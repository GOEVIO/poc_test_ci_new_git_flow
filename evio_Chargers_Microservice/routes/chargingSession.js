const express = require('express');
const router = express.Router();
const ChargingSession = require('../models/chargingSession');
const StatisticsSession = require('../statisticsSession');
const Charger = require('../models/charger');
const Infrastructure = require('../models/infrastructure');
const NotifymeHistory = require('../models/notifymeHistory');
const axios = require("axios");
const toggle = require('evio-toggle').default;
const Sentry = require("@sentry/node");
const ObjectId = require('mongoose').Types.ObjectId;
// Disable node-cron by mocking for an easy turn-back
// const cron = require('node-cron');
const { StatusCodes } = require('http-status-codes');
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},
     validate: ()=>{},
     status: '',
    })
};
const ScheduleTime = require('../models/scheduleTime.json');
const ConcurrentManufacturer = require('../models/concurrentManufacturers');
require("dotenv-safe").load();
const moment = require('moment-timezone');
const { getCode, getName } = require('country-list');
const { sendSessionToHistoryQueue, checkBeforeSendSessionToHistoryQueue } = require('../utils/sendSessionToHistoryQueue');
const { saveSessionLogs } = require('../utils/save-session-logs');
const { Enums, Helpers } = require('evio-library-commons').default;
const { calculateSessionValues } = require('../services/chargingsession.service');

const notificationsProxy = 'http://notifications:3008';
const firebaseStart = `${notificationsProxy}/api/private/firebase/start`;
const firebaseStop = `${notificationsProxy}/api/private/firebase/stop`;
const firebaseData = `${notificationsProxy}/api/private/firebase/data`;
const firebaseMyChargerStart = `${notificationsProxy}/api/private/firebase/myChargers/start`;
const firebaseMyChargerStop = `${notificationsProxy}/api/private/firebase/myChargers/stop`;

const notificationsFirebaseWLProxy = 'http://notifications-firebase-wl:3032';
const firebaseWLStart = `${notificationsFirebaseWLProxy}/api/private/firebase/start`;
const firebaseWLStop = `${notificationsFirebaseWLProxy}/api/private/firebase/stop`;
const firebaseWLData = `${notificationsFirebaseWLProxy}/api/private/firebase/data`;
const firebaseMyChargerWLStart = `${notificationsFirebaseWLProxy}/api/private/firebase/myChargers/start`;
const firebaseMyChargerWLStop = `${notificationsFirebaseWLProxy}/api/private/firebase/myChargers/stop`;

const getPlafondByIdPath = `${process.env.HostPayments}/api/private/plafond/byId`;

const ConfigsProxy = 'http://configs:3028';
const feesConfig = `${ConfigsProxy}/api/private/config/fees`;

const Utils = require('../utils')

const { NotificationType, notifyChargerAvailable, notifySessionEvCharging, notifySessionEvNotCharging } = require('evio-library-notifications').default;

const pendingStatusesStartSessions = [Enums.SessionStatusesNumberTypes.PENDING, Enums.SessionStatusesNumberTypes.PENDING_DELAY, Enums.SessionStatusesNumberTypes.PENDING_START];
const { sendMessage } = require('evio-event-producer');

import addTotalPowerCondition from '../services/chargersServices';
import { ChargingSessionReadRepository } from 'evio-library-chargers';
const chargerServices = require('../services/chargersServices').default;
const minimumPowerToBilling = 100

const { DevicesPreAuthorizationService } = require('../services/device-preauthorization.service')


//========== POST ==========
//Create Charging Session
router.post('/api/private/chargingSession/start', async (req, res, next) => {
    var context = "POST /api/private/chargingSession/start";
    try {
        var chargingSession = new ChargingSession(req.body);

        var query = {
            hwId: chargingSession.hwId,
            active: true,
            hasInfrastructure: true
        };

        let charger = await chargerFindOne(query);

        var evOwner = '-1'
        let invoiceType = '-1'
        let invoiceCommunication = '-1'
        let evDetails, fleetDetails

        console.info(`"POST /api/private/chargingSession/start chargingSession.fees.IVA before - ${chargingSession.fees.IVA}`)

        if (typeof chargingSession?.fees?.IVA !== "number"  && req.body.userIdToBillingInfo ) {
                chargingSession.fees = await getFeesWithUser(charger, req.body.userIdToBillingInfo);
        } else if(typeof chargingSession?.fees?.IVA !== "number") {
                chargingSession.fees = await getFees(charger);
        }

        console.info(`"POST /api/private/chargingSession/start chargingSession.fees.IVA after - ${chargingSession.fees.IVA}`)

        if (chargingSession.evId != '-1') {
            let { ev, fleet } = await getEVAllByEvId(chargingSession.evId);
            evOwner = ev?.userId;
            invoiceType = ev?.invoiceType
            invoiceCommunication = ev?.invoiceCommunication
            evDetails = ev
            fleetDetails = fleet
            if (ev?.plafondId) {
                // TODO: add tests to check if includingInternalCharging boolean is handling plafonds correctly
                const { includingInternalCharging } = await axios.get(getPlafondByIdPath, { params: {_id: ev.plafondId } });
                if (includingInternalCharging) {
                    chargingSession.plafondId = ev.plafondId;
                }
            }

            // EVIO 1478 -  add kms to session object
            chargingSession.acceptKMs = ev.acceptKMs ? ev.acceptKMs : false
            chargingSession.updateKMs = ev.updateKMs ? ev.updateKMs : false
        };

        if (invoiceType != '-1')
            chargingSession.invoiceType = invoiceType
        if (invoiceCommunication != '-1')
            chargingSession.invoiceCommunication = invoiceCommunication

        chargingSession.chargerOwner = charger.createUser;
        chargingSession.evOwner = evOwner;
        chargingSession.evDetails = evDetails;
        chargingSession.fleetDetails = fleetDetails;
        chargingSession.model = charger.model;
        chargingSession.purchaseTariff = charger.purchaseTariff;
        chargingSession.timeZone = charger?.timeZone;
        if(chargingSession.startDate && charger.timeZone)
            chargingSession.localStartDate = moment(chargingSession.startDate).tz(charger.timeZone).format("YYYY-MM-DDTHH:mm:ss");

        if(chargingSession.stopDate && charger.timeZone)
            chargingSession.localStopDate = moment(chargingSession.stopDate).tz(charger.timeZone).format("YYYY-MM-DDTHH:mm:ss");

        validateFields(chargingSession, res);
        /*closeBooking(chargingSession)
            .then(async (chargingSession) => {

                /*
                let tariff;
                if (chargingSession.tariffId != '-1') {

                    tariff = await getTariff(chargingSession.tariffId);

                };
                */
        let allowsConcurrency = await ConcurrentManufacturer.findOne({ $or: [{ manufacturer: charger.vendor.toUpperCase(), active: true }, { manufacturer: charger.manufacturer.toUpperCase(), active: true }] }).lean()

        if (allowsConcurrency && chargingSession.authType !== process.env.AuthTypeApp_User) {
            // console.log("creating session with concurrency")

            ChargingSession.createChargingSession(chargingSession, function (err, result) {
                if (err) {
                    console.error(`[${context}][createChargingSession] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (result) {
                        if (result.status === process.env.SessionStatusRunning) startFirebaseNotification(result);
                        return res.status(200).send(result);
                    } else {
                        return res.status(400).send({ auth: false, code: 'server_chargingSession_not_created', message: "Charging sessions not created" });
                    }
                };
            });
        } else {
            var query = {
                $and: [
                    {
                        $and: [
                            { hwId: chargingSession.hwId },
                            { plugId: chargingSession.plugId }
                        ]
                    },
                    { $or: [{ status: process.env.SessionStatusRunning }, { status: process.env.SessionStatusToStop }] }
                ]
            };
            // console.log(JSON.stringify(query))
            // Verify if the charger or the EV is not in use.
            ChargingSession.findOne(query, (error, resultFind) => {
                if (error) {
                    console.error(`[${context}][findOne] Error `, error.message);
                    return res.status(500).send(error.message);
                }
                else {
                    console.log("resultFind")
                    console.log(resultFind)
                    if (!resultFind) { //If not in use - start chargingSession

                        ChargingSession.createChargingSession(chargingSession, function (err, result) {
                            if (err) {
                                console.error(`[${context}][createChargingSession] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {
                                    if (result.status === process.env.SessionStatusRunning) startFirebaseNotification(result);
                                    return res.status(200).send(result);
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_chargingSession_not_created', message: "Charging sessions not created" });
                                }
                            };
                        });
                    }
                    else {
                        //If in use send a error
                        return res.status(400).send({ auth: false, code: 'server_charger_already_in_use', message: "Charger already in use", idTag: resultFind.idTag });
                    };
                };
            });
        }
        /*})
        .catch((error) => {
            console.error(`[${context}][closeBooking][.catch] Error `, error.message);
            return res.status(500).send(error.message);
        });*/

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/chargingSession/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/chargingSession/runFirstTime";
    try {

        //runFirstTime();
        //addUserIdWillPayPaymentMethod();
        //addEVOwnerToSession();
        //priceCorrection();
        //addStopTransactionReceived();
        //tariffCostSessionsRunFirstTime()
        //addAddress();
        //addClientName();
        //addUserIdToBilling();
        //updateb2bComissioned(req);
        //updateSessionsPurchaseTariffDetails()
        //updateAddressModel();
        //updateCO2SavedMinumum();
        updateCardNumber();

        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/chargingSession/updateSessionsPurchaseTariffDetails', async (req, res, next) => {
    let context = "POST /api/private/chargingSession/updateSessionsPurchaseTariffDetails";
    try {

        let clientName = req.body.clientName
        updateSessionsPurchaseTariffDetails(clientName)
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//TODO stop Transaction Received

router.patch('/api/private/chargingSession', async (req, res, next) => {
    const context = "PATCH /api/private/chargingSession";

    try {

        let chargingSession = req.body.body;

        if (!chargingSession._id)
            return res.status(400).send({ auth: false, code: 'server_session_id_required', message: "Session Id required" });

        var query = { _id: chargingSession._id };
        var chargingSessionFound = await chargingSessionFindOne(query);

        const {isDevice = false, deviceType = '' } = Helpers.verifyIsDeviceRequest(chargingSessionFound?.createdWay || '');

        if (chargingSession.status === process.env.SessionStatusRunning) {

            if (chargingSessionFound.evId !== "-1") {
                updataEv(chargingSessionFound.evId, chargingSessionFound.userId, process.env.PlugsStatusInUse);
            }
            chargingSessionFound.clientName = chargingSession.clientName
            startFirebaseNotification(chargingSessionFound);
            startMyChargerFirebaseNotification(chargingSessionFound);

        } else if (chargingSession.status === process.env.SessionStatusStopped || chargingSession.status === process.env.SessionStatusStoppedAndEvParked) {

            //let result = await chargingSessionFindOne(query);
            let timeCharged = chargingSession.timeCharged !== null && chargingSession.timeCharged !== undefined ? chargingSession.timeCharged : chargingSessionFound.timeCharged
            let totalPower = chargingSession.totalPower !== null && chargingSession.totalPower !== undefined ? chargingSession.totalPower : chargingSessionFound.totalPower
            // let stopDate = new Date(((chargingSessionFound.startDate.getTime() / 1000) + timeCharged) * 1000);
            let stopDate = chargingSession.stopDate !== null && chargingSession.stopDate !== undefined ? chargingSession.stopDate : new Date(((chargingSessionFound.startDate.getTime() / 1000) + timeCharged) * 1000);
            chargingSession.stopDate = stopDate;
            if(chargingSession.stopDate && chargingSessionFound.timeZone)
                chargingSession.localStopDate = moment(chargingSession.stopDate).tz(chargingSessionFound.timeZone).format("YYYY-MM-DDTHH:mm:ss");
            chargingSession.timeCharged = timeCharged;
            chargingSession.CO2Saved = Number(process.env.CarbonIntensity) * (totalPower / 1000);// Kg CO₂ eq/kWh
            if (chargingSession.CO2Saved < 0)
                chargingSession.CO2Saved = 0

            if ((chargingSessionFound.evId !== "-1")) {

                updataEv(chargingSessionFound.evId, chargingSessionFound.userId, process.env.PlugStatusAvailable);

            };

            let response;
            if (chargingSession.totalPower) {
                response = await validateTariffId(chargingSessionFound, chargingSession);
            } else {
                response = await validateTariffId(chargingSessionFound, chargingSessionFound);
            }
            console.log("1", response)

            let totalPrice = response.totalPrice;
            let costDetails = response.costDetails;

            var estimatedPrice = totalPrice.incl_vat;

            var newSession = {
                _id: chargingSession._id,
                estimatedPrice: estimatedPrice,
                totalPrice: totalPrice,
                costDetails: costDetails
            };

            /*var query = {
                _id: chargingSessionFound._id
            };*/

            var newValues = { $set: newSession };

            if(isDevice){
                try {
                    //TODO IMPROVE CAPTURE OCPP - HANDLE ERROR
                    const preAuthorizationAPT = new DevicesPreAuthorizationService(deviceType);
                    const isCaptureSuccess = await preAuthorizationAPT.capturePreAuthorization(chargingSession, totalPrice.incl_vat)
                    if(!isCaptureSuccess){
                        throw new Error('Capture pre-authorization failed');
                    }
                } catch (error) {
                    console.error(`[APT Capture value][chargingSessionUpdate] Error `, error.message);
                    Sentry.captureException(`[APT Capture value][chargingSessionUpdate] Error - ${error.message}`);
                }
            }

            chargingSessionUpdate(query, newValues)
                .then(async (session) => {
                    if (session) {
                        console.log(`[${context}][chargingSessionUpdate] Updated `);
                    }
                    else {
                        console.log(`[${context}][chargingSessionUpdate] Not updated `);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][chargingSessionUpdate] Error `, error.message);
                });

            if(!isDevice){
                stopFirebaseNotification(chargingSessionFound);
                stopMyChargerFirebaseNotification(chargingSessionFound);
            }
            

        } else if (chargingSession.status === process.env.SessionStatusFailed) {
            if(!isDevice){
                updatePreAuthorize(chargingSessionFound.transactionId, true)
            }

            //let result = await chargingSessionFindOne(query);
            chargingSession.CO2Saved = Number(process.env.CarbonIntensity) * (chargingSessionFound.totalPower / 1000);// Kg CO₂ eq/kWh
            if (chargingSession.CO2Saved < 0)
                chargingSession.CO2Saved = 0

            if (chargingSessionFound.evId !== "-1") {
                /* chargingSessionFindOne(query)
                     .then((result) => {*/
                updataEv(chargingSessionFound.evId, chargingSessionFound.userId, process.env.PlugStatusAvailable, chargingSession.status);
                // to remove kms in this fail session ( this will be done async to not delay this action)
                Utils.removeKmsFromSession(chargingSession.sessionId, null)
                /*})
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                });*/
            };

        } else if (chargingSession.status === process.env.SessionStatusToStop) {

            console.log("SessionStatusToStop")

        } else if (chargingSession.status === process.env.SessionStatusAvailableButNotStopped) {

            console.log("SessionStatusAvailableButNotStopped")

        } else {

            //let result = await chargingSessionFindOne(query);

            chargingSession.CO2Saved = Number(process.env.CarbonIntensity) * (chargingSessionFound.totalPower / 1000);
            if (chargingSession.CO2Saved < 0)
                chargingSession.CO2Saved = 0

            let response = await validateTariffId(chargingSessionFound, chargingSession);
            console.log("2", response)

            let totalPrice = response.totalPrice;
            let costDetails = response.costDetails;

            chargingSession.estimatedPrice = totalPrice.incl_vat;
            chargingSession.costDetails = costDetails;
            chargingSession.totalPrice = totalPrice;

        };
        console.log("chargingSession - patch", JSON.stringify(chargingSession))
        var newValues = { $set: chargingSession };

        ChargingSession.updateChargingSession(query, newValues, async (err, result) => {
            if (err) {
                console.error(`[${context}][updateChargingSession] Error `, err.message);
                return res.status(500).send(err.message);
            } else {

                sendSessionToHistoryQueue(chargingSession._id, context);

                const enableBillingV2AdHoc = await toggle.isEnable('billing-v2-session_adhoc');
                if (enableBillingV2AdHoc) {
                    console.info(`BillingV2 - Preparing message to send | sessionId: ${chargingSession._id.toString()}`);
                    const payload = { sessionId: chargingSession._id.toString() };
                    sendMessage({ method: 'invoiceAdHocOCPP', payload }, 'billing_v2_key');
                }

                if ((chargingSession.status === process.env.SessionStatusStopped && chargingSession.stopTransactionReceived === true) || chargingSession.stopTransactionReceived === true) {
                    console.log("Session stopped");
                    let session = await chargingSessionFindOne(query);
                    tariffCostSessions(session)
                        .then((result) => {

                            if (result) {

                                //console.log(`Result`, result);
                                ChargingSession.findOneAndUpdate({ _id: session._id }, { $set: { purchaseTariffDetails: result } }, { new: true }, async (err, response) => {
                                    if (err) {

                                        console.error(`[${context}] Error `, err.message);

                                    }
                                    sendSessionToHistoryQueue(response._id, `${context} - after tariffCostSessions`);
                                });

                            }

                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                        });

                }

                if (!chargingSession)
                    return res.status(400).send({ auth: false, code: 'server_update_error', message: "Cannot update charger " + chargingSession._id });
                else
                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: 'Update successfully', result: result });

            };
        });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


        /*
            Recalculates and/or updates a charging session. Only allowed when status is "Stopped".
            - Expected body:
            {
                _id: internalSessionId,
                status: status,
                meterStop: meterStop,
                totalPower: totalPowerConsumed,
                timeCharged: timeChargedinSeconds,
                stopDate: stopDate,
                parkingStartDate: dateNow,
                stopTransactionReceived: true,
                update?: false, //update or return only
            }
        */
router.patch('/api/private/chargingSession/recalculate', async (req, res, next) => {
    const context = "PATCH /api/private/chargingSession/recalculate";

    try {
        let chargingSession = req.body;
        const updateSession = chargingSession.update || false;

        if (!chargingSession._id)
            return res.status(400).send({ auth: false, code: 'server_session_id_required', message: "Session Id required" });

        var query = { _id: chargingSession._id };
        var chargingSessionFound = await chargingSessionFindOne(query);

        if (chargingSession.status === process.env.SessionStatusStopped) {

            let timeCharged = chargingSession.timeCharged !== null && chargingSession.timeCharged !== undefined ? chargingSession.timeCharged : chargingSessionFound.timeCharged
            let totalPower = chargingSession.totalPower !== null && chargingSession.totalPower !== undefined ? chargingSession.totalPower : chargingSessionFound.totalPower
            let stopDate = chargingSession.stopDate !== null && chargingSession.stopDate !== undefined ? chargingSession.stopDate : new Date(((chargingSessionFound.startDate.getTime() / 1000) + timeCharged) * 1000);
            chargingSession.stopDate = stopDate;
            if(chargingSession.stopDate && chargingSessionFound.timeZone)
                chargingSession.localStopDate = moment(chargingSession.stopDate).tz(chargingSessionFound.timeZone).format("YYYY-MM-DDTHH:mm:ss");
            chargingSession.timeCharged = timeCharged;
            chargingSession.CO2Saved = Number(process.env.CarbonIntensity) * (totalPower / 1000);// Kg CO₂ eq/kWh
            if (chargingSession.CO2Saved < 0) chargingSession.CO2Saved = 0

            let response;
            if (chargingSession.totalPower) {
                response = await validateTariffId(chargingSessionFound, chargingSession);
            } else {
                response = await validateTariffId(chargingSessionFound, chargingSessionFound);
            }

            let totalPrice = response.totalPrice;
            let costDetails = response.costDetails;

            var estimatedPrice = totalPrice.incl_vat;

            var newSession = {
                _id: chargingSession._id,
                estimatedPrice: estimatedPrice,
                totalPrice: totalPrice,
                costDetails: costDetails
            };

            var newValues = { $set: newSession };

            console.log(`Session values recalculated: ${JSON.stringify(newSession)}`);

            if (updateSession) {
                chargingSessionUpdate(query, newValues)
                    .then(async (session) => {
                        if (session) {
                            console.log(`[${context}][chargingSessionUpdate] Updated `);
                        }
                    else {
                        console.log(`[${context}][chargingSessionUpdate] Not updated `);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][chargingSessionUpdate] Error `, error.message);
                });
            } else return res.status(200).send(newSession);

        } else {
            console.log(`recalculate charging session error: Only ${process.env.SessionStatusStopped} status is allowed for recalculation`);
            return res.status(400).send({ auth: false, code: 'server_invalid_session_status', message: "Invalid session status" });
        };
        var newValues = { $set: chargingSession };

        ChargingSession.updateChargingSession(query, newValues, async (err, result) => {
            if (err) {
                console.error(`[${context}][updateChargingSession] Error `, err.message);
                return res.status(500).send(err.message);
            } else {

                sendSessionToHistoryQueue(chargingSession._id, context);

                if ((chargingSession.status === process.env.SessionStatusStopped && chargingSession.stopTransactionReceived === true) || chargingSession.stopTransactionReceived === true) {
                    console.log("Session stopped");
                    let session = await chargingSessionFindOne(query);
                    tariffCostSessions(session)
                        .then((result) => {

                            if (result) {
                                ChargingSession.findOneAndUpdate({ _id: session._id }, { $set: { purchaseTariffDetails: result } }, { new: true }, async (err, response) => {
                                    if (err) {

                                        console.error(`[${context}] Error `, err.message);

                                    }
                                    sendSessionToHistoryQueue(response._id, `${context} - after tariffCostSessions`);
                                });

                            }

                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                        });

                }

                if (!chargingSession)
                    return res.status(400).send({ auth: false, code: 'server_update_error', message: "Cannot update charger " + chargingSession._id });
                else
                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: 'Update successfully', result: result });

            };
        });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/chargingSession/v1/:sessionId', async (req, res, next) => {
    const context = "PATCH /api/private/chargingSession/v1/:sessionId";
    try {
        const sessionId = req.params.sessionId;
        if(!sessionId || !ObjectId.isValid(sessionId))
            return res.status(400).send({ auth: false, code: 'server_session_id_required', message: "Session Id required" });

        const updateObject = req.body;
        if(!updateObject)
            return res.status(400).send({ auth: false, code: 'server_updateObject_required', message: "Is required to send an object in body to update the charging session data" });

        const query = { sessionId };
        const updated = await ChargingSession.updateChargingSession(query, updateObject)

        if (updated) {
            return res.status(200).send(updated);
        }
        return res.status(400).send({ auth: false, code: 'server_fail_update_session', message: "Fail to update ChargingSession" });
    }catch (error){
        console.error(`[${context}] Error `, error.message);
        if(!error.code){
            Sentry.captureException(error);
        }
        return res.status(500).send( error.code ?? 'Internal Server Error');
    }
});


router.patch('/api/private/chargingSession/frontend', (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/frontend";
    try {

        const chargingSession = new ChargingSession(req.body);

        var query = { _id: chargingSession._id };
        var newValues = { $set: { status: chargingSession.status } };

        ChargingSession.updateChargingSession(query, newValues, async (err, result) => {
            if (err) {
                console.error(`[${context}][updateChargingSession] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {
                    if(await checkBeforeSendSessionToHistoryQueue(chargingSession?.status)){
                        sendSessionToHistoryQueue(chargingSession?._id, context);
                    }
                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                };
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Add reading point and calculates the estimated price
router.patch('/api/private/chargingSession/statistics', async (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/statistics";
    try {

        var chargingSession = req.body.body;
        var readPoint = chargingSession.readingPoints;
        delete chargingSession.readingPoints;

        var query = { _id: chargingSession._id };

        var chargingSessionFound = await chargingSessionFindOne(query);

        const {isDevice = false, deviceType = '' } = Helpers.verifyIsDeviceRequest(chargingSessionFound?.createdWay || '');

        if (chargingSessionFound.status === "40" && chargingSessionFound.chargerType === "007") {

            //console.log("teste de stop")
            return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
        } else if (chargingSessionFound.stopTransactionReceived) {
            let newValues = {
                $push: { readingPoints: readPoint }
            };

            chargingSessionUpdate(query, newValues)
            //console.log("teste de stop")
            return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
        } else {

            chargingSession.CO2Saved = Number(process.env.CarbonIntensity) * (chargingSession.totalPower / 1000);// Kg CO₂ eq/kWh
            if (chargingSession.CO2Saved < 0)
                chargingSession.CO2Saved = 0

            validateTariffId(chargingSessionFound, chargingSession)
                .then((response) => {

                    console.log("3", response)
                    let totalPrice = response.totalPrice;
                    let costDetails = response.costDetails;

                    chargingSession.estimatedPrice = totalPrice.incl_vat;
                    chargingSession.costDetails = costDetails
                    chargingSession.totalPrice = totalPrice;

                    var newValues = {
                        $set: chargingSession,
                        $push: { readingPoints: readPoint }
                    };

                    query.stopTransactionReceived = false
                    chargingSessionUpdate(query, newValues)
                        .then((response) => {

                            if (response) {

                                chargingSessionFindOne(query)
                                    .then(async (chargingSessionFound) => {
                                        chargingSessionFound = JSON.parse(JSON.stringify(chargingSessionFound));

                                        if(isDevice){
                                            const preAuthorizationAPT = new DevicesPreAuthorizationService(deviceType);
                                            const preAuthorizationResult = await preAuthorizationAPT.updatePreAuthorization(chargingSessionFound, chargingSession.estimatedPrice);
                                            console.log('[chargingSessionUpdate] Info - Pre-authorization updated', preAuthorizationResult);
                                            if(!preAuthorizationResult){
                                                const reason = {
                                                    reasonCode: 'other',
                                                    reasonText: 'Pre-authorization update failed'
                                                };
                                                autoStopChargingSession(chargingSessionFound, reason);
                                            }
                                        }
                                        dataFirebaseNotification(chargingSessionFound, readPoint);
                                        notificationManagement(chargingSessionFound)

                                        if (chargingSessionFound.autoStop === undefined && chargingSessionFound.chargerType !== process.env.EVIOBoxType) {
                                            return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                        }
                                        else {
                                            if (chargingSessionFound.autoStop === undefined || Object.keys(chargingSessionFound.autoStop).length === 0) {
                                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                            }
                                            else {
                                                if (chargingSessionFound.autoStop.uom === process.env.AutoStopByTime) {
                                                    if (chargingSessionFound.autoStop.value <= chargingSessionFound.timeCharged) {

                                                        var reason = {
                                                            reasonCode: 'other',
                                                            reasonText: 'Total time reached'
                                                        };

                                                        autoStopChargingSession(chargingSessionFound, reason);

                                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                                    }
                                                    else {
                                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                                    };
                                                }
                                                else if (chargingSessionFound.autoStop.uom === process.env.AutoStopByPower) {

                                                    if (chargingSessionFound.autoStop.value <= chargingSessionFound.totalPower) {

                                                        var reason = {
                                                            reasonCode: 'other',
                                                            reasonText: 'Total power reached'
                                                        };

                                                        autoStopChargingSession(chargingSessionFound, reason);

                                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                                    }
                                                    else {
                                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                                    };
                                                }
                                                else if (chargingSessionFound.autoStop.uom === process.env.AutoStopByPrice) {

                                                    if (chargingSessionFound.autoStop.value <= chargingSessionFound.estimatedPrice) {

                                                        var reason = {
                                                            reasonCode: 'other',
                                                            reasonText: 'Total price reached'
                                                        };

                                                        autoStopChargingSession(chargingSessionFound, reason);

                                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                                    }
                                                    else {
                                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully", chargingSessionFound });
                                                    };
                                                };
                                            };

                                        };

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][chargingSessionFindOne] Error `, error.message);
                                        return res.status(500).send(error.message);

                                    });

                            }
                            else {

                                return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });

                            };

                        })
                        .catch((error) => {

                            console.error(`[${context}][chargingSessionUpdate] Error `, error.message);
                            return res.status(500).send(error.message);

                        });

                })
                .catch((error) => {

                    console.error(`[${context}][validateTariffId] Error `, error.message);
                    return res.status(500).send(error.message);

                });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Patch Update multipointer, averages and stop session
//deprecated
/**
 * @deprecated Since version xx. Will be deleted in version xx. Use xxx instead.
 */
router.patch('/api/private/chargingSession/mulstat', (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/mulstat";
    console.warn("/api/private/chargingSession/mulstat - Calling deprecated function!");
    try {
        var chargingSession = req.body.body;

        var query = { _id: chargingSession._id };

        ChargingSession.findOne(query, (err, resChargingSession) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                const statisticsSessionController = StatisticsSession();
                statisticsSessionController.getSessionAveragesPower(resChargingSession, chargingSession)
                    .then((result) => {
                        Charger.findOne({ hwId: result.hwId, active: true, hasInfrastructure: true }, (err, resCharger) => {
                            if (err) {
                                console.error(`[${context}][findOne] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                statisticsSessionController.getSessionAveragesPrice(result, resCharger)
                                    .then((finalChargingSession) => {
                                        var newValues = { $set: finalChargingSession };
                                        ChargingSession.updateChargingSession(query, newValues, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}][updateChargingSession] Error `, err.message);
                                                return res.status(500).send(err.message);
                                            }
                                            else {
                                                if (result) {
                                                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                                }
                                                else {
                                                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                };
                                            };
                                        });
                                    }).catch((error) => {
                                        console.error(`[${context}][getSessionAveragesPrice] Error `, error)
                                        return res.status(500).send(error.message);
                                    });
                            };
                        });
                    }).catch((error) => {
                        console.error(`[${context}][getSessionAveragesPower] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update auto stop reason
router.patch('/api/private/chargingSession/autoStop', (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/autoStop";
    try {
        var query = req.body.query;
        var chargingSession = {
            autoStop: req.body.autoStop
        };
        var newValues = { $set: chargingSession };

        ChargingSession.updateChargingSession(query, newValues, async (err, result) => {
            if (err) {
                console.error(`[${context}][updateChargingSession] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result){
                    if(await checkBeforeSendSessionToHistoryQueue(result?.status)){
                        sendSessionToHistoryQueue(result._id, context);
                    }
                    return res.status(200).send(true);
                }
                else
                    return res.status(200).send(false);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Change status charging session on chargers evio when mqtt fail (Internal endpoint)
router.patch('/api/private/chargingSession/mqttFail', (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/mqttFail";
    try {

        var query = req.body;
        query.active = true;
        query.hasInfrastructure = true;

        chargerFind(query)
            .then(async (chargersFound) => {
                if (chargersFound.length == 0) {
                    return res.status(200).send(true);
                }
                else {
                    let chargerHwId = await getChargerId(chargersFound);
                    var query = {
                        $and: [
                            {
                                hwId: chargerHwId
                            },
                            {
                                status: {$in: [...pendingStatusesStartSessions, process.env.SessionStatusRunning]}
                            }
                        ]
                    };
                    chargingSessionFind(query)
                        .then((chargingSessionFound) => {
                            if (chargingSessionFound.length == 0) {
                                return res.status(200).send(true);
                            }
                            else {
                                Promise.all(
                                    chargingSessionFound.map(chargingSession => {
                                        return new Promise((resolve, reject) => {
                                            chargingSession.status = process.env.SessionStatusInPause;
                                            var query = {
                                                _id: chargingSession._id
                                            };
                                            var newValues = { $set: chargingSession };
                                            chargingSessionUpdate(query, newValues)
                                                .then((result) => {
                                                    resolve(result);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}] Error `, error.message);
                                                    reject(error.message);
                                                });
                                        });
                                    })
                                ).then(() => {
                                    return res.status(200).send(true);
                                }).catch((error) => {
                                    console.error(`[${context}] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Change status charging session on chargers evio when mqtt fail (Internal endpoint)
router.patch('/api/private/chargingSession/updateWalletOnChargingSession', (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/updateWalletOnChargingSession";
    try {
        var query = {
            $and: [
                { userIdWillPay: req.body.userId },
                { paymentMethod: process.env.PaymentMethodWallet },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusRunning
                        },
                        {
                            status: process.env.SessionStatusInPause
                        }
                    ]
                }
            ]
        };

        var newTransaction = {
            $inc: {
                "walletAmount": req.body.newWalletValue
            },
            $set: {
                paymentNotificationStatus: false
            }
        };

        console.log("updateWalletOnChargingSession", newTransaction);
        ChargingSession.updateMany(query, newTransaction, (err, result) => {

            if (err) {

                console.error(`[${context}][updateChargingSession] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                return res.status(200).send(result);

            };

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/chargingSession/sessionsStatusToStart', (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/sessionsStatusToStart";
    try {

        var date = new Date();

        var chargingSession = req.body;

        var query = {
            status: {$in: pendingStatusesStartSessions},
            chargerType: chargingSession.chargerType,
            hwId: chargingSession.hwId
        };
        /*
        chargingSession.status = process.env.SessionStatusFailed;
        chargingSession.command = process.env.StopCommand;
        chargingSession.stopDate = date;
        chargingSession.stopReason = reason;
        */


        var newValues = {
            $set:
            {
                status: process.env.SessionStatusFailed,
                command: process.env.StopCommand,
                stopDate: date,
                stopReason: chargingSession.stopReason
            }
        };

        chargingSessionUpdate(query, newValues)
            .then((result) => {
                if (result) {

                    return res.status(200).send(result);

                }
                else {

                    //console.log("[chargingSessionUpdate] Not updated");
                    return res.status(400).send({ auth: false, code: 'server_session _not_updated', message: "Session updated unsuccessfully" });

                };
            })
            .catch((error) => {

                console.error(`[${context}][chargingSessionUpdate] Error `, error.message);
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.patch('/api/private/chargingSession/invoiceId', async (req, res, next) => {
    const context = "PATCH /api/private/chargingSession/invoiceId";
    try {

        let query = req.query;
        let body = req.body;

        if (typeof query._id === 'string') {

            ChargingSession.updateChargingSession(query, { $set: body }, async (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    sendSessionToHistoryQueue(query._id, context);

                    return res.status(200).send(result);

                }
            });

        }
        else {

            ChargingSession.updateMany(query, { $set: body }, async (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (Array.isArray(query._id) && query._id.length > 0) {
                        query._id.forEach((id) =>  sendSessionToHistoryQueue(id, `${context} - updateMany`));
                    }

                    return res.status(200).send(result);

                }
            });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//TODO
router.patch('/api/private/chargingSession/invoice', async (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/invoice";
    try {

        let body = req.body;

        let query = {
            invoiceId: body.invoiceId
        };

        let data = {
            invoiceStatus: body.invoiceStatus
        };

        ChargingSession.updateChargingSession(query, { $set: data }, async (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                sendSessionToHistoryQueue(result._id, context);

                return res.status(200).send(result);

            }
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.patch('/api/private/chargingSession/updateSessionSync/:id', (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/updateSessionSync";
    try {

        let query = {
            _id: req.params.id
        };


        ChargingSession.updateChargingSession(query, { $set: { sessionSync: true } }, (err, result) => {

            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(result);
            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.patch('/api/private/chargingSession/endOfEnergyDate', async (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/endOfEnergyDate";
    try {

        let { _id, endOfEnergyDate } = req.body
        let foundSession = await ChargingSession.findOneAndUpdate({ _id }, { endOfEnergyDate }, { new: true })
        if (foundSession) {
            return res.status(200).send(foundSession);
        } else {
            return res.status(200).send({})
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

router.patch('/api/private/chargingSession/sessionID', (req, res, next) => {
    let context = "PATCH /api/private/chargingSession/sessionID";
    try {
        const updateObject = req.body.updateObject
        const sessionID = req.body.sessionID

        if (!sessionID || !updateObject) {
            console.error(`[${context}] Error - Missing input information`,);
            return res.status(400).send("Missing input information");
        }
        let query = {
            sessionId: sessionID
        }
        ChargingSession.findOneAndUpdate(query, { $set: updateObject }, { new: true }).then(function (UpdatedSession) {
            return res.status(200).send(UpdatedSession);
        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(400).send(error.message);
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
})

router.patch('/api/private/chargingSession/setSessionsCommissioned', async (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/setSessionsCommissioned";
    try {

        let query = req.body.params

        let foundSession = await ChargingSession.updateMany(query, { $set: { "b2bComissioned": true } })
        if (foundSession) {
            console.log(foundSession)
            return res.status(200).send(foundSession);
        } else {
            console.log("No sessions found")
            return res.status(200).send({})
        }
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
})

router.patch('/api/private/chargingSession/updateEvAndUsersInfo', updateEvAndUsersInfo)

router.patch('/api/private/chargingSession/sessions/ev/acceptKMs', async (req, res, next) => {
    var context = "PATCH /api/private/chargingSession/sessions/ev/acceptKMs";
    try {
        let arrayEvID = req.body.evID
        let acceptKMs = req.body.acceptKMs
        if (!Array.isArray(arrayEvID) || typeof acceptKMs !== "boolean") {
            console.log("Missing input variables")
            return res.status(400).send("Missing input variables");
        }

        let query = null
        if (arrayEvID.length > 1) {
            let ids = []
            for (let evID of arrayEvID) {
                ids.push({ evId: evID })
            }
            query = { $or: ids }
        } else {
            query = {
                evId: arrayEvID[0]
            }
        }

        ChargingSession.updateMany(query, { $set: { acceptKMs: acceptKMs } }).then(function (result) {
            return res.status(200).send(true);
        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(400).send(error.message);
        })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

router.patch('/api/private/chargingSession/sessions/ev/updateKMs', async (req, res, next) => {
    const context = "PATCH /api/private/chargingSession/sessions/ev/updateKMs";
    try {
        const arrayEvID = req.body.evID
        const updateKMs = req.body.updateKMs
        if (!Array.isArray(arrayEvID) || typeof updateKMs !== "boolean" || arrayEvID && arrayEvID.length < 1) {
            console.log("Missing input variables")
            return res.status(400).send("Missing input variables");
        }

        let query = {
            evId: { $in: arrayEvID }
        }
        if (updateKMs) query.evKms = { $exists: false }

        const result = await ChargingSession.updateMany(query, { $set: { updateKMs } })
        if (!result) {
            console.error(`[${context}] Error - Fail to update ev flag updateKMs`);
            return res.status(500).send('Fail to update ev flag updateKMs');
        }
        return res.status(200).send(true);

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    }
})

//========== PUT ==========
//Put to insert rating of the charging session
router.put('/api/private/chargingSession/rating', (req, res, next) => {
    var context = "PUT /api/private/chargingSession/rating";
    try {
        var session = req.body;
        var query = {
            _id: session._id
        };
        var sum = 0;
        Promise.all(
            session.feedBack.map(feedBack => {
                return new Promise((resolve) => {
                    sum += feedBack.value;
                    resolve(true);
                });
            })
        ).then(() => {
            session.rating = (sum / session.feedBack.length);
            var newSession = { $set: session };
            ChargingSession.updateChargingSession(query, newSession, async (err, result) => {
                if (err) {
                    console.error(`[${context}][updateChargingSession] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (result) {
                        if(await checkBeforeSendSessionToHistoryQueue(result?.status)){
                            sendSessionToHistoryQueue(result._id, context);
                        }
                        var host = process.env.HostCharger + process.env.pathChargerRating;

                        var data = {
                            hwId: result.hwId,
                            rating: session.rating,
                            hasInfrastructure: true,
                            active: true
                        };
                        axios.patch(host, data)
                            .then((value) => {
                                return res.status(200).send(value.data);
                            })
                            .catch((error) => {
                                console.error(`[${context}][Axis patch ${host}] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_rating_not_updated', message: "Rating updated unsuccessfully" });
                    };
                };
            });
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Put to insert reason to stop charging session
router.put('/api/private/chargingSession/stopReason', (req, res, next) => {
    var context = "PUT /api/private/chargingSession/stopReason";
    try {
        var session = req.body;
        var query = {
            _id: session._id
        };
        chargingSessionFindOne(query)
            .then((chargingSessionFound) => {
                if (chargingSessionFound) {
                    chargingSessionFound.stopReason = session.stopReason;
                    chargingSessionFound.stoppedByOwner = true;
                    var newSession = { $set: chargingSessionFound };
                    chargingSessionUpdate(query, newSession)
                        .then((result) => {
                            if (result) {
                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][chargingSessionUpdate] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(200).send({ auth: true, code: 'server_chargingSesion_not_found', message: "Charging session not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargingSessionFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.put('/api/private/chargingSession/addPaymentId', async (req, res, next) => {
    var context = "PUT /api/private/chargingSession/addPaymentId";
    try {

        let received = req.body;

        let query = {
            _id: received.sessionId
        };

        let paymentStatus;
        if (received.paymentMethod === process.env.PaymentMethodNotPay) {
            paymentStatus = process.env.ChargingSessionPaymentStatusNotApplied;
        }
        else {
            if (received.status === process.env.PaymentStatusPaidOut) {
                paymentStatus = process.env.ChargingSessionPaymentStatusPaid;
            }
            else {
                paymentStatus = process.env.ChargingSessionPaymentStatusUnpaid;
            };
        };

        let newValues = {
            $set: {
                paymentId: received._id,
                paymentStatus: paymentStatus
            }
        };

        chargingSessionUpdate(query, newValues)
            .then(async (result) => {

                sendSessionToHistoryQueue(query._id, context);
                return res.status(200).send(result);

            })
            .catch((error) => {

                console.error(`[${context}][chargingSessionUpdate] Error `, error.message);
                return res.status(500).send(error.message);

            });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.put('/api/private/chargingSession/updateSyncPlafond', (req, res, next) => {
    var context = "PUT /api/private/chargingSession/updateSyncPlafond";
    try {

        let received = req.body;

        let query = {
            _id: received.sessionId
        };


        let newValues = { $set: { syncToPlafond: true } };

        chargingSessionUpdate(query, newValues)
            .then((result) => {

                if (result) {
                    return res.status(200).send({ auth: true, code: 'server_syncPlafond_updated', message: "SyncPlafond updated successfully" });
                } else {
                    return res.status(400).send({ auth: true, code: 'server_syncPlafond_not_updated', message: "SyncPlafond updated unsuccessfully" });
                };

            })
            .catch((error) => {

                console.error(`[${context}][chargingSessionUpdate] Error `, error.message);
                return res.status(500).send(error.message);

            });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.put('/api/private/chargingSession/cancelPaymentFailedSessions', (req, res, next) => {
    var context = "PUT transaction/api/private/chargingSession/cancelPaymentFailedSessions";
    try {

        var received = req.body;

        let query = {
            _id: received._id
        };

        let newValues = { $set: { paymentStatus: received.paymentStatus } };

        ChargingSession.updateChargingSession(query, newValues, (err, result) => {

            if (err) {

                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                return res.status(200).send(result);

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.put('/api/private/chargingSession/monthlyBilling', async (req, res, next) => {
    var context = "PUT /api/private/chargingSession/monthlyBilling";
    try {

        let sessions = req.body.sessionId;
        let query = {
            _id: sessions
        };

        let paymentStatus;
        if (req.body.status === "20") {
            paymentStatus = process.env.ChargingSessionPaymentStatusPaidWaitingEVIO
        }
        else if (req.body.status === "40") {
            paymentStatus = process.env.ChargingSessionPaymentStatusPaid
        }
        else {
            paymentStatus = process.env.ChargingSessionPaymentStatusUnpaid
        };

        const newValues = {

            paymentStatus: paymentStatus,
            transactionId: req.body.transactionId,
            paymentId: req.body.paymentId,

        };

        ChargingSession.updateMany(query, { $set: newValues }, async (error, result) => {
            if (error) {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                if (result.nModified == result.n) {
                    if (Array.isArray(query._id) && query._id.length > 0) {
                        query._id.forEach((id) =>  sendSessionToHistoryQueue(id, `${context} - updateMany`));
                    }
                    return res.status(200).send(true);
                }
                else {
                    return res.status(200).send(false);
                }
            }
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});


//========== GET ==========
router.get('/api/private/chargingSession/Query', (req, res, next) => {
    var context = "GET /api/private/chargingSession/Query";
    try {

        var query = req.query;

        ChargingSession.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(result);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

router.get('/api/private/chargingSession/sessionID', (req, res, next) => {
    var context = "GET /api/private/chargingSession/sessionID";
    try {
        const sessionID = req.query.sessionID;
        if (!sessionID) {
            console.error(`[${context}] Error - Missing sessionID`,);
            return res.status(400).send("Missing sessionID");
        }
        var query = {
            sessionId: sessionID
        }

        ChargingSession.findOne(query, (err, session) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(session);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

//Get chargers with required action
router.get('/api/private/chargingSession', async (req, res, next) => {
    var context = "GET /api/private/chargingSession";
    try {
        const filter = {};
        if (req.query) {
            if (req.query.message !== undefined) {
                var query = {
                    $or: [
                        {
                            command: process.env.StopCommand,
                            status: process.env.SessionStatusToStop,
                            hwId: req.query.hwId,
                            plugId: req.query.plugId
                        },
                        {
                            command: process.env.StartCommand,
                            status: process.env.SessionStatusRunning,
                            hwId: req.query.hwId,
                            plugId: req.query.plugId
                        }
                    ]
                };
                filter.query = query;
            } else if (req.query.stopStatusNotification) {
                const queryStatus = req.query.status === Enums.SessionStatusesNumberTypes.PENDING ?
                {$in: pendingStatusesStartSessions} : req.query.status;

                var query = {
                    $or: [
                        {
                            authType: process.env.AuthTypeApp_User,
                            status: queryStatus,
                            hwId: req.query.hwId,
                            plugId: req.query.plugId
                        },
                        {
                            authType: process.env.AuthTypeRFID,
                            status: queryStatus,
                            hwId: req.query.hwId,
                        }
                    ]
                };
                filter.query = query;
            } else if (req.query.offlineTransaction) {
                var query = {
                    idTag: req.query.idTag,
                    hwId: req.query.hwId,
                    plugId: req.query.plugId,
                    startDate: new Date(req.query.startDate),
                    meterStart: Number(req.query.meterStart),
                    status: process.env.SessionStatusRunning,
                };
                filter.query = query;
            } else if (req.query.offlineStatusNotification) {
                var query = {
                    hwId: req.query.hwId,
                    plugId: req.query.plugId,
                    startDate: { $lte: new Date(req.query.timestamp) },
                    status: process.env.SessionStatusRunning,
                };
                filter.query = query;
            } else if (req.query.infrastructure) {
                let query = {
                    infrastructure: req.query.infrastructure
                };

                let chargers = await Charger.find(query)

                let hwIds = []

                for (let i = 0; i != chargers.length; i++)
                    hwIds.push(chargers[i].hwId)

                query = {
                    hwId: hwIds
                }

                filter.query = query;
            }
            else {
                filter.query = req.query;
            };
        };
        // console.log("req.query", req.query);
        ChargingSession.find(filter.query, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargingSession) {
                    return res.status(200).send({ chargingSession });
                }
                else
                    return res.status(200).send({ auth: true, code: 'server_request_not_found', message: "Request not found" });
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/toBilling/:sessionId', (req, res, next) => {
    var context = "GET /api/private/chargingSession/toBilling";
    try {

        let sessionId = req.params.sessionId.split(",");
        //console.log("sessionId", sessionId);
        let query = {
            _id: sessionId
        };
        //console.log("req.query", req.query);
        ChargingSession.find(query, (err, chargingSession) => {
            if (err) {

                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);

            } else {

                return res.status(200).send(chargingSession);

            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get active sessions
router.get('/api/private/chargingSession/inSession', (req, res, next) => {
    var context = "GET /api/private/chargingSession/inSession";
    try {
        var params = {
            status: { $nin: [process.env.SessionStatusStopped, process.env.SessionStatusFailed, process.env.SessionStatusToStop] },
        };

        if (req.query) {
            Object.assign(params, req.query);
        };
        ChargingSession.find(params, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargingSession.length > 0)
                    return res.status(200).send({ chargingSession });
                else {
                    var chargingSession = [];
                    return res.status(200).send({ chargingSession });
                    //return res.status(200).send({ auth: true, code: 'server_request_not_found', message: "Request not found" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get my active sessions
router.get('/api/private/chargingSession/myActiveSessions', (req, res, next) => {
    var context = "GET /api/private/chargingSession/myActiveSessions";
    try {
        var userId = req.headers['userid'];

        var params = {
            $and: [
                {
                    $or: [
                        { userId: userId },
                        { evOwner: userId }
                    ]
                },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusRunning
                        },
                        {
                            status: process.env.SessionStatusInPause
                        }
                    ]
                }
            ]
        };

        ChargingSession.find(params, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargingSession.length > 0) {
                    getEvs(chargingSession)
                        //getEvsNew(chargingSession)
                        .then((result) => {
                            return res.status(200).send(result);
                        })
                        .catch((error) => {
                            console.error(`[${context}][getEvs][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else
                    return res.status(200).send([]);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/exists/:hwId', async (req, res) => {
    const context = 'GET /api/private/chargingSession/exists/:hwId';
    const { hwId } = req.params;

    try {
        const exists = await ChargingSessionReadRepository.existsByHwId(hwId);
        return res.status(200).json({ exists });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;


//Get all active sessions
router.get('/api/private/chargingSession/allActiveSessions', (req, res, next) => {
    var context = "GET /api/private/chargingSession/allActiveSessions";
    try {
        var params = {
            $or: [
                {
                    status: process.env.SessionStatusRunning
                },
                {
                    status: process.env.SessionStatusInPause
                }
            ]
        };

        ChargingSession.find(params, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargingSession.length > 0) {
                    getEvs(chargingSession)
                        //getEvsNew(chargingSession)
                        .then((result) => {
                            return res.status(200).send(result);
                        })
                        .catch((error) => {
                            console.error(`[${context}][getEvs][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else
                    return res.status(200).send([]);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get my active sessions
router.get('/api/private/chargingSession/myActiveSessionsPaymentMethod', (req, res, next) => {
    var context = "GET /api/private/chargingSession/myActiveSessionsPaymentMethod";
    try {

        var userId = req.headers['userid'];

        var params = {
            $and: [
                {
                    $or: [
                        { userId: userId },
                        { userIdWillPay: userId }
                    ]
                },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusRunning
                        },
                        {
                            status: process.env.SessionStatusInPause
                        }
                    ]
                }
            ]
        };

        ChargingSession.find(params, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargingSession.length > 0) {
                    //console.log("chargingSession", chargingSession.length);
                    return res.status(200).send(chargingSession);
                }
                else
                    return res.status(200).send([]);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get rating of charging sessions by chargers
router.get('/api/private/chargingSession/rating', (req, res, next) => {
    var context = "GET /api/private/chargingSession/rating";
    try {
        var query = req.query;
        var fields = {
            _id: 0,
            hwId: 1,
            rating: 1,
            feedBack: 1
        };

        ChargingSession.find(query, fields, (err, result) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result.length > 0) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_request_dont_found', message: "Request don't found" })
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get questions and answers of the feedback
//deprecated
/**
 * @deprecated Since version xx. Will be deleted in version xx. Use xxx instead.
 */
router.get('/api/private/chargingSession/feedBack', (req, res, next) => {
    //Deprecated
    var context = "GET /api/private/chargingSession/feedBack";
    console.warn("/api/private/chargingSession/feedBack - Calling deprecated function!");
    try {
        var feedBacks = req.body;
        var query = {
            $or: [

            ]
        };
        var fields = {
            question: 1,
            answers: 1
        };
        const getQuery = (feedBack) => {
            return new Promise((resolve, reject) => {
                try {
                    var temp = {
                        $and: [
                            { _id: feedBack.questionId },
                            {
                                answers: {
                                    $elemMatch: {
                                        _id: feedBack.answerId
                                    }
                                }
                            }
                        ]
                    };
                    query.$or.push(temp);
                    resolve(true);
                } catch (error) {
                    console.error(`[${context}][getQuery] Error `, error.message);
                    reject(error);
                };
            });
        };

        Promise.all(
            feedBacks.feedBack.map(feddBack => getQuery(feddBack))
        )
            .then((value) => {
                Questions.find(query, fields, (err, result) => {
                    if (err) {
                        console.error(`[${context}][find] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        return res.status(200).send(result);
                    };
                });
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error`, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get active sessions on my chargers
//deprecated
/**
 * @deprecated Since version 0.27. Will be deleted in version 0.30. Use xxx instead.
 */
router.get('/api/private/chargingSession/activeSessionsMyChargers_old', (req, res, next) => {
    var context = "GET /api/private/chargingSession/activeSessionsMyChargers";
    try {
        var userId = req.headers['userid'];
        var query = {
            $and: [
                {
                    createUser: userId
                },
                {
                    plugs: {
                        $elemMatch: {
                            status: process.env.PlugsStatusInUse
                        }
                    }
                },
                {
                    hasInfrastructure: true,
                    active: true
                }
            ]
        };
        Charger.find(query, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}][charger.find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargersFound.length > 0) {
                    var hwId = [];
                    var infrastructure = [];
                    const getHwId = (charger) => {
                        return new Promise((resolve) => {
                            var filterPlugs = charger.plugs.filter(plug => {
                                return plug.status == process.env.PlugsStatusInUse;
                            });
                            charger.plugs = filterPlugs;
                            hwId.push(charger.hwId);
                            infrastructure.push(charger.infrastructure);
                            resolve(true);
                        });
                    };
                    Promise.all(
                        chargersFound.map(charger => getHwId(charger))
                    ).then(async () => {
                        var params = {
                            $and: [
                                {
                                    hwId: hwId
                                },
                                {
                                    $or: [
                                        {
                                            status: process.env.SessionStatusRunning
                                        },
                                        {
                                            status: process.env.SessionStatusInPause
                                        }
                                    ]
                                }
                            ]
                        };
                        var query = {
                            _id: infrastructure
                        };
                        let listOfInfrastructures = await infrastructureFind(query);
                        let listOfChargingSessions = await chargingSessionFind(params);

                        let responseToFrontEnd = await activeSessionsMyChargers(chargersFound, listOfInfrastructures, listOfChargingSessions);
                        return res.status(200).send(responseToFrontEnd);

                    });
                }
                else {
                    return res.status(200).send([]);
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get active sessions on my chargers
router.get('/api/private/chargingSession/activeSessionsMyChargers', async (req, res, next) => {
    var context = "GET /api/private/chargingSession/activeSessionsMyChargers";
    try {

        var userId = req.headers['userid'];
        var queryChargingSessions = {
            $and: [
                {
                    chargerOwner: userId
                },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusRunning
                        },
                        {
                            status: process.env.SessionStatusInPause
                        }
                    ]
                }
            ]
        };

        chargingSessionFind(queryChargingSessions)
            .then(async (result) => {

                if (result.length > 0) {

                    var listOfChargingSessions = result;

                    var queryCharger = {
                        $and: [
                            {
                                createUser: userId
                            },
                            /*{
                                plugs: {
                                    $elemMatch: {
                                        status: process.env.PlugsStatusInUse
                                    }
                                }
                            },*/
                            {
                                hasInfrastructure: true,
                                active: true
                            }
                        ]
                    };

                    let chargersFound = await chargerFind(queryCharger);
                    let queryInfrastructures = await getInfrastructureId(chargersFound);
                    let listOfInfrastructures = await infrastructureFind(queryInfrastructures);

                    //return res.status(200).send(result);

                    let responseToFrontEnd = await activeSessionsMyChargers(chargersFound, listOfInfrastructures, listOfChargingSessions);
                    //console.log("responseToFrontEnd 1 ", responseToFrontEnd.length, " - userId - ", userId)
                    return res.status(200).send(responseToFrontEnd);
                }
                else {

                    return res.status(200).send([]);

                };

            })
            .catch((error) => {

                console.error(`[${context}][chargingSessionFind] Error `, error.message);
                return res.status(500).send(error.message);

            })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get session summary
router.get('/api/private/chargingSession/summary', (req, res, next) => {
    const context = "GET /api/private/chargingSession/summary";
    try {
        let userId = req.headers['userid'];
        if (!req.query._id) {
            return res.status(400).send({ auth: false, code: 'server_chargingSession_id_required', message: "Charging Session id is required" });
        }
        else {
            let query = {
                _id: req.query._id,
                userId: userId
            };

            //console.log("query", query);
            chargingSessionFindOne(query)
                .then(async (chargingSessionFound) => {
                    if (chargingSessionFound) {
                        chargingSessionFound = JSON.parse(JSON.stringify(chargingSessionFound));

                        let queryCharger = {
                            hwId: chargingSessionFound.hwId,
                            hasInfrastructure: true,
                            active: true
                        };

                        //Add hasInvoice logic
                        let invoiceId = chargingSessionFound.invoiceId
                        let hasInvoice = false
                        if (invoiceId !== null && invoiceId !== undefined) {
                            let invoice = await getInvoiceDocument(invoiceId)
                            if (invoice) {
                                if (invoice.status == process.env.InvoiceStatusCompleted && chargingSessionFound.userIdWillPay === chargingSessionFound.userId) {
                                    hasInvoice = true
                                }
                            }
                        };

                        let evInSession;
                        if (chargingSessionFound.evId && chargingSessionFound.evId !== '-1' && chargingSessionFound.paymentMethod === process.env.PaymentMethodPlafond) {
                            evInSession = await getPlafond(chargingSessionFound.evId)
                        };

                        chargingSessionFound.hasInvoice = hasInvoice

                        let chargerFound = await chargerFindOne(queryCharger);
                        chargerFound = JSON.parse(JSON.stringify(chargerFound));

                        let plug = chargerFound.plugs.filter(plug => {
                            return plug.plugId === chargingSessionFound.plugId
                        });

                        chargerFound.plugs = plug;

                        if ((chargingSessionFound.bookingId === undefined) || (chargingSessionFound.bookingId === "")) {
                            let bookingFound = {};
                            if ((chargingSessionFound.idTag === undefined) || (chargingSessionFound.idTag === "")) {
                                let contract = {}
                                let sessionSummary = await createSessionSummary(chargerFound, chargingSessionFound, bookingFound, contract, evInSession);
                                return res.status(200).send(sessionSummary);
                            } else {
                                /*
                                var queryContract = {
                                    cards: {
                                        $elemMatch: {
                                            idTag: chargingSessionFound.idTag
                                        }
                                    }
                                };
                                */
                                let queryContract = {
                                    networks: {
                                        $elemMatch: {
                                            $or: [
                                                {
                                                    name: "EVIO",
                                                    tokens: {
                                                        $elemMatch: {
                                                            $or: [
                                                                { idTagDec: chargingSessionFound.idTag },
                                                                { idTagHexa: chargingSessionFound.idTag },
                                                                { idTagHexaInv: chargingSessionFound.idTag }
                                                            ]
                                                        }
                                                    }
                                                },
                                                {
                                                    name: "MobiE",
                                                    tokens: {
                                                        $elemMatch: {
                                                            $or: [
                                                                { idTagDec: chargingSessionFound.idTag }
                                                            ]
                                                        }
                                                    }
                                                }
                                            ]

                                        }
                                    }
                                };
                                let contract = await getcontract(queryContract);
                                let sessionSummary = await createSessionSummary(chargerFound, chargingSessionFound, bookingFound, contract, evInSession);
                                return res.status(200).send(sessionSummary);
                            };
                        } else {
                            let queryBooking = {
                                _id: chargingSessionFound.bookingId
                            };
                            let bookingFound = await getBooking(queryBooking);

                            if ((chargingSessionFound.idTag === undefined) || (chargingSessionFound.idTag === "")) {
                                let contract = {}
                                let sessionSummary = await createSessionSummary(chargerFound, chargingSessionFound, bookingFound, contract, evInSession);
                                return res.status(200).send(sessionSummary);
                            }
                            else {
                                /*
                                var queryContract = {
                                    cards: {
                                        $elemMatch: {
                                            idTag: chargingSessionFound.idTag
                                        }
                                    }
                                };
                                */
                                let queryContract = {
                                    networks: {
                                        $elemMatch: {
                                            $or: [
                                                {
                                                    name: "EVIO",
                                                    tokens: {
                                                        $elemMatch: {
                                                            $or: [
                                                                { idTagDec: chargingSessionFound.idTag },
                                                                { idTagHexa: chargingSessionFound.idTag },
                                                                { idTagHexaInv: chargingSessionFound.idTag }
                                                            ]
                                                        }
                                                    }
                                                },
                                                {
                                                    name: "MobiE",
                                                    tokens: {
                                                        $elemMatch: {
                                                            $or: [
                                                                { idTagDec: chargingSessionFound.idTag }
                                                            ]
                                                        }
                                                    }
                                                }
                                            ]

                                        }
                                    }
                                };
                                let contract = await getcontract(queryContract);
                                let sessionSummary = await createSessionSummary(chargerFound, chargingSessionFound, bookingFound, contract, evInSession);
                                return res.status(200).send(sessionSummary);
                            };
                        };


                    } else {
                        return res.status(400).send({ auth: true, code: 'server_chargingSesion_not_found', message: "Charging session not found for given parameters" });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get chargers with required action
router.get('/api/private/chargingSession/siemens', (req, res, next) => {
    var context = "GET /api/private/chargingSession/siemens";
    try {
        const filter = {};
        if (req.body) {
            filter.query = req.body;
        };
        console.log(" filter.query ", filter.query);
        ChargingSession.find(filter.query, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargingSession) {
                    return res.status(200).send({ chargingSession });
                }
                else
                    return res.status(200).send({ auth: true, code: 'server_request_not_found', message: "Request not found" });
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/byTariffId', (req, res, next) => {
    var context = "GET /api/private/chargingSession/byTariffId";
    try {
        var query = req.body
        chargingSessionFind(query)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/myChargingSessions', (req, res, next) => {
    var context = "GET /api/private/chargingSession/myChargingSessions";
    try {
        var userId = req.headers['userid'];
        var params = req.query;
        if (params.hwId === undefined) {
            var query = {
                status: process.env.SessionStatusStopped,
                userId: userId,
                $and: [
                    { stopDate: { $gte: params.startDate } },
                    { stopDate: { $lte: params.endDate } }
                ]
            };
        }
        else {
            var query = {
                status: process.env.SessionStatusStopped,
                $or: [
                    { userId: userId },
                    { hwId: params.hwId }
                ],
                $and: [
                    { stopDate: { $gte: params.startDate } },
                    { stopDate: { $lte: params.endDate } }
                ]
            };
        };
        chargingSessionFind(query)
            .then((result) => {
                if (result.length != 0) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargingSessionFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/chargingSessionsMyChargers', (req, res, next) => {
    var context = "GET /api/private/chargingSession/chargingSessionsMyChargers";
    try {
        var params = req.query;
        let userId = req.headers.userid;
        var query = {
            status: process.env.SessionStatusStopped,
            $and: [
                { stopDate: { $gte: params.startDate } },
                { stopDate: { $lte: params.endDate } }
            ],
            hwId: params.hwId,
            chargerOwner: userId
        };
        chargingSessionFind(query)
            .then((result) => {
                if (result.length != 0) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargingSessionFind] Error `, error.message);
                return res.status(500).send(error.message);
            });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/sessions', (req, res, next) => {
    var context = "GET /api/private/chargingSession/sessions";
    try {

        var userId = req.headers['userid'];
        var params = req.query;
        if (params.hwId === undefined) {
            var query = {
                status: process.env.SessionStatusStopped,
                userId: userId,
                $and: [
                    { stopDate: { $gte: params.startDate } },
                    { stopDate: { $lte: params.endDate } }
                ]
            };
        }
        else {
            var query = {
                status: process.env.SessionStatusStopped,
                $and: [
                    { stopDate: { $gte: params.startDate } },
                    { stopDate: { $lte: params.endDate } }
                ],
                $or: [
                    { hwId: params.hwId },
                    { userId: userId }
                ]
            };
        };

        chargingSessionFind(query)
            .then((result) => {
                if (result.length != 0) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargingSessionFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/sessions/mySessionAndSessionsMyChargers', (req, res, next) => {
    var context = "GET /api/private/chargingSession/sessions/mySessionAndSessionsMyChargers";
    try {

        var userId = req.headers['userid'];
        var params = req.query;
        var body = req.body;

        var query = {
            status: process.env.SessionStatusStopped,
            $and: [
                { stopDate: { $gte: params.startDate } },
                { stopDate: { $lte: params.endDate } }
            ],
            $or: [
                { chargerOwner: userId },
                { userId: userId },
                { evId: body.evId }
            ]
        };

        chargingSessionFind(query)
            .then((result) => {
                if (result.length != 0) {
                    //console.log(result.length);
                    return res.status(200).send(result);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargingSessionFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/sessions/checkPaymentMethod', (req, res, next) => {
    var context = "GET /api/private/chargingSession/sessions/checkPaymentMethod";
    try {

        var params = req.query;

        var query = {
            paymentMethodId: params.paymentMethodId,
            status: {$in: [
                ...pendingStatusesStartSessions,
                process.env.SessionStatusRunning,
                process.env.SessionStatusToStop,
                process.env.SessionStatusInPause
            ]},
        };

        chargingSessionFind(query)
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch((error) => {
                console.error(`[${context}][chargingSessionFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/emptySessions', (req, res, next) => {
    const context = "GET transaction/api/private/chargingSession/emptySessions";
    try {

        const limitOfQuery = req.query.limit ? req.query.limit : process.env.LimitEmptySessions;

        /*var query = {
            status: process.env.SessionStatusStopped,
            stopTransactionReceived: true,
            paymentId: { "$exists": false },
            $and: [
                { paymentMethod: { $ne: process.env.PaymentMethodNotPay } },
                { paymentMethod: { $ne: process.env.PaymentMethodTypeTransfer } }
            ]
        };*/

        /*let query = {
            status: process.env.SessionStatusStopped,
            stopTransactionReceived: true,
            $and: [
                { paymentMethod: { $ne: process.env.PaymentMethodNotPay } },
                { paymentMethod: { $ne: process.env.PaymentMethodTypeTransfer } }
            ],
            $or: [
                {
                    paymentType: process.env.PaymentTypeAD_HOC,
                    $or: [
                        {
                            paymentId: { "$exists": false },
                        },
                        {
                            $and: [
                                { paymentId: { "$exists": true, $ne: "" } },
                                { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                            ]
                        }
                    ]
                },
                {
                    paymentType: process.env.PaymentTypeMonthly,
                    paymentMethod: process.env.PaymentMethodPlafond,
                    $or: [
                        {
                            paymentId: { "$exists": false },
                        },
                        {
                            $and: [
                                { paymentId: { "$exists": true, $ne: "" } },
                                { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                            ]
                        }
                    ]
                }
            ]/*,
            $or: [
                {
                    paymentId: { "$exists": false },
                },
                {
                    $and: [
                        { paymentId: { "$exists": true, $ne: "" } },
                        { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                    ]
                }
            ]*/
        //};*/

        let query = {
            status: process.env.SessionStatusStopped,
            stopTransactionReceived: true,
            //paymentMethod: { $ne: process.env.PaymentMethodNotPay },
            $or: [
                {
                    paymentType: process.env.PaymentTypeAD_HOC,
                    $and: [
                        {
                            paymentMethod: { $ne: "Unknown" }
                        },
                        {
                            paymentMethod: { $ne: "unknown" }
                        },
                        {
                            paymentMethod: { $ne: "UNKNOWN" }
                        },
                        {
                            paymentMethod: { $ne: process.env.PaymentMethodNotPay }
                        },
                        {
                            paymentMethod: { $ne: process.env.PaymentMethodTypeTransfer }
                        }
                    ],
                    $or: [
                        {
                            paymentId: { "$exists": false },
                        },
                        {
                            $and: [
                                { paymentId: { "$exists": true, $ne: "" } },
                                { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                            ]
                        }
                    ]
                },
                {
                    $or: [
                        { syncToPlafond: false },
                        { syncToPlafond: { "$exists": false } }
                    ],
                    $and: [
                        { plafondId: { $nin: [ "-1", null ] } },
                        { plafondId: { "$exists": true } }
                    ]
                }
            ]
        };

        //console.log("query", query)

        chargingSessionFind(query, Number(limitOfQuery))
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch((error) => {

                console.error(`[${context}] [chargingSessionFindE] rror `, error);
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/chargingSession/cancelPaymentFailedSessions', (req, res, next) => {
    var context = "GET transaction/api/private/chargingSession/cancelPaymentFailedSessions";
    try {

        let query = {
            status: process.env.SessionStatusFailed,
            paymentStatus: { $ne: process.env.ChargingSessionPaymentStatusCanceled }
        };

        ChargingSession.find(query, (error, sessionsFound) => {

            if (error) {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            }
            else {

                return res.status(200).send(sessionsFound);

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/chargingSession/sessionsStatusToStart', (req, res, next) => {
    var context = "GET /api/private/chargingSession/sessionsStatusToStart";
    try {
        const query = {
            status: {$in: pendingStatusesStartSessions}

        };

        chargingSessionFind(query)
            .then((chargingSessionFound) => {

                return res.status(200).send(chargingSessionFound);

            })
            .catch((error) => {

                console.error(`[${context}][chargingSessionFind] ERROR `, error);
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/chargingSession/sessionsByEV/:evId', (req, res, next) => {
    var context = "GET /api/private/chargingSession/sessionsByEV/:evId";
    try {

        let evId = req.params.evId;

        let query = {
            evId: evId
        };

        ChargingSession.find(query, (err, sessionsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(sessionsFound);
            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/chargingSession/byInvoiceStatus', (req, res, next) => {
    var context = "GET /api/private/chargingSession/byInvoiceStatus";
    try {

        var query = {
            invoiceStatus: false,
            paymentStatus: process.env.ChargingSessionPaymentStatusPaid,
            $or: [
                { invoiceId: { $exists: true, $eq: "" } },
                { invoiceId: { $exists: false } },
            ]
        };

        chargingSessionFind(query)
            .then((chargingSessionFound) => {

                return res.status(200).send(chargingSessionFound);

            })
            .catch((error) => {

                console.error(`[${context}][chargingSessionFind] ERROR `, error);
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/chargingSession/monthlyBilling', (req, res, next) => {
    var context = "GET /api/private/chargingSession/monthlyBilling";
    try {

        let received = req.body;
        let userId = received.userId;
        let startDate = received.startDate;
        let endDate = received.endDate;
        //let month = received.month;
        delete received.startDate;
        delete received.endDate;
        delete received.userId;
        //let year = new Date().getFullYear();

        startDate = `${startDate}T00:00`;
        endDate = `${endDate}T23:59`;

        let queryCreated = {

            status: process.env.SessionStatusStopped,
            clientType: "b2b",
            paymentMethod: process.env.PaymentMethodTypeTransfer,
            /*
            paymentMethod: {
                $ne: [
                    process.env.PaymentMethodNotPay,
                    process.env.PaymentMethodUnknown
                ]
            },
            */
            $and: [
                { stopDate: { $gte: startDate } },
                { stopDate: { $lte: endDate } }
            ],
            $or: [
                { userId: userId },
                { userIdWillPay: userId }
            ],
            invoiceStatus: { $exists: false },
            $or: [
                { paymentId: { $exists: false } },
                { paymentId: { $eq: "" } },
                { paymentId: { $eq: "NA" } },
                { paymentId: { $eq: "-1" } },
            ]


        };

        let query = Object.assign(received, queryCreated);

        //console.log("Query", query);

        ChargingSession.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                //console.log("result", result.length);
                return res.status(200).send(result);

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

/**
 * Responsible for return countries that have sessions to be billed in the billing period
 */
router.get('/api/private/chargingSession/getCountriesToBillingPeriodSessions', async (req, res, next) => {
    const context = "[GET /api/private/chargingSession/getCountriesToBillingPeriodSessions]";
    try {

        let { userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time } = req.query

        if(!userId || !billingPeriod) {
            return res.status(400).send({ auth: false, code: 'userId_and_billingPeriod_required', message: "UserId and BillingPeriod are requiered" });
        }

        invoiceWithoutPayment = invoiceWithoutPayment === "true"
        let queryCreated =
        {
            $and: [
                { clientName: process.env.WhiteLabelGoCharge, chargerType: { $in: [ Enums.ChargerTypes.GoCharge, Enums.ChargerTypes.Hyundai ] } },
                { status: process.env.SessionStatusStopped },
                { paymentStatus: invoiceWithoutPayment ? 'UNPAID' : 'PAID' },
                {
                    $or: [
                        { invoiceStatus: false },
                        { invoiceStatus: { $exists: false } },
                    ]
                },
                { userIdToBilling: userId },
                { "tariff.billingType": "billingTypeForBilling" },
                { paymentMethod: { $ne: process.env.PaymentMethodNotPay } },
                { totalPower: { $gt: 0 } },
                { timeCharged: { $gt: 60 } },
                invoiceWithoutPayment ? {
                    $or: [
                        { paymentId: { $exists: false } },
                        { paymentId: { $exists: true, $eq: null } },
                    ]
                } : {
                    paymentId: { $exists: true, $ne: null, $ne: "" }
                },
                start_date_time ? { stopDate: { $gte: new Date(start_date_time) } } : {},
                end_date_time ? { stopDate: { $lte: new Date(end_date_time) } } : {},
                (billingPeriod === 'MONTHLY' && !end_date_time) ? { stopDate: { $lte: new Date(getLastDateOfPreviousMonth()) } } : {}
            ]
        };

        const sessions = await ChargingSession.find(queryCreated, { address: 1, fees: 1 }).lean();
        const fetchedCountryCodes = sessions.map(session => session.fees?.countryCode ?? session.address?.country);
        const setCoutryCodes = [...new Set(fetchedCountryCodes)];

        return res.status(200).send(setCoutryCodes);
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return res.status(500).send(error.message);
    }

});

router.get('/api/private/chargingSession/billingPeriodSessions', async (req, res, next) => {
    const context = "GET /api/private/chargingSession/billingPeriodSessions";
    try {

        let { userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, country } = req.query
        invoiceWithoutPayment = invoiceWithoutPayment === "true"
        let queryCreated = {
            $and: [
                { clientName: process.env.WhiteLabelGoCharge },
                { chargerType: { $in: [ Enums.ChargerTypes.GoCharge, Enums.ChargerTypes.Hyundai ] } },
                { status: process.env.SessionStatusStopped },
                { paymentStatus: invoiceWithoutPayment ? 'UNPAID' : 'PAID' },
                {
                    $or: [
                        { invoiceStatus: false },
                        { invoiceStatus: { "$exists": false } },
                    ]
                },
                //{ userIdWillPay: userId },
                { userIdToBilling: userId },
                { "tariff.billingType": "billingTypeForBilling" },
                { paymentMethod: { $ne: process.env.PaymentMethodNotPay } },
                { totalPower: { $gt: 0 } },
                { timeCharged: { $gt: 60 } },
                invoiceWithoutPayment ? {
                    $or: [
                        { paymentId: { "$exists": false } },
                        { paymentId: { "$exists": true, $eq: null } },
                    ]
                } : {
                    $and: [
                        { paymentId: { "$exists": true, $ne: null } },
                        { paymentId: { "$exists": true, $ne: "" } },
                    ]
                },
                country ? { $or: [{ "address.country": country, "fees.countryCode": { $exists: false } }, { "fees.countryCode": country }] } : {},
                start_date_time ? { stopDate: { $gte: start_date_time } } : {},
                end_date_time ? { stopDate: { $lte: end_date_time } } : {},
            ]
        };

        if (billingPeriod === 'MONTHLY' && !end_date_time) {
            let end_date_time = getLastDateOfPreviousMonth()
            queryCreated["$and"].push({ stopDate: { $lte: end_date_time } })
        }
        console.log(JSON.stringify(queryCreated, null, 2))

        let sessions = await ChargingSession.find(queryCreated).sort({ startDate: 1 }).lean()
        return res.status(200).send(sessions);


    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargingSession/getBillingSessions', async (req, res, next) => {
    const context = "GET /api/private/chargingSession/getBillingSessions";
    try {

        const featureFlagEnabled = await toggle.isEnable('reprocess-attach-of-sessions-6739');
        if(!featureFlagEnabled) {
            console.log(`[${context}][FEATUREFLAG][reprocess-attach-of-sessions-6739]`)
            return res.status(403).send({ code: 'feature_deactivated', message: "Feature deactivated" });
        }

        let { invoiceId } = req.query

        let queryCreated = { invoiceId };

        const sessions = await ChargingSession.find(queryCreated).sort({ startDate: 1 }).lean()
        return res.status(200).send(sessions);

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargingSession/toHistory', (req, res, next) => {
    var context = "GET /api/private/chargingSession/toHistory";
    try {

        let query = {
            status: process.env.SessionStatusStopped,
            $or: [
                { "sessionSync": false },
                { "sessionSync": { "$exists": false } }
            ]
        };

        ChargingSession.find(query, (err, sessionsFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            } else {

                return res.status(200).send(sessionsFound);

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargingSession/updatedToHistory', (req, res, next) => {
    var context = "GET /api/private/chargingSession/updatedToHistory";
    try {

        /*
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        today.toDateString()
        yesterday.toDateString()

        let todayYear = today.getFullYear();
        let yesterdayYear = yesterday.getFullYear();
        let todayDay;
        let todayMonth;
        let yesterdayMonth;
        let yesterdayDay;

        if (today.getDate() < 10) {
            todayDay = "0" + today.getDate();
        } else {
            todayDay = today.getDate();
        };

        if (yesterday.getDate() < 10) {
            yesterdayDay = "0" + yesterday.getDate();
        } else {
            yesterdayDay = yesterday.getDate();
        };

        if ((today.getMonth() + 1) < 10) {
            todayMonth = "0" + (today.getMonth() + 1)
        } else {
            todayMonth = today.getMonth() + 1
        };

        if ((yesterday.getMonth() + 1) < 10) {
            yesterdayMonth = "0" + (yesterday.getMonth() + 1)
        } else {
            yesterdayMonth = yesterday.getMonth() + 1
        };

        let startDate = new Date(`${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}T00:00:00.000Z`);
        let endDate = new Date(`${todayYear}-${todayMonth}-${todayDay}T00:00:00.000Z`);
        */

        let received = req.query;
        console.log(req.query);

        let query = {
            status: process.env.SessionStatusStopped,
            sessionSync: true,
            $and: [
                { updatedAt: { $gte: received.startDate } },
                { updatedAt: { $lt: received.endDate } }
            ]
        };

        ChargingSession.find(query, (err, sessionsFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            } else {

                return res.status(200).send(sessionsFound);

            };
        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargingSession/activeSessionsByEV/:evId', (req, res, next) => {
    var context = "GET /api/private/chargingSession/activeSessionsByEV/:evId";
    try {

        let evId = req.params.evId;

        let query = {
            evId: evId,
            status: { $in: [
                ...pendingStatusesStartSessions,
                process.env.SessionStatusRunning,
                process.env.SessionStatusToStop,
                process.env.SessionStatusInPause
            ]}
        };

        ChargingSession.find(query, (err, result) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            };

            return res.status(200).send(result);


        });
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargingSession/toGenerateCSV', (req, res, next) => {
    var context = "GET /api/private/chargingSession/toGenerateCSV";
    try {

        let received = req.body;
        let startDate = received.start_date;
        let endDate = received.end_date;

        startDate = `${startDate}T00:00`;
        endDate = `${endDate}T23:59`;

        console.log(received)
        console.log(startDate)
        console.log(endDate)

        let queryCreated = {
            status: process.env.SessionStatusStopped,
            paymentMethod: { $ne: process.env.PaymentMethodNotPay },
            tariffId: { $ne: "-1" },
            "tariff.billingType": process.env.BillingTypeForBilling,
            // paymentMethod: process.env.PaymentMethodTypeTransfer,
            $and: [
                { stopDate: { $gte: startDate } },
                { stopDate: { $lte: endDate } }
            ]
        };
        let fields = {
            startDate: 1,
            stopDate: 1,
            tariff: 1,
            fees: 1,
            costDetails: 1,
            totalPower: 1,
            address: 1,
            hwId: 1,
            totalPrice: 1,
            userId: 1,
            userIdWillPay: 1,
            evId: 1,
            paymentMethod: 1,
            sessionId: 1,
            invoiceId: 1,
            invoiceStatus: 1,
            paymentStatus: 1,
            totalPrice: 1,
            chargerOwner: 1,
            tariffId: 1,
            userIdToBilling: 1,
            clientName: 1
        }

        ChargingSession.find(queryCreated, fields).lean()
            .then(result => {
                return res.status(200).send(result);
            })
            .catch(error => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            })
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargingSession/priorityIdTags', async (req, res, next) => {
    var context = "GET /api/private/chargingSession/priorityIdTags";
    try {
        let received = req.body;
        let idTagsInfoArray = received.idTagsInfoArray
        let hwId = received.hwId
        let priorityIdTags = await prioritizeIdTags(idTagsInfoArray, hwId)
        return res.status(200).send(priorityIdTags);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargingSession/sessionsToPaymentPeriodic', (req, res, next) => {
    var context = "GET /api/private/chargingSession/sessionsToPaymentPeriodic";
    try {
        let query = req.body;

        chargerFind(query)
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch(error => {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            })

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/evioapi/chargingsessions/active', async (req, res, next) => {
    var context = "GET /evioapi/chargingsessions/active";
    try {

        const userId = req.headers['userid'];
        const received = req.query;
        const infrastructure = req.query.infrastructureId;
        let query;
        let hwIds;

        if (!received.type) {
            return res.status(400).send({ auth: false, code: 'server_reportsType_required', message: "Type is required" });
        };

        if (infrastructure && received.type.toUpperCase() === "EVS") {
            return res.status(400).send({
                auth: false,
                code: 'server_infrastructureId_not_allowed',
                message: 'InfrastructureID parameter not allowed together with type=EVS'
            });
        }

        let fields = {
            _id: 1,
            totalPower: 1,
            estimatedPrice: 1,
            batteryCharged: 1,
            timeCharged: 1,
            CO2Saved: 1,
            authType: 1,
            hwId: 1,
            evId: 1,
            idTag: 1,
            status: 1,
            plugId: 1,
            startDate: 1,
            "readingPoints.readDate": 1,
            "readingPoints.communicationDate": 1,
            "readingPoints.totalPower": 1,
            "readingPoints.instantPower": 1,
            "readingPoints.instantVoltage": 1,
            "readingPoints.instantAmperage": 1,
            sessionId: 1,
            meterStart: 1,
            cardNumber: 1
        };

        if (received.type.toUpperCase() === "EVS") {
            const result = await myFleets(userId)
            let listCars;

            if (!result.myFleetsValidate) {
                return res.status(400).send({ auth: false, code: 'server_user_without_fleets', message: result.message });
            } else {
                listCars = result.listEVs
                if (!Array.isArray(listCars) || listCars.length < 1) {
                    return res.status(400).send({ auth: false, code: 'server_user_does_not_have_ev', message: "User does not have an EV!" });
                }
                console.log(listCars);
            }

            query = {
                $and: [
                    {
                        $or: [
                            { userId: userId },
                            { evOwner: userId }
                        ]
                    },
                    {
                        $or: [
                            {
                                status: process.env.SessionStatusRunning
                            },
                            {
                                status: process.env.SessionStatusInPause
                            }
                        ]
                    },
                    {
                        evId: { $in: listCars }
                    }
                ]
            };

        } else if (received.type.toUpperCase() === "CHARGERS") {

            if (infrastructure) {
                const infrastructureIds = Array.isArray(infrastructure) ? infrastructure : [infrastructure];

                query = {
                    infrastructure: { $in: infrastructureIds }, status: "20", createUser: userId
                };

                let chargerList = await Charger.find(query, { hwId: 1, _id: 0 })

                if (!chargerList || chargerList.length === 0) {
                    return res.status(200).send([]);
                }

                hwIds = chargerList.map(charger => {
                    return charger.hwId;
                })

                query = {
                    $and: [
                        {
                            chargerOwner: userId
                        },
                        {
                            $or: [
                                {
                                    status: process.env.SessionStatusRunning
                                },
                                {
                                    status: process.env.SessionStatusInPause
                                }
                            ]
                        }
                    ]
                };

            } else {
                query = {
                    $and: [
                        {
                            chargerOwner: userId
                        },
                        {
                            $or: [
                                {
                                    status: process.env.SessionStatusRunning
                                },
                                {
                                    status: process.env.SessionStatusInPause
                                }
                            ]
                        }
                    ]
                };

            }

        } else {
            return res.status(400).send({ auth: false, code: 'server_type_not_supported', message: "Type not supported" });
        };

        let chargingSession = await ChargingSession.find(query, fields)

        if (!chargingSession || chargingSession.length < 1) {
            return res.status(200).send([]);
        }

        chargingSession = JSON.parse(JSON.stringify(chargingSession));

        chargingSession.map(session => {
            session.status = 'CHARGING';
            return session;
        })

        return res.status(200).send(chargingSession);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/last', async (req, res, next) => {
    var context = "GET /api/private/chargingSession/last";
    try {
        let foundSession = await ChargingSession.findOne(req.query).sort({ createdAt: -1 }).lean()
        return res.status(200).send(foundSession);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/byId', async (req, res, next) => {
    let context = "GET /api/private/chargingSession/byId";
    try {

        let foundSession = await ChargingSession.findOne(req.query)
        return res.status(200).send(foundSession);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargingSession/notPaid', (req, res, next) => {
    var context = "GET /api/private/chargingSession/notPaid";
    try {

        const { userId } = req.query

        var params = {
            $and: [
                { paymentType: "AD_HOC" },
                { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid },
                {
                    "tariff.billingType": "billingTypeForBilling"
                },
                {
                    paymentMethod: { $ne: process.env.PaymentMethodNotPay }
                },
                {
                    userIdWillPay: userId
                },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusRunning
                        },
                        {
                            status: process.env.SessionStatusInPause
                        },
                        {
                            status: process.env.SessionStatusStoppedAndEvParked
                        },
                        {
                            status: process.env.SessionStatusToStop
                        },
                        {
                            status: process.env.SessionStatusAvailableButNotStopped
                        },
                        {
                            status: process.env.SessionStatusStopped
                        },
                    ]
                }
            ]
        };

        ChargingSession.find(params, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (chargingSession.length > 0) {
                    //console.log("chargingSession", chargingSession.length);
                    return res.status(200).send(chargingSession);
                }
                else
                    return res.status(200).send([]);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get("/api/private/chargingSession", (req, res, next) => {
    const context = "GET /api/private/chargingSession "
    try {
        const sessionID = req.params.sessionID

        if (!sessionID) {
            console.error(`[${context}] Error - Missing sessionID`);
            return res.status(400).send("Missing sessionID");
        }

        ChargingSession.findOne({ _id: sessionID }, (err, chargingSession) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            return res.status(200).send(chargingSession);
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }

})

///////////////////////////////////////////
//Job OCPP 10 to 60 status
var task = null;

router.post('/api/private/chargingSession/job/ocpp/startJob', (req, res) => {
    var context = "POST /api/private/chargingSession/job/ocpp/startJob";
    var timer = "*/20 * * * * *";

    if (req.body.timer)
        timer = req.body.timer;

    getCpModelsWithNoAvailableStatusNotification()
        .then((cpModels) => {

            initJobOcppSessions(timer, cpModels).then(() => {
                task.start();
                console.log("Sessions 10 to 60 Job Started")
                return res.status(200).send('Sessions 10 to 60 Job Started');
            }).catch((e) => {
                return res.status(400).send(e);
            });

        })
        .catch((error) => {
            if (error.response) {
                return res.status(400).send(error.response.data);

            }
            else {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            };
        });


});

router.post('/api/private/chargingSession/job/ocpp/stopJob', (req, res) => {

    task.stop();
    console.log("Sessions 10 to 60 Job Stopped")
    return res.status(200).send('Sessions 10 to 60 Job Stopped');
});

router.post('/api/private/chargingSession/job/ocpp/statusJob', (req, res) => {
    var status = "Stopped";
    if (task != undefined) {
        status = task.status;
    }

    return res.status(200).send({ "Sessions 10 to 60 Job Status": status });
});

router.post('/api/job/ocppSessionsFrom10To60', async (req, res) => {
    const context = "JOB ocppSessionsFrom10To60";
    try {
        console.info(`[${context}] Process started`);

        const cpModels = await getCpModelsWithNoAvailableStatusNotification();
        console.info(`[${context}] cpModels found:${cpModels.length}`);
        if (cpModels && cpModels.length > 0) {
            await sessionsStatusToStart(cpModels);
        }

        console.info(`[${context}] Process completed`);
        return res.status(200).send(`${context} - Process completed successfully`);
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return res.status(500).send({ error: `${context} - An error occurred while processing` });
    }
});

//========== Functions ==========
function initJobOcppSessions(timer, cpModels) {
    return new Promise((resolve, reject) => {

        task = cron.schedule(timer, () => {
            console.log('Running Job Change Sessions OCPP from 10 to 60' + new Date().toISOString());


            sessionsStatusToStart(cpModels)
        }, {
            scheduled: false
        });

        resolve();

    });

};

//Function to validate Fields
function validateFields(chargingSession, res) {
    if (!chargingSession)
        return res.status(400).send({ auth: false, code: 'server_chargingSession_data_required', message: "Charging Session data is required" });
    //throw new Error("Charging Session is required");

    if (!chargingSession.hwId)
        return res.status(400).send({ auth: false, code: 'server_plug_id_required', message: "Plug Id is required" });
    //throw new Error("Plug is required");

    if (!chargingSession.evId)
        return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Electric vehicle Id is required" });
    //throw new Error("EV is required");
};

function getEvs(chargingSession) {
    var context = "Function getEvs";
    return new Promise((resolve, reject) => {
        try {
            var myActiveSessions = [];
            const getEV = (session) => {
                return new Promise(async (resolve, reject) => {
                    session = JSON.parse(JSON.stringify(session));
                    var query = {
                        hwId: session.hwId,
                        hasInfrastructure: true,
                        active: true
                    };
                    var fields = {
                        address: 1
                    };
                    if (session.evId == -1) {
                        var evId = {};
                    }
                    else {
                        var data = {
                            _id: session.evId
                        };
                        var host = process.env.HostEvs + process.env.PathGetEvs;
                        let values = await axios.get(host, { data });
                        var evId = values.data;
                    };
                    if (session.tariffId == -1 || session.tariffId == "") {
                        var tariff = {}
                    }
                    else {
                        var params = {
                            _id: session.tariffId
                        };
                        var host = process.env.HostTariffs + process.env.PathGetTariffById;
                        let values;
                        try {
                            values = await axios.get(host, { params });
                        } catch (error) {
                            if (error.response)
                                console.error(`[${host}][] err`, error.response.data.message);
                            else
                                console.error(`[${host}][] err`, error.message);
                            values = {};
                        }
                        var tariff = values.data;
                        if (tariff)
                            tariff.tariffId = session.tariffId;
                        else
                            tariff = { tariffId: "" }
                    };
                    Charger.findOne(query, fields, (err, result) => {
                        if (err) {
                            console.error(`[${context}][findOne] err`, err);
                            reject(err);
                        } else {
                            if (result) {
                                session.address = result.address;
                                session.evId = evId;
                                session.tariff = tariff;
                                session.source = session.network;
                                myActiveSessions.push(session);
                                resolve(true);
                            } else
                                resolve(false);
                        };
                    });
                });
            };
            Promise.all(
                chargingSession.map(session => getEV(session))
            ).then((result) => {
                resolve(myActiveSessions);
            }).catch((error) => {
                console.error(`[${context}][chargingSession.map] Error `, error.message);
                reject(error);
            });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function infrastructureFind(query) {
    var context = "Funciton infrastructureFind";
    return new Promise((resolve, reject) => {
        Infrastructure.find(query, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err);
            } else {
                resolve(infrastructureFound);
            };
        });
    });
};

function chargingSessionFind(query, limit = undefined) {
    var context = "Funciton chargingSessionFind";
    return new Promise((resolve, reject) => {
        const options = limit ? {limit, sort: {createdAt: -1}} : {};

        ChargingSession.find(query, {}, options, (err, chargingSessionFound) => {
            if (err) {
                console.error(`[${context}][ChargingSession.find] Error `, err.message);
                reject(err);
            } else {
                resolve(chargingSessionFound);
            };
        });
    });
};

function chargingSessionFindOne(query) {
    var context = "Funciton chargingSessionFindOne";
    return new Promise((resolve, reject) => {
        ChargingSession.findOne(query, (err, chargingSessionFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                //console.log("chargingSessionFound", chargingSessionFound);
                resolve(chargingSessionFound);
            };
        });
    });
};

function chargingSessionUpdate(query, newValue) {
    var context = "Funciton chargingSessionUpdate";
    return new Promise((resolve, reject) => {
        ChargingSession.updateChargingSession(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function activeSessionsMyChargers(chargersFound, listOfInfrastructures, listOfChargingSessions) {
    var context = "Funciton activeSessionsMyChargers";
    return new Promise((resolve, reject) => {
        chargersFound = JSON.parse(JSON.stringify(chargersFound));
        listOfInfrastructures = JSON.parse(JSON.stringify(listOfInfrastructures));
        listOfChargingSessions = JSON.parse(JSON.stringify(listOfChargingSessions));

        //console.log("listOfChargingSessions - ", listOfChargingSessions.length)

        const getCharger = (charger) => {
            return new Promise((resolve, reject) => {
                var sessions = listOfChargingSessions.filter((session) => {
                    return session.hwId == charger.hwId;
                });
                //console.log("sessions - ", sessions.length)
                sessionsOfChargers(charger, sessions)
                    .then((newCharger) => {

                        //console.log("sessionsOfChargers - ", newCharger)
                        //Get user name
                        Promise.all(
                            newCharger.plugs.map((plug) => {
                                return new Promise(async (resolve, reject) => {
                                    if (plug.session !== undefined) {
                                        let userName;

                                        if (plug.session.userId && plug.session.userId.toUpperCase() !== "UNKNOWN") {
                                            userName = await getUserNameById(plug.session.userId);
                                        } else {
                                            userName = "";
                                        }
                                        if (userName) {
                                            plug.session.userName = userName;
                                            resolve();
                                        }
                                        else {
                                            plug.session.userName = "";
                                            resolve();
                                        }
                                    }
                                    else {
                                        resolve();
                                    }
                                });
                            })
                        ).then(() => {
                            charger = newCharger;
                            resolve(true);
                        }).catch(() => {
                            charger = newCharger;
                            resolve(true);
                        });
                        //charger = newCharger;
                        //resolve(true);
                    });
            });
        };
        Promise.all(
            chargersFound.map((charger) => getCharger(charger))
        ).then(async () => {
            let newChargersFound = await verifySession(chargersFound);

            //console.log("newChargersFound - ", newChargersFound);
            listOfInfrastructure(newChargersFound, listOfInfrastructures)
                .then((listOfInfrastructures) => {
                    resolve(listOfInfrastructures);
                })
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });
    });
};

function sessionsOfChargers(charger, sessions) {
    var context = "Funciton sessionsOfChargers";
    return new Promise((resolve, reject) => {
        Promise.all(
            sessions.map(session => {
                return new Promise((resolve) => {
                    var found = charger.plugs.indexOf(charger.plugs.find(plug => {
                        return plug.plugId == session.plugId;
                    }));
                    if (found >= 0) {
                        delete session.hwId;
                        delete session.chargerType;
                        delete session.plugId;

                        charger.plugs[found].session = session;
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    };
                });
            })
        ).then((result) => {
            resolve(charger);
        })
    });
};

function listOfInfrastructure(chargersFound, listOfInfrastructures) {
    var context = "Funciton sessionsOfChargers";
    return new Promise((resolve, reject) => {

        if (chargersFound.length == 0) {
            var newListOfinfrastructure = [];
            resolve(newListOfinfrastructure);
        }
        else {
            Promise.all(
                listOfInfrastructures.map(infra => {
                    return new Promise((resolve, reject) => {
                        infra.listChargers = [];
                        infra.listChargers = chargersFound.filter(charger => {
                            return charger.infrastructure == infra._id;
                        });
                        resolve(true);
                    });
                })
            ).then(() => {

                let newListOfInfrastructures = listOfInfrastructures.filter(infrastructure => {
                    return infrastructure.listChargers.length > 0;
                });

                resolve(newListOfInfrastructures);
            }).catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
        };
    });
};

function chargerFindOne(query) {
    var context = "Funciton chargerFindOne";
    return new Promise((resolve, reject) => {
        Charger.findOne(query, (err, chargerFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(chargerFound);
            };
        });
    });
};

function chargerFind(query) {
    var context = "Funciton chargerFind";
    return new Promise((resolve, reject) => {
        Charger.find(query, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(chargersFound);
            };
        });
    });
};

function getBooking(params) {
    var context = "Funciton getBooking";
    return new Promise((resolve, reject) => {
        var host = process.env.HostBooking + process.env.PathGetBookingById;
        axios.get(host, { params })
            .then((value) => {
                var bookingFound = value.data;
                resolve(bookingFound);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error`, error.message);
                //reject(error);
                resolve({});
            });
    });
};

function getcontract(data) {
    var context = "Funciton getcontract";
    return new Promise((resolve, reject) => {
        var host = process.env.HostUser + process.env.PathGetContractByIdTag;
        axios.get(host, { data })
            .then((value) => {
                var contractFound = value.data;
                resolve(contractFound);
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error`, error.message);
                reject(error);
            });
    });
};

function createSessionSummary(chargerFound, chargingSessionFound, bookingFound, contract, evInSession) {
    const context = "Funciton createSessionSummary";
    return new Promise((resolve) => {

        let sessionSummary
        if (evInSession) {
            sessionSummary = {
                charger: chargerFound,
                booking: bookingFound,
                chargingSession: chargingSessionFound,
                contract: contract,
                parking: {},
                plafond: evInSession
            }
        } else {
            sessionSummary = {
                charger: chargerFound,
                booking: bookingFound,
                chargingSession: chargingSessionFound,
                contract: contract,
                parking: {}
            }
        };

        resolve(sessionSummary);

    });
};

function autoStopChargingSession(chargingSessionFound, reason) {
    const context = "Funciton autoStopChargingSession";
    try {
        const host = process.env.HostConnectioStation + process.env.PathConnectioStation;

        let body = {
            _id: chargingSessionFound._id,
            chargerId: chargingSessionFound.hwId,
            plugId: chargingSessionFound.plugId,
            evId: chargingSessionFound.evId,
            userId: chargingSessionFound.userId,
            sessionPrice: chargingSessionFound.estimatedPrice,
            idTag: chargingSessionFound.idTag,
            stopReason: reason,
            action: process.env.ActionStop,
            chargerType: chargingSessionFound.chargerType
        };

        axios.post(host, body)
            .then((result) => {
                if (result.data) {
                    console.log(`[${context}][axios.post] Result `, result.data);
                }
                else {
                    console.error(`[${context}][axios.post] Error`);
                };
            })
            .catch((error) => {
                console.error(`[${context}][axios.post] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error`, error.message);
    };
};

function getChargerId(chargersFound) {
    var context = "Funciton getChargerId";
    return new Promise((resolve, reject) => {
        var chargerHwId = []
        Promise.all(
            chargersFound.map(charger => {
                return new Promise((resolve, reject) => {
                    chargerHwId.push(charger.hwId);
                    resolve(true);
                });
            })
        ).then((result) => {
            resolve(chargerHwId);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });
    });
};

function verifySession(chargersFound) {
    var context = "Funciton verifySession";
    return new Promise((resolve, reject) => {
        var newChargersFound = []

        Promise.all(
            chargersFound.map(charger => {
                return new Promise((resolve, reject) => {
                    var found = charger.plugs.find(plug => {
                        return plug.session != undefined;
                    });
                    if (found) {
                        charger = JSON.parse(JSON.stringify(charger));
                        let plugs = charger.plugs.filter(plug => {
                            return plug.session != undefined
                        });
                        charger.plugs = plugs;
                        newChargersFound.push(charger);
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    }
                });
            })
        ).then((result) => {
            resolve(newChargersFound);
        }).catch((error) => {
            reject(error);
        });
    });
};

function getUserNameById(userId) {
    var context = "Funciton getUserNameById";
    return new Promise((resolve, reject) => {

        let host = process.env.HostUser + process.env.PathGetUser;

        let headers = {
            userid: userId
        }

        axios.get(host, { headers })
            .then(result => {
                if (result.data) {
                    resolve(result.data.name);
                }
                else {
                    reject();
                }
            })
            .catch(err => {
                reject(err);
            });

    });
}

function getPriceEVIO(chargingSessionFound, chargingSession) {
    var context = "Funciton getPriceEVIO";
    return new Promise(async (resolve, reject) => {

        const newCalculations = await toggle.isEnable('charge-832-update-evio-session-calculations');
        if (newCalculations) {
            const result = calculateSessionValues(chargingSessionFound, chargingSession)
            return resolve(result);
        }
        switch (chargingSessionFound.tariff.tariffType) {

            case process.env.TariffByPower:
                console.log(process.env.TariffByPower)

                energyBaseTariff(chargingSessionFound, chargingSession)
                    .then((totalPrice) => {
                        resolve(totalPrice);
                    })
                    .catch((error) => {
                        console.error(`[${context}][energyBaseTariff][.catch] Error`, error.message);
                        reject(error);
                    });

                break;

            case process.env.TariffByTime:
                console.log(process.env.TariffByTime)

                timeBaseTariff(chargingSessionFound, chargingSession)
                    //energyBaseTariff(chargingSessionFound, chargingSession)
                    .then((totalPrice) => {
                        resolve(totalPrice);
                    })
                    .catch((error) => {
                        console.error(`[${context}][timeBaseTariff][.catch] Error`, error.message);
                        reject(error);
                    });

                break;

            default:
                console.log("Others")

                timeBaseTariff(chargingSessionFound, chargingSession)
                    //energyBaseTariff(chargingSessionFound, chargingSession)
                    .then((totalPrice) => {
                        resolve(totalPrice);
                    })
                    .catch((error) => {
                        console.error(`[${context}][timeBaseTariff][.catch] Error`, error.message);
                        reject(error);
                    });

                break;

        };

    });
};

//Function to calculate estimatedPrice using time base tariff
function timeBaseTariffOld(chargingSessionFound, chargingSession) {
    var context = "Funciton timeBaseTariff";
    return new Promise((resolve, reject) => {
        switch (chargingSessionFound.tariff.tariff.chargingAmount.uom) {
            case 's':
                var excl_vat = chargingSession.timeCharged * chargingSessionFound.tariff.tariff.chargingAmount.value;
                var incl_vat = excl_vat + (chargingSession.timeCharged * chargingSessionFound.tariff.tariff.chargingAmount.value) * chargingSessionFound.fees.IVA;
                resolve({ excl_vat: Number(excl_vat.toFixed(2)), incl_vat: Number(incl_vat.toFixed(2)) });
                break;
            case 'min':
                var excl_vat = (chargingSession.timeCharged / 60) * chargingSessionFound.tariff.tariff.chargingAmount.value;
                var incl_vat = excl_vat + ((chargingSession.timeCharged / 60) * chargingSessionFound.tariff.tariff.chargingAmount.value) * chargingSessionFound.fees.IVA;
                resolve({ excl_vat: Number(excl_vat.toFixed(2)), incl_vat: Number(incl_vat.toFixed(2)) });
                break;
            case 'h':
                var excl_vat = (chargingSession.timeCharged / 3600) * chargingSessionFound.tariff.tariff.chargingAmount.value;
                var incl_vat = excl_vat + ((chargingSession.timeCharged / 3600) * chargingSessionFound.tariff.tariff.chargingAmount.value) * chargingSessionFound.fees.IVA;
                resolve({ excl_vat: Number(excl_vat.toFixed(2)), incl_vat: Number(incl_vat.toFixed(2)) });
                break;
            default:
                var excl_vat = (chargingSession.timeCharged / 60) * chargingSessionFound.tariff.tariff.chargingAmount.value;
                var incl_vat = excl_vat + ((chargingSession.timeCharged / 60) * chargingSessionFound.tariff.tariff.chargingAmount.value) * chargingSessionFound.fees.IVA;
                resolve({ excl_vat: Number(excl_vat.toFixed(2)), incl_vat: Number(incl_vat.toFixed(2)) });
                break;
        };
    });
};

function timeBaseTariff(chargingSessionFound, chargingSession) {
    var context = "Funciton timeBaseTariff";
    return new Promise((resolve, reject) => {

        var excl_vat = 0;
        var incl_vat = 0;
        var parkingDuringChargingAmount = 0;
        var iva = 0;
        var activationFee = chargingSessionFound.tariff.tariff.activationFee;
        var costDuringCharge = 0;

        switch (chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.uom) {
            case 's':
                parkingDuringChargingAmount = chargingSession.timeCharged * chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value;
                break;
            case 'h':
                parkingDuringChargingAmount = (chargingSession.timeCharged / 3600) * chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value;
                break;
            default:
                parkingDuringChargingAmount = (chargingSession.timeCharged / 60) * chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value;
                break;
        };

        switch (chargingSessionFound.tariff.tariff.chargingAmount.uom) {
            case 's':
                costDuringCharge = chargingSession.timeCharged * chargingSessionFound.tariff.tariff.chargingAmount.value;
                break;
            case 'h':
                costDuringCharge = (chargingSession.timeCharged / 3600) * chargingSessionFound.tariff.tariff.chargingAmount.value;
                break;
            default:
                costDuringCharge = (chargingSession.timeCharged / 60) * chargingSessionFound.tariff.tariff.chargingAmount.value;
                break;
        };

        if (chargingSessionFound.fees.IVA)
            iva = chargingSessionFound.fees.IVA;
        else
            iva = 0.23

        //Round to two decimal places
        parkingDuringChargingAmount = parseFloat(parkingDuringChargingAmount.toFixed(2));
        activationFee = parseFloat(activationFee.toFixed(2));
        costDuringCharge = parseFloat(costDuringCharge.toFixed(2));

        let costDetails = {
            activationFee: activationFee,
            parkingDuringCharging: parkingDuringChargingAmount,
            parkingAmount: 0,
            timeCharged: chargingSession.timeCharged,
            totalTime: chargingSession.timeCharged,
            totalPower: chargingSession.totalPower,
            costDuringCharge: costDuringCharge
        };

        excl_vat = costDuringCharge + parkingDuringChargingAmount + activationFee;
        incl_vat = excl_vat + (excl_vat * iva);

        let totalPrice = {
            excl_vat: parseFloat(excl_vat.toFixed(2)),
            incl_vat: parseFloat(incl_vat.toFixed(2))
        };

        resolve({ totalPrice, costDetails });

    });
};

//Function to calculate estimatedPrice using energy base tariff
function energyBaseTariff(chargingSessionFound, chargingSession) {
    var context = "Funciton energyBaseTariff";
    return new Promise((resolve, reject) => {

        // if (chargingSessionFound.tariff.tariff.chargingAmount.uom == 'kWh') {
        //     //Convert total power on kWh
        //     var excl_vat = chargingSessionFound.tariff.tariff.chargingAmount.value * (chargingSession.totalPower / 1000);
        //     var incl_vat = excl_vat + ((chargingSessionFound.tariff.tariff.chargingAmount.value * (chargingSession.totalPower / 1000)) * chargingSessionFound.fees.IVA);
        //     resolve({ excl_vat: excl_vat, incl_vat: incl_vat });
        // }
        // else {
        //     var excl_vat = chargingSessionFound.tariff.tariff.chargingAmount.value * chargingSession.totalPower;
        //     var incl_vat = excl_vat + ((chargingSessionFound.tariff.tariff.chargingAmount.value * chargingSession.totalPower) * chargingSessionFound.fees.IVA);
        //     resolve({ excl_vat: excl_vat, incl_vat: incl_vat });
        // };

        //Experiencia Diogo 17/03/2021
        //Convert total power on kWh
        var parkingDuringChargingAmount;
        //var salesTariff = chargingSessionFound.tariff;
        //console.log("chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value", chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value);
        //console.log("chargingSession.timeCharged", chargingSession.timeCharged);

        switch (chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.uom) {
            case 's':
                parkingDuringChargingAmount = chargingSession.timeCharged * chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value;
                break;
            case 'h':
                parkingDuringChargingAmount = (chargingSession.timeCharged / 3600) * chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value;
                break;
            default:
                parkingDuringChargingAmount = (chargingSession.timeCharged / 60) * chargingSessionFound.tariff.tariff.parkingDuringChargingAmount.value;
                break;
        };

        //console.log("parkingDuringChargingAmount", parkingDuringChargingAmount);
        //console.log("chargingSessionFound.tariff.tariff.chargingAmount.value ", chargingSessionFound.tariff.tariff.chargingAmount.value);

        /*if ((chargingSessionFound.status === "20" || chargingSessionFound.status === "70") && chargingSessionFound.tariffId === "6077fe315368980019c2a229") {
            console.log("chargingSession.totalPower", chargingSession.totalPower);
            console.log("chargingSessionFound.fees.IVA", chargingSessionFound.fees);
            console.log("chargingSessionFound.tariff.tariff.chargingAmount.value", chargingSessionFound.tariff.tariff.chargingAmount.value);
            console.log("chargingSessionFound.tariff.tariff.chargingAmount", chargingSessionFound.tariff.tariff.chargingAmount);
            console.log("parkingDuringChargingAmount", parkingDuringChargingAmount);
            console.log("chargingSessionFound.tariff.tariff.activationFee", chargingSessionFound.tariff.tariff.activationFee);
        }*/

        var iva;
        if (chargingSessionFound.fees.IVA)
            iva = chargingSessionFound.fees.IVA;
        else
            iva = 0.23

        console.log("chargingSessionFound", chargingSessionFound.tariff.tariff);
        console.log("chargingSessionFound.tariff.tariff.chargingAmount.value", chargingSessionFound.tariff.tariff.chargingAmount.value);
        console.log("chargingSession", chargingSession.totalPower);

        var costDuringCharge = (chargingSession.totalPower / 1000) * chargingSessionFound.tariff.tariff.chargingAmount.value;
        var activationFee = chargingSessionFound.tariff.tariff.activationFee;
        console.log("costDuringCharge", costDuringCharge);

        //var excl_vat = (chargingSessionFound.tariff.tariff.chargingAmount.value * (chargingSession.totalPower / 1000)) + parkingDuringChargingAmount + chargingSessionFound.tariff.tariff.activationFee;
        //var incl_vat = excl_vat + (excl_vat * iva);

        //Round to two decimal places
        parkingDuringChargingAmount = parseFloat(parkingDuringChargingAmount.toFixed(2));
        activationFee = parseFloat(activationFee.toFixed(2));
        costDuringCharge = parseFloat(costDuringCharge.toFixed(2));

        console.log("costDuringCharge 1 ", costDuringCharge);

        var costDetails = {
            activationFee: activationFee,
            parkingDuringCharging: parkingDuringChargingAmount,
            parkingAmount: 0,
            timeCharged: chargingSession.timeCharged,
            totalTime: chargingSession.timeCharged,
            totalPower: chargingSession.totalPower,
            costDuringCharge: costDuringCharge
        };

        var excl_vat = costDuringCharge + parkingDuringChargingAmount + activationFee;
        var incl_vat = excl_vat + (excl_vat * iva);
        //console.log("excl_vat", excl_vat);
        //console.log("incl_vat", incl_vat);
        //console.log({ excl_vat: Number(excl_vat.toFixed(2)), incl_vat: Number(incl_vat.toFixed(2)) });

        var totalPrice = {
            excl_vat: parseFloat(excl_vat.toFixed(2)),
            incl_vat: parseFloat(incl_vat.toFixed(2))
        };

        resolve({ totalPrice, costDetails });

    });
};

//Function to update a charger
function updateCharger(query, values) {
    var context = "Function updateCharger";
    return new Promise((resolve, reject) => {
        try {
            Charger.updateCharger(query, values, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateCharger] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    };
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to close booking
const closeBooking = (data) => {
    var context = "Function closeBooking";
    return new Promise((resolve, reject) => {

        try {
            var body = {
                plugId: data.plugId,
                userId: data.userId
            };
            var host = process.env.HostBooking + process.env.PathCloseBooking;
            axios.patch(host, body)
                .then((result) => {
                    if (result.data === "") {
                        data.bookingId = "";
                        resolve(data);
                    }
                    else {
                        data.bookingId = result.data;
                        resolve(data);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][patch] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

const updataEv = (evId, userId, status, chargingSessionStatus) => {
    var context = "Function updataEv";
    var host = process.env.HostEvs + process.env.PathEvs;
    if (chargingSessionStatus === undefined || chargingSessionStatus === "") {
        var data = {
            evId: evId,
            userId,
            status
        };
    }
    else {
        var data = {
            evId: evId,
            userId,
            status,
            chargingSessionStatus
        };
    };
    axios.patch(host, data)
        .then((result) => {
            console.log(`[${context}] Result `, result.data.message);
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
        });
};

//Function to verify if existe book pending
const verifyAutomaticBooking = (body) => {
    var context = "Function verifyAutomaticBooking";
    try {
        var host = process.env.HostBooking + process.env.PathBooking;
        axios.patch(host, body)
            .then((result) => {
                var option = result.data;
                if (option) {
                    console.log(`[${context}][Automatic Booking] Result `, result.data);
                }
                else {
                    var query = body;
                    query.active = true;
                    notifymeHistoryFindOne(query)
                        .then(async (notifymeHistoryFound) => {
                            if (notifymeHistoryFound) {
                                //TODO Send notifications to users
                                sendNotificationToUsers(listOfUsers)

                                notifymeHistoryFound.active = false
                                var newValue = { $set: notifymeHistoryFound };
                                query = {
                                    _id: notifymeHistoryFound._id
                                };
                                notifymeHistoryUpdate(query, newValue)
                                    .then((result) => {
                                        if (result) {
                                            console.log("Update successfully");
                                        }
                                        else {
                                            console.log("Update unsuccessfully");
                                        };
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][notifymeHistoryUpdate] Error`, error.message);

                                    });

                            }
                            else {
                                console.log("Notification not found for given parameters");
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][notifymeHistoryFindOne] Error`, error.message);
                            // return res.status(500).send(error.message);
                        });
                };
            })
            .catch((error) => {
                if (error.response !== undefined) {
                    console.log(`[${context}][Automatic Booking] Result `, error.response.data.message);
                } else {
                    console.error(`[${context}][Automatic Booking] Error `, error.message);
                };
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

async function sendNotificationToUsers(listOfUsers) {
     var context = "Function sendNotificationToUsers";
    const promises = listOfUsers.map(userI => notifyChargerAvailable(userI.hwId, userI.userId));
    await Promise.allSettled(promises)
        .catch(errors => errors.forEach(error => console.error(`[${context}] Error`, error.message)));
}

//Function to create a payment
const creatPayment = (body) => {
    var context = "Function creatPayment";
    return new Promise((resolve, reject) => {
        try {
            var host = process.env.HostPayments + process.env.PathCreatPayments;
            //console.log("post host ", host);
            axios.post(host, body)
                .then((result) => {

                    resolve(result.data);
                })
                .catch((error) => {
                    if (error.response) {
                        if (error.response.data.auth !== undefined) {
                            console.log(`[${context}][creatPayment post] Result `, error.response.data.message);
                            reject(error);
                        } else {
                            console.error(`[${context}][creatPayment post] Error `, error.response.data);
                            reject(error);
                        };
                    }
                    else {
                        console.error(`[${context}][creatPayment post] Error `, error.message);
                        reject(error);
                    };
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to find one notifymeHistory
// function notifymeHistoryFindOne(query) {
//     var context = "Function notifymeHistoryFindOne";
//     return new Promise((resolve, reject) => {
//         NotifymeHistory.findOne(query, (error, notifymeHistoryFound) => {
//             if (error) {
//                 console.error(`[${context}] Error`, error.message);
//                 reject(error);
//             }
//             else {
//                 resolve(notifymeHistoryFound);
//             };
//         });
//     });
// };

function notifymeHistoryFindOne(query) {
    var context = "Function notifymeHistoryFindOne";
    let data = query
    let host = process.env.HostNotifications + process.env.PathNotifymeHistoryFindOne
    return new Promise((resolve, reject) => {
        axios.get(host, { data })
            .then(result => {
                resolve(result.data)
            })
            .catch(err => {
                reject(err)
            })
    });
};

//Function to update a notifymeHistory
// function notifymeHistoryUpdate(query, newValue) {
//     var context = "Function notifymeHistoryUpdate";
//     return new Promise((resolve, reject) => {
//         NotifymeHistory.updateNotifymeHistory(query, newValue, (error, result) => {
//             if (error) {
//                 console.error(`[${context}] Error`, error.message);
//                 reject(error);
//             }
//             else {
//                 resolve(result)
//             };
//         })
//     });
// };

function notifymeHistoryUpdate(query, newValue) {
    var context = "Function notifymeHistoryUpdate";
    let data = newValue
    let host = process.env.HostNotifications + process.env.PathNotifymeHistoryUpdate
    return new Promise((resolve, reject) => {
        axios.patch(host, data)
            .then(result => {
                resolve(result.data)
            })
            .catch(err => {
                reject(err)
            })
    });
};


getCpModelsWithNoAvailableStatusNotification()
    .then(cpModels => {

        initJobOcppSessions("*/20 * * * * *", cpModels).then(() => {
            task.start();
            console.log("Sessions 10 to 60 Job Started")

        }).catch((e) => {
            console.log("Error starting Sessions 10 to 60 Job: " + e.message)
        });

    });

//deprecated
/**
 * @deprecated Since version xx. Will be deleted in version xx. Use xxx instead.
 */
//Cron to put status 10 to 60 OCPP sessions
// cron.schedule('*/20 * * * * *', () => {
//     console.log('running every 20 seconds change 10 to 60');
//     sessionsStatusToStart()
// });

function sessionsStatusToStart(cpModels) {
    const stageToLog = "[[JOB] sessionsStatusToStart OCPP] - Session Fail By EVIO platform";
    const actionToLog = "start";
    const baseDataToSaveLog = {
        userId: '',
        hwId: '',
        plugId: '',
        sessionId: '',
        externalSessionId: '',
        stage: stageToLog,
        action: actionToLog,
        status: Enums.SessionFlowLogsStatus.ERROR,
        errorType: Enums.SessionFlowLogsErrorTypes.TIMEOUT_ERROR,
    }
    var context = "Function sessionsStatusToStart";
    var date = new Date();

    var query = {
        status: { $in: pendingStatusesStartSessions },
        model: cpModels
        /*,
        $or: [
            { chargerType: process.env.OCPPSType },
            { chargerType: process.env.OCPPSTypeFastCharger },
            { chargerType: process.env.OCPPJ16Type }
        ]
        */

    };
    //console.log("Date", date);
    chargingSessionFind(query)
        .then((chargingSessionFound) => {
            if (chargingSessionFound.length !== 0) {
                chargingSessionFound.map(chargingSession => {
                    //console.log("chargingSession", (date.getTime() / 1000) - (chargingSession.startDate.getTime() / 1000));
                    if (((date.getTime() / 1000) - (chargingSession.startDate.getTime() / 1000)) >= process.env.ConnectionTimeOut) {
                        var query = {
                            status: { $in: pendingStatusesStartSessions },
                            chargerType: chargingSession.chargerType,
                            hwId: chargingSession.hwId
                        };
                        chargingSession.status = process.env.SessionStatusFailed;
                        chargingSession.command = process.env.StopCommand;
                        chargingSession.stopDate = date;

                        baseDataToSaveLog.userId = chargingSession.userId;
                        baseDataToSaveLog.hwId = chargingSession.hwId;
                        baseDataToSaveLog.plugId = chargingSession.plugId;
                        baseDataToSaveLog.sessionId = chargingSession._id;
                        baseDataToSaveLog.payload = chargingSession;

                        var reason = {
                            reasonCode: 'other',
                            reasonText: 'Session Fail By EVIO platform'
                        };
                        chargingSession.stopReason = reason;
                        var newValues = { $set: chargingSession };
                        chargingSessionUpdate(query, newValues)
                            .then((result) => {
                                if (result) {
                                    const { isDevice = false, deviceType = '' } = Helpers.verifyIsDeviceRequest(result?.createdWay || '');
                                    if(!isDevice){
                                        updatePreAuthorize(chargingSession.transactionId, true)
                                    }
                                    var query = {
                                        hwId: chargingSession.hwId,
                                        hasInfrastructure: true,
                                        active: true
                                    };
                                    chargerFindOne(query)
                                        .then((chargerFound) => {
                                            var found = chargerFound.plugs.indexOf(chargerFound.plugs.find((plug) => {
                                                return plug.plugId == chargingSession.plugId;
                                            }));
                                            if (found != -1) {
                                                chargerFound.plugs[found].status = process.env.PlugStatusAvailable;
                                                var newValues = { $set: chargerFound };
                                                updateCharger(query, newValues)
                                                    .then((answers) => {
                                                        if (answers) {
                                                            /*
                                                            if (chargingSession.paymentMethod === process.env.PaymentMethodCard) {
                                                                cancelPreAuthorisePayment(chargingSession);
                                                            }
                                                            */
                                                            saveSessionLogs({
                                                                ...baseDataToSaveLog,
                                                                errorMessage: "Plug not found for given parameters",
                                                            });
                                                            console.log("[chargingSessionUpdate] Charging session Faild");
                                                        }
                                                        else
                                                            console.log("[chargingSessionUpdate] Not updated");
                                                    })
                                                    .catch((error) => {
                                                        saveSessionLogs({
                                                            ...baseDataToSaveLog,
                                                            errorMessage: "Plug not found for given parameters",
                                                        });
                                                        console.error(`[${context}][updateCharger] ERROR `, error);
                                                    });
                                            }
                                            else {
                                                saveSessionLogs({
                                                    ...baseDataToSaveLog,
                                                    errorMessage: "Plug not found for given parameters",
                                                });
                                                console.log("Plug not found for given parameters");
                                            };
                                        })
                                        .catch((error) => {
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                errorMessage: "Session update error: " + error.message,
                                            });
                                            console.error(`[${context}][chargerFindOne] ERROR `, error);
                                        });

                                    //console.log("[chargingSessionUpdate] Updated");
                                }
                                else {
                                    console.log("[chargingSessionUpdate] Not updated");
                                };
                            })
                            .catch((error) => {
                                saveSessionLogs({
                                    ...baseDataToSaveLog,
                                    errorMessage: "Session update error: " + error.message,
                                });
                                console.error(`[${context}][chargingSessionUpdate] ERROR `, error);
                            });
                    };
                });
            };
        })
        .catch((error) => {
            console.error(`[${context}][chargingSessionFind] ERROR `, error);
        });
};

function startFirebaseNotification(chargingSession) {
    var context = "Function startFirebaseNotification";

    let body = {
        _id: chargingSession._id,
        hwId: chargingSession.hwId,
        plugId: chargingSession.plugId,
        userId: chargingSession.userId,
        instantPower: 0
    }

    if (chargingSession.totalPower === undefined || chargingSession.totalPower === null) {
        body.totalPower = 0;
    }
    else {
        body.totalPower = chargingSession.totalPower;
    }

    if (chargingSession.estimatedPrice === undefined || chargingSession.estimatedPrice === null) {
        body.estimatedPrice = 0;
    }
    else {
        body.estimatedPrice = chargingSession.estimatedPrice;
    }

    if (chargingSession.timeCharged === undefined || chargingSession.timeCharged === null) {
        body.timeCharged = 0;
    }
    else {
        body.timeCharged = chargingSession.timeCharged;
    }

    if (chargingSession.batteryCharged === undefined || chargingSession.batteryCharged === null) {
        body.batteryCharged = -1;
    }
    else {
        body.batteryCharged = chargingSession.batteryCharged;
    }

    if (chargingSession.clientName === "EVIO") {
        axios.post(firebaseStart, body)
            .then((response) => {
                if (response) {
                    updateNotificationsHistory(chargingSession, 'CHARGING_SESSION_START')
                    console.log(`[${context}] Firebase start notification sent successfully`);
                }
                else {
                    console.error(`[${context}] Error `, response);
                }
            })
            .catch((error) => {
                //console.log("error", error.response.status);
                if (error.response != undefined && error.response.status === 400) {
                    console.error(`[${context}] Error `, error.response.data);
                }
                else {
                    console.error(`[${context}] Error `, error.message);
                };
            });
    } else {
        axios.post(firebaseWLStart, body)
            .then((response) => {
                if (response) {
                    updateNotificationsHistory(chargingSession, 'CHARGING_SESSION_START')
                    console.log(`[${context}] Firebase start notification sent successfully`);
                }
                else {
                    console.error(`[${context}] Error `, response);
                }
            })
            .catch((error) => {
                //console.log("error", error.response.status);
                if (error.response != undefined && error.response.status === 400) {
                    console.error(`[${context}] Error `, error.response.data);
                }
                else {
                    console.error(`[${context}] Error `, error.message);
                };
            });
    };

};

function stopFirebaseNotification(chargingSession) {
    var context = "Function stopFirebaseNotification";

    let body = {
        _id: chargingSession._id,
        hwId: chargingSession.hwId,
        plugId: chargingSession.plugId,
        userId: chargingSession.userId
    }

    if (chargingSession.totalPower === undefined || chargingSession.totalPower === null) {
        body.totalPower = 0;
    }
    else {
        body.totalPower = chargingSession.totalPower;
    }

    if (chargingSession.estimatedPrice === undefined || chargingSession.estimatedPrice === null) {
        body.estimatedPrice = 0;
    }
    else {
        body.estimatedPrice = chargingSession.estimatedPrice;
    }

    if (chargingSession.timeCharged === undefined || chargingSession.timeCharged === null) {
        body.timeCharged = 0;
    }
    else {
        body.timeCharged = chargingSession.timeCharged;
    }

    if (chargingSession.batteryCharged === undefined || chargingSession.batteryCharged === null) {
        body.batteryCharged = -1;
    }
    else {
        body.batteryCharged = chargingSession.batteryCharged;
    }

    if (chargingSession.readingPoints.length !== 0) {
        body.instantPower = chargingSession.readingPoints[chargingSession.readingPoints.length - 1].instantPower
    }
    else {
        body.instantPower = 0;
    }
    if (chargingSession.clientName === "EVIO") {
        axios.post(firebaseStop, body)
            .then((response) => {
                if (response) {
                    updateNotificationsHistory(chargingSession, 'CHARGING_SESSION_STOP')
                    console.log(`[${context}] Firebase stop notification sent successfully`);
                } else {
                    console.error(`[${context}] Error `, response);
                }
            })
            .catch((error) => {
                if (error.response) {
                    if (error.response.status === 400) {
                        console.error(`[${context}] Error `, error.response.data);
                    }
                    else {
                        console.error(`[${context}] Error `, error.response);
                    };
                }
                else {
                    console.error(`[${context}] Error `, error.message);
                };
            });
    } else {
        axios.post(firebaseWLStop, body)
            .then((response) => {
                if (response) {
                    updateNotificationsHistory(chargingSession, 'CHARGING_SESSION_STOP')
                    console.log(`[${context}] Firebase stop notification sent successfully`);
                } else {
                    console.error(`[${context}] Error `, response);
                }
            })
            .catch((error) => {
                if (error.response) {
                    if (error.response.status === 400) {
                        console.error(`[${context}] Error `, error.response.data);
                    }
                    else {
                        console.error(`[${context}] Error `, error.response);
                    };
                }
                else {
                    console.error(`[${context}] Error `, error.message);
                };
            });
    };

};

function dataFirebaseNotification(chargingSession, readPoint) {
    var context = "Function dataFirebaseNotification";

    if (readPoint.length !== 0) {

        let body = {
            _id: chargingSession._id,
            instantPower: readPoint[readPoint.length - 1].instantPower,
            totalPower: chargingSession.totalPower,
            estimatedPrice: chargingSession.estimatedPrice,
            timeCharged: chargingSession.timeCharged,
            userId: chargingSession.userId
        }

        if (chargingSession.batteryCharged === undefined || chargingSession.batteryCharged === null) {
            body.batteryCharged = -1;
        }
        else {
            body.batteryCharged = chargingSession.batteryCharged;
        }
        if (chargingSession.clientName === "EVIO") {
            axios.post(firebaseData, body)
                .then((response) => {
                    if (response) {
                        updateNotificationsHistory(chargingSession, 'CHARGING_SESSION_DATA')
                        console.log(`[${context}] Firebase session update notification sent successfully`);
                    } else {
                        console.error(`[${context}] Error `, response);
                    }
                })
                .catch((error) => {
                    if (error.response != undefined && error.response.status === 400) {
                        console.error(`[${context}] Error `, error.response.data);
                    }
                    else {
                        console.error(`[${context}] Error `, error.message);
                    };
                });
        } else {
            axios.post(firebaseWLData, body)
                .then((response) => {
                    if (response) {
                        updateNotificationsHistory(chargingSession, 'CHARGING_SESSION_DATA')
                        console.log(`[${context}] Firebase session update notification sent successfully`);
                    } else {
                        console.error(`[${context}] Error `, response);
                    }
                })
                .catch((error) => {
                    if (error.response != undefined && error.response.status === 400) {
                        console.error(`[${context}] Error `, error.response.data);
                    }
                    else {
                        console.error(`[${context}] Error `, error.message);
                    };
                });
        }
    }

};

function startMyChargerFirebaseNotification(chargingSession) {
    var context = "Function startMyChargerFirebaseNotification";

    Charger.findOne({ hwId: chargingSession.hwId, active: true, hasInfrastructure: true })
        .then((chargerFound) => {

            if (chargerFound.createUser !== chargingSession.userId) {

                let userId = chargerFound.createUser;

                let body = {
                    _id: chargingSession._id,
                    hwId: chargingSession.hwId,
                    plugId: chargingSession.plugId,
                    userId: userId,
                    instantPower: 0
                }

                if (chargingSession.totalPower === undefined) {
                    body.totalPower = 0;
                }
                else {
                    body.totalPower = chargingSession.totalPower;
                }

                if (chargingSession.estimatedPrice === undefined) {
                    body.estimatedPrice = 0;
                }
                else {
                    body.estimatedPrice = chargingSession.estimatedPrice;
                }

                if (chargingSession.timeCharged === undefined) {
                    body.timeCharged = 0;
                }
                else {
                    body.timeCharged = chargingSession.timeCharged;
                }

                if (chargingSession.batteryCharged === undefined) {
                    body.batteryCharged = -1;
                }
                else {
                    body.batteryCharged = chargingSession.batteryCharged;
                }

                if (chargerFound.clientName === "EVIO") {
                    axios.post(firebaseMyChargerStart, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase start notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response != undefined && error.response.status === 400) {
                                console.error(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                } else {
                    axios.post(firebaseMyChargerWLStart, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase start notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            if (error.response != undefined && error.response.status === 400) {
                                console.error(`[${context}] Error `, error.response.data);
                            }
                            else {
                                console.error(`[${context}] Error `, error.message);
                            };
                        });
                }

            }

        })
        .catch((error) => {
            if (error.response != undefined && error.response.status === 400) {
                console.error(`[${context}] Error `, error.response.data);
            }
            else {
                console.error(`[${context}] Error `, error.message);
            };
        });

};

function stopMyChargerFirebaseNotification(chargingSession) {
    var context = "Function stopMyChargerFirebaseNotification";

    Charger.findOne({ hwId: chargingSession.hwId, active: true, hasInfrastructure: true })
        .then((chargerFound) => {

            if (chargerFound.createUser !== chargingSession.userId) {

                let userId = chargerFound.createUser;

                let body = {
                    _id: chargingSession._id,
                    hwId: chargingSession.hwId,
                    plugId: chargingSession.plugId,
                    userId: userId
                }

                if (chargingSession.totalPower === undefined) {
                    body.totalPower = 0;
                }
                else {
                    body.totalPower = chargingSession.totalPower;
                }

                if (chargingSession.estimatedPrice === undefined) {
                    body.estimatedPrice = 0;
                }
                else {
                    body.estimatedPrice = chargingSession.estimatedPrice;
                }

                if (chargingSession.timeCharged === undefined) {
                    body.timeCharged = 0;
                }
                else {
                    body.timeCharged = chargingSession.timeCharged;
                }

                if (chargingSession.batteryCharged === undefined) {
                    body.batteryCharged = -1;
                }
                else {
                    body.batteryCharged = chargingSession.batteryCharged;
                }

                if (chargingSession.readingPoints.length !== 0) {
                    body.instantPower = chargingSession.readingPoints[chargingSession.readingPoints.length - 1].instantPower
                }
                else {
                    body.instantPower = 0;
                }

                if (chargerFound.clientName === "EVIO") {
                    axios.post(firebaseMyChargerStop, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase stop notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                        });
                } else {
                    axios.post(firebaseMyChargerWLStop, body)
                        .then((response) => {
                            if (response) {
                                console.log(`[${context}] Firebase stop notification sent successfully`);
                            } else {
                                console.error(`[${context}] Error `, response);
                            }
                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                        });
                }
            }

        })
        .catch((error) => {
            if (error.response != undefined && error.response.status === 400) {
                console.error(`[${context}] Error `, error.response.data);
            }
            else {
                console.error(`[${context}] Error `, error.message);
            };
        });

};

function getTariff(tariffId) {
    var context = "Function getTariff";
    return new Promise((resolve, reject) => {
        var host = process.env.HostTariffs + process.env.PathGetTariffById;
        var params = {
            _id: tariffId
        };
        axios.get(host, { params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error`, error.message);
                reject(error);
            });
    });
};

function getInfrastructureId(chargersFound) {
    var context = "Function getInfrastructureId";
    return new Promise((resolve, reject) => {

        var infra = [];
        Promise.all(
            chargersFound.map(charger => {
                return new Promise((resolve, reject) => {
                    infra.push(charger.infrastructure);
                    resolve(true);
                })
            })
        ).then(() => {
            var query = {
                _id: infra
            }
            resolve(query);
        }).catch((error) => {
            console.error(`[${context}] Error`, error.message);
            reject(error);
        });

    });
};

function getFees(charger) {
    return new Promise(async (resolve, reject) => {

        let countryCode;
        let postalCode;

        if (charger.address != undefined) {
            if (charger.address.country) {
                if (charger.address.country === 'Portugal' || charger.address.country === '') {
                    countryCode = 'PT';
                }
                else {
                    countryCode = charger.address.country;
                }
            }
            else {
                countryCode = 'PT';
            }

            if (charger.address.zipCode !== undefined && charger.address.zipCode !== "") {
                let result = charger.address.zipCode.split("-");
                if (result.length > 1) {
                    postalCode = result[0];
                }
                else {
                    postalCode = '';
                }
            }
            else {
                postalCode = '';
            }
        }
        else {
            countryCode = 'PT';
        }

        var params = {
            countryCode: countryCode,
            postalCode: postalCode
        }

        axios.get(feesConfig, { params })
            .then((fees) => {
                if (fees.data) {

                    resolve(fees.data);

                }
                else {

                    resolve({ IEC: 0.001, IVA: 0.23 });

                }
            })
            .catch((error) => {
                console.log("[Error] " + error);
                resolve({ IEC: 0.001, IVA: 0.23 });
            });

    });
};

/**
 * Builds and sends a request to get user fees
 * @param {import('../models/charger.js')} charger
 * @param {string} userId
 * @returns { Promise<{ IEC: number, IVA: number }> }
 */
async function getFeesWithUser(charger, userId) {
    const { address } = charger;
    const splitZipCode = address?.zipCode?.split("-");

    const countryCode = address?.country && address.country !== 'Portugal'
        ? address.country
        : 'PT';

    const postalCode = splitZipCode?.length > 1
        ? splitZipCode[0]
        : '';

    const params = {
        countryCode,
        postalCode,
        userId,
    }

    try {
        const fees = await axios.get(feesConfig, { params })
        if (fees.data) {
            return fees.data;
        }
    } catch (error) {
        console.log(`[Function getFeesWithUser Error]  `, error);
    }

    return { IEC: 0.001, IVA: 0.23 };
}

function cancelPreAuthorisePayment(chargingSession) {
    var context = "Function cancelPreAuthorisePayment";

    var host = process.env.HostPayments + process.env.PathCancelPreAuthorisePayment;

    var data = {
        transactionId: chargingSession.transactionId
    };


    let headers = {
        clientname: chargingSession.clientName
    }

    axios.delete(host, { headers }, { data })
        .then((result) => {
            console.log("Pre authorise payment cancel!");
        })
        .catch((error) => {
            console.error(`[${context}] Error`, error.message);
        });
};

function validateTariffId(chargingSessionFound, chargingSession) {
    var context = "Function validateTariffId";

    return new Promise(async (resolve, reject) => {

        try {

            //console.log("1", chargingSessionFound.tariff.billingType);

            if (chargingSessionFound.tariffId == '-1' || chargingSessionFound.tariffId == "") {
                console.log("tariffId === -1")

                let totalPrice = {
                    excl_vat: 0.0,
                    incl_vat: 0.0 * chargingSessionFound.fees.IVA
                };

                let costDetails = {
                    activationFee: 0,
                    parkingDuringCharging: 0,
                    parkingAmount: 0,
                    timeCharged: chargingSession.timeCharged,
                    totalTime: chargingSession.timeCharged,
                    totalPower: chargingSession.totalPower,
                    costDuringCharge: 0
                };

                resolve({ totalPrice, costDetails });

            } else {

                if (chargingSessionFound.tariff.billingType === process.env.BillingTypeNotApplicable) {

                    /*if (chargingSessionFound.userIdWillPay === chargingSessionFound.chargerOwner) {

                    let totalPrice = {
                        excl_vat: 0,
                        incl_vat: 0 * chargingSessionFound.fees.IVA
                    };

                    resolve(totalPrice);

                    }*/
                    //else {


                    let totalPrice = await getPriceEVIO(chargingSessionFound, chargingSession);
                    resolve(totalPrice);

                    // }

                }
                else if (chargingSessionFound.tariff.billingType === process.env.BillingTypeForImportingCosts) {

                    let totalPrice = await getPriceEVIO(chargingSessionFound, chargingSession);
                    resolve(totalPrice);

                }
                else {

                    let totalPrice = await getPriceEVIO(chargingSessionFound, chargingSession);
                    resolve(totalPrice);

                };

            };


        } catch (error) {

            console.error(`[${context}] Error`, error.message);
            reject(error);

        };

    });

};

function runFirstTime() {
    var query = {}

    var fields = { hwId: 1 }

    ChargingSession.find(query, fields, (err, result) => {
        if (err) {
            console.error("Error", err);
        }
        else {
            if (result.length > 0) {
                result.map(session => {

                    var query = {
                        hwId: session.hwId,
                        active: true,
                        hasInfrastructure: true
                    };
                    var fields = {
                        createUser: 1
                    }
                    Charger.findOne(query, fields, (err, charger) => {
                        if (err) {
                            console.error("Error", err);
                        }
                        else {
                            if (charger) {
                                var query = {
                                    _id: session._id
                                };
                                var newValues = { $set: { chargerOwner: charger.createUser } };
                                ChargingSession.updateChargingSession(query, newValues, (err, result) => {
                                    if (err) {
                                        console.error("Error", err);
                                    }
                                    else {
                                        console.log("Updated");
                                    };
                                });
                            };
                        };
                    });
                });
            };
        };
    });
};

function addUserIdWillPayPaymentMethod() {

    let query = {
        status: process.env.SessionStatusStopped,
        paymentMethod: { "$exists": false },
        userIdWillPay: { "$exists": false }
    };

    chargingSessionFind(query)
        .then((result) => {

            if (result.length > 0) {
                result.map(session => {
                    var newValues = {
                        $set: {
                            paymentMethod: process.env.PaymentMethodWallet,
                            userIdWillPay: session.userId
                        }
                    }
                    ChargingSession.updateChargingSession({ _id: result._id }, newValues, async (err, result) => {
                        if (err) {
                            console.error("Error", err.message);
                        }
                        else {
                            if(await checkBeforeSendSessionToHistoryQueue(result?.status)){
                                sendSessionToHistoryQueue(result._id,  'Function addUserIdWillPayPaymentMethod');
                            }
                            console.log("result");
                        };
                    });
                });
            };

        })
        .catch((error) => {
            console.error("Error", error.message);
        });


};

function getEVByEvId(evId) {
    var context = "Function getEVByEvId";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostEvs + process.env.PathGetEVByEVId;
        let params = { _id: evId };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data.userId);
                }
                else {
                    resolve('-1');
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve('-1');
            });
    });
};

function getEVAllByEvId(evId) {
    var context = "Function getEVByEvId";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostEvs + process.env.PathGetAllInfoById;
        let params = { _id: evId };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve({});
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve({});
            });
    });
};

//getCpModelsWithNoAvailableStatusNotification();
function getCpModelsWithNoAvailableStatusNotification() {
    var context = "Function getCpModelsWithNoAvailableStatusNotification";
    return new Promise(async (resolve, reject) => {

        let host = process.env.HostConfigs + process.env.PathGetCpModel;

        axios.get(host)
            .then((result) => {

                if (result.data.length > 0) {

                    let response = [];

                    Promise.all(
                        result.data.map(cpModel => {
                            return new Promise((resolve, reject) => {
                                response.push(cpModel.chargerModel);
                                resolve();
                            });
                        })
                    ).then(() => {

                        resolve(response);

                    }).catch((error) => {

                        console.error(`[${context}] Error `, error.message);
                        resolve([]);

                    });

                }
                else {
                    resolve([]);
                };

            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve([]);
            });

    });
};

//addEVOwnerToSession();
function addEVOwnerToSession() {

    let query = {
        evId: { $ne: '-1' }
    };

    chargingSessionFind(query)
        .then((result) => {
            if (result.length > 0) {

                result.map(session => {

                    getEVByEvId(session.evId)
                        .then(evOwner => {

                            let newValues = {
                                $set: {
                                    evOwner: evOwner
                                }
                            };

                            ChargingSession.updateChargingSession({ _id: session._id }, newValues, (err, result) => {
                                if (err) {
                                    console.error("Error", err.message);
                                }
                                else {
                                    console.log("Session Updated");
                                };
                            });
                        })
                });

            };
        })
        .catch((error) => {
            console.error("Error", error.message);
        });
};

//testHistory()
function testHistory() {
    try {
        //60353f6a53868b001f230e0d - com EVID
        //609e40c9e32126001fca6b90 - sem EVID
        ChargingSession.findOne({ _id: "60353f6a53868b001f230e0d" }, (err, result) => {
            if (err) {
                console.error("Error", err.message);
            }
            else {

                //console.log("result", result);

                let data = result;
                let host = "http://statitics-v2:3031/api/private/history"

                axios.post(host, data)
                    .then((result) => {

                        console.log("result", result.data);

                    })
                    .catch((error) => {
                        console.error("Error", error.message);
                    })

            };
        });
    } catch (error) {
        console.error("Error", error.message);
    };

};


//priceCorrection();
function priceCorrection() {
    chargingSessionFind({ $or: [{ status: "40" }], tariffId: { $ne: "-1" }, _id: "6224f4a0515e8300127abf33" })
        //chargingSessionFind({ _id: "61378c435b1e600022a3f6cd" })
        .then((result) => {
            if (result.length > 0) {

                result.forEach(async session => {

                    try {

                        // console.log("Session", session.totalPrice);
                        //let tariff = await getTariff(session.tariffId);
                        //console.log("tariff", tariff);
                        //session.tariff = tariff;

                        if (session.status === "70") {
                            console.log("tariff", session.tariff);
                        }

                        validateTariffId(session, session)
                            .then((response) => {

                                console.log("4", response)
                                let totalPrice = response.totalPrice;
                                let costDetails = response.costDetails;

                                //console.log("totalPrice", totalPrice);
                                session.totalPrice = totalPrice;
                                session.costDetails = costDetails;
                                session.estimatedPrice = totalPrice.incl_vat;

                                ChargingSession.update({ _id: session._id }, { $set: session }, (err, result) => {
                                    if (err) {
                                        console.error("Error", err.message);
                                    }
                                    else {
                                        console.log("Session Updated")
                                    }
                                });

                            })
                            .catch((error) => {
                                console.error("Error [getPriceEVIO]", error.message);
                            })


                    } catch (error) {
                        console.error("Error", error.message);
                    }

                });

            };
        })
        .catch((error) => {
            console.error("Error", error.message);
        });
};

//addStopTransactionReceived();
function addStopTransactionReceived() {
    ChargingSession.updateMany({ status: "40" }, { $set: { stopTransactionReceived: true } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else
            console.log("result", result);
    });
};

//addAddress()
function addAddress() {
    chargingSessionFind({})
        .then((result) => {
            if (result.length > 0) {

                result.map(async session => {

                    try {

                        Charger.findOne({ hwId: session.hwId }, { address: 1 }, (err, chargerFound) => {
                            if (err) {
                                console.error("Error", error.message);
                            } else {

                                if (chargerFound) {
                                    ChargingSession.updateChargingSession({ _id: session._id }, { $set: { address: chargerFound.address } }, (err, result) => {
                                        if (err) {
                                            console.error("Error", error.message);
                                        }

                                        console.log("Session Updated")

                                    });
                                };
                            };
                        });

                    } catch (error) {
                        console.error("Error", error.message);
                    }

                });

            };
        })
        .catch((error) => {
            console.error("Error", error.message);
        });
};

//testeFunction()
function testeFunction() {

    /*var query = {
        status: process.env.SessionStatusStopped,
        stopTransactionReceived: true,
        paymentId: { "$exists": false },
        $and: [
            { paymentMethod: { $ne: process.env.PaymentMethodNotPay } },
            { paymentMethod: { $ne: process.env.PaymentMethodTypeTransfer } }
        ]
    };*/
    var query = {
        status: process.env.SessionStatusStopped,
        stopTransactionReceived: true,
        $and: [
            { paymentMethod: { $ne: process.env.PaymentMethodNotPay } },
            { paymentMethod: { $ne: process.env.PaymentMethodTypeTransfer } }
        ],
        $or: [
            { paymentId: { "$exists": false } },
            {
                $and: [
                    { paymentId: { "$exists": true, $ne: "" } },
                    { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                ]
            }
        ]
    };
    chargingSessionFind(query)
        .then((result) => {

            console.log("result.length", result.length);

        })
        .catch((error) => {

            console.error(`[${context}] [chargingSessionFindE] rror `, error);

        });
};

function getInvoiceDocument(invoiceId) {
    var context = "Function getInvoiceDocument";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostBilling + process.env.PathGetInvoiceDocument;
        let params = { invoiceId: invoiceId };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve(null);
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve(null);
            });
    });
}

function getLastDateOfPreviousMonth() {
    let context = "getLastDateOfPreviousMonth function"
    try {
        let currentIsoDate = new Date().toISOString()
        let currentIsoDateObj = new Date(currentIsoDate)
        currentIsoDateObj.setDate(0)
        currentIsoDateObj.setHours(23, 59, 59)
        return currentIsoDateObj.toISOString()
    } catch (error) {
        return new Date().toISOString()
    }
};

/*ChargingSession.findOne({ _id: "63fe4abbe93c1000137686d6" }, (err, session) => {
    if (err)
        console.error(`[] Error `, err.message);
    tariffCostSessions(session)
        .then((result) => {
            //console.log("result", result)
        })
})*/

function tariffCostSessions(session) {
    let context = "Function tariffCostSessions";
    return new Promise(async (resolve, reject) => {
        try {

            if (session.purchaseTariff) {

                if (session.purchaseTariff.weekSchedule && session.purchaseTariff.weekSchedule.length > 0) {

                    //console.log("session.costDetails.timeCharged", session.timeCharged)

                    let numberOfQuarters = Math.ceil(((Math.abs(session.timeCharged) / 60) / 15));

                    //console.log("numberOfQuarters", numberOfQuarters);

                    let averageKwh = ((session.costDetails.totalPower / 1000) / numberOfQuarters)

                    //console.log("averageKwh", averageKwh);

                    let startDay = session.startDate.getDay();
                    let endDay = session.stopDate.getDay();
                    let sessionCost = 0;
                    let startHour = session.startDate.getHours();
                    let startMin = session.startDate.getMinutes();
                    let endHour = session.stopDate.getHours();
                    let endMin = session.stopDate.getMinutes();
                    let startYear = session.startDate.getFullYear();
                    let stopYear = session.stopDate.getFullYear();
                    let startMonth = session.startDate.getMonth();
                    let stopMonth = session.stopDate.getMonth();
                    let startDayNumber = session.startDate.getDate();
                    let stopDayNumber = session.stopDate.getDate();

                    if (startHour < 10) {
                        startHour = "0" + startHour
                    };
                    if (startMin < 10) {
                        startMin = "0" + startMin
                    };
                    if (endHour < 10) {
                        endHour = "0" + endHour
                    };
                    if (endMin < 10) {
                        endMin = "0" + endMin
                    };
                    if (startDayNumber < 10) {
                        startDayNumber = "0" + startDayNumber
                    };
                    if (stopDayNumber < 10) {
                        stopDayNumber = "0" + stopDayNumber
                    };
                    if (startMonth + 1 < 10) {
                        startMonth = "0" + (startMonth + 1)
                    } else {
                        startMonth = (startMonth + 1)
                    };
                    if (stopMonth + 1 < 10) {
                        stopMonth = "0" + (stopMonth + 1)
                    } else {
                        stopMonth = (stopMonth + 1)
                    };

                    let timeStartSession = startHour + ":" + startMin
                    let timeStopSession = endHour + ":" + endMin

                    let differenceInTime = new Date(`${stopYear}-${stopMonth}-${stopDayNumber}T23:59:59Z`).getTime() - new Date(`${startYear}-${startMonth}-${startDayNumber}T00:00:00Z`).getTime();
                    let differenceInDays = differenceInTime / (1000 * 3600 * 24);
                    let numberDays = parseInt(differenceInDays);

                    if (startDay === endDay) {
                        //Session in same day

                        console.log("Same day")

                        var weekDay;
                        switch (startDay) {
                            case 1:
                                weekDay = "monday";
                                break;
                            case 2:
                                weekDay = "tuesday";
                                break;
                            case 3:
                                weekDay = "wednesday";
                                break;
                            case 4:
                                weekDay = "thursday";
                                break;
                            case 5:
                                weekDay = "friday";
                                break;
                            case 6:
                                weekDay = "saturday";
                                break;
                            default:
                                weekDay = "sunday";
                                break;
                        };

                        var weekDaySchedule = session.purchaseTariff.weekSchedule.find(schedule => {
                            return schedule.weekDay === weekDay;
                        });

                        var kwhListAverage = [];

                        // console.log("weekDaySchedule", weekDaySchedule);
                        if (weekDaySchedule) {

                            //console.log("weekDaySchedule", weekDaySchedule);
                            let scheduleTime = await makeScheduleTime(weekDaySchedule.scheduleTime);

                            for (let i = 0; i < numberOfQuarters; i++) {
                                kwhListAverage.push(averageKwh);
                                let found = scheduleTime.find(time => {
                                    let startTime = time.startTime;
                                    let stopTime;
                                    if (time.stopTime === "00:00") {
                                        stopTime = "23:59";
                                    } else {
                                        stopTime = time.stopTime
                                    };

                                    return ((startTime < timeStartSession && stopTime > timeStartSession) || (stopTime <= timeStopSession && startTime > timeStartSession) || (startTime <= timeStopSession && stopTime > timeStopSession));
                                });

                                if (found) {
                                    sessionCost += (averageKwh * found.value);
                                }
                            }
                            /*scheduleTime.forEach(time => {

                                let startTime = time.startTime;
                                let stopTime;
                                if (time.stopTime === "00:00") {
                                    stopTime = "23:59";
                                } else {
                                    stopTime = time.stopTime
                                };

                                //console.log("startTime", startTime);
                                //console.log("stopTime", stopTime);
                                //console.log("timeStartSession", timeStartSession);
                                //console.log("timeStopSession", timeStopSession);
                                //console.log("startTime < timeStartSession && stopTime > timeStartSession", startTime < timeStartSession && stopTime > timeStartSession);
                                //console.log("stopTime <= timeStopSession && startTime > timeStartSession", stopTime <= timeStopSession && startTime > timeStartSession);

                                if ((startTime < timeStartSession && stopTime > timeStartSession) || (stopTime <= timeStopSession && startTime > timeStartSession) || (startTime <= timeStopSession && stopTime > timeStopSession)) {
                                    kwhListAverage.push(averageKwh);
                                    sessionCost += (averageKwh * time.value);
                                };

                            });*/

                            var purchaseTariffDetails = {
                                kwhListAverage: kwhListAverage,
                                excl_vat: parseFloat(sessionCost.toFixed(4)),
                                incl_vat: parseFloat((sessionCost + (sessionCost * session.fees.IVA)).toFixed(4))
                            };
                            resolve(purchaseTariffDetails);

                        } else {

                            resolve(false);

                        };

                    } else {

                        console.log("Diferent Day", numberDays);

                        let dayOne = startDay
                        let kwhListAverage = [];

                        for (let i = 0; i < numberDays; i++) {
                            //console.log("i - ", i)
                            if (dayOne === 7) {
                                dayOne = 0;
                            };
                            let weekDay;
                            switch (dayOne) {
                                case 1:
                                    weekDay = "monday";
                                    break;
                                case 2:
                                    weekDay = "tuesday";
                                    break;
                                case 3:
                                    weekDay = "wednesday";
                                    break;
                                case 4:
                                    weekDay = "thursday";
                                    break;
                                case 5:
                                    weekDay = "friday";
                                    break;
                                case 6:
                                    weekDay = "saturday";
                                    break;
                                default:
                                    weekDay = "sunday";
                                    break;
                            };

                            //console.log("weekDayStart", weekDay);
                            //console.log("dayOne 0", dayOne);
                            dayOne++;
                            //console.log("dayOne 1", dayOne);
                            let weekDaySchedule = session.purchaseTariff.weekSchedule.find(schedule => {
                                return schedule.weekDay === weekDay;
                            });

                            if (weekDaySchedule) {
                                //console.log("numberOfQuarters", numberOfQuarters);
                                let scheduleTime = await makeScheduleTime(weekDaySchedule.scheduleTime);

                                //console.log("scheduleTime", scheduleTime);
                                for (let i = 0; i < (numberOfQuarters); i++) {

                                    kwhListAverage.push(averageKwh);
                                    let found = scheduleTime.find(time => {
                                        let startTime = time.startTime;
                                        let stopTime;
                                        if (time.stopTime === "00:00") {
                                            stopTime = "23:59";
                                        } else {
                                            stopTime = time.stopTime
                                        };

                                        return ((startTime < timeStartSession && stopTime > timeStartSession) || (stopTime <= timeStopSession && startTime > timeStartSession) || (startTime <= timeStopSession && stopTime > timeStopSession));
                                    });

                                    if (found) {
                                        sessionCost += (averageKwh * found.value);
                                    }
                                }

                            };
                        };
                        //console.log("kwhListAverage", kwhListAverage.length);
                        //console.log("parseFloat(sessionCost.toFixed(2)", parseFloat(sessionCost.toFixed(2)));
                        let purchaseTariffDetails = {
                            kwhListAverage: kwhListAverage,
                            excl_vat: parseFloat(sessionCost.toFixed(2)),
                            incl_vat: parseFloat((sessionCost + (sessionCost * session.fees.IVA)).toFixed(2))
                        };
                        //console.log("purchaseTariffDetails", purchaseTariffDetails);
                        resolve(purchaseTariffDetails);

                    };

                } else {

                    resolve(false);

                };

            } else {

                resolve(false);

            };

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            resolve(false);

        };
    });
};

function makeScheduleTime(scheduleTime) {
    var context = "Function makeScheduleTime";
    return new Promise(async (resolve, reject) => {
        try {

            let newScheduleTime = ScheduleTime;

            if (scheduleTime.length === 1) {
                newScheduleTime.forEach(time => {
                    time.value = scheduleTime[0].value;
                });
                resolve(newScheduleTime);
            } else {
                newScheduleTime.forEach(time => {

                    let found = scheduleTime.find(elem => {

                        if (elem.stopTime === "00:00") {
                            elem.stopTime = "23:59";
                        }
                        if (time.stopTime === "00:00") {
                            time.stopTime = "23:59";
                        }
                        /*if (elem.startTime === time.startTime) {
                            return elem
                        }
                        if (elem.stopTime === time.stopTime) {
                            return elem
                        }
                        if (time.startTime > elem.startTime && time.stopTime < elem.stopTime && time.stopTime > elem.startTime) {

                            return elem
                        }*/
                        return (elem.startTime === time.startTime || elem.stopTime === time.stopTime || (time.startTime > elem.startTime && time.stopTime < elem.stopTime && time.stopTime > elem.startTime))
                    });

                    if (found)
                        time.value = found.value;

                });

                resolve(newScheduleTime);
            };

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            resolve([]);

        };
    });
};

//tariffCostSessionsRunFirstTime()
function tariffCostSessionsRunFirstTime() {
    var context = "Function tariffCostSessionsRunFirstTime";

    var query = {
        status: process.env.SessionStatusStopped,
        stopTransactionReceived: true
    };

    chargingSessionFind(query)
        .then((sessionsFound) => {

            if (sessionsFound.length > 0) {

                sessionsFound.forEach(session => {

                    tariffCostSessions(session)
                        .then((result) => {

                            if (result) {

                                //console.log(`Result`, result);
                                ChargingSession.findOneAndUpdate({ _id: session._id }, { $set: { purchaseTariffDetails: result } }, { new: true }, (err, response) => {
                                    if (err) {

                                        console.error(`[${context}] Error `, err.message);

                                    } else {

                                        console.log("Session updated");

                                    };
                                });

                            } else {

                                //console.log(`Result`, result);

                            };

                        })
                        .catch((error) => {

                            console.error(`[${context}] Error `, error.message);

                        });

                });

            };

        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
        });
};

async function prioritizeIdTags(idTagsInfoArray, hwId) {
    const context = "Function prioritizeIdTags"
    try {
        let idTags = idTagsInfoArray.map(obj => obj.idTag)
        let query = [{
            "$match": {
                "idTag": {
                    "$in": idTags
                },
                "hwId": hwId
            }
        },
        {
            "$group": {
                "_id": {
                    "idTag": "$idTag"
                },
                "COUNT(*)": {
                    "$sum": 1
                }
            }
        },
        {
            "$project": {
                "idTag": "$_id.idTag",
                "count": "$COUNT(*)",
                "_id": 0
            }
        }
        ];

        let idTagsCount = await ChargingSession.aggregate(query)
        let sortedIdTags = idTagsCount.sort((a, b) => b.count - a.count).map(idTagCount => idTagsInfoArray.find(obj => obj.idTag === idTagCount.idTag))
        let inexistingIdTagsOnSessions = idTagsInfoArray.filter(obj => !sortedIdTags.find(sortedObj => sortedObj.idTag === obj.idTag))
        return [...sortedIdTags, ...inexistingIdTagsOnSessions]
    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
        return idTagsInfoArray
    }
};

//addClientName();
//addUserIdToBilling();
function addClientName() {
    let context = "Function addClientName";

    ChargingSession.updateMany({}, { $set: { clientName: "EVIO" } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };
        console.log("result", result)
    })
};

async function updateb2bComissioned(req) {
    let context = "Function updateb2bComissioned";

    try {
        let date = req.body.date;
        if (date) {
            console.log("Update ChargerSessions created before: " + date);

            query = { "createdAt": { $lt: date } }

            let foundSession = await ChargingSession.updateMany(query, { $set: { "b2bComissioned": true } })

            if (foundSession) {
                console.log(foundSession)
            } else {
                console.log("No sessions found")
            }
        }
        else {
            console.log("No date provided!");
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
}

function addUserIdToBilling() {
    let context = "Function addUserIdToBilling";

    ChargingSession.find({}, { _id: 1, userIdWillPay: 1 }, (err, sessionsFound) => {

        if (err) {
            console.error(`[${context}] Error `, err.message);
        };

        if (sessionsFound.length > 0) {
            sessionsFound.forEach(session => {
                ChargingSession.updateChargingSession({ _id: session._id }, { $set: { userIdToBilling: session.userIdWillPay } }, (err, sessionsFound) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    };

                    console.log("Success")
                });
            });
        };

    })
}

function getPlafond(evId) {
    const context = "Function getPlafond";
    return new Promise(async (resolve) => {
        try {

            let host = process.env.HostPayments + process.env.PathGetPlafondByEV + evId;
            let plafond = await axios.get(host);
            resolve(plafond.data);

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            resolve(null);

        };
    });
};

//updateSessionsPurchaseTariffDetails("EVIO")
async function updateSessionsPurchaseTariffDetails(clientName) {
    let context = "Function updateSessionsPurchaseTariffDetails";
    try {

        console.log("Start update sessions purchase tariff details! ")

        let sessions = await ChargingSession.find({ status: "40", clientName: clientName }).count();

        console.log("Number of sessions - ", sessions)
        if (sessions > 0) {

            let limiteQuery = 400

            let numberOfPages;

            if (sessions > limiteQuery) {
                numberOfPages = Math.ceil((sessions / limiteQuery));
            } else {
                numberOfPages = 1;
            }

            for (let i = 1; i <= numberOfPages; i++) {
                setTimeout(async () => {

                    console.log("i - ", i, " Date - ", new Date())
                    let options = {
                        skip: (Number(i) - 1) * Number(limiteQuery),
                        limit: Number(limiteQuery)
                    };

                    let query = { status: "40", clientName: clientName };

                    console.log("options - ", options)
                    let sessions = await ChargingSession.find(query, {}, options);

                    if (sessions.length > 0) {

                        for (let j = 0; j < sessions.length; j++) {

                            setTimeout(async () => {
                                console.log("j - ", j, " Date - ", new Date())

                                try {

                                    let purchaseTariffDetails = await tariffCostSessions(sessions[j])

                                    let response = await ChargingSession.findOneAndUpdate({ _id: sessions[j]._id }, { $set: { purchaseTariffDetails: purchaseTariffDetails } }, { new: true })

                                    sendSessionToHistoryQueue(sessions[j]._id, context);
                                    console.log("Charging Session Updated");

                                } catch (error) {
                                    console.error(`[${context}][tariffCostSessions] Error `, error.message);
                                };

                            }, j * 2 * 1000);

                        }

                    }

                }, i * 600 * 1000);
            }

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
}

async function updateNotificationsHistory(session, type) {
    const context = "Function updateNotificationsHistory"
    try {
        return await ChargingSession.findOneAndUpdate({ _id: session._id }, { $push: { notificationsHistory: { type: type, timestamp: notificationTimestamp(session, type), totalPower: notificationTotalPower(session) } } })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

function notificationTimestamp(session, type) {
    const context = "Function notificationTimestamp"
    try {
        switch (type) {
            case 'CHARGING_SESSION_START':
                return session.startDate ? moment.utc(session.startDate).format() : new Date().toISOString()
            case 'CHARGING_SESSION_STOP':
                return session.stopDate ? moment.utc(session.stopDate).format() : new Date().toISOString()
            case 'CHARGING_SESSION_DATA':
                return session.readingPoints.length > 0 ? moment.utc(session.readingPoints[session.readingPoints.length - 1].readDate).format() : new Date().toISOString()
            default:
                return new Date().toISOString()
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return new Date().toISOString()
    }
}


async function notificationManagement(session) {
    const context = "Function notificationManagement";
    try {
        /*
            The algorithm runs on a specific setting of parameters.
            The first of them is the minimum number of readingPoints.
            The longer the number, the better.

            Sometimes there can be sessions with a really small value of readingPoints, that's why the
            minimum value is so low (5)

            Only the readingPoints of the last hour are valid, to prevent communication errors and misleading notifications

            The lastReadingPoint must be from the last 15 minutes
        */

        //  ===== Parameters and restrictions ===== //
        let minimumValidReadingPoints = 5
        let allReadingPointsIntervalOfTime = 60 //minutes
        let lastReadingPointIntervalOfTime = 15 //minutes
        let endOfChargeLimit = 0.05
        //  ======================================= //


        let { userId, readingPoints, _id, chargerType, endOfEnergyDate, clientName, tariff, notificationsHistory } = session
        // Get all needed values with applied restrictions
        let {
            validReadingPoints,
            nLastValidPoints,
            allReadingPointsDateLimit,
            lastReadingPointDateLimit,
            firstReadDate,
            lastReadDate,
            currentDate
        } = readingPointsRestrictions(readingPoints, minimumValidReadingPoints, allReadingPointsIntervalOfTime, lastReadingPointIntervalOfTime)

        // The algorithm runs if theres a minimum of valid reading points
        if (validReadingPoints.length >= minimumValidReadingPoints) {

            // The algorithm runs if valid reading points are newer than the limit of allReadingPointsIntervalOfTime
            if (firstReadDate >= allReadingPointsDateLimit) {

                // The algorithm runs if the last reading point is newer than the limit of lastReadingPointIntervalOfTime
                if (lastReadDate >= lastReadingPointDateLimit) {

                    //Check if no energy has been consumed comparing the last readingPoint with the first of the last 5
                    if (sendNoChargingNotification(notificationsHistory) && noEnergyConsumed(nLastValidPoints)) {
                        let updateDate = moment.utc(nLastValidPoints[0].readDate).format()
                        let updateEnergy = nLastValidPoints[0].totalPower

                        // await updateEndOfEnergyDate(chargerType, null, updateDate, _id, 'CHARGING_SESSION_EV_NOT_CHARGING')
                        let newValues = {
                            $push: {
                                notificationsHistory: {
                                    type: NotificationType.CHARGING_SESSION_EV_NOT_CHARGING,
                                    timestamp: updateDate,
                                    totalPower: updateEnergy,
                                }
                            },
                            $set: {
                                endOfEnergyDate: updateDate
                            }
                        }
                        await updateSessionValues(_id, newValues)
                        await notifySessionEvNotCharging(tariff, userId)
                    } else {
                        if (energyConsumed(nLastValidPoints)) {

                            if (sendChargingNotification(notificationsHistory)) {
                                let updateDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate).format()
                                let updateEnergy = nLastValidPoints[nLastValidPoints.length - 1].totalPower

                                let newValues = {
                                    $push: {
                                        notificationsHistory: {
                                            type: NotificationType.CHARGING_SESSION_EV_CHARGING,
                                            timestamp: updateDate,
                                            totalPower: updateEnergy,
                                        }
                                    }
                                }

                                await updateSessionValues(_id, newValues)
                                await notifySessionEvCharging(userId);
                            }

                        }
                    }

                }

            } else {
                console.log(`[${context}] Session with id ${_id} and chargerType ${chargerType} not descending its readingPoints`)
            }

        } else {
            if (readingPoints.length >= minimumValidReadingPoints) {

                //Check if no energy has been consumed comparing the last readingPoint with the first of the last 5
                let lastValidPoints = readingPoints.slice(-minimumValidReadingPoints)
                if (sendNoChargingNotification(notificationsHistory) && lastValidPoints.every(element => !element.totalPower)) {
                    let updateDate = moment.utc(lastValidPoints[0].readDate).format()
                    let updateEnergy = lastValidPoints[0].totalPower

                    // await updateEndOfEnergyDate(chargerType, null, updateDate, _id, 'CHARGING_SESSION_EV_NOT_CHARGING')
                    let newValues = {
                        $push: {
                            notificationsHistory: {
                                type: NotificationType.CHARGING_SESSION_EV_NOT_CHARGING,
                                timestamp: updateDate,
                                totalPower: updateEnergy,
                            }
                        },
                        $set: {
                            endOfEnergyDate: updateDate
                        }
                    }
                    await updateSessionValues(_id, newValues)
                    await notifySessionEvNotCharging(tariff, userId);
                } else {
                    let positiveIndex = lastValidPoints.findLastIndex(elem => elem.totalPower > 0)
                    let positivePoints = positiveIndex >= 0 ? lastValidPoints.slice(0, positiveIndex + 1) : []
                    if (positivePoints.length > 1 && energyConsumed(positivePoints)) {

                        if (sendChargingNotification(notificationsHistory)) {
                            let updateDate = moment.utc(positivePoints[positivePoints.length - 1].readDate).format()
                            let updateEnergy = positivePoints[positivePoints.length - 1].totalPower

                            let newValues = {
                                $push: {
                                    notificationsHistory: {
                                        type: NotificationType.CHARGING_SESSION_EV_CHARGING,
                                        timestamp: updateDate,
                                        totalPower: updateEnergy,
                                    }
                                }
                            }

                            await updateSessionValues(_id, newValues)
                            await notifySessionEvCharging(userId);
                        }

                    }
                }
            } else {
                let positiveIndex = readingPoints.findLastIndex(elem => elem.totalPower > 0)
                let positivePoints = positiveIndex >= 0 ? readingPoints.slice(0, positiveIndex + 1) : []
                if (positivePoints.length > 1 && energyConsumed(positivePoints)) {

                    if (sendChargingNotification(notificationsHistory)) {
                        let updateDate = moment.utc(positivePoints[positivePoints.length - 1].readDate).format()
                        let updateEnergy = positivePoints[positivePoints.length - 1].totalPower

                        let newValues = {
                            $push: {
                                notificationsHistory: {
                                    type: NotificationType.CHARGING_SESSION_EV_CHARGING,
                                    timestamp: updateDate,
                                    totalPower: updateEnergy,
                                }
                            }
                        }

                        await updateSessionValues(_id, newValues)
                        await notifySessionEvCharging(userId);
                    }

                }
            }

        }


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}
function readingPointsRestrictions(readingPoints, minimumValidReadingPoints, allReadingPointsIntervalOfTime, lastReadingPointIntervalOfTime) {
    const context = "Function readingPointsRestrictions";
    try {
        let currentDate = moment.utc(new Date().toISOString())
        //We evaluate only reading points with a totalPower bigger than 0
        let validReadingPoints = readingPoints.filter(point => point.totalPower > 0)

        // Last minimumValidReadingPoints
        let nLastValidPoints = validReadingPoints.slice(-minimumValidReadingPoints)

        // All Reading Points Restriction
        let allReadingPointsDateLimit = moment.utc(currentDate).add(-allReadingPointsIntervalOfTime, 'minutes').format()

        // Last reading point Restriction
        let lastReadingPointDateLimit = moment.utc(currentDate).add(-lastReadingPointIntervalOfTime, 'minutes').format()

        //First valid read date
        let firstReadDate = nLastValidPoints.length > 0 ? moment.utc(nLastValidPoints[0].readDate).format() : ""

        //Last valid read date
        let lastReadDate = nLastValidPoints.length > 0 ? moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate).format() : ""


        return { validReadingPoints, nLastValidPoints, allReadingPointsDateLimit, lastReadingPointDateLimit, firstReadDate, lastReadDate, currentDate }

    } catch {
        console.error(`[${context}] Error `, error.message);
        return { validReadingPoints: [], nLastValidPoints: [], allReadingPointsDateLimit: "", lastReadingPointDateLimit: "", firstReadDate: "", lastReadDate: "" }
    }
}
function noEnergyConsumed(nLastValidPoints) {
    const context = "Function noEnergyConsumed"
    try {
        let energyDiff = (nLastValidPoints[nLastValidPoints.length - 1].totalPower - nLastValidPoints[0].totalPower) / 1000
        let firstPointDate = moment.utc(nLastValidPoints[0].readDate)
        let lastPointDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate)
        let timeDiff = moment.duration(lastPointDate.diff(firstPointDate)).asHours()
        return timeDiff > 0 ? ((energyDiff / timeDiff) < 1 ? true : false) : false
    } catch (error) {
        console.error(`[${context}] Error `, error)
        return false
    }
}

function sendNoChargingNotification(notificationsHistory) {
    const context = "Function sendNoChargingNotification"
    try {
        if (!notificationsHistory || notificationsHistory?.length > 0) return false;

        const lastRelevantNotification = notificationsHistory.findLast(element => element.type !== 'CHARGING_SESSION_DATA')
        return lastRelevantNotification?.type === 'CHARGING_SESSION_START' || lastRelevantNotification?.type === 'CHARGING_SESSION_EV_CHARGING'
    } catch (error) {
        console.error(`[${context}] Error `, error)
        return false
    }
}
function energyConsumed(nLastValidPoints) {
    const context = "Function energyConsumed"
    try {
        let energyDiff = (nLastValidPoints[nLastValidPoints.length - 1].totalPower - nLastValidPoints[nLastValidPoints.length - 2].totalPower) / 1000
        let firstPointDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 2].readDate)
        let lastPointDate = moment.utc(nLastValidPoints[nLastValidPoints.length - 1].readDate)
        let timeDiff = moment.duration(lastPointDate.diff(firstPointDate)).asHours()
        return timeDiff > 0 ? ((energyDiff / timeDiff) >= 1 ? true : false) : false
    } catch (error) {
        console.error(`[${context}] Error `, error)
        return false
    }
}
function sendChargingNotification(notificationsHistory) {
    const context = "Function sendChargingNotification"
    try {
        if (!notificationsHistory || notificationsHistory?.length > 0) return false;

        const lastRelevantNotification = notificationsHistory.findLast(element => element.type !== 'CHARGING_SESSION_DATA')
        const currentDate = moment.utc()
        const lastRelevantReadDate = lastRelevantNotification ? moment.utc(lastRelevantNotification.timestamp) : currentDate;
        const timeDiff = moment.duration(currentDate.diff(lastRelevantReadDate)).asMinutes()
        return (lastRelevantNotification?.type === 'CHARGING_SESSION_START' && timeDiff >= 10) || lastRelevantNotification?.type === 'CHARGING_SESSION_EV_NOT_CHARGING'
    } catch (error) {
        console.error(`[${context}] Error `, error)
        return false
    }
}

async function updateSessionValues(_id, body) {
    let context = "Function updateSessionValues";
    try {

        if (body['$push']) {
            if (body['$push'].notificationsHistory) {
                if (body['$push'].notificationsHistory.type === 'CHARGING_SESSION_EV_CHARGING') {
                    body['$unset'] = { endOfEnergyDate: 1 }
                }
            }
        }

        let foundSession = await ChargingSession.findOneAndUpdate({ _id }, body, { new: true })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}


async function getRequest(host, params) {
    const context = "Function getRequest";
    try {
        let resp = await axios.get(host, { params })
        if (resp.data) {
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}


function chargesTime(tariff) {
    const context = "Function chargesTime"
    try {
        if (tariff) {
            if (tariff.tariff) {
                if (tariff.tariff.chargingAmount) {
                    if (tariff.tariff.chargingAmount.value > 0 && tariff.tariff.chargingAmount.uom === "min") return true
                }
                if (tariff.tariff.parkingDuringChargingAmount) {
                    if (tariff.tariff.parkingDuringChargingAmount.value > 0) return true
                }
                if (tariff.tariff.parkingAmount) {
                    if (tariff.tariff.parkingAmount.value > 0) return true
                }
            }
        }
        return false
    } catch (error) {
        console.error(`[${context}] Error `, error)
        return false
    }

}

function notificationTotalPower(session) {
    const context = "Function notificationTotalPower"
    try {
        return session.totalPower ? session.totalPower : 0
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return 0
    }
}

async function updatePreAuthorize(reference, active) {
    const context = "Function updatePreAuthorize"
    try {
        const data = {
            reference,
            active
        }
        const host = process.env.HostPayments + process.env.PathUpdatePreAuthorize
        await axios.patch(host, data)
    } catch (error) {
        console.error(`${context} Error `, error.message)
    }
}

async function updateEvAndUsersInfo(req, res) {
    var context = "PATCH /api/private/chargingSession/updateEvAndUsersInfo";
    try {
        const { start_date_time } = req.body
        const query = {
            $and: [
                {
                    $or: [
                        { evDetails: { "$exists": false } },
                        { fleetDetails: { "$exists": false } },
                        { userIdInfo: { "$exists": false } },
                        { userIdWillPayInfo: { "$exists": false } },
                        { userIdToBillingInfo: { "$exists": false } },
                        { evDetails: { "$exists": true, "$eq": null } },
                        { fleetDetails: { "$exists": true, "$eq": null } },
                        { userIdInfo: { "$exists": true, "$eq": null } },
                        { userIdWillPayInfo: { "$exists": true, "$eq": null } },
                        { userIdToBillingInfo: { "$exists": true, "$eq": null } },
                    ]
                },
                { status: { "$ne": process.env.SessionStatusFailed } },
                {
                    $or: [
                        { evId: { "$exists": true, "$ne": "-1" } },
                        {
                            $and: [
                                { userId: { "$exists": true, "$ne": "-1" } },
                                { userIdWillPay: { "$exists": true, "$ne": "-1" } },
                            ]
                        }
                    ]
                },
                start_date_time ? { stopDate: { $gte: start_date_time } } : {}

            ]
        };
        const sessionsToUpdate = await ChargingSession.find(query).lean()
        for (const session of sessionsToUpdate) {
            let newValues = {
                $set: {}
            }
            if (session.userId && session.userIdWillPay && session.userId.toUpperCase() !== "UNKNOWN" && session.userIdWillPay.toUpperCase() !== "UNKNOWN") {
                let { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } = await getAllUserInfo(session.userId, session.userIdWillPay, session.userIdToBilling)
                newValues["$set"].userIdInfo = userIdInfo
                newValues["$set"].userIdWillPayInfo = userIdWillPayInfo
                newValues["$set"].userIdToBillingInfo = userIdToBillingInfo
            }
            if (session.evId != "-1") {
                let { ev, fleet } = await getEVAllByEvId(session.evId);
                newValues["$set"].evDetails = ev
                newValues["$set"].fleetDetails = fleet
            }
            await ChargingSession.findOneAndUpdate({ _id: session._id }, newValues)
            if(await checkBeforeSendSessionToHistoryQueue(session?.status)) {
                sendSessionToHistoryQueue(session._id, context)
            }
            await sleep(200)
        }
        return res.status(200).send(sessionsToUpdate);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(err.message);
    }


}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getAllUserInfo(userId, userIdWillPay, userIdToBilling) {
    var context = "Function getAllUserInfo";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostUser + process.env.PathGetAllUserInfo
        let params = { userId, userIdWillPay, userIdToBilling };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve({});
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                resolve({});
            });
    });
}

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await ChargingSession.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ", result);
            };
        })

        await ChargingSession.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ", result);
            };
        })

        let chargingSessions = await ChargingSession.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != chargingSessions.length; i++) {
            if (chargingSessions[i].address)
                if (chargingSessions[i].address.country)
                    if (unicCountries.indexOf(chargingSessions[i].address.country) == -1) {
                        unicCountries.push(chargingSessions[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes")
        console.log(coutryCodes)

        console.log("unicCountries")
        console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await ChargingSession.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

function updateCO2SavedMinumum() {
    let context = "FUNCTION updateCO2SavedMinumum"

    let query = {
        CO2Saved: { $lt: 0 }
    };

    let newValues = {
        "CO2Saved": 0,
    };

    ChargingSession.updateMany(query, { $set: newValues }, (err, result) => {
        if (err) {
            console.error(`[${context}][OCPI.findOneAndUpdate] Error`, err.message);
        }
    });
}

async function updateCardNumber() {
    const context = "Function updateCardNumber";

    try {
        const sessionsToUpdate = await ChargingSession.find({
            $and: [
                { status: { $in: ["40", "70"] } },
                { cardNumber: { $exists: false } }
            ]
        });

        let arrayIdTags = [];

        if (sessionsToUpdate) {
            arrayIdTags = sessionsToUpdate.map(session => {
                return {
                    userId: session.userId,
                    idTag: session.idTag,
                    networkType: session.network,
                    evId: session.evId
                }
            });
        } else {
            console.error('sessionsToUpdate is undefined or null.');
        }

        const host = process.env.HostUser + process.env.PathGetContractsIdTag;

        const response = await axios({
            method: 'get',
            url: host,
            data: {
                arrayIdTags: arrayIdTags
            },
            headers: {
                'Content-Type': 'application/json'
            },
        });

        const contracts = response.data.contract;

        let updatedSessions = [];

        for (const session of sessionsToUpdate) {
            const matchingContract = contracts.find(contract =>
                findIdTagContract(
                    session.userId,
                    session.idTag,
                    session.network,
                    session.evId,
                    contract
                )
            );

            if (matchingContract && matchingContract.cardNumber) {
                await ChargingSession.findOneAndUpdate(
                    { _id: session._id },
                    { $set: { cardNumber: matchingContract.cardNumber } },
                    { new: true }
                );

                updatedSessions.push(session);
            }

            await sleep(200);

        }

        if (updatedSessions.length > 0) {
            console.log('Success: Sessions were updated.', updatedSessions);
        } else {
            console.log('Error: No sessions were updated.');
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return reject(error);
    }
};

function findIdTagContract(userId, idTag, networkType, evId, contract) {
    return (
        (contract.userId === userId &&
            contract.networks.find(network =>
                network.network === networkType &&
                network.tokens.find(token =>
                    token.idTagDec === idTag ||
                    token.idTagHexa === idTag ||
                    token.idTagHexaInv === idTag
                )
            )) ||
        (contract.evId === evId &&
            contract.networks.find(network =>
                network.network === networkType &&
                network.tokens.find(token =>
                    token.idTagDec === idTag ||
                    token.idTagHexa === idTag ||
                    token.idTagHexaInv === idTag
                )
            ))
    );
}

function myFleets(userId) {
    const context = "Function myFleets";

    return new Promise((resolve, reject) => {

        try {
            if (!userId) {
                console.error(`[${context}] Error `, 'Missing input value');
                return reject(new Error('Missing input value'));
            }

            const host = process.env.HostEvs + process.env.PathGetMyFleets;

            axios.get(host, {
                headers: {
                    userId
                },
            }).then(
                (fleets) => {
                    if (!Array.isArray(fleets.data) || fleets.data.length < 1) {
                        return resolve({ myFleetsValidate: false, message: "User without fleets!" });
                    }

                    let listEVs = [];

                    for (let fleet of fleets.data) {

                        if (fleet.listEvs.length > 0) {
                            const temp = fleet.listEvs.map((elem) => elem.evId)
                            listEVs = listEVs.concat(temp)
                        }

                    }

                    resolve({ myFleetsValidate: true, listEVs: listEVs })
                }
            ).catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return reject(error);
            });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return reject(error);
        }
    });
};

module.exports = router;
