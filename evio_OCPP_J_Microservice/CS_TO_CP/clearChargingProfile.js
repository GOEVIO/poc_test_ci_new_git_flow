const OcppJsonCall = require("../OcppJsonCall")
const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const trigger = global.triggeredByCS

module.exports = {
    handle: async function (req, res, wss, eventEmitter) {
        const context = "[Clear Charging Profile]";
        const action = 'ClearChargingProfile';

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'Hardware ID required' });
        }

        const plugId = req.body.plugId;
        
        const id = req.body.id;
        if (id && (typeof id !== 'number' || id < 0)) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Id should be a number or not exist' });
        }

        const  chargingProfilePurpose = req.body.chargingProfilePurpose;
        if (chargingProfilePurpose !== undefined && typeof chargingProfilePurpose !== 'string' &&
            !["ChargePointMaxProfile", "TxDefaultProfile", "TxProfile"].includes(chargingProfilePurpose)) {
                return res.status(400).send({ auth: 'true', code: "invalid_chargingProfilePurpose", message: 'ChargingProfilePurpose must be a valid string: "ChargePointMaxProfile", "TxDefaultProfile", or "TxProfile".' });
        }

        const stackLevel = req.body.stackLevel;
        if (stackLevel && (typeof stackLevel !== 'number' || stackLevel < 0)) {
            return res.status(400).send({ auth: 'true', code: "invalid_stackLevel", message: 'StackLevel should be a number or not exist.' });
        }


        try {
            const clients = Array.from(wss.clients);
            const client = clients.find(a => a.id == hwId);

            if (client && client.readyState === WebSocket.OPEN) {
                // Check if charger exists on EVIO Network and get data of charger
                const params = { hwId: hwId };
                const charger = await Utils.chekIfChargerExists(chargerServiceProxy, params);

                if (charger) {
                    console.log(`${context} Trying to ClearChargingProfile: ChargerId: ${hwId}; Endpoint: ${charger.endpoint}`);
                    const messageId = uuidv4();

                    const data = {
                        connectorId: parseInt(plugId),
                        id: id,
                        chargingProfilePurpose: chargingProfilePurpose,
                        stackLevel: stackLevel
                    };

                    const call = [global.callRequest, messageId, action, data];
                    console.log(JSON.stringify(call));
                    console.log(`Message sent to ${client.id}, ${action}`);

                    client.send(JSON.stringify(call), function (temp) {
                        eventEmitter.on(messageId, function (result) {
                            const clearChargingProfileStatus = result.status;

                            if (clearChargingProfileStatus === process.env.statusAccepted) {
                                Utils.saveLog(hwId, call[3], result, true, 'ClearChargingProfile', `ClearChargingProfile command`, plugId, trigger);
                                return res.status(200).send(result);
                            } else if (clearChargingProfileStatus === process.env.statusUnknown) {
                                Utils.saveLog(hwId, call[3], result, false, 'ClearChargingProfile', 'Failed to find profile(s): The Charge Point does not find profile(s) matching the request.', plugId, trigger);
                                return res.status(400).send({ auth: 'true', code: "failed_find_profile", message: 'Failed to find profile(s): The Charge Point does not find profile(s) matching the request.' });
                            } else {
                                Utils.saveLog(hwId, call[4], result, false, 'ClearChargingProfile', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                            }
                        });
                    });
                }
            } else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body, {}, false, 'ClearChargingProfile', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger);
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (error) {
            const message = `${context} Error occurred: ${error}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'ClearChargingProfile', message, plugId, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
};
