const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const Utils = require('../utils');
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = "[Get Local List Version]";
        const action = 'GetLocalListVersion';
        
        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });
        }

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];

        if (client) {
            if (client.readyState === WebSocket.OPEN) {

                /////////////////////////////////////////////////////////////////////////////
                //Check if charger exists on EVIO Network and get data of charger
                const params = {
                    hwId: hwId
                };

                Utils.chekIfChargerExists(chargerServiceProxy, params)
                .then((charger) => {
                    if (charger) {

                        console.log(`${context} Trying to GetLocalListVersion: ChargerId: ${hwId}; Endpoint: ${charger.endpoint} `);

                        const messageId = uuidv4();

                        const data = new Object;

                        const call = [global.callRequest, messageId, action, data];
                        console.log(JSON.stringify(call))
                        console.log(`Message sent to ${client.id}, ${action}`)

                        client.send(JSON.stringify(call), function (temp) {

                            eventEmitter.on(messageId, function (result) {
                                Utils.saveLog(hwId, data , result , true , 'GetLocalListVersion' , 'GetLocalListVersion command' , 0 , trigger)
                                return res.status(200).send(result);

                            });

                        });

                    }
                    else {
                        Utils.saveLog(hwId, req.body , {} , false , 'GetLocalListVersion' , `Charger ${hwId} does not exists` , 0 , trigger)
                        return res.status(400).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });

            }

        } else {
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body , {} , false , 'GetLocalListVersion' , `Communication not established between the CS and the charging station ${hwId}` , 0 , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}

