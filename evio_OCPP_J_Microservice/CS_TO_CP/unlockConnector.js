const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
var host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Unlock Connector]";
        const action = 'UnlockConnector';

        const userId = req.headers['userid'];

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });
        }

        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                let params = {
                    hwId: hwId
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {
                    if (charger) {
                        params = {
                            hwId,
                            plugId,
                            status: process.env.SessionStatusRunning
                        };

                        Utils.checkIfHasChargingSession(chargingSessionServiceProxy, params).then((chargingSession) => {

                            if (chargingSession) {
                                if (chargingSession.userId === userId || charger.createUser === userId) {
                                    console.log(`${context}Trying to unlock connector on charger ${hwId} with connector ${plugId}; Endpoint: ${charger.endpoint} `);

                                    const messageId = uuidv4();

                                    let data = new Object
                                    data.connectorId = parseInt(plugId);

                                    //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                    const call = [global.callRequest, messageId , action, data];
                                    console.log(JSON.stringify(call))
                                    console.log(`Message sent to ${client.id}, ${action}`)

                                    client.send(JSON.stringify(call), function (result) {
                                        eventEmitter.on(messageId, function (data) {

                                            const unlockStatus = data.status;
                                            if (unlockStatus === process.env.statusUnlocked) {
                                                Utils.saveLog(hwId, call[3] , data , true , 'UnlockConnector' , `UnlockConnector command` , plugId , trigger)
                                                return res.status(200).send(data);
                                            } else if (unlockStatus === process.env.statusNotSupported) {
                                                Utils.saveLog(hwId, call[3] , data , false , 'UnlockConnector' , 'Charge Point has no connector lock, or ConnectorId is unknown.' , plugId , trigger)
                                                return res.status(404).send({ auth: 'true', code: "", message: 'Charge Point has no connector lock, or ConnectorId is unknown.' });
                                            } else if (unlockStatus === process.env.statusUnlockFailed) {
                                                Utils.saveLog(hwId, call[3] , data , false , 'UnlockConnector' , 'Failed to unlock the connector: The Charge Point has tried to unlock the connector and has detected that the connector is still locked or the unlock mechanism failed.' , plugId , trigger)
                                                return res.status(406).send({ auth: 'true', code: "", message: 'Failed to unlock the connector: The Charge Point has tried to unlock the connector and has detected that the connector is still locked or the unlock mechanism failed.' });
                                            } else {
                                                Utils.saveLog(hwId, call[4], result, false, 'UnlockConnector', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                                            }
                                        });

                                    });
                                } else {
                                    Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , 'User not allowed' , plugId , trigger)
                                    return res.status(400).send({ auth: 'true', code: "error_user_not_allowed", message: 'User not allowed' });
                                }
                            } else {
                                console.log(`${context}Trying to unlock connector on charger ${hwId} with connector ${plugId}; Endpoint: ${charger.endpoint} `);

                                const messageId = uuidv4();

                                let data = new Object
                                data.connectorId = parseInt(plugId);

                                //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                                const call = [global.callRequest, messageId , action, data];
                                console.log(JSON.stringify(call))
                                console.log(`Message sent to ${client.id}, ${action}`)

                                client.send(JSON.stringify(call), function (result) {
                                    eventEmitter.on(messageId, function (data) {

                                        const unlockStatus = data.status;
                                        if (unlockStatus === process.env.statusUnlocked) {
                                            Utils.saveLog(hwId, call[3] , data , true , 'UnlockConnector' , `UnlockConnector command` , plugId , trigger)
                                            return res.status(200).send(data);
                                        } else if (unlockStatus === process.env.statusNotSupported) {
                                            Utils.saveLog(hwId, call[3] , data , false , 'UnlockConnector' , 'Charge Point has no connector lock, or ConnectorId is unknown.' , plugId , trigger)
                                            return res.status(404).send({ auth: 'true', code: "", message: 'Charge Point has no connector lock, or ConnectorId is unknown.' });
                                        } else if (unlockStatus === process.env.statusUnlockFailed) {
                                            Utils.saveLog(hwId, call[3] , data , false , 'UnlockConnector' , 'Failed to unlock the connector: The Charge Point has tried to unlock the connector and has detected that the connector is still locked or the unlock mechanism failed.' , plugId , trigger)
                                            return res.status(406).send({ auth: 'true', code: "", message: 'Failed to unlock the connector: The Charge Point has tried to unlock the connector and has detected that the connector is still locked or the unlock mechanism failed.' });
                                        } else {
                                            Utils.saveLog(hwId, call[4], result, false, 'UnlockConnector', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                            return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                                        }
                                    });

                                });
                            }

                        }).catch(function (error) {
                            console.log(`${context} error checking if has any charging session`, error)
                            if (error) {
                                if (error.response) {
                                    Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , error.response.data.message , plugId , trigger)
                                } else {
                                    Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , error.message , plugId , trigger)
                                }
                            } else {
                                Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , `Communication not established between the CS and the charging station ${hwId}` , plugId , trigger)
                            }
                            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: "error checking if has any charging session" });

                        });

                    }
                    else {
                        Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , `Charger ${hwId} does not exist` , plugId , trigger)
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });

            }

        } else {
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , `Communication not established between the CS and the charging station ${hwId}` , plugId , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }

    }
}
