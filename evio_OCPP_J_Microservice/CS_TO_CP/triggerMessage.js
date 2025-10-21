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
        const context = "[Trigger Message]";
        const action = 'TriggerMessage';

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'Hardware ID required' });
        }

        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }

        const validValues = [
            'BootNotification',
            'DiagnosticsStatusNotification',
            'FirmwareStatusNotification',
            'Heartbeat',
            'MeterValues',
            'StatusNotification'
        ];

        const requestedMessage = req.body.requestedMessage;
        if (!requestedMessage || typeof requestedMessage !== 'string' || !validValues.includes(requestedMessage)) {
            return res.status(400).send({
                auth: 'true',
                code: 'requestedMessage_required',
                message: 'Requested Message is required, should be a string, and must be one of the following values: BootNotification, DiagnosticsStatusNotification, FirmwareStatusNotification, Heartbeat, MeterValues, StatusNotification.'
              });
        }

        try {
            const clients = Array.from(wss.clients);
            const client = clients.find(a => a.id == hwId);

            if (client && client.readyState === WebSocket.OPEN) {
                // Check if charger exists on EVIO Network and get data of charger
                const params = { hwId: hwId };
                const charger = await Utils.chekIfChargerExists(chargerServiceProxy, params);

                if (charger) {
                    console.log(`${context} Trying to TriggerMessage: ChargerId: ${hwId}; Endpoint: ${charger.endpoint}`);
                    const messageId = uuidv4();

                    const data = {
                        requestedMessage: requestedMessage,
                        connectorId: parseInt(plugId) 
                    };

                    const call = [global.callRequest, messageId, action, data];
                    console.log(JSON.stringify(call));
                    console.log(`Message sent to ${client.id}, ${action}`);

                    client.send(JSON.stringify(call), function (temp) {
                        eventEmitter.on(messageId, function (result) {
                            const triggerMessageStatus = result.status;

                            if (triggerMessageStatus === process.env.statusAccepted) {
                                Utils.saveLog(hwId, call[3], result, true, 'TriggerMessage', `TriggerMessage command`, plugId, trigger);
                                return res.status(200).send(result);
                            } else if (triggerMessageStatus === process.env.statusNotImplemented) {
                                Utils.saveLog(hwId, call[3], result, false, 'TriggerMessage', 'Failed to send a request notification: The Charge Point cannot send a request notification because it is either not implemented or unknown.', plugId, trigger);
                                return res.status(404).send({ auth: 'true', code: "failed_not_implemented", message: 'Failed to send a request notification: The Charge Point cannot send a request notification because it is either not implemented or unknown.' });
                            } else if (triggerMessageStatus === constants.responseStatus.Rejected) {
                                Utils.saveLog(hwId, call[3], result, false, 'TriggerMessage', 'Failed to send a request notification: The Charge Point not send a request notification.', plugId, trigger);
                                return res.status(406).send({ auth: 'true', code: "failed_send_request", message: 'Failed to send a request notification: The Charge Point not send a request notification.' });
                            } else {
                                Utils.saveLog(hwId, call[4], result, false, 'TriggerMessage', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                            }
                        });
                    });
                }
            } else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body, {}, false, 'TriggerMessage', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger);
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (error) {
            const message = `${context} Error occurred: ${error}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'TriggerMessage', message, plugId, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
};


