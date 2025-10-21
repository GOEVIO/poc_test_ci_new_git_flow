const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const moment = require('moment');
const axios = require("axios");
const Utils = require('../utils');
const constants = require('../utils/constants');
var context = "[Remote Stop Transaction]";
var host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const trigger = global.triggeredByCS
const Sentry = require("@sentry/node");
const { saveSessionLogs } = require('../utils/save-session-logs')
const { Enums } = require('evio-library-commons').default;


module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Remote Stop Transaction]";
        const action = 'RemoteStopTransaction';

        try {
            const { hwId, plugId, sessionId } = req.body;
            const chargerId = hwId;
            const baseDataToSaveLog = {
                userId: req?.body?.userId || req.headers['userid'] || '',
                hwId,
                plugId,
                sessionId,
                stage: '[RemoteStopSession OCPP] - Route [POST /api/private/connectionstation/ocppj/stop]',
                action: 'stop',
                status: Enums.SessionFlowLogsStatus.ERROR,
                payload: req?.body || '',
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
            }

            let clients = Array.from(wss.clients);
            var client = clients.filter(a => a.id == chargerId)[0];

            if (req.body.freeStopTransaction) {
                // Remote stop sent from control center operator
                freeStopTransaction(req, res, eventEmitter, client, baseDataToSaveLog)
            } else {
                let messageError = ''
                if (!sessionId){
                    messageError = 'Charging session ID required' 
                    saveSessionLogs({...baseDataToSaveLog, errorMessage: messageError });
                    return res.status(400).send({ auth: 'true', code: "server_session_id_required", message: messageError});
                }
                const idTag = req.body.idTag;
                if (!idTag){
                    messageError = 'IdTag required' 
                    saveSessionLogs({...baseDataToSaveLog, errorMessage: messageError });
                    return res.status(500).send({ auth: 'true', code: "server_id_tag_required", message: messageError });
                }
                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                let params = {
                    hwId: hwId
                };

                if (client) {
                    if (client.readyState === WebSocket.OPEN) {

                        Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

                            if (charger) {

                                ////////////////////////////////////////////////
                                //Get if is any session running to given session Id
                                params = {
                                    status: process.env.SessionStatusRunning,
                                    hwId: hwId,
                                    plugId: plugId,
                                    sessionId: sessionId,
                                    idTag: idTag
                                };

                                console.log(params);

                                axios.get(chargingSessionServiceProxy, { params })
                                    .then(function (response) {

                                        if (typeof response.data.chargingSession[0] === 'undefined') {
                                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Charging Session ${sessionId} not found or is already stoped`, plugId, trigger)
                                            saveSessionLogs({ 
                                                ...baseDataToSaveLog, 
                                                errorMessage: `Charging Session not found or is already stoped`,
                                            });
                                            return res.status(400).send({ auth: 'true', code: "server_invalid_charging_session", message: `Charging Session ${sessionId} not found or is already stoped` });
                                        } else {

                                            let internalSessionId = response.data.chargingSession[0]._id;
                                            console.log(`\n${context} Setting session ${sessionId} as ToStop`);

                                            updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusToStop).then((chargingSession) => {

                                                if (chargingSession) {
                                                    console.log(`${context} Trying stop  remote transaction: ChargerId: ${hwId}; PlugId: ${plugId}; userIdTag: ${idTag}; `);
                                                    const messageId = uuidv4();

                                                    let data = new Object;
                                                    data.transactionId = parseInt(sessionId);

                                                    //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                                    const call = [global.callRequest, messageId, action, data];
                                                    console.log(JSON.stringify(call))
                                                    console.log(`Message sent to ${client.id}, ${action}`)

                                                    client.send(JSON.stringify(call), function (temp) {


                                                        eventEmitter.on(messageId, function (result) {

                                                            const remoteStopTransactionStatus = result.status;
                                                            if (remoteStopTransactionStatus === constants.responseStatus.Accepted) {
                                                                Utils.saveLog(hwId, data, result, true, 'RemoteStopTransaction', `RemoteStopTransaction accepted`, plugId, trigger)
                                                                saveSessionLogs({ 
                                                                    ...baseDataToSaveLog,
                                                                    status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                                    sessionId: sessionId
                                                                });
                                                                return res.status(200).send({ auth: 'true', code: "", message: 'Remote Stop accepted' });
                                                            } else {
                                                                if (remoteStopTransactionStatus !== constants.responseStatus.Rejected) {
                                                                    Utils.saveLog(hwId, data, result, false, 'RemoteStopTransaction', 'Unknown remoteStop response status', plugId, trigger);
                                                                    saveSessionLogs({ 
                                                                        ...baseDataToSaveLog, 
                                                                        errorMessage: `Unknown remoteStop response status: ${remoteStopTransactionStatus}`,
                                                                        errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                                    });
                                                                    Sentry.captureException(new Error(`Unknown remoteStop response status response ${hwId}`));
                                                                } else {
                                                                    saveSessionLogs({ 
                                                                        ...baseDataToSaveLog, 
                                                                        errorMessage: `Rejected remoteStop response status: ${remoteStopTransactionStatus}`,
                                                                        errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                                    });
                                                                    Utils.saveLog(hwId, data, result, false, 'RemoteStopTransaction', `Error stoping charging session ${sessionId}`, plugId, trigger)
                                                                }
                                                                updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning);
                                                                console.error(`${context} error stop charging:`, JSON.stringify(result));
                                                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                                                            }

                                                        });
                                                    });

                                                }
                                                else {
                                                    console.error(`${context} Charger: ${hwId}. Error updating charging session tostop status`);
                                                    updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning);
                                                    saveSessionLogs({ 
                                                        ...baseDataToSaveLog, 
                                                        errorMessage: `Error updating charging session status, chargingSession not found`,
                                                        errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                    });
                                                    Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Error updating charging session tostop status`, plugId, trigger)
                                                    return res.status(400).send({ auth: 'true', code: "error_ stopping_charging_session", message: `Error stoping charging session ${sessionId}` });
                                                }

                                            }).catch(function (error) {
                                                console.error(`${context} Charger: ${hwId}. Error updating charging session tostop status: ${error}`);
                                                updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning);

                                                if (error) {
                                                    if (error.response) {
                                                        saveSessionLogs({ 
                                                            ...baseDataToSaveLog, 
                                                            errorMessage: error.response.data.message,
                                                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                        });
                                                        Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.response.data.message, plugId, trigger)
                                                    } else {
                                                        saveSessionLogs({ 
                                                            ...baseDataToSaveLog, 
                                                            errorMessage: error.message,
                                                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                        });
                                                        Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.message, plugId, trigger)
                                                    }
                                                } else {
                                                    saveSessionLogs({ 
                                                        ...baseDataToSaveLog, 
                                                        errorMessage: "[updateChargingSessionStop]: Error updating charging session stop status",
                                                        errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                    });
                                                    Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
                                                }
                                                return res.status(500).send({ auth: true, status: false, message: `Charger: ${hwId}. Error updating charging session tostop status: ${error}` });
                                            });
                                        }

                                    }).catch(function (error) {
                                        console.log(`${context} Error getting session status: ${error}`);
                                        if (error) {
                                            if (error.response) {
                                                saveSessionLogs({ 
                                                    ...baseDataToSaveLog, 
                                                    errorMessage: error.response.data.message,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                });
                                                Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.response.data.message, plugId, trigger)
                                            } else {
                                                saveSessionLogs({ 
                                                    ...baseDataToSaveLog, 
                                                    errorMessage: error.message,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                });
                                                Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.message, plugId, trigger)
                                            }
                                        } else {
                                            saveSessionLogs({ 
                                                ...baseDataToSaveLog, 
                                                errorMessage: error.message,
                                                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                            });
                                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
                                        }
                                        return res.status(500).send({ auth: true, status: false, message: error.message });
                                    });
                            }
                            else {
                                console.error(`${context} Charger ${hwId} does not exists`)
                                saveSessionLogs({ 
                                    ...baseDataToSaveLog, 
                                    errorMessage: `Error during get charger ${hwId} does not exists`,
                                });
                                Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Charger ${hwId} does not exists`, plugId, trigger)
                                return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                            }
                        });
                    } else {
                        const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
                        console.error(message);
                        saveSessionLogs({ 
                            ...baseDataToSaveLog, 
                            errorMessage: message + ' no websocket client open',
                            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                        });
                        Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
                        return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
                    }
                } else {
                    const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
                    console.error(message);
                    saveSessionLogs({ 
                        ...baseDataToSaveLog, 
                        errorMessage: message + ' no websocket client found',
                        errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                    });
                    Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
                    return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
                }
            }
        } catch (err) {
            const plugId = req.body.plugId;
            console.error(`${context} Error processing remote stop transaction: ` + err)
            saveSessionLogs({ 
                userId: req?.body?.userId || req.headers['userid'] || '',
                stage: '[RemoteStopSession OCPP] - Route [POST /api/private/connectionstation/ocppj/stop]',
                action: 'stop',
                status: Enums.SessionFlowLogsStatus.ERROR,
                payload: req?.body || '',
                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                errorMessage: `Error in RemoteStopTransaction: ${err.message || ''}`,
                hwId: req.body.hwId || '',
                plugId: plugId
            });
            Utils.saveLog(req.body.hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${req.body.hwId}`, plugId, trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `${context} Error processing remote stop transaction: ` + err });
        }
    }
}

const updateChargingSessionStop = (ServiceProxy, chargingSessionId, status, stopReason = null) => {
    return new Promise((resolve, reject) => {
        try {
            const dateNow = moment(new Date().toISOString()).utc();

            const body = {
                _id: chargingSessionId,
                command: process.env.StopCommand,
                status: status,
                stopDate: dateNow,
            }
            if (stopReason) {
                body.stopReason = stopReason
            }

            axios.patch(ServiceProxy, { body })
                .then(function (response) {
                    resolve(true);
                })
                .catch(function (error) {
                    console.error("[Remore Stop Transaction] Error updating charging session: " + error)
                    resolve(false);
                });
        } catch (err) {
            console.error("[Remore Stop Transaction] Error updating charging session: " + err)
        }
    })

};

async function freeStopTransaction(req, res, eventEmitter, client, baseDataToSaveLog = {}) {
    const context = "[Remote Stop Transaction]";
    const action = 'RemoteStopTransaction';

    const chargerId = req.body.hwId;
    baseDataToSaveLog.stage = '[RemoteStopSession OCPP] - [freeStopTransaction]';
    try {
        const hwId = req.body.hwId;
        let messageError = '';
        if (!hwId){
            messageError = 'hwId required'
            saveSessionLogs({...baseDataToSaveLog, errorMessage: messageError });
            return res.status(400).send({ auth: 'true', code: "server_hwId_required", message: messageError });
        }
        baseDataToSaveLog.hwId = hwId;
        const plugId = req.body.plugId;
        if (!plugId){
            messageError = 'plugId required'
            saveSessionLogs({...baseDataToSaveLog, errorMessage: messageError });
            return res.status(400).send({ auth: 'true', code: "server_plugId_required", message: messageError });
        }
        baseDataToSaveLog.plugId = plugId;
        const userId = req.body.userId;
        if (!userId){
            messageError = 'userId required'
            saveSessionLogs({...baseDataToSaveLog, errorMessage: messageError });
            return res.status(400).send({ auth: 'true', code: "server_userId_required", message: messageError });
        }
        baseDataToSaveLog.userId = userId;
        /////////////////////////////////////////////////////////////////////////////
        //Check if charger exists on EVIO Network and get data of charger
        let params = {
            hwId: hwId
        };

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

                    if (charger) {

                        if (userId !== charger.operatorId) {
                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `userId ${userId} has not permission to stop in this charging station via free mode`, plugId, trigger)
                            saveSessionLogs({ 
                                ...baseDataToSaveLog, 
                                errorMessage: `RemoteStopTransaction failed because userId ${userId} has not permission to charge in this charging station via free mode`,
                            });
                            return res.status(500).send({ auth: 'true', code: "server_userId_required", message: 'userId has not permission to stop in this charging station via free mode' });
                        }

                        ////////////////////////////////////////////////
                        //Get if is any session running to given session Id
                        params = {
                            status: process.env.SessionStatusRunning,
                            hwId: hwId,
                            plugId: plugId,
                        };

                        axios.get(chargingSessionServiceProxy, { params })
                            .then(function (response) {

                                if (typeof response.data.chargingSession[0] === 'undefined') {
                                    Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Charging Session not found or is already stoped`, plugId, trigger)
                                    saveSessionLogs({ 
                                        ...baseDataToSaveLog, 
                                        errorMessage: `Charging Session not found or is already stoped`,
                                    });
                                    return res.status(400).send({ auth: 'true', code: "server_invalid_charging_session", message: `Charging Session ${sessionId} not found or is already stoped` });
                                } else {

                                    let internalSessionId = response.data.chargingSession[0]._id;
                                    let sessionId = response.data.chargingSession[0].sessionId
                                    let idTag = response.data.chargingSession[0].idTag

                                    console.log(`\n${context} Setting session ${sessionId} as ToStop`);

                                    let reason = {
                                        reasonCode: 'other',
                                        reasonText: 'Stopped by operator'
                                    };

                                    updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusToStop, reason).then((chargingSession) => {

                                        if (chargingSession) {
                                            console.log(`${context} Trying stop  FREE remote transaction: ChargerId: ${hwId}; PlugId: ${plugId}; userIdTag: ${idTag}; `);
                                            const messageId = uuidv4();

                                            let data = new Object;
                                            data.transactionId = parseInt(sessionId);

                                            //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                            const call = [global.callRequest, messageId, action, data];
                                            console.log(JSON.stringify(call))
                                            console.log(`Message sent to ${client.id}, ${action}`)

                                            client.send(JSON.stringify(call), function (temp) {
                                                eventEmitter.on(messageId, function (result) {

                                                    const remoteStopTransactionStatus = result.status;
                                                    if (remoteStopTransactionStatus === constants.responseStatus.Accepted) {
                                                        Utils.saveLog(hwId, data, result, true, 'RemoteStopTransaction', `RemoteStopTransaction accepted`, plugId, trigger)
                                                        saveSessionLogs({ 
                                                            ...baseDataToSaveLog,
                                                            status: Enums.SessionFlowLogsStatus.SUCCESS,
                                                            sessionId: chargingSession.data._id
                                                        });
                                                        return res.status(200).send({ auth: 'true', code: "", message: 'Remote Stop accepted' });
                                                    } else {
                                                        if (remoteStopTransactionStatus !== constants.responseStatus.Rejected) {
                                                            Utils.saveLog(hwId, data, result, false, 'RemoteStopTransaction', 'Unknown remoteStop response status', plugId, trigger);
                                                            saveSessionLogs({ 
                                                                ...baseDataToSaveLog, 
                                                                errorMessage: `Unknown remoteStop response status: ${remoteStopTransactionStatus}`,
                                                                errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                            });
                                                            Sentry.captureException(new Error(`Unknown remoteStop response status response ${hwId}`));
                                                        } else {
                                                            saveSessionLogs({ 
                                                                ...baseDataToSaveLog, 
                                                                errorMessage: `Rejected remoteStop response status: ${remoteStopTransactionStatus}`,
                                                                errorType: Enums.SessionFlowLogsErrorTypes.EXTERNAL_SERVICE_ERROR,
                                                            });
                                                            Utils.saveLog(hwId, data, result, false, 'RemoteStopTransaction', `Error stoping charging session ${sessionId}`, plugId, trigger)
                                                        }
                                                        updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning);
                                                        console.error(`${context} error stop charging:`, JSON.stringify(result));
                                                        return res.status(400).send({ auth: 'true', code: "error_ stopping_charging_session", message: `Error stoping charging session ${sessionId}` });
                                                    }
                                                });
                                            });

                                        }
                                        else {
                                            console.error(`${context} Charger: ${hwId}. Error updating charging session tostop status`);
                                            updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning);
                                            saveSessionLogs({ 
                                                ...baseDataToSaveLog, 
                                                errorMessage: `Error updating charging session status, chargingSession not found`,
                                                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                            });
                                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Error updating charging session tostop status`, plugId, trigger)
                                            return res.status(400).send({ auth: 'true', code: "error_ stopping_charging_session", message: `Error stoping charging session ${sessionId}` });
                                        }

                                    }).catch(function (error) {
                                        console.log(`${context} Charger: ${hwId}. Error updating charging session tostop status: ${error}`);
                                        updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning);
                                        if (error) {
                                            if (error.response) {
                                                saveSessionLogs({ 
                                                    ...baseDataToSaveLog, 
                                                    errorMessage: error.response.data.message,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                });
                                                Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.response.data.message, plugId, trigger)
                                            } else {
                                                saveSessionLogs({ 
                                                    ...baseDataToSaveLog, 
                                                    errorMessage: error.message,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                                });
                                                Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.message, plugId, trigger)
                                            }
                                        } else {
                                            saveSessionLogs({ 
                                                ...baseDataToSaveLog, 
                                                errorMessage: "[updateChargingSessionStop]: Error updating charging session stop status",
                                                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                            });
                                            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
                                        }
                                        return res.status(500).send({ auth: true, status: false, message: `Charger: ${hwId}. Error updating charging session tostop status: ${error}` });
                                    });
                                }

                            }).catch(function (error) {
                                console.error(`${context} Error getting session status: ${error}`);
                                if (error) {
                                    if (error.response) {
                                        saveSessionLogs({ 
                                            ...baseDataToSaveLog, 
                                            errorMessage: error.response.data.message,
                                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                        });
                                        Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.response.data.message, plugId, trigger)
                                    } else {
                                        saveSessionLogs({ 
                                            ...baseDataToSaveLog, 
                                            errorMessage: error.message,
                                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                        });
                                        Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', error.message, plugId, trigger)
                                    }
                                } else {
                                    Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
                                    saveSessionLogs({ 
                                        ...baseDataToSaveLog, 
                                        errorMessage: error.message,
                                        errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_SERVER_ERROR,
                                    });
                                }
                                return res.status(500).send({ auth: true, status: false, message: error.message });
                            });
                    }
                    else {
                        console.error(`${context} Charger ${hwId} does not exists`)
                        Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Charger ${hwId} does not exists`, plugId, trigger)
                        saveSessionLogs({ 
                            ...baseDataToSaveLog, 
                            errorMessage: `Error during get charger ${hwId} does not exists`,
                        });
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });
            } else {
                const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
                console.error(message);
                saveSessionLogs({ 
                    ...baseDataToSaveLog, 
                    errorMessage: message + ' no websocket client open',
                    errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                });
                Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
                return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } else {
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            saveSessionLogs({ 
                ...baseDataToSaveLog, 
                errorMessage: message + ' no websocket client found',
                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
            });
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
            return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }

    } catch (error) {
        const plugId = req.body.plugId;
        saveSessionLogs({ 
            ...baseDataToSaveLog, 
            errorMessage: `Error in freeStopTransaction: ${error.message || ''}`,
            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
            hwId: chargerId,
            plugId: plugId
        });
        console.error(`${context} Error processing remote stop transaction: ` + error)
        Utils.saveLog(chargerId, req.body, {}, false, 'RemoteStopTransaction', `Communication not established between the CS and the charging station ${chargerId}`, plugId, trigger)
        return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `${context} Error processing remote stop transaction: ` + error });
    }
}