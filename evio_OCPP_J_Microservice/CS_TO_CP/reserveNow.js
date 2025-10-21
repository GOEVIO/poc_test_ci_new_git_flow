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
        const context = "[Reserve Now]";
        const action = 'ReserveNow';

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'Hardware ID required' });
        }

        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }

        const expiryDate = req.body.expiryDate;
        if (!expiryDate || !isValidDateTime(expiryDate)) {
            return res.status(400).send({ auth: 'true', code: "expiryDate_required", message: 'Expiry Date required in valid date-time format' });
        }

        const idTag = req.body.idTag;
        if (!idTag) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }

        const reservationId = req.body.reservationId;
        if (typeof reservationId === 'undefined' || reservationId === null || typeof reservationId !== 'number' || reservationId < 0) {
            return res.status(400).send({ auth: 'true', code: "server_reservation_id_required", message: 'Reservation ID is required, and it should be a number greater than or equal to zero.' });
        }

        const parentIdTag  = req.body.parentIdTag;
        if (parentIdTag && typeof parentIdTag !== 'string' && parentIdTag.length > 20) {
            return res.status(400).send({ auth: 'true', code: "parent_id_tag_too_long", message: 'ParentIdTag should be a string and have a maximum length of 20 characters' });
        }

        try {
            const clients = Array.from(wss.clients);
            const client = clients.find(a => a.id == hwId);

            if (client && client.readyState === WebSocket.OPEN) {
                // Check if charger exists on EVIO Network and get data of charger
                const params = { hwId: hwId };
                const charger = await Utils.chekIfChargerExists(chargerServiceProxy, params);

                if (charger) {
                    console.log(`${context} Trying to ReserveNow: ChargerId: ${hwId}; Endpoint: ${charger.endpoint}`);
                    const messageId = uuidv4();

                    const data = {
                        connectorId: parseInt(plugId),
                        reservationId: reservationId,
                        idTag: idTag,
                        expiryDate: expiryDate,
                        parentIdTag: parentIdTag
                    };

                    const call = [global.callRequest, messageId, action, data];
                    console.log(JSON.stringify(call));
                    console.log(`Message sent to ${client.id}, ${action}`);

                    client.send(JSON.stringify(call), function (temp) {
                        eventEmitter.on(messageId, function (result) {
                            const reserveNowStatus = result.status;

                            if (reserveNowStatus === process.env.statusAccepted) {
                                Utils.saveLog(hwId, call[3], result, true, 'ReserveNow', `ReserveNow command`, plugId, trigger);
                                return res.status(200).send(result);
                            } else if (reserveNowStatus === constants.responseStatus.Rejected) {
                                Utils.saveLog(hwId, call[3], result, false, 'ReserveNow', 'Failed to reserve: The Charge Point is not configured to accept reservations.', plugId, trigger);
                                return res.status(404).send({ auth: 'true', code: "failed_charge_point_not_configured", message: 'Failed to reserve: The Charge Point is not configured to accept reservations.' });
                            } else if (reserveNowStatus === process.env.statusFaulted) {
                                Utils.saveLog(hwId, call[3], result, false, 'ReserveNow', 'Failed to reserve: The connector are in a faulted state.', plugId, trigger);
                                return res.status(406).send({ auth: 'true', code: "failed_connector_faulted", message: 'Failed to reserve: The connector are in a faulted state.' });
                            } else if (reserveNowStatus === process.env.statusUnavailable) {
                                Utils.saveLog(hwId, call[3], result, false, 'ReserveNow', 'Failed to reserve: The connector are in a unavailable state.', plugId, trigger);
                                return res.status(409).send({ auth: 'true', code: "failed_connector_unavailable", message: 'Failed to reserve: The connector are in a unavailable state.' });
                            } else if (reserveNowStatus === process.env.statusOccupied) {
                                Utils.saveLog(hwId, call[3], result, false, 'ReserveNow', 'Failed to reserve: The connector are in a occupied state.', plugId, trigger);
                                return res.status(416).send({ auth: 'true', code: "failed_connector_occupied", message: 'Failed to reserve: The connector are in a occupied state.' });
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
                Utils.saveLog(hwId, req.body, {}, false, 'ReserveNow', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger);
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (error) {
            const message = `${context} Error occurred: ${error}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'ReserveNow', message, plugId, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
};

function isValidDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date instanceof Date && !isNaN(date);
}
