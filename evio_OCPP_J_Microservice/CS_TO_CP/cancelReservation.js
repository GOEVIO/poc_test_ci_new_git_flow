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
        const context = "[Cancel Reservation]";
        const action = 'CancelReservation';

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'Hardware ID required' });
        }

        const reservationId = req.body.reservationId;
        if (!reservationId || isNaN(reservationId) || reservationId < 0) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Reservation Id is required, and it should be a number greater than or equal to zero.' });
        }

        try {
            const clients = Array.from(wss.clients);
            const client = clients.find(a => a.id == hwId);

            if (client && client.readyState === WebSocket.OPEN) {
                // Check if charger exists on EVIO Network and get data of charger
                const params = { hwId: hwId };
                const charger = await Utils.chekIfChargerExists(chargerServiceProxy, params);

                if (charger) {
                    console.log(`${context} Trying to CancelReservation: ChargerId: ${hwId}; Endpoint: ${charger.endpoint}`);
                    const messageId = uuidv4();

                    const data = {
                        reservationId: reservationId,
                    };

                    const call = [global.callRequest, messageId, action, data];
                    console.log(JSON.stringify(call));
                    console.log(`Message sent to ${client.id}, ${action}`);
                    
                    client.send(JSON.stringify(call), { timeout: 20000 }, function (temp) {
                        eventEmitter.on(messageId, function (result) {

                            const cancelReservationStatus = result.status;
                            if (cancelReservationStatus === constants.responseStatus.Accepted) {
                                Utils.saveLog(hwId, call[3], result, true, 'CancelReservation', `CancelReservation command`, reservationId, trigger);
                                return res.status(200).send(result);
                            } else if (cancelReservationStatus === constants.responseStatus.Rejected) {
                                Utils.saveLog(hwId, call[3], result, false, 'CancelReservation', 'Failed to cancel reservation: The the reservation does not match, still reserved.', reservationId, trigger);
                                return res.status(404).send({ auth: 'true', code: "failed_cancel_reservation", message: 'Failed to cancel reservation: The the reservation does not match, still reserved.' });
                            } else {
                                Utils.saveLog(hwId, call[4], result, false, 'CancelReservation', 'An error occurred while processing the request. Please check your request and try again.', reservationId, trigger);
                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                            }
                        });
                    });
                }
            } else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body, {}, false, 'CancelReservation', `Communication not established between the CS and the charging station ${hwId}`, reservationId, trigger);
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (error) {
            const message = `${context} Error occurred: ${error}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'CancelReservation', message, reservationId, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
};
