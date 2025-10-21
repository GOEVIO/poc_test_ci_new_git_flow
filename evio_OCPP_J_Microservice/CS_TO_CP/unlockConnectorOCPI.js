const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
let host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Unlock Connector]";
        const action = 'UnlockConnector';
        
        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });
        }

        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
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

        const operatorId = req.body.operatorId;
        if (!operatorId) {
            return res.status(400).send({ auth: 'true', code: "server_operatorId_required", message: 'operatorId required' });
        }

        const commandType = 'UNLOCK_CONNECTOR'
        
        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];

        const body = {
            message : '',
            response_url,
            party_id,
            hwId,
            network,
            plugId,
            commandType,
            operatorId,
        }

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                const params = {
                    hwId: hwId
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {
                    if (charger) {
                        console.log(`${context}Trying to unlock connector on charger ${hwId} with connector ${plugId}; Endpoint: ${charger.endpoint} `);

                        const messageId = uuidv4();

                        let data = new Object
                        data.connectorId = parseInt(plugId);

                        //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                        const call = [global.callRequest, messageId , action, data];
                        console.log(JSON.stringify(call))
                        console.log(`Message sent to ${client.id}, ${action}`)

                        client.send(JSON.stringify(call), function (result) {
                            eventEmitter.on(messageId, async function (data) {

                                const unlockStatus = data.status;
                                if (unlockStatus === process.env.statusUnlocked) {
                                    Utils.saveLog(hwId, call[3] , data , true , 'UnlockConnector' , `UnlockConnector command` , plugId , trigger)
                                    Utils.sendCommandResult (response_url , commandType , {...body , result : 'ACCEPTED'})
                                    return res.status(200).send(data);
                                } else if (unlockStatus === process.env.statusUnlockFailed) {
                                    Utils.saveLog(hwId, call[3] , data , false , 'UnlockConnector' , 'Failed to unlock the connector: The Charge Point has tried to unlock the connector and has detected that the connector is still locked or the unlock mechanism failed.' , plugId , trigger)
                                    Utils.sendCommandResult (response_url , commandType , {...body , result : 'FAILED'})
                                    return res.status(400).send({ auth: 'true', code: "", message: 'Failed to unlock the connector: The Charge Point has tried to unlock the connector and has detected that the connector is still locked or the unlock mechanism failed.'});
                                } else if (unlockStatus === process.env.statusNotSupported) {
                                    Utils.saveLog(hwId, call[3] , data , false , 'UnlockConnector' , 'Charge Point has no connector lock, or ConnectorId is unknown.' , plugId , trigger)
                                    Utils.sendCommandResult (response_url , commandType , {...body , result : 'NOT_SUPPORTED'})
                                    return res.status(400).send({ auth: 'true', code: "", message: 'Charge Point has no connector lock, or ConnectorId is unknown.'});
                                }
                            });

                        });
                    }
                    else {
                        Utils.sendCommandResult (response_url , commandType , {...body , result : 'FAILED'})
                        Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , `Charger ${hwId} does not exist` , plugId , trigger)
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });
            }

        } else {
            Utils.sendCommandResult (response_url , commandType , {...body , result : 'FAILED'})
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body , {} , false , 'UnlockConnector' , `Communication not established between the CS and the charging station ${hwId}` , plugId , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}

