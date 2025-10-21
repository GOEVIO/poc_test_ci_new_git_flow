const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
var versions = require('../versions/platformVersions');
var details = require('../details/platformDetails');
const global = require('../../../global');
var _ = require("underscore");
const Session = require('../../../models/sessions')
const Platform = require('../../../models/platforms');
const { sendSessionToHistoryQueue } = require('../../../functions/sendSessionToHistoryQueue')
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
var moment = require('moment');
const Utils = require('../../../utils');
const toggle = require('evio-toggle').default

var platformSessionsEndpoint = "";
var task = null;
var platformToken = "";
var platformCode = "";


function initJob(req) {
    return new Promise((resolve, reject) => {
        let ocpiVersion = "2.1.1"
        platformCode = "Gireve"

        versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

            //get Details
            var platformDetails = platform.platformDetails;

            //Get Endpoint to 2.1.1 OCPI versions
            var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
            var platformEndpoints22 = platformDetails22[0].endpoints
            var platformSessionssEndpointObject = _.where(platformEndpoints22, { identifier: "sessions" });


            if (platformSessionssEndpointObject === undefined || platformSessionssEndpointObject.length == 0) {
                reject("Platform does not allow sessions module");
                return;
            }
            platformSessionsEndpoint = platformSessionssEndpointObject[0].url;

            var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
            platformToken = platformActiveCredentials[0].token;

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

const processSessions = (async (date_from) => {

    var endpoint = platformSessionsEndpoint;
    versions.getPlatformVersionsByPlatformCode(platformCode)
        .then(async platform => {
            if (platform.sessionsLastRequestDate !== undefined) {
                var date_from = platform.sessionsLastRequestDate;
                var date_to = new Date().toISOString();
                var result = await getSessions(endpoint, platformToken, date_from, date_to, false);
                if (!result.error) {
                    Platform.updatePlatform({ platformCode }, { sessionsLastRequestDate: date_to }, (err, result) => {
                        if (err) {
                            console.error(`[updatePlatform] Error `, err);
                        }
                        else {
                            console.log("Updated sessionsLastRequestDate! - " + date_to)
                        };
                    });
                }
            } else {
                var date_from = new Date();
                date_from.setHours(date_from.getHours() - 24);

                //Transform date_from object to string
                date_from = date_from.toISOString()
                var date_to = new Date().toISOString();
                var result = await getSessions(endpoint, platformToken, date_from, date_to, false);
                if (!result.error) {
                    Platform.updatePlatform({ platformCode }, { sessionsLastRequestDate: date_to }, (err, result) => {
                        if (err) {
                            console.error(`[updatePlatform] Error `, err);
                        }
                        else {
                            console.log("Updated sessionsLastRequestDate! - " + date_to)
                        };
                    });
                }
            }
        })
        .catch(async error => {
            console.log(error.message)
        })

});

async function getSessions(originalEndpoint, token, date_from, date_to, isToSaveAllSessions) {

    let originalHost = originalEndpoint;
    var host = "";
    var token = token;
    var offset = 0;
    var totalCount = 10;

    var date_from = date_from;

    if (date_from != "")
        host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=10";
    else
        host = originalHost + "?offset=" + offset + "&limit=10";;

    var sessionsCount = 0;
    var newSessions = 0;
    var result;

    while (offset < totalCount) {

        result = await new Promise((resolve, reject) => {
            asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, sessionsCount, resolve, newSessions, isToSaveAllSessions);
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

async function asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, sessionsCount, resolve, newSessions, isToSaveAllSessions) {

    console.log("host", host)

    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then(async (result) => {

        var x_total_count = result.headers["x-total-count"];
        console.log("x_total_count", x_total_count);
        if (x_total_count != 0 && x_total_count !== null && x_total_count !== undefined) {
            totalCount = x_total_count;
        }
        else {
            totalCount = 0
        }
        var x_limit = result.headers["x-limit"]
        if (x_limit != 0 && x_limit !== null && x_limit !== undefined) {
            offset = Number(offset) + Number(x_limit);
        } else {
            x_limit = 0
        }
        //offset = Number(offset) + 1;

        if (result) {

            if (result.data) {

                if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {

                    sessionsCount += result.data.data.length;

                    for (let i = 0; i < result.data.data.length; i++) {
                        let session = result.data.data[i];

                        //WARNING - In this case, we just want to save all sessions to no production environment, for statistics purposes
                        session = Utils.getSessionModelObj(session)
                        if (isToSaveAllSessions) {
                            var res = await processSession(session.id, session, isToSaveAllSessions);
                            if (res)
                                newSessions += 1;
                        }
                        else {

                            //Validating if session is about EVIO
                            if (session.contract_id.includes('PT-EVI-')) {
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

        if (date_from != "")
            host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + Number(x_limit);
        else
            host = originalHost + "?offset=" + offset + "&limit=" + Number(x_limit);

        resolve({ offset: offset, totalCount: totalCount, sessionsCount: sessionsCount, host: host, newSessions: newSessions })

    }).catch((e) => {
        console.log("[SessionsJob]", e.message);
        //offset = Number(offset) - Number(10);
        //resolve({ offset: offset, totalCount: totalCount, sessionsCount: sessionsCount, host: host, newSessions: newSessions })
        resolve({ offset: offset, totalCount: -1, sessionsCount: sessionsCount, error: true, message: e.message, newSessions: newSessions })
    });
    // });
}

async function processSession(sessionId, data, isToSaveAllSessions) {
    const context = "2.1.1 session job processSession";
    return new Promise(async (resolve, reject) => {
        const sessionToStartStatuses = [
            Enums.SessionStatusesTextTypes.PENDING_START, 
            Enums.SessionStatusesTextTypes.PENDING,
            Enums.SessionStatusesTextTypes.PENDING_DELAY
        ];

        try {

            let query;

            if (data.status === global.SessionStatusRunning || sessionToStartStatuses.includes(data.status)) {
                query = {
                    "$or": [
                        { id: sessionId },
                        {
                            "$and": [
                                { location_id: data.location_id },
                                { evse_uid: data.evse_uid },
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
                //Session.find(query, (err, session) => {

                if (Utils.isEmptyObject(session)) {

                    var tokenUid = await Utils.getUserIdToken(data.contract_id);

                    if (tokenUid) {

                        if (!(tokenUid.type !== "RFID" && data.status === global.SessionStatusFailed)) {
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

                                var new_session = await setSession(data);
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
                            console.log("Session " + data.id + " is invalid and not RFID");
                            resolve(false)
                        }
                    } else {
                        console.log("Session " + data.id + " without contract_id");
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
                                if (data.status === "COMPLETED") {
                                    Utils.updateSessionStopMeterValuesRoaming(doc)
                                    sendSessionToHistoryQueue(doc._id, context)
                                } else {
                                    Utils.updateSessionMeterValuesRoaming(doc, data, false)
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
            resolve();
        }

    });
}

async function setSession(data) {

    return new Promise(async (resolve, reject) => {

        // TODO: We don't receive the uid, so we're fetching the token with the contract_id. Is it always RFID here?
        var tokenUid = await Utils.getUserIdToken(data.contract_id);
        var result = await Utils.getCharger(data.location_id, data.connector_id);
        let evOwner = "-1"
        let evId = "-1"
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

        var fees = { IEC: 0.001, IVA: 0.23 }
        let timeZone = ""
        let address = ""
        let cpoCountryCode = ""

        let countryCode = ""
        let partyId = ""
        let source = ""
        let evseGroup = ""
        let geometry = {}

        if (result) {
            var plug = result.plug;
            fees = await vatService.getFees(result.charger)
            timeZone = result.charger.timeZone;
            address = result.charger.address
            cpoCountryCode = result.charger.cpoCountryCode
            countryCode = result.charger.countryCode
            partyId = result.charger.partyId
            source = result.charger.source
            geometry = result.charger.geometry
            if (!timeZone) {
                let { latitude, longitude } = Utils.getChargerLatitudeLongitude(geometry)
                timeZone = Utils.getTimezone(latitude, longitude)
            }
            // evseGroup = result.charger.evseGroup
        }
        else
            fees = { IEC: 0.001, IVA: 0.23 }

        var plugId = "";
        var tariffId;
        let plugPower = 22
        let plugVoltage = 400
        if (plug) {
            tariffId = plug.tariffId[0];
            plugId = plug.plugId;
            evseGroup = plug.evseGroup
            plugPower = plug.power
            plugVoltage = plug.voltage
        }
        var tariffOPC = await TariffsService.getOcpiCpoTariff(
            result?.charger,
            plug?.serviceCost?.tariffs,
            '',
            result?.charger?.geometry?.coordinates?.[1],
            result?.charger?.geometry?.coordinates?.[0],
            plug?.power,
            userId,
            evOwner
        ) ?? await Utils.getDefaultOPCTariff();
        // let currency = tariffOPC.currency ? tariffOPC.currency : "EUR"

        // let roamingPlanParams = {
        //     country: countryCode,
        //     region: countryCode,
        //     partyId: partyId,
        //     roamingType: source,
        //     evseGroup: evseGroup
        // }
        // var currency = "EUR"
        // let roamingPlanCpo = await Utils.getRoamingPlanTariff(roamingPlanParams)
        // if (roamingPlanCpo.tariff) {
        //     currency = roamingPlanCpo.currency
        //     tariffOPC = Utils.createTariffOPCWithRoamingPlan(roamingPlanCpo)
        // }
        // var tariffCEME = await Utils.getTariffCEME("EVIO");

        /* 
            I was saying that country code was the CPO country code, but I think a CPO can have chargers in multiple countries, right? 
            That being said, it's better to use the chargers country code
        
        */
        data.country_code = countryCode
        let chargerType = Utils.getChargerTypeByPlatformCode(platformCode)
        const new_session = new Session(data);
        new_session.source = platformCode;
        new_session.chargerType = chargerType
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
        // new_session.tariffCEME = tariffCEME;
        new_session.timeZone = timeZone;
        new_session.address = address;
        new_session.cpoCountryCode = cpoCountryCode;
        new_session.fees = fees;
        new_session.cdrId = "-1"
        // new_session.currency = currency
        new_session.plugPower = plugPower
        new_session.plugVoltage = plugVoltage
        if (data.authorization_reference === null || typeof data.authorization_reference === 'undefined') {
            var authorization_reference = Utils.generateToken(24);
            new_session.authorization_reference = authorization_reference;
        }

        if (tokenUid) {
            new_session.token_uid = tokenUid.uid
            new_session.token_type = tokenUid.type
            new_session.cdr_token = {
                uid: tokenUid.uid,
                type: tokenUid.type,
                contract_id: tokenUid.contract_id,
            }
        } else {
            new_session.token_uid = "Unknown"
            new_session.token_type = "Unknown"
            new_session.cdr_token = {
                uid: "Unknown",
                type: "Unknown",
                contract_id: data.contract_id,
            }
        }


        //Get Conditions Payment
        var paymentConditionsInit = {
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

        var paymentConditions = {};

        let userIdWillPay = ""
        let userIdToBilling = ""

        if (tokenUid) {
            const idTagToPaymentCondition = await Utils.verifyFlagIsActiveToSendIdTagToPaymentConditions(new_session?.token_uid)
            paymentConditions = await Utils.getPaymentConditions(new_session.userId, evId, data.location_id, plugId, chargerType, fees, idTagToPaymentCondition).catch((e) => {
                console.log("Get payment conditions failed. Reason ", e)
                new_session.notes = "Get payment conditions failed - " + JSON.stringify(e.message)
                userIdWillPay = e.userIdWillPay ? e.userIdWillPay : ""
                userIdToBilling = e.userIdToBilling ? e.userIdToBilling : ""
            });

            // new_session.userId = tokenUid.userId;

            if (!paymentConditions) {
                // let userInfo = await Utils.getUserInfo(new_session.userId)
                // if (userInfo) {
                //     paymentConditionsInit.clientType = userInfo.clientType
                //     paymentConditionsInit.clientName = userInfo.clientName
                // }

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

        // if (evId != "-1") {
        //     var obj = await Utils.getEvDriverId(tokenUid.evId);
        //     console.log(obj);
        //     if (obj) {
        //         var evDriverId = obj.userId;
        //         new_session.userId = evDriverId;
        //         if (!evDriverId) {
        //             new_session.userId = tokenUid.userId
        //         }
        //     }
        //     else
        //         new_session.userId = tokenUid.userId
        // }

        new_session.operator = partyId;
        new_session.chargeOwnerId = partyId;


        console.log("handler session:", paymentConditions);


        //Check if payment will be done at the end of charging session or end of the month. if user is b2c, he MUST to pay at the end of session, if user is b2b ,monthly.
        if (paymentConditions.clientType) {

            new_session.paymentType = paymentConditions.paymentType;
            /*
            if (paymentConditions.clientType == "b2c")
                new_session.paymentType = "AD_HOC";
            else
                new_session.paymentType = "MONTHLY";
            */
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

        let tariffCEME = ""
        // Check if tariffCEME is sent
        if (paymentConditions.ceme) {
            if (paymentConditions.ceme.plan) {
                // new_session.tariffCEME = paymentConditions.ceme.plan
                tariffCEME = paymentConditions.ceme.plan
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
                tariffCEME.tariff = tariffArray
                new_session.tariffCEME = tariffCEME
            } else {
                // new_session.tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Gireve);
                if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
                tariffCEME.tariff = tariffArray
                new_session.tariffCEME = tariffCEME
            }
            // new_session.currency = paymentConditions.ceme.currency
        } else {
            //Default value for now
            // new_session.tariffCEME = await Utils.getTariffCEME(new_session.clientName);
            tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Gireve);
            if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
            let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
            tariffCEME.tariff = tariffArray
            new_session.tariffCEME = tariffCEME
        }

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
        paymentConditions.plafondId && (new_session.plafondId = paymentConditions.plafondId);

        new_session.viesVAT = paymentConditions.viesVAT

        if (paymentConditions.userIdWillPay)
            new_session.userIdWillPay = paymentConditions.userIdWillPay;
        else
            new_session.userIdWillPay = paymentConditionsInit.userIdWillPay;

        if (paymentConditions.userIdToBilling)
            new_session.userIdToBilling = paymentConditions.userIdToBilling;
        else
            new_session.userIdToBilling = paymentConditionsInit.userIdToBilling;


        new_session.fees = await vatService.getFees(result.charger, new_session.userIdToBilling)
        new_session.adyenReference = paymentConditions.adyenReference;
        new_session.transactionId = paymentConditions.transactionId;
        new_session.paymentStatus = "UNPAID"

        if (evDetails) {
            if (evDetails.acceptKMs) new_session.acceptKMs = evDetails.acceptKMs
            if (evDetails.updateKMs) new_session.updateKMs = evDetails.updateKMs
        }

        resolve(new_session);

    });
}

router.post('/startJob', (req, res) => {
    initJob(req).then(() => {
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
    console.log(req.params)
    let ocpiVersion = "2.1.1"
    platformCode = "Gireve"
    // console.log(platformCode)
    versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

        //get Mobie Details
        var platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.1.1 OCPI versions
        var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
        var platformEndpoints22 = platformDetails22[0].endpoints
        var platformSessionsEndpointObject = _.where(platformEndpoints22, { identifier: "sessions" });


        if (platformSessionsEndpointObject === undefined || platformSessionsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'sessions_update_error', message: "Platform does not allow sessions module" });
        }
        platformSessionsEndpoint = platformSessionsEndpointObject[0].url;

        var date_from = new Date();
        date_from.setHours(date_from.getHours() - 24 * 30);

        //Transform date_from object to string
        date_from = date_from.toISOString()
        var date_to = new Date().toISOString();
        var isToSaveAllSessions = false;
        var endpoint = platformSessionsEndpoint;
        var data = req.body;
        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;
                date_to = data.date_to;

                if (data.isToSaveAllSessions)
                    isToSaveAllSessions = data.isToSaveAllSessions;
            }
        }

        var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
        var platformToken = platformActiveCredentials[0].token;

        getSessions(endpoint, platformToken, date_from, date_to, isToSaveAllSessions).then((result) => {
            console.log(result)
            if (result == true)
                return res.status(400).send({ code: 'sessions_update_error', message: "Sessions update error: " + result.message });
            else
                return res.status(200).send({ code: 'sessions_update_success', message: "Sessions processed: " + result.sessionsCount + ". New Sessions: " + result.newSessions });

        })

    });
});


router.post('/startCronJob', async (req, res) => {
    try {
        console.log("\nOCPI - 2.1.1 - Sessions Job Started from EKS\n")
        let ocpiVersion = "2.1.1"
        platformCode = "Gireve"
        const platform = await versions.getPlatformVersionsByPlatformCode(platformCode);
        //get Details
        const platformDetails = platform.platformDetails;

        //Get Endpoint to 2.1.1 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
        const platformEndpoints22 = platformDetails22[0].endpoints
        const platformSessionssEndpointObject = _.where(platformEndpoints22, { identifier: "sessions" });


        if (platformSessionssEndpointObject === undefined || platformSessionssEndpointObject.length == 0) {
            return res.status(400).send({ code: 'sessions_update_error', message: "Platform does not allow sessions module" });
        }

        platformSessionsEndpoint = platformSessionssEndpointObject[0].url;

        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
        platformToken = platformActiveCredentials[0].token;

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
        return res.status(400).send({ code: 'sessions_update_error', message: "Sessions update error: " + error.message });
    }
});


module.exports = router;