const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const versions = require('../versions/platformVersions');
const global = require('../../../global');
const _ = require("underscore");
const Session = require('../../../models/sessions')
const { sendSessionToHistoryQueue } = require('../../../functions/sendSessionToHistoryQueue')
const ObjectId = require('mongoose').Types.ObjectId;
const vatService = require('../../../services/vat')
const Sentry = require("@sentry/node");
const { Enums } = require('evio-library-commons').default;
const { TariffsService } = require('evio-library-ocpi');
const { getAllUserInfo, getEmspTariffWithIdTag } = require('evio-library-identity').default;

// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const moment = require('moment');
const Utils = require('../../../utils');
const parseLink = require('parse-link-header');



let platformSessionsEndpoint = "";
let task = null;
let mobieToken = "";


function initJob() {
    return new Promise((resolve, reject) => {
        versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {

            //get Mobie Details
            const platformDetails = platform.platformDetails;

            //Get Mobie Endpoint to 2.2 OCPI versions
            const platformDetails22 = _.where(platformDetails, { version: "2.2" });
            const platformEndpoints22 = platformDetails22[0].endpoints

            const platformSessionssEndpointObject = _.where(platformEndpoints22, { identifier: "sessions", role: "SENDER" });
            if (platformSessionssEndpointObject === undefined || platformSessionssEndpointObject.length == 0) {
                reject("Platform does not allow sessions module");
                return;
            }
            platformSessionsEndpoint = platformSessionssEndpointObject[0].url;

            const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
            mobieToken = platformActiveCredentials[0].token;

            console.log("Sessions Job Init - sessionsScheduleTimeCronJob: ", platform.sessionsScheduleTimeCronJob);

            task = cron.schedule(platform.sessionsScheduleTimeCronJob, () => {

                let date = new Date();
                // Just in case the value is not in the DB yet, I validate its existence. (Fetching the last 24 hours by default)
                let fetchPastHours = platform.sessionsFetchPastHours !== null && platform.sessionsFetchPastHours !== undefined ? platform.sessionsFetchPastHours : 24
                date.setHours(date.getHours() - fetchPastHours);

                //Transform date object to string
                date = date.toISOString()

                console.log('Running Sessions Job ' + date);

                processSessions(date);
            }, {
                scheduled: false
            });
            resolve();
        });
    });
};

const processSessions = (async(date_from) => {
    const endpoint = platformSessionsEndpoint;
    getSessions(endpoint, mobieToken, date_from, false).then((result) => {
        if (result.error == true)
            console.log("Sessions not processed. Error: " + result.message);
        else
            console.log("Sessions processed: " + result.sessionsCount + ". New Sessions: " + result.newSessions);
    })
});

async function getSessions(originalEndpoint, token, date_from, isToSaveAllSessions) {

    let originalHost = originalEndpoint;
    let host = "";
    let offset = 0;
    let totalCount = 10;

    if (date_from != "")
        host = originalHost + "?date_from=" + date_from + "&offset=" + offset + "&limit=10";
    else
        host = originalHost + "?offset=" + offset + "&limit=10";;

    let sessionsCount = 0;
    let newSessions = 0;
    let result;

    while (offset < totalCount) {

        result = await new Promise((resolve, reject) => {
            asyncCall(host, offset, totalCount, date_from, originalHost, token, sessionsCount, resolve, newSessions, isToSaveAllSessions);
        });

        offset = result.offset;
        totalCount = result.totalCount;
        sessionsCount = result.sessionsCount;
        host = result.host;
        newSessions = result.newSessions;
        console.log(JSON.stringify(result));
    }

    return result;
}

async function asyncCall(host, offset, totalCount, date_from, originalHost, token, sessionsCount, resolve, newSessions, isToSaveAllSessions) {

    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then(async (result) => {

        const x_total_count = result.headers["x-total-count"];
        if (x_total_count != 0)
            totalCount = x_total_count;

        const x_limit = result.headers["x-limit"]
        const link = result.headers["link"]
        const parsedLink = parseLink(link)

        //offset = Number(offset) + 1;
        offset = Number(offset) + Number(x_limit);

        if (result) {
            if (result.data) {
                if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {
                    sessionsCount += result.data.data.length;

                    for (let i = 0; i < result.data.data.length; i++) {
                        let session = result.data.data[i];

                        //WARNING - In this case, we just want to save all sessions to no production environment, for statistics purposes
                        if (isToSaveAllSessions) {
                            const res = await processSession(session.id, session, isToSaveAllSessions);
                            if (res)
                                newSessions += 1;
                        }
                        else {
                            //Validating if session is about EVIO
                            if (session.cdr_token) {
                                if (session.cdr_token.contract_id.includes('PT-EVI-')) {
                                    console.log("Job Session Recover: ", session.id);
                                    var res = await processSession(session.id, session, isToSaveAllSessions);
                                    if (res)
                                        newSessions += 1;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (date_from != "")
            host = originalHost + "?date_from=" + date_from + "&offset=" + offset + "&limit=10";
        else
            host = originalHost + "?offset=" + offset + "&limit=10";

        console.log("parsedLink" , JSON.stringify(parsedLink))
        if (parsedLink) {
            host = parsedLink?.next?.url
            offset = Number(parsedLink?.next?.offset) || sessionsCount
        }
        resolve({ offset: offset, totalCount: totalCount, sessionsCount: sessionsCount, host: host, newSessions: newSessions })

    }).catch((e) => {
        console.log(e);
        //offset = Number(offset) - Number(10);
        //resolve({ offset: offset, totalCount: totalCount, sessionsCount: sessionsCount, host: host, newSessions: newSessions })
        resolve({ offset: offset, totalCount: -1, sessionsCount: sessionsCount, error: true, message: e.message, newSessions: newSessions })
    });
}

async function processSession(sessionId, data, isToSaveAllSessions) {
    const context = "2.2 session job - processSession"
    return new Promise(async (resolve, reject) => {
        try {
            const sessionToStartStatuses = [
                Enums.SessionStatusesTextTypes.PENDING_START, 
                Enums.SessionStatusesTextTypes.PENDING,
                Enums.SessionStatusesTextTypes.PENDING_DELAY
            ];
            let query;
            let idTag = "";
            if (data.cdr_token !== undefined && data.cdr_token !== null) {
                idTag = data.cdr_token.uid;
                data.token_uid = idTag
            } else {
                idTag = data.token_uid;
            }
            if (data.status === global.SessionStatusRunning || sessionToStartStatuses.includes(data.status)) {
                query = {
                    "$or": [
                        { id: sessionId },
                        {
                            "$and": [
                                { location_id: data.location_id },
                                { evse_uid: data.evse_uid },
                                { token_uid: idTag },
                                { status: {$in: sessionToStartStatuses} }
                            ]
                        }
                    ]
                };
            } else if (data.authorization_reference !== null && data.authorization_reference !== undefined) {
                query = {
                    "$or": [
                        { id: sessionId },
                        { authorization_reference: data.authorization_reference }
                    ]
                };
            } else {
                query = {
                    id: sessionId
                }
            }

            Utils.chargingSessionFindOne(query).then(async (session) => {
                if (Utils.isEmptyObject(session)) {
                    if (data.cdr_token) {
                        if (!(data.cdr_token.type !== "RFID" && data.status === global.SessionStatusFailed)) {
                            if (data.connector_id !== null && data.connector_id !== undefined) {
                                //If is to save all sessions, is only for statistics purposes. So, nothing else matters, other than session info
                                if (isToSaveAllSessions) {
                                    const new_session = new Session(data);
                                    new_session.createdWay = "JOB_SESSION"
                                    Session.create(new_session, (err, result) => {

                                        if (result) {
                                            console.log("Session " + sessionId + " created ");
                                            resolve(true);
                                        } else {
                                            console.log("Session " + sessionId + " not created ", err);
                                            resolve(false);
                                        }
                                    })
                                }
                                else {
                                    //Otherwise, we need to process session is is a new handler session arriving
                                    const new_session = await setSession(data);
                                    new_session.createdWay = "JOB_SESSION"
                                    // console.log("new_session", new_session);
                                    Session.create(new_session, (err, result) => {
                                        if (result) {
                                            resolve(true);
                                        } else {
                                            console.log("Session not created ", err);
                                            resolve(false);
                                        }
                                    })

                                }
                            } else {
                                console.log("Session " + data.id + " without plugId");
                                resolve(false)
                            }
                        } else {
                            console.log("Session " + data.id + " is invalid and not RFID");
                            resolve(false)
                        }
                    } else {
                        console.log("Session " + data.id + " without cdr_token");
                        resolve(false)
                    }
                }
                else {
                    console.log("Session " + sessionId + " not created - Session already exists");
                    if (session.cdrId == "-1" &&
                        (session.status !== global.SessionStatusFailed || (session.status === global.SessionStatusFailed && !sessionToStartStatuses.includes(session.status))) &&
                        session.status !== global.SessionStatusStopped && session.status !== global.SessionStatusExpired &&
                        !(session.status === global.SessionStatusRunning && sessionToStartStatuses.includes(session.status))
                    ) {
                        // if ( !(session.status === global.SessionStatusToStop && data.status !== global.SessionStatusStopped)) {
                        Session.updateSession(query, { $set: data }, async (err, doc) => {
                            if (doc != null) {
                                if (data.status === 'COMPLETED') {
                                    Utils.updateStopSessionMeterValues(doc)
                                    sendSessionToHistoryQueue(doc?._id, context)
                                } else {
                                    Utils.updateMeterValues(doc, data, false)
                                }
                            }
                        })
                        // }
                    }
                    resolve(false);
                }
            });
        }
        catch (e) {
            console.log("[sessionsJob.processSession] Generic client error. ", e);
            Sentry.captureException(e);
            resolve();
        }
    });
}

async function setSession(data) {
    return new Promise(async (resolve, reject) => {

        let idTag = "";
        if (data.cdr_token !== undefined && data.cdr_token !== null) {
            idTag = data.cdr_token.uid;
            data.token_uid = idTag
        } else {
            idTag = data.token_uid;
        }

        const tokenUid = await Utils.getUserId(idTag);
        const result = await Utils.getCharger(data.location_id, data.connector_id);

        let evOwner = "-1";
        let evId = "-1";
        let invoiceType = "-1"
        let invoiceCommunication = "-1"
        let evDetails,fleetDetails
        let userId = "Unknown"

        if (tokenUid) {
            //evOwner = tokenUid.evId != "-1" ? await Utils.getEVByEvId(tokenUid.evId) : "-1"
            evId = tokenUid.evId;
            userId = tokenUid.userId
            if (tokenUid.evId != "-1") {
                const evInfo = await Utils.getEvInfo(evId, userId)
                evOwner = evInfo?.evOwner;
                invoiceType = evInfo?.invoiceType;
                invoiceCommunication = evInfo?.invoiceCommunication;
                evDetails = evInfo?.evDetails;
                fleetDetails = evInfo?.fleetDetails;
                userId = evInfo?.userId;
            }
        }


        let fees = { IEC: 0.001, IVA: 0.23 }
        let voltageLevel = "BTN";
        let address = ""
        let cpoCountryCode = ""
        let geometry = {}
        let timeZone = ""
        if (result) {
            var plug = result.plug;
            fees = await vatService.getFees(result.charger)
            voltageLevel = result.charger.voltageLevel;
            address = result.charger.address
            cpoCountryCode = result.charger.cpoCountryCode
            geometry = result.charger.geometry
            timeZone = result.charger.timeZone
            if (!timeZone) {
                let { latitude, longitude } = Utils.getChargerLatitudeLongitude(geometry)
                timeZone = Utils.getTimezone(latitude, longitude)
            }
        }
        else
            fees = { IEC: 0.001, IVA: 0.23 }

        let plugId = "";
        let tariffId;
        let plugPower = 22
        let plugVoltage = 400
        if (plug) {
            tariffId = plug.tariffId[0];
            plugId = plug.plugId;
            plugPower = plug.power
            plugVoltage = plug.voltage
        }

        const tariffOPC = await TariffsService.getOcpiCpoTariff(
            result?.charger,
            plug?.serviceCost?.tariffs,
            '',
            result?.charger?.geometry?.coordinates?.[1],
            result?.charger?.geometry?.coordinates?.[0],
            plug?.power,
            userId,
            evOwner
        ) ?? await Utils.getDefaultOPCTariff();
        // var tariffCEME = await Utils.getTariffCEME("EVIO");

        let new_session = new Session(data);
        new_session.source = "MobiE";
        new_session.evId = evId;
        if (invoiceType != "-1")
            new_session.invoiceType = invoiceType
        if (invoiceCommunication != "-1")
            new_session.invoiceCommunication = invoiceCommunication
        new_session.evOwner = evOwner
        new_session.evDetails = evDetails
        new_session.fleetDetails = fleetDetails
        new_session.userId = userId
        new_session.tariffOPC = tariffOPC;
        new_session.chargerType = process.env.chargerTypeMobie
        // new_session.tariffCEME = tariffCEME;
        new_session.voltageLevel = voltageLevel;
        new_session.address = address;
        new_session.cpoCountryCode = cpoCountryCode;
        new_session.fees = fees;
        new_session.cdrId = "-1"
        new_session.plugPower = plugPower
        new_session.plugVoltage = plugVoltage
        if (data.authorization_reference === null || typeof data.authorization_reference === 'undefined') {
            new_session.authorization_reference = Utils.generateToken(24);
        }
        // new_session.authorization_reference = authorization_reference;

        //Get Conditions Payment
        const paymentConditionsInit = {
            paymentType: "AD_HOC",
            paymentMethod: "Unknown",
            paymentMethodId: "-1",
            walletAmount: -1,
            reservedAmount: -1,
            confirmationAmount: -1,
            userIdWillPay: "Unknown",
            userIdToBilling: "Unknown",
            adyenReference: "-1",
            transactionId: "-1",
            clientType: "b2b",
            clientName: "EVIO"
        };

        let paymentConditions = {};

        let userIdWillPay = ""
        let userIdToBilling = ""

        if (tokenUid) {
            const idTagToPaymentCondition = await Utils.verifyFlagIsActiveToSendIdTagToPaymentConditions(idTag)
            paymentConditions = await Utils.getPaymentConditions(new_session.userId, evId, data.location_id, plugId, process.env.chargerTypeMobie, fees, idTagToPaymentCondition).catch((e) => {
                console.log("Get payment conditions failed. Reason ", e)
                new_session.notes = "Get payment conditions failed - " + JSON.stringify(e.message)
                userIdWillPay = e.userIdWillPay ? e.userIdWillPay : ""
                userIdToBilling = e.userIdToBilling ? e.userIdToBilling : ""
            });

            if (!paymentConditions) {
                if (userIdWillPay && userIdToBilling) {
                    paymentConditionsInit.userIdWillPay = userIdWillPay;
                    paymentConditionsInit.userIdToBilling = userIdToBilling;
                } else {
                    let evValidation = await Utils.validateEV(evId, new_session.userId, new_session.evDetails)
                    if (evValidation.userIdWillPay && evValidation.userIdToBilling) {
                        paymentConditionsInit.userIdWillPay = evValidation.userIdWillPay
                        paymentConditionsInit.userIdToBilling = evValidation.userIdToBilling
                    } else {
                        paymentConditionsInit.userIdWillPay = new_session.userId;
                        paymentConditionsInit.userIdToBilling = new_session.userId;
                    }

                }

                let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await getAllUserInfo({userId, userIdWillPay: paymentConditionsInit.userIdWillPay, userIdToBilling: paymentConditionsInit.userIdToBilling})
                new_session.userIdInfo = userIdInfo
                new_session.userIdWillPayInfo = userIdWillPayInfo
                new_session.userIdToBillingInfo = userIdToBillingInfo
                // let userInfo = await Utils.getUserInfo(paymentConditionsInit.userIdWillPay)
                if (userIdWillPayInfo) {
                    paymentConditionsInit.clientType = userIdWillPayInfo?.clientType
                    paymentConditionsInit.clientName = userIdWillPayInfo?.clientName
                    paymentConditionsInit.paymentType = userIdWillPayInfo?.paymentPeriod ?? "AD_HOC"
                }
                paymentConditions = paymentConditionsInit;
            } else {
                let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await getAllUserInfo({userId, userIdWillPay: paymentConditions.userIdWillPay, userIdToBilling: paymentConditions.userIdToBilling})
                new_session.userIdInfo = userIdInfo
                new_session.userIdWillPayInfo = userIdWillPayInfo
                new_session.userIdToBillingInfo = userIdToBillingInfo
            }
        }
        else {
            paymentConditions = paymentConditionsInit;
            new_session.userId = "Unknown";
        }

        new_session.operator = data.party_id;
        new_session.chargeOwnerId = data.party_id;

        //Check if payment will be done at the end of charging session or end of the month. if user is b2c, he MUST to pay at the end of session, if user is b2b ,monthly.
        if (paymentConditions.clientType) {
            new_session.paymentType = paymentConditions.paymentType;
        }
        else {
            new_session.paymentType = paymentConditionsInit.paymentType;
        }

        if (paymentConditions.clientName) {
            new_session.clientName = paymentConditions.clientName;
        } else {
            new_session.clientName = paymentConditionsInit.clientName;
        }

        if (paymentConditions.cardNumber) {
            new_session.cardNumber = paymentConditions.cardNumber;
        }

        // Check if tariffCEME is sent
        /*
            When charging in MobiE, paymentConditions.ceme is an object with the keys plan,schedule and tar
        */
        let tariffCEME = ""
        if (paymentConditions.ceme) {
            if (!Utils.isEmptyObject(paymentConditions.ceme.plan)) {
                // new_session.tariffCEME = paymentConditions.ceme.plan
                tariffCEME = paymentConditions.ceme.plan
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
                tariffCEME.tariff = tariffArray
                new_session.tariffCEME = tariffCEME
            } else {
                // new_session.tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Mobie);
                if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
                tariffCEME.tariff = tariffArray
                new_session.tariffCEME = tariffCEME
            }
        } else {
            //Default value for now
            // new_session.tariffCEME = await Utils.getTariffCEME(new_session.clientName);
            tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Mobie);
            if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
            let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
            tariffCEME.tariff = tariffArray
            new_session.tariffCEME = tariffCEME
        }

        // GET TAR AND SCHEDULES
        let { tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(tariffCEME._id, timeZone, "MobiE", new_session.clientName)

        new_session.schedulesCEME = TAR_Schedule
        new_session.tariffTAR = tariffTAR
        new_session.timeZone = timeZone

        if (paymentConditions.billingPeriod) {
            new_session.billingPeriod = paymentConditions.billingPeriod;
        } else {
            new_session.billingPeriod = new_session?.userIdToBillingInfo?.billingPeriod
        }

        new_session.paymentMethod = paymentConditions.paymentMethod;
        new_session.paymentMethodId = paymentConditions.paymentMethodId;
        new_session.walletAmount = paymentConditions.walletAmount;
        new_session.reservedAmount = paymentConditions.reservedAmount;
        new_session.confirmationAmount = paymentConditions.confirmationAmount;
        new_session.plafondId = paymentConditions.plafondId;

        new_session.viesVAT = paymentConditions.viesVAT

        if (paymentConditions.userIdWillPay)
            new_session.userIdWillPay = paymentConditions.userIdWillPay;
        else
            new_session.userIdWillPay = paymentConditionsInit.userIdWillPay;

        if (paymentConditions.userIdToBilling)
            new_session.userIdToBilling = paymentConditions.userIdToBilling;
        else
            new_session.userIdToBilling = paymentConditionsInit.userIdToBilling;

        new_session.adyenReference = paymentConditions.adyenReference;
        new_session.transactionId = paymentConditions.transactionId;
        new_session.paymentStatus = "UNPAID"

        if (evDetails) {
            if (evDetails.acceptKMs) new_session.acceptKMs = evDetails.acceptKMs
            if (evDetails.updateKMs) new_session.updateKMs = evDetails.updateKMs
        }

        if (result)
            new_session.fees = await vatService.getFees(result.charger, new_session.userIdToBilling)
        resolve(new_session);
    });
}

router.post('/startJob', (req, res) => {
    initJob().then(() => {
        task.start();
        console.log("Sessions Job Started")
        return res.status(200).send('Sessions Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/stopJob', (req, res) => {
    task.stop();
    console.log("Sessions Job Stopped")
    return res.status(200).send('Sessions Job Stopped');
});

router.post('/statusJob', (req, res) => {
    var status = "Stopped";
    if (task != undefined) {
        status = task.status;
    }

    return res.status(200).send({ "Sessions Job Status": status });
});

router.post('/forceJobProcess', (req, res) => {
    versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {

        //get Mobie Details
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
        const platformEndpoints22 = platformDetails22[0].endpoints

        const platformSessionsEndpointObject = _.where(platformEndpoints22, { identifier: "sessions", role: "SENDER" });
        if (platformSessionsEndpointObject === undefined || platformSessionsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'sessions_update_error', message: "Platform does not allow sessions module" });
        }
        platformSessionsEndpoint = platformSessionsEndpointObject[0].url;

        const date_from = "";
        const isToSaveAllSessions = false;
        const endpoint = platformSessionsEndpoint;
        const data = req.body;
        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;

                if (data.isToSaveAllSessions)
                    isToSaveAllSessions = data.isToSaveAllSessions;
            }
        }

        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
        const mobieToken = platformActiveCredentials[0].token;

        getSessions(endpoint, mobieToken, date_from, isToSaveAllSessions).then((result) => {
            console.log(result)
            if (result == true)
                return res.status(400).send({ code: 'sessions_update_error', message: "Sessions update error: " + result.message });
            else
                return res.status(200).send({ code: 'sessions_update_success', message: "Sessions processed: " + result.sessionsCount + ". New Sessions: " + result.newSessions });
        })
    });
});

function initJobExpiredSessions() {
    return new Promise((resolve, reject) => {
        versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {

            //get Mobie Details
            const platformDetails = platform.platformDetails;

            //Get Mobie Endpoint to 2.2 OCPI versions
            const platformDetails22 = _.where(platformDetails, { version: "2.2" });
            const platformEndpoints22 = platformDetails22[0].endpoints

            const platformSessionssEndpointObject = _.where(platformEndpoints22, { identifier: "sessions", role: "SENDER" });
            if (platformSessionssEndpointObject === undefined || platformSessionssEndpointObject.length == 0) {
                reject("Platform does not allow sessions module");
                return;
            }
            platformSessionsEndpoint = platformSessionssEndpointObject[0].url;

            const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
            mobieToken = platformActiveCredentials[0].token;

            console.log("Expired Sessions Job Init - initJobExpiredSessions: ", "0 2 * * *");
            let lastHours = platform.expiredSessionsLastHours > 0 ? platform.expiredSessionsLastHours : 72
            task = cron.schedule("0 2 * * *", () => {
                updateSessionsToExpired(lastHours)
            }, {
                scheduled: false
            });
            resolve();
        });
    });
};

async function updateSessionsToExpired(lastHours) {
    const context = "Function updateSessionsToExpired"
    try {
        console.log("Querying sessions in the last " + lastHours + " hours")
        let currentDate = new Date().toISOString();
        let expiringLimitDate = moment.utc(currentDate).add(-lastHours, "hours").format()
        let query = {
            $or: [
                {
                    $and: [
                        { source: global.mobiePlatformCode },
                        { status: global.SessionStatusStopped },
                        {
                            $or: [
                                { cdrId: { "$exists": true, "$eq": "" } },
                                { cdrId: { "$exists": true, "$eq": "NA" } },
                                { cdrId: { "$exists": true, "$eq": "-1" } },
                                { cdrId: { "$exists": false } }
                            ]
                        },
                        {
                            $or: [
                                {
                                    $and: [
                                        { start_date_time: { "$exists": true } },
                                        { start_date_time: { $lte: expiringLimitDate } }
                                    ]
                                },
                                {
                                    $and: [
                                        { start_date_time: { "$exists": false } },
                                        { createdAt: { $lte: new Date(expiringLimitDate) } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    $and: [
                        { source: global.mobiePlatformCode },
                        { status: global.SessionStatusRunning },
                        {
                            $or: [
                                {
                                    $and: [
                                        { start_date_time: { "$exists": true } },
                                        { start_date_time: { $lte: expiringLimitDate } }
                                    ]
                                },
                                {
                                    $and: [
                                        { start_date_time: { "$exists": false } },
                                        { createdAt: { $lte: new Date(expiringLimitDate) } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    $and: [
                        { source: global.hubjectPlatformCode },
                        { status: global.SessionStatusRunning },
                        {
                            $or: [
                                {
                                    $and: [
                                        { start_date_time: { "$exists": true } },
                                        { start_date_time: { $lte: expiringLimitDate } }
                                    ]
                                },
                                {
                                    $and: [
                                        { start_date_time: { "$exists": false } },
                                        { createdAt: { $lte: new Date(expiringLimitDate) } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    $and: [
                        { source: global.mobiePlatformCode },
                        { status: global.SessionStatusToStop },
                        {
                            $or: [
                                {
                                    $and: [
                                        { start_date_time: { "$exists": true } },
                                        { start_date_time: { $lte: expiringLimitDate } }
                                    ]
                                },
                                {
                                    $and: [
                                        { start_date_time: { "$exists": false } },
                                        { createdAt: { $lte: new Date(expiringLimitDate) } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    $and: [
                        { source: global.hubjectPlatformCode },
                        { status: global.SessionStatusToStop },
                        {
                            $or: [
                                {
                                    $and: [
                                        { start_date_time: { "$exists": true } },
                                        { start_date_time: { $lte: expiringLimitDate } }
                                    ]
                                },
                                {
                                    $and: [
                                        { start_date_time: { "$exists": false } },
                                        { createdAt: { $lte: new Date(expiringLimitDate) } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
            ]
        }

        let fields = {
            _id: 1
        }
        let sessionsToExpire = await Session.find(query, fields).lean()
        if(sessionsToExpire.length) {
            await Session.updateMany({_id:{"$in": sessionsToExpire.map(session => ( new ObjectId(session._id)))}}, {status: global.SessionStatusExpired})
            sessionsToExpire.forEach(session => sendSessionToHistoryQueue(session._id, `${context} - updateMany`))
        }
        return sessionsToExpire
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return [];
    }
}

router.post('/expiredSessionsForceJobProcess', async (req, res) => {
    let lastHours = req.body.lastHours > 0 ? req.body.lastHours : 72
    const sessionsExpired = await updateSessionsToExpired(lastHours)

    return res.status(200).send(sessionsExpired);
});
router.post('/expiredSessionsStartJob', (req, res) => {
    initJobExpiredSessions().then(() => {
        task.start();
        console.log("expiredSessions Job Started")
        return res.status(200).send('expiredSessions Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/startCronJob', async (req, res) => {
    try {
        console.log("\nOCPI - 2.2 - Session Job Started from EKS\n")

        const platform = await versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode)

        //get Mobie Details
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
        const platformEndpoints22 = platformDetails22[0]?.endpoints

        const platformSessionssEndpointObject = _.where(platformEndpoints22, { identifier: "sessions", role: "SENDER" });
        if (platformSessionssEndpointObject === undefined || platformSessionssEndpointObject.length == 0) {
            return res.status(400).send({ code: 'session_update_error', message: "Platform does not allow sessions module"});
        }
        platformSessionsEndpoint = platformSessionssEndpointObject[0].url;

        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
        mobieToken = platformActiveCredentials[0].token;

        console.log("Sessions Job Init - sessionsScheduleTimeCronJob: ", platform.sessionsScheduleTimeCronJob);

        let date = new Date();
        // Just in case the value is not in the DB yet, I validate its existence. (Fetching the last 24 hours by default)
        let fetchPastHours = platform.sessionsFetchPastHours !== null && platform.sessionsFetchPastHours !== undefined ? platform.sessionsFetchPastHours : 24
        date.setHours(date.getHours() - fetchPastHours);

        //Transform date object to string
        date = date.toISOString()

        console.log('Running Sessions Job ' + date);

        await processSessions(date);
        return res.status(200).send({ "Session Job Status": "Started" });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(400).send({ code: 'session_update_error', message: "Session update error: " + error.message });
    }
});

module.exports = router;
