const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const constants = require('../utils/constants')
const host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const trigger = global.triggeredByCS


module.exports = {
    handle: async function (req, res, wss, eventEmitter) {
        const context = "[Get Composite Schedule]";
        const action = 'GetCompositeSchedule';

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'Hardware ID required' });
        }
       
        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }

        const duration  = req.body.duration;
        if (typeof duration === 'undefined' || duration === null || typeof duration !== 'number' || duration < 0) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Duration is required, and it should be a number greater than or equal to zero.' });
        }

        const chargingRateUnit  = req.body.chargingRateUnit;
        if (chargingRateUnit !== undefined && chargingRateUnit !== process.env.a && chargingRateUnit !== process.env.w) {
            return res.status(400).send({ auth: 'true', code: "invalid_chargingRateUnit", message: 'ChargingRateUnit must be "A" or "W"' });
        }

        try {
            const clients = Array.from(wss.clients);
            const client = clients.find(a => a.id == hwId);

            if (client && client.readyState === WebSocket.OPEN) {
                // Check if charger exists on EVIO Network and get data of charger
                const params = { hwId: hwId };
                const charger = await Utils.chekIfChargerExists(chargerServiceProxy, params);

                if (charger) {
                    console.log(`${context} Trying to GetCompositeSchedule: ChargerId: ${hwId}; Endpoint: ${charger.endpoint}`);

                    const messageId = uuidv4();
                    const data = {
                        connectorId: parseInt(plugId),
                        duration: duration,
                        chargingRateUnit: chargingRateUnit
                    };

                    const call = [global.callRequest, messageId, action, data];
                    console.log(JSON.stringify(call));
                    console.log(`Message sent to ${client.id}, ${action}`);

                    client.send(JSON.stringify(call), function (temp) {
                        eventEmitter.on(messageId, function (result) {

                            const getCompositeScheduleStatus = result.status;
                            if (getCompositeScheduleStatus === constants.responseStatus.Accepted) {
                                Utils.saveLog(hwId, call[3], result, true, 'GetCompositeSchedule', `GetCompositeSchedule command`, plugId, trigger);
                                return res.status(200).send(result);
                            }else if (getCompositeScheduleStatus === constants.responseStatus.Rejected) {
                                Utils.saveLog(hwId, call[3], result, false, 'GetCompositeSchedule', 'Failed report the requested schedule: The Charge Point is not able to report the requested schedule.', plugId, trigger);
                                return res.status(406).send({ auth: 'true', code: "", message: 'Failed report the requested schedule: The Charge Point is not able to report the requested schedule.' });
                            } else {
                                Utils.saveLog(hwId, call[4], result, false, 'GetCompositeSchedule', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                            }
                        });
                    });
                }
            } else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body, {}, false, 'GetCompositeSchedule', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger);
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (error) {
            const message = `${context} Error occurred: ${error}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'GetCompositeSchedule', message, plugId, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
};
