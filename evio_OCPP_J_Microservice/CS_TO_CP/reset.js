const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');

var host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {
        const context = '[Reset]'
        const action = 'Reset';

        const hwId = req.body.hwId;
        if (!hwId)
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });

            const resetType = req.body.resetType;
        if (!resetType || typeof resetType !== 'string' || (resetType !== 'Hard' && resetType !== 'Soft')) {
            return res.status(400).send({
                auth: 'true',
                code: "server_reset_type_required",
                message: 'Reset Type required. It must be either "Hard" or "Soft"'
            });
        }

        const chargerId = req.body.hwId;
        /////////////////////////////////////////////////////////////////////////////
        //Check if charger exists on EVIO Network and get data of charger
        const params = {
            hwId: hwId
        };

        const clients = Array.from(wss.clients);
        const client = clients.filter(a => a.id == hwId)[0];

        if (client) {
            if (client.readyState === WebSocket.OPEN) {
                Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {
                    
                    if (charger) {
                        console.log(`${context}Trying ${resetType} reset: ChargerId: ${hwId}; Endpoint: ${charger.endpoint} `);

                        const messageId = uuidv4();

                        let data = new Object
                        data.type = resetType;

                        //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                        const call = [global.callRequest, messageId , action, data];
                        console.log(JSON.stringify(call))
                        console.log(`Message sent to ${client.id}, ${action}`)

                        client.send(JSON.stringify(call), function (result) {

                            eventEmitter.on(messageId, function (data) {
                                const resetStatus = data.status;
                                if (resetStatus === process.env.statusAccepted) {
                                    Utils.saveLog(hwId, call[3] , data , true , 'Reset' , `Reset command` , 0 , trigger)
                                    return res.status(200).send(data);
                                } else if (resetStatus === process.env.statusRejected) {
                                    Utils.saveLog(hwId, call[3] , data , false , 'Reset' , 'Failed to reset' , plugId , trigger)
                                    return res.status(406).send({ auth: 'true', code: "", message: 'Failed to reset' });
                                } else {
                                    Utils.saveLog(hwId, call[4], result, false, 'Reset', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                    return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                                }
                            });

                        });

                    }
                    else {
                        Utils.saveLog(hwId, req.body , {} , false , 'Reset' , `Charger ${hwId} does not exists` , 0 , trigger)
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });
            }

        } else {
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body , {} , false , 'Reset' , `Communication not established between the CS and the charging station ${chargerId}` , 0 , trigger)
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
}
