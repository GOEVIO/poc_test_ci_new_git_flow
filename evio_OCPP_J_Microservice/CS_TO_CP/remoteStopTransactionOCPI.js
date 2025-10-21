const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const moment = require('moment');
const axios = require("axios");
const Utils = require('../utils');
const constants = require('../utils/constants');

const context = "[Remote Stop Transaction]";
const host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const trigger = global.triggeredByCS
const commandType = 'STOP_SESSION'
const Sentry = require("@sentry/node");

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Remote Stop Transaction]";
        const action = 'RemoteStopTransaction';

        try {
            const sessionId = req.body.sessionId;
            if (!sessionId) {
                return res.status(400).send({ auth: 'true', code: "server_session_id_required", message: 'Charging session ID required' });
            }

            const idTag = req.body.idTag;
            if (!idTag) {
                return res.status(400).send({ auth: 'true', code: "server_id_tag_required", message: 'IdTag required' });
            }

            const response_url = req.body.response_url;
            if (!response_url) {
                return res.status(400).send({ auth: 'true', code: "server_response_url_required", message: 'response_url required' });
            }

            const party_id = req.body.party_id;
            if (!party_id) {
                return res.status(400).send({ auth: 'true', code: "server_party_id_required", message: 'party_id required' });
            }

            const network = req.body.network;
            if (!network) {
                return res.status(400).send({ auth: 'true', code: "server_network_required", message: 'network required' });
            }

            const hwId = req.body.hwId;
            if (!hwId) {
                return res.status(400).send({ auth: 'true', code: "server_hwId_required", message: 'hwId required' });
            }

            const plugId = req.body.plugId;
            if (!plugId) {
                return res.status(400).send({ auth: 'true', code: "server_plugId_required", message: 'plugId required' });
            }

            const operatorId = req.body.operatorId;
            if (!operatorId) {
                return res.status(400).send({ auth: 'true', code: "server_operatorId_required", message: 'operatorId required' });
            }

            const commandResultBody = {
                response_url,
                party_id,
                network,
                hwId,
                plugId,
                commandType,
                operatorId,
            }

            /////////////////////////////////////////////////////////////////////////////
            //Check if charger exists on EVIO Network and get data of charger
            let params = {
                hwId: hwId
            };

            const clients = Array.from(wss.clients);
            const client = clients.filter(a => a.id == hwId)[0];

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
                                        Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})
                                        Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , `Charging Session ${sessionId} not found or is already stoped` , plugId , trigger)
                                        return res.status(400).send({ auth: 'true', code: "server_invalid_charging_session", message: `Charging Session ${sessionId} not found or is already stoped` });
                                    } else {
        
                                        let internalSessionId = response.data.chargingSession[0]._id;
                                        console.log(`\n${context} Setting session ${sessionId} as ToStop`);
        
                                        updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusToStop , response_url).then((chargingSession) => {
        
                                            if (chargingSession) {
        
                                                console.log(`${context} Trying stop  remote transaction: ChargerId: ${hwId}; PlugId: ${plugId}; userIdTag: ${idTag}; `);
                                                const messageId = uuidv4();
        
                                                let data = new Object;
                                                data.transactionId = parseInt(sessionId);
        
                                                //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                                const call = [global.callRequest, messageId , action, data];
                                                console.log(JSON.stringify(call))
                                                console.log(`Message sent to ${client.id}, ${action}`)
        
                                                client.send(JSON.stringify(call), function (temp) {
                                                    eventEmitter.on(messageId, function (result) {
                                                        
                                                        const remoteStopTransactionStatus = result.status;
                                                        if (remoteStopTransactionStatus === constants.responseStatus.Accepted) {
                                                            Utils.saveLog(hwId, data, result, true, 'RemoteStopTransaction', `RemoteStopTransaction accepted`, plugId, trigger)
                                                            return res.status(200).send({ auth: 'true', code: "", message: 'Remote Stop accepted' });
                                                        } else {
                                                            if (remoteStopTransactionStatus !== constants.responseStatus.Rejected) {
                                                                Utils.saveLog(hwId, data, result, false, 'RemoteStopTransaction', 'Unknown remoteStop response status', plugId, trigger);
                                                                Sentry.captureException(new Error(`Unknown remoteStop response status response ${hwId}`));
                                                            } else {
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
                                                Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})
                                                console.error(`${context} Charger: ${hwId}. Error updating charging session tostop status`);
                                                updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning , response_url);
                                                Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , `Error updating charging session tostop status` , plugId , trigger)
                                                return res.status(400).send({ auth: 'true', code: "error_ stopping_charging_session", message: `Error stoping charging session ${sessionId}` });
                                            }
        
                                        }).catch(function (error) {
                                            console.error(`${context} Charger: ${hwId}. Error updating charging session tostop status: ${error}`);
                                            updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning , response_url);
                                            Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})

                                            if (error) {
                                                if (error.response) {
                                                    Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , error.response.data.message , plugId , trigger)
                                                } else {
                                                    Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , error.message , plugId , trigger)
                                                }
                                            } else {
                                                Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , `Communication not established between the CS and the charging station ${hwId}` , plugId , trigger)
                                            }
                                            return res.status(500).send({ auth: true, status: false, message: `Charger: ${hwId}. Error updating charging session tostop status: ${error}` });
                                        });
                                    }
        
                                }).catch(function (error) {
                                    Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})
                                    console.error(`${context} Error getting session status: ${error}`);
                                    if (error) {
                                        if (error.response) {
                                            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , error.response.data.message , plugId , trigger)
                                        } else {
                                            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , error.message , plugId , trigger)
                                        }
                                    } else {
                                        Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , `Communication not established between the CS and the charging station ${hwId}` , plugId , trigger)
                                    }
                                    return res.status(500).send({ auth: true, status: false, message: error.message });
                                });
                        }
                        else {
                            Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})
                            console.error(`${context} Charger ${hwId} does not exists`)
                            Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , `Charger ${hwId} does not exists` , plugId , trigger)
                            return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                        }
                    });
                } else {
                    Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})
                    const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                    console.error(message);
                    Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , `Communication not established between the CS and the charging station ${hwId}` , plugId , trigger)
                    return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
                }
            } else {
                Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body , {} , false , 'RemoteStopTransaction' , `Communication not established between the CS and the charging station ${hwId}` , plugId , trigger)
                return res.status(400).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (err) {
            Utils.sendCommandResult(response_url , commandType , {...commandResultBody , result : 'FAILED'  , message : ''})
            const plugId = req.body.plugId;
            console.error(`${context} Error processing remote stop transaction: ` + err)
            Utils.saveLog(req.body.hwId, req.body , {} , false , 'RemoteStopTransaction' , `Communication not established between the CS and the charging station ${req.body.hwId}` , plugId , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: `${context} Error processing remote stop transaction: ` + err });
        }
    }
}

const updateChargingSessionStop = (ServiceProxy, chargingSessionId, status , response_url_stop) => {
    return new Promise((resolve, reject) => {
        try {
            const dateNow = moment(new Date().toISOString()).utc();

            const body = {
                _id: chargingSessionId,
                command: process.env.StopCommand,
                status: status,
                stopDate: dateNow,
                response_url_stop,
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
