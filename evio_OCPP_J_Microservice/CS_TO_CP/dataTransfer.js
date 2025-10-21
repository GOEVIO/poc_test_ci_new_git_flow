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
        const context = "[Data Transfer]";
        const action = 'DataTransfer';

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'Hardware ID required' });
        }

        const vendorId = req.body.vendorId;
        if (!vendorId || typeof vendorId !== "string" || vendorId.length > 255) {
            return res.status(400).send({ auth: 'true', code: "vendorId_required", message: 'Vendor ID required and must be a string of up to 255 characters' });
        }

        const messageId = req.body.messageId;
        if (messageId && (typeof messageId !== "string" || messageId.length > 50)) {
            return res.status(400).send({ auth: 'true', code: "messageId_validation_error", message: 'Message ID should be a string and not exceeds 50 characters in length.' });
        }

        const dataReq = req.body.data;
        if (dataReq && typeof dataReq !== "string") {
            return res.status(400).send({ auth: 'true', code: "data_validation_error", message: 'Data should be a string' });
        }

        try {
            const clients = Array.from(wss.clients);
            const client = clients.find(a => a.id == hwId);

            if (client && client.readyState === WebSocket.OPEN) {
                // Check if charger exists on EVIO Network and get data of charger
                const params = { hwId: hwId };
                const charger = await Utils.chekIfChargerExists(chargerServiceProxy, params);

                if (charger) {
                    console.log(`${context} Trying to DataTransfer: ChargerId: ${hwId}; Endpoint: ${charger.endpoint}`);
                    const messageId = uuidv4();

                    const data = {
                        vendorId: vendorId,
                        messageId: messageId,
                        data: dataReq
                    };

                    const call = [global.callRequest, messageId, action, data];
                    console.log(JSON.stringify(call));
                    console.log(`Message sent to ${client.id}, ${action}`);

                    client.send(JSON.stringify(call), function (temp) {
                        eventEmitter.on(messageId, function (result) {

                            const dataTransferStatus = result.status;
                            if (dataTransferStatus === process.env.statusAccepted) {
                                Utils.saveLog(hwId, call[3], result, true, 'DataTransfer', `DataTransfer command`, plugId, trigger);
                                return res.status(200).send(result);
                            } else if (dataTransferStatus === process.env.statusUnknownVendorId) {
                                Utils.saveLog(hwId, call[3], result, false, 'DataTransfer', 'Failed to interpreted data: The message could not be interpreted due to unknown vendorId string.', plugId, trigger);
                                return res.status(404).send({ auth: 'true', code: "unknown_vendorId", message: 'Failed to interpreted data: The message could not be interpreted due to unknown vendorId string.' });
                            } else if (dataTransferStatus === process.env.statusUnknownMessageId) {
                                Utils.saveLog(hwId, call[3], result, false, 'DataTransfer', 'Failed to interpreted data: The message could not be interpreted due to unknown messageId string.', plugId, trigger);
                                return res.status(406).send({ auth: 'true', code: "unknown_messageId", message: 'Failed to interpreted data: The message could not be interpreted due to unknown messageId string..' });
                            } else if (dataTransferStatus === constants.responseStatus.Rejected) {
                                Utils.saveLog(hwId, call[3], result, false, 'DataTransfer', 'Failed to interpreted data: The message has been accepted but the contained request is rejected.', plugId, trigger);
                                return res.status(409).send({ auth: 'true', code: "failed_interpreted_data", message: 'Failed to interpreted data: The message has been accepted but the contained request is rejected.' });
                            } else {
                                Utils.saveLog(hwId, call[4], result, false, 'DataTransfer', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                            }
                        });
                    });
                }
            } else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body, {}, false, 'DataTransfer', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger);
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (error) {
            const message = `${context} Error occurred: ${error}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'DataTransfer', message, plugId, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
};
