const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const host = global.charger_microservice_host;
const Utils = require('../utils');
const ConfigurationKey = require('../models/configurationKeys')
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceUpdateProxy = `${host}/api/private/chargers/plugs`;
const chargerServiceTariffProxy = `${host}/api/private/chargers/getTariff`;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const axios = require("axios");
const context = '[StatusNotification] ';
// var Notification = require('../notifications');
const _ = require("underscore");
const chargerServiceUpdateStatus = `${host}/api/private/chargers`;
const chargerHeartBeatServiceProxy = `${host}/api/private/chargers/heartBeat`;

const tariffHost = global.tariff_microservice_host
const SalesTariffProxy = `${tariffHost}/api/private/salesTariff/byId`

const paymentHost = global.payment_microservice_host
const validatePaymentConditionsProxy = `${paymentHost}/api/private/payments/validatePaymentConditions`
const trigger = global.triggeredByCP

module.exports = {
    handle: function (data, payload) {
        return new Promise(function (resolve, reject) {
            const StatusNotificationResponse = [global.callResult, data.messageId, {}];
            try {
                //Change mode status from parking mode to finish mode
                finishChargingSession(data, payload);

                //Experiencia. 11/03/2021. Quando o posto comunica o status notification primeiro que o stop transaction.
                finishChargingSessionWhenStatusNotificationAvailableFirstThenStopTransaction(data, payload)

                //Stop transaction notification when user does not connects the plug
                stopChargingSession(data, payload);

                //Stop transaction when stopTransaction is not sent due to offline mode
                // finishChargingSessionOfflineWhenNoStopTransactionIsSent(data, payload);

                //When RFID is activated we need to create and change charging session later
                // confirmChargingSession(data, payload);

                //Function to stop transaction notification when user starts a transaction with RFID card and does not connects the plug. Here, we dont know the plugId.
                //stopChargingSessionWhenRFIDCardRead(data, payload);

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network
                let params = {
                    hwId: data.chargeBoxIdentity
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {
                    if (charger) {
                        const chargerId = charger._id;

                        Utils.getEvioChargePointStatus(payload.status).then(async (statusObj) => {
                            if (statusObj) {

                                //get Connector type
                                let plugs = charger.plugs;
                                let filteredPlug = _.where(plugs, { plugId: payload.connectorId.toString() });

                                if (payload.connectorId != 0) {
                                    // Utils.inteligentHeartBeat(chargerHeartBeatServiceProxy, charger.hwId, false);

                                    let connectorType = "Unknown";
                                    if (filteredPlug[0]) {
                                        connectorType = filteredPlug[0].connectorType;
                                    }
                                    else {
                                        connectorType = "Unknown";
                                    }

                                    let evseStatus = await Utils.getEvseStatus(charger, payload.connectorId.toString(), statusObj.status)

                                    const body = {
                                        _id: chargerId,
                                        plugs: [{
                                            plugId: payload.connectorId.toString(),
                                            status: statusObj.status,
                                            subStatus: statusObj.subStatus,
                                            connectorType: connectorType,
                                            evseStatus
                                        }]
                                    }

                                    Utils.updateChargerData(chargerServiceUpdateProxy, body).then((result) => {
                                        if (!result) {
                                            console.log('[StatusNotification] Updating charger with connectores - error: ');
                                            Utils.saveLog(data.chargeBoxIdentity, payload, StatusNotificationResponse[2], false, 'StatusNotification', 'Error updating connectors', payload.connectorId, trigger)
                                            resolve(StatusNotificationResponse);
                                        }
                                        else {
                                            Utils.patchManyLocations(charger, payload.connectorId.toString(), evseStatus)
                                            Utils.saveLog(data.chargeBoxIdentity, payload, StatusNotificationResponse[2], true, 'StatusNotification', `Status Notification Update`, payload.connectorId, trigger)
                                            resolve(StatusNotificationResponse);
                                        }
                                    });
                                }
                                else {
                                    //change EVIO charger status
                                    changeEVIOChargerStatus(data, payload, chargerId);
                                    Utils.saveLog(data.chargeBoxIdentity, payload, StatusNotificationResponse[2], true, 'StatusNotification', `Status Notification Update`, payload.connectorId, trigger)
                                    resolve(StatusNotificationResponse);
                                }
                            }
                            else {
                                Utils.saveLog(data.chargeBoxIdentity, payload, StatusNotificationResponse[2], false, 'StatusNotification', `Failed to get evio plug status`, payload.connectorId, trigger)
                                resolve(StatusNotificationResponse);
                            }
                        });

                    }
                    else {
                        Utils.saveLog(data.chargeBoxIdentity, payload, StatusNotificationResponse[2], false, 'StatusNotification', `Charger ${data.chargeBoxIdentity} does not exist `, payload.connectorId, trigger)
                        console.error(`[StatusNotification] charger ${data.chargeBoxIdentity} does not exists: `);
                        resolve(StatusNotificationResponse);
                    }

                });
            } catch (error) {
                Utils.saveLog(data.chargeBoxIdentity, payload, StatusNotificationResponse[2], false, 'StatusNotification', `${error.message}`, payload.connectorId, trigger)
                resolve(StatusNotificationResponse);
                console.error('[StatusNotification] error :' + error);
            }
        });
    }
}

//Function to stop transaction when user unconnects the plug
const finishChargingSession = (data, payload) => {
    //Check if connector id is available
    if (payload.status == global.chargePointStatusPlugOCPPAvailable) {
        //Check if there is any charging session running to specific connector id
        const params = {
            hwId: data.chargeBoxIdentity,
            status: process.env.SessionStatusStoppedAndEvParked,
            plugId: payload.connectorId
        };

        Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {
            if (chargingSession) {
                //Update charging Session with failed
                updateChargingSession3(chargingSessionServiceProxy, process.env.SessionStatusStopped, chargingSession);
                console.log(`[StatusNotification] A EV was detached on charger ${data.chargeBoxIdentity} and connectorId  ${payload.connectorId}`)
            }

        }).catch(function (error) {
            console.error(`${context} error checking if has any charging session`, error)
        });
    }
};

//Experiencia. 11/03/2021. Quando o posto comunica o status notification primeiro que o stop transaction.
const finishChargingSessionWhenStatusNotificationAvailableFirstThenStopTransaction = (data, payload) => {
    //Check if connector id is available
    if (payload.status == global.chargePointStatusPlugOCPPAvailable) {
        //Check if there is any charging session running to specific connector id
        const params = {
            hwId: data.chargeBoxIdentity,
            status: process.env.SessionStatusToStop
        };

        //console.log(params);
        Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {
            if (chargingSession) {
                //Update charging Session with failed
                updateChargingSession3(chargingSessionServiceProxy, process.env.SessionStatusAvailableButNotStopped, chargingSession);
                console.log(`[StatusNotification] A charging session ${chargingSession.sessionId} was stopped for charge station ${data.chargeBoxIdentity} and connectorId  ${payload.connectorId}`)
            }

        }).catch(function (error) {
            console.error(`${context} error checking if has any charging session`, error)
        });

    }
};

//Experiencia. 20/10/2021. Quando o posto não comunica o stop transaction de uma sessão efetuada offline
const finishChargingSessionOfflineWhenNoStopTransactionIsSent = (data, payload) => {
    //Check if connector id is available
    if (payload.status == global.chargePointStatusPlugOCPPAvailable) {
        //Check if there is any charging session running to specific connector id
        let statusNotificationTimestamp = payload.timestamp ? payload.timestamp : moment(new Date().toISOString()).utc().format()
        const params = {
            hwId: data.chargeBoxIdentity,
            plugId: payload.connectorId,
            timestamp: statusNotificationTimestamp,
            offlineStatusNotification: true
        };

        //console.log(params);
        Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {
            if (chargingSession) {
                updateChargingSession4(chargingSessionServiceProxy, process.env.SessionStatusAvailableButNotStopped, statusNotificationTimestamp, chargingSession);
                console.log(`[StatusNotification] A charging session ${chargingSession.sessionId} was stopped for charge station ${data.chargeBoxIdentity} and connectorId  ${payload.connectorId}`)
            }

        }).catch(function (error) {
            console.error(`${context} error checking if has any charging session`, error)

        });

    }
};


//Function to stop transaction notification when user does not connects the plug
const stopChargingSession = (data, payload) => {

    //Check if connector id is available
    if (payload.status == global.chargePointStatusPlugOCPPAvailable) {

        //Check if there is any charging session running to specific connector id
        const params = {
            hwId: data.chargeBoxIdentity,
            plugId: payload.connectorId,
            status: process.env.SessionStatusToStart,
            //This stopStatusNotification works as a logic key in the endpoint called by checkIfHasChargingSessions where the query is made
            stopStatusNotification: true
        };
        /*
            Sometimes users can create multiple sessions when passing the RFID card multiple times in a row.
            So, we check if there is more than one session in a certain plug with status "10" so we can change
            it to "60".
        */
        Utils.checkIfHasChargingSessions(chargingSessionServiceProxy, params).then(async (chargingSessions) => {

            if (chargingSessions.length > 0) {
                //Update charging Session with failed
                for (let chargingSession of chargingSessions) {
                    console.log(new Date().toISOString() + " - Found possible session to change status " + chargingSession._id);
                    const error = {
                        reasonCode: "other",
                        reasonText: "User did not connect the plug"
                    }
                    let chargerConfigurationKeys = await ConfigurationKey.findOneConfigurationKeys({ hwId: data.chargeBoxIdentity })
                    let chargerTimeOutKey = chargerConfigurationKeys ? chargerConfigurationKeys.keys.find(obj => obj.key === global.ocppConnectionTimeOut) : null
                    let timeout = chargerTimeOutKey ? Number(chargerTimeOutKey.value) : global.defaultChargerTimeout
                    let startDate = chargingSession.startDate !== undefined && chargingSession.startDate !== null ? chargingSession.startDate : new Date(chargingSession.createdAt).toISOString();
                    let statusNotificationTimestamp = payload.timestamp ? payload.timestamp : moment(new Date().toISOString()).utc().format()
                    let diffSeconds = Utils.getChargingTime(startDate, moment(statusNotificationTimestamp).utc())

                    //We're adding a 5 second margin due to the time it can take to create the session asynchronously
                    if (diffSeconds + 5 > timeout) {
                        updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession, error);
                        console.log(`[StatusNotification] A charging session ${chargingSession.sessionId} was canceled for charge station ${data.chargeBoxIdentity} and connectorId  ${payload.connectorId}`)
                    } else {
                        console.error(`[StatusNotification] Charging session ${chargingSession.sessionId} on ${data.chargeBoxIdentity} and connectorId  ${payload.connectorId} didn't exceed timeout`)
                    }
                }
            }

        }).catch(function (error) {
            console.error(`${context} error checking if has any charging session`, error)
        });
    }
};

//Function to stop transaction notification when user starts a transaction with RFID card and does not connects the plug. Here, we dont know the plugId.
const stopChargingSessionWhenRFIDCardRead = (data, payload) => {
    //Check if connector id is available
    if (payload.status == global.chargePointStatusPlugOCPPAvailable) {
        //Check if there is any charging session running to specific connector id
        const params = {
            hwId: data.chargeBoxIdentity,
            status: process.env.SessionStatusToStart
        };

        Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {

            if (chargingSession) {
                //Update charging Session with failed
                const error = {
                    reasonCode: "other",
                    reasonText: "Started a transaction with RFID card and user did not connect the plug"
                }

                updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession, error);
                console.error(`[StatusNotification] A charging session ${chargingSession.sessionId} was canceled for charge station ${data.chargeBoxIdentity} and connectorId  ${payload.connectorId}`)
            }

        }).catch(function (error) {
            console.error(`${context} error checking if has any charging session`, error)

        });
    }
};

//Function to confirm charging sesseion when user starts charging via RFID card
const confirmChargingSession = (data, payload) => {
    //Check if connector id is available
    if (payload.status == global.chargePointPlugStatusOCPPCharging) {
        //Check if there is any charging session running to specific connector id
        const hwId = data.chargeBoxIdentity
        const plugId = payload.connectorId;
        let params = {
            hwId: hwId,
            status: process.env.SessionStatusToStart,
            plugId: plugId
        };


        Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {
            if (chargingSession) {
                const userId = chargingSession.userId;
                const internalSessionId = chargingSession._id;
                const fleetId = chargingSession.fleetId;

                /////////////////////////////////////////////////////////////////////////////
                //Accept startTransaction

                let params = {
                    userId: userId,
                    plugId: plugId,
                    hwId: hwId,
                    fleetId: fleetId
                };
                let chargingSessionBody = {
                    _id: internalSessionId,
                    status: process.env.SessionStatusRunning,
                    plugId: plugId,
                    // startedBy : 'StatusNotification'
                }

                if (chargingSession.userIdWillPay === "" || chargingSession.userIdWillPay === undefined) {

                    Utils.getTariff(chargerServiceTariffProxy, params)
                        .then(async tariffId => {
                            //Update charging session to running
                            if (tariffId != '-1' && tariffId !== null) {
                                var params = {
                                    _id: tariffId
                                }

                                const tariff = await Utils.getSalesTariff(SalesTariffProxy, params)

                                //Aqui, as fees já foram adicionadas as fees à sessão no remote start command
                                let fees = { IEC: 0.001, IVA: 0.23 }
                                if (chargingSession.fees) {
                                    fees = chargingSession.fees;
                                }

                                const validatePaymentConditionsData = {
                                    userId: userId,
                                    data: {
                                        hwId: hwId,
                                        plugId: plugId,
                                        evId: chargingSession.evId,
                                        tariffId: tariffId,
                                        chargerType: chargingSession.chargerType,
                                        tariff: tariff,
                                        fees: fees
                                    }
                                }

                                const paymentConditions = await Utils.validatePaymentConditions(validatePaymentConditionsProxy, validatePaymentConditionsData)

                                if (paymentConditions && tariff) {
                                    chargingSessionBody = {
                                        ...chargingSessionBody,
                                        tariffId,
                                        paymentId: paymentConditions.paymentId,
                                        paymentMethod: paymentConditions.paymentMethod,
                                        paymentMethodId: paymentConditions.paymentMethodId,
                                        walletAmount: paymentConditions.walletAmount,
                                        reservedAmount: paymentConditions.reservedAmount,
                                        confirmationAmount: paymentConditions.confirmationAmount,
                                        userIdWillPay: paymentConditions.userIdWillPay,
                                        adyenReference: paymentConditions.adyenReference,
                                        transactionId: paymentConditions.transactionId,
                                        clientType: paymentConditions.clientType,
                                        tariff,
                                        paymentType: paymentConditions.paymentType,
                                        billingPeriod: paymentConditions.billingPeriod,
                                        userIdToBilling: paymentConditions.userIdToBilling,
                                        plafondId: paymentConditions.plafondId,
                                        clientName: paymentConditions.clientName,
                                    }

                                    if (chargingSession.chargerOwner === userId) {
                                        chargingSessionBody.tariffId = "-1";
                                        chargingSessionBody.tariff = {};
                                    }

                                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, chargingSessionBody);
                                    console.error(`${context} Charging session updated`)
                                } else {
                                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, status: process.env.SessionStatusFailed, tariffId: '-1' });
                                    console.error(`${context} Charging session failed to update in paymentConditions or tariff`)
                                }

                            } else {

                                if (chargingSession.chargerOwner === userId || session.freeOfCharge) {
                                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, tariffId: '-1' });
                                    console.log(`${context} Charging session updated`)
                                } else {
                                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, status: process.env.SessionStatusFailed, tariffId: '-1' });
                                    console.error(`${context} Charging session failed to update. Not found tariff for CP and userId is not thw owner of CP`)
                                }
                            }

                        })
                        .catch(error => {
                            Utils.updateChargingSessionWithPlug(chargingSessionProxy, { ...chargingSessionBody, status: process.env.SessionStatusFailed, tariffId: '-1' });
                            console.error(`${context} Charging session failed to update : ${error}`)
                        })
                }
                else {
                    //Se o pedido vem do remote start transaction, já temos toda a informação necessária dos pagamentos. Não temos que a obter novamente
                    if (chargingSession.chargerOwner === userId || session.freeOfCharge) {
                        chargingSessionBody.tariffId = "-1";
                        chargingSessionBody.tariff = {};
                    }

                    Utils.updateChargingSessionWithPlug(chargingSessionProxy, chargingSessionBody);
                    console.error(`${context} Charging session updated`)
                }

            } else {
                console.error(`${context} Charging session not found for given parameters: `, params);
            }

        }).catch(function (error) {
            console.error(`${context} error checking if has any charging session`, error)
        });
    }
};

const changeEVIOChargerStatus = (data, payload, chargerId) => {
    if (payload.status == global.chargePointStatusPlugOCPPAvailable) {
        Utils.updateChargerStatus(chargerServiceUpdateStatus, chargerId, global.chargePointStatusEVIOAvailable);
    }
    else if (payload.status == global.chargePointPlugStatusOCPPFaulted) {
        Utils.updateChargerStatus(chargerServiceUpdateStatus, chargerId, global.chargePointStatusEVIOUnavailable);
    }
    else if (payload.status == global.chargePointPlugStatusOCPPOccupied) {
        Utils.updateChargerStatus(chargerServiceUpdateStatus, chargerId, global.chargePointStatusEVIOInUse);
    }
    else if (payload.status == global.chargePointPlugStatusOCPPReserved) {
        Utils.updateChargerStatus(chargerServiceUpdateStatus, chargerId, global.chargePointStatusEVIOInUse);
    }
    else if (payload.status == global.chargePointPlugStatusOCPPUnavailable) {
        Utils.updateChargerStatus(chargerServiceUpdateStatus, chargerId, global.chargePointStatusEVIOUnavailable);
    }
    else if (payload.status == global.chargePointPlugStatusOCPPSuspendedEVSE) {
        Utils.updateChargerStatus(chargerServiceUpdateStatus, chargerId, global.chargePointStatusEVIOUnavailable);
    }
    else {
        Utils.updateChargerStatus(chargerServiceUpdateStatus, chargerId, global.chargePointStatusEVIOAvailable);
    }
};

const updateChargingSession = (ServiceProxy, status, chargingSession, error) => {
    const body = {
        _id: chargingSession._id,
        status: status,
        stopReason: error,
    }

    axios.patch(ServiceProxy, { body })
        .then(function (response) {
            // console.log("Success");
        })
        .catch(function (error) {
            console.error(error);
        });
};

const updateChargingSession2 = (ServiceProxy, status, chargingSession, plugId, tariffId) => {
    const body = {
        _id: chargingSession._id,
        status: status,
        plugId: plugId,
        tariffId: tariffId
    }

    axios.patch(ServiceProxy, { body })
        .then(function (response) {
            // console.log("Success");
        })
        .catch(function (error) {
            console.error(error);
        });
};

const updateChargingSession3 = (ServiceProxy, status, chargingSession) => {
    const dateNow = moment(new Date().toISOString()).utc();
    const body = {
        _id: chargingSession._id,
        status: status
    }

    axios.patch(ServiceProxy, { body })
        .then(function (response) {
            // console.log("Success");
        })
        .catch(function (error) {
            console.error(error.message);
        });
};

const updateChargingSession4 = (ServiceProxy, status, stopDate, chargingSession) => {
    const body = {
        _id: chargingSession._id,
        status: status,
        stopDate: moment(stopDate).utc(),
    }

    axios.patch(ServiceProxy, { body })
        .then(function (response) {
            // console.log("Success");
        })
        .catch(function (error) {
            console.error(error.message);
        });
};