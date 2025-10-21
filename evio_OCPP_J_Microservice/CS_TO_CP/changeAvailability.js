const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const constants = require('../utils/constants')
const  host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const trigger = global.triggeredByCS

module.exports = {
    handle: function (req, res, wss, eventEmitter) {

        const context = "[Change Availability]";
        const action = 'ChangeAvailability';

        const hwId = req.body.hwId;
        if (!hwId)
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });

        const chargerId = hwId;

        const availability = req.body.availability;
        if (!availability || typeof availability !== 'string' || (availability !== process.env.inoperative && availability !== process.env.operative)) {
            return res.status(400).send({ 
                auth: 'true', 
                code: "invalid_availability_type", 
                message: 'Invalid Availability Type. It must be either "Operative" or "Inoperative".' 
            });
        }

        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }
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

                        console.log(`${context} Trying changing configuration: ChargerId: ${hwId}; Endpoint: ${charger.endpoint} `);

                        const messageId = uuidv4();

                        let data = new Object;
                        data.connectorId = parseInt(plugId);
                        data.type = availability;

                        //const call = new OcppJsonCall(messageId, global.callRequest, action, data);
                        const call = [global.callRequest, messageId, action, data];
                        console.log(JSON.stringify(call))
                        console.log(`Message sent to ${client.id}, ${action}`)

                        client.send(JSON.stringify(call), function (temp) {
                            eventEmitter.on(messageId, function (result) {

                                const remoteStatus = result.status;
                                if (remoteStatus === constants.responseStatus.Accepted) {
                                    Utils.saveLog(hwId, data , result , true , 'ChangeAvailability' , 'ChangeAvailability accepted' , plugId , trigger)
                                    return res.status(200).send({ auth: 'true', code: "", message: 'Change Availability accepted', status: remoteStatus });
                                } else if (remoteStatus === constants.responseStatus.Scheduled) {
                                    Utils.saveLog(hwId, data, result, true, 'ChangeAvailability', 'ChangeAvailability scheduled', plugId, trigger);
                                    return res.status(200).send({ auth: 'true', code: "", message: 'Change Availability scheduled after transaction end', status: remoteStatus });
                                } else if (remoteStatus === constants.responseStatus.Rejected) {
                                    Utils.saveLog(hwId, data , result , false , 'ChangeAvailability' , 'ChangeAvailability not accepted' , plugId , trigger)
                                    console.log(`${context} error changing configuration`, JSON.stringify(result));
                                    return res.status(400).send({ auth: 'true', code: "server_ocpp_change_availability_not_accepted", message: 'Change Availability not accepted' });
                                } else {
                                    Utils.saveLog(hwId, call[4], result, false, 'ChangeAvailability', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                    return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                                }
                            });

                        });

                    }
                    else {
                        Utils.saveLog(hwId, req.body , {} , false , 'ChangeAvailability' , `Charger ${hwId} does not exist` , plugId , trigger)
                        return res.status(500).send({ auth: true, status: false, message: `Charger ${hwId} does not exists` });
                    }
                });

            }

        } else {
            Utils.saveLog(hwId, req.body , {} , false , 'ChangeAvailability' , `Communication not established between the CS and the charging station ${chargerId}` , plugId , trigger)
            const message = `${context} Communication not established between the CS and the charging station ${chargerId}`;
            console.error(message);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }

    }
}
