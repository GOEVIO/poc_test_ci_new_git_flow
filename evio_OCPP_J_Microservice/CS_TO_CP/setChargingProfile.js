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
        const context = "[Set Charging Profile]";
        const action = 'SetChargingProfile';

        const hwId = req.body.hwId;
        if (!hwId) {
            return res.status(400).send({ auth: 'true', code: "server_hwid_required", message: 'Hardware ID required' });
        }
       
        const plugId = req.body.plugId;
        if (!plugId) {
            return res.status(400).send({ auth: 'true', code: "server_plug_id_required", message: 'Plug ID required' });
        }

        const csChargingProfiles = req.body.csChargingProfiles;
        if (!csChargingProfiles) {
            return res.status(400).send({ auth: 'true', code: "csChargingProfiles_required", message: 'csChargingProfiles required' });
        }

        const requiredFields = ["chargingProfileId", "stackLevel", "chargingProfilePurpose", "chargingProfileKind", "chargingSchedule"];
        for (const field of requiredFields) {
            if (csChargingProfiles[field] === undefined) {
                return res.status(400).send({ auth: 'true', code: `${field}_required`, message: `${field} is required in csChargingProfiles` });
            }
        }

        if (!Number.isInteger(csChargingProfiles.chargingProfileId)) {
            return res.status(400).send({ auth: 'true', code: "invalid_chargingProfileId", message: 'chargingProfileId must be an integer' });
        }

        if (csChargingProfiles.transactionId && !Number.isInteger(csChargingProfiles.transactionId)) {
            return res.status(400).send({ auth: 'true', code: "invalid_transactionId", message: 'TransactionId must be an integer' });
        }

        if (!Number.isInteger(csChargingProfiles.stackLevel)) {
            return res.status(400).send({ auth: 'true', code: "invalid_stackLevel", message: 'stackLevel must be an integer' });
        }

        if (!["ChargePointMaxProfile", "TxDefaultProfile", "TxProfile"].includes(csChargingProfiles.chargingProfilePurpose)) {
            return res.status(400).send({ auth: 'true', code: "invalid_chargingProfilePurpose", message: 'Invalid value for chargingProfilePurpose' });
        }

        if (!["Absolute", "Recurring", "Relative"].includes(csChargingProfiles.chargingProfileKind)) {
            return res.status(400).send({ auth: 'true', code: "invalid_chargingProfileKind", message: 'Invalid value for chargingProfileKind' });
        }

        if (csChargingProfiles.recurrencyKind && !["Daily", "Weekly"].includes(csChargingProfiles.recurrencyKind)) {
            return res.status(400).send({ auth: 'true', code: "invalid_recurrencyKind", message: 'Invalid value for recurrencyKind' });
        }

        //validar strings que seguem um padrão específico de formato de data e hora em UTC (ex: "2024-04-04T12:30:45Z")
        if (csChargingProfiles.validFrom && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(csChargingProfiles.validFrom)) {
            return res.status(400).send({ auth: 'true', code: "invalid_validFrom", message: 'Invalid format for validFrom' });
        }

        if (csChargingProfiles.validTo && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(csChargingProfiles.validTo)) {
            return res.status(400).send({ auth: 'true', code: "invalid_validTo", message: 'Invalid format for validTo' });
        }

        const chargingSchedule = csChargingProfiles.chargingSchedule;
        if (!chargingSchedule) {
            return res.status(400).send({ auth: 'true', code: "chargingSchedule_required", message: 'chargingSchedule is required in csChargingProfiles' });
        }

        if (chargingSchedule.duration && !Number.isInteger(chargingSchedule.duration)) {
            return res.status(400).send({ auth: 'true', code: "invalid_duration", message: 'duration must be an integer' });
        }

        if (chargingSchedule.startSchedule && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(chargingSchedule.startSchedule)) {
            return res.status(400).send({ auth: 'true', code: "invalid_startSchedule", message: 'Invalid format for startSchedule' });
        }

        if (!["A", "W"].includes(chargingSchedule.chargingRateUnit)) {
            return res.status(400).send({ auth: 'true', code: "invalid_chargingRateUnit", message: 'Invalid value for chargingRateUnit' });
        }

        const chargingSchedulePeriod = chargingSchedule.chargingSchedulePeriod;
        if (!chargingSchedulePeriod || !Array.isArray(chargingSchedulePeriod) || chargingSchedulePeriod.length === 0) {
            return res.status(400).send({ auth: 'true', code: "invalid_chargingSchedulePeriod", message: 'chargingSchedulePeriod is required and must be a non-empty array' });
        }

        for (const period of chargingSchedulePeriod) {
            if (!Number.isInteger(period.startPeriod) || period.startPeriod < 0) {
                return res.status(400).send({ auth: 'true', code: "invalid_startPeriod", message: 'startPeriod must be a non-negative integer' });
            }

            if (typeof period.limit !== "number" || period.limit < 0 || !isValidDecimalNumber(period.limit.toString())) {
                return res.status(400).send({ auth: 'true', code: "invalid_limit", message: 'Limit must be a non-negative decimal number' });
            }

            if (period.numberPhases && !Number.isInteger(period.numberPhases) || period.numberPhases < 0) {
                return res.status(400).send({ auth: 'true', code: "invalid_numberPhases", message: 'NumberPhases must be a non-negative integer' });
            }
        }

        if (csChargingProfiles.minChargingRate && (typeof csChargingProfiles.minChargingRate !== "number" || !isValidDecimalNumber(csChargingProfiles.minChargingRate.toString()))) {
            return res.status(400).send({ auth: 'true', code: "invalid_minChargingRate", message: 'MinChargingRate must be decimal number' });
        }


        try {
            const clients = Array.from(wss.clients);
            const client = clients.find(a => a.id == hwId);

            if (client && client.readyState === WebSocket.OPEN) {
                // Check if charger exists on EVIO Network and get data of charger
                const params = { hwId: hwId };
                const charger = await Utils.chekIfChargerExists(chargerServiceProxy, params);

                if (charger) {
                    console.log(`${context} Trying to SetChargingProfile: ChargerId: ${hwId}; Endpoint: ${charger.endpoint}`);

                    const messageId = uuidv4();
                    const data = {
                        connectorId: parseInt(plugId),
                        csChargingProfiles: csChargingProfiles
                    };

                    const call = [global.callRequest, messageId, action, data];
                    console.log(JSON.stringify(call));
                    console.log(`Message sent to ${client.id}, ${action}`);

                    client.send(JSON.stringify(call), function (temp) {
                        eventEmitter.on(messageId, function (result) {
                            const setChargingProfileStatus = result.status;

                            if (setChargingProfileStatus === process.env.statusAccepted) {
                                Utils.saveLog(hwId, call[3], result, true, 'SetChargingProfile', `SetChargingProfile command`, plugId, trigger);
                                return res.status(200).send(result);
                            }else if (setChargingProfileStatus === constants.responseStatus.Rejected) {
                                Utils.saveLog(hwId, call[3], result, false, 'SetChargingProfile', 'Failed to set charging profile(s): The Charge Point does cannot set a Charging Profile, for example by an invalid value for the connectorId in the request.', plugId, trigger);
                                return res.status(400).send({ auth: 'true', code: "failed_set_charging_profile", message: 'Failed to set charging profile(s): The Charge Point does cannot set a Charging Profile, for example by an invalid value for the connectorId in the request.' });
                            } else if (setChargingProfileStatus === process.env.statusNotSupported) {
                                Utils.saveLog(hwId, call[3], result, false, 'SetChargingProfile', 'Failed to suport charging profile(s): The Charge Point does not support Smart Charging.', plugId, trigger);
                                return res.status(406).send({ auth: 'true', code: "failed_support_charging_profile", message: 'Failed to suport charging profile(s): The Charge Point does not support Smart Charging.' });
                            } else {
                                Utils.saveLog(hwId, call[4], result, false, 'SetChargingProfile', 'An error occurred while processing the request. Please check your request and try again.', plugId, trigger);
                                return res.status(500).send({ auth: 'true', code: "error_processing_request", message: 'An error occurred while processing the request. Please check your request and try again.' });
                            }
                        });
                    });
                }
            } else {
                const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
                console.error(message);
                Utils.saveLog(hwId, req.body, {}, false, 'SetChargingProfile', `Communication not established between the CS and the charging station ${hwId}`, plugId, trigger);
                return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
            }
        } catch (error) {
            const message = `${context} Error occurred: ${error}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'SetChargingProfile', message, plugId, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message: message });
        }
    }
};


function isValidDecimalNumber(value) {
    const decimalPattern = /^-?\d*\.?\d+$/;
  
    return decimalPattern.test(value);
  }
