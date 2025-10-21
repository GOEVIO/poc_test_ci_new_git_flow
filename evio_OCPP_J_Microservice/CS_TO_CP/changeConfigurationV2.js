const global = require('../global');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const Utils = require('../utils');
const ConfigurationKey = require('../models/configurationKeys');
const moment = require('moment');
const axios = require("axios");

const context = "[Change Configuration V2]";

const host = global.charger_microservice_host;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;

const trigger = global.triggeredByCS;

module.exports = {
    handle: function (req, res, wss, eventEmitter) {

        const action = 'ChangeConfiguration';

        const hwId = req.body.hwId;
        if (!hwId)
            return res.status(400).send({ auth: 'true', code: "server_hw_id_required", message: 'Hardware ID required' });

        const configuration = req.body.configuration;
        if (!configuration || !Array.isArray(configuration))
            return res.status(400).send({ auth: 'true', code: "server_configuration_key_required", message: 'Configuration Key must be an array' });

        const clients = Array.from(wss.clients);
        const client = clients.find(a => a.id == hwId);

        if (!client || client.readyState !== WebSocket.OPEN) {
            const message = `${context} Communication not established between the CS and the charging station ${hwId}`;
            console.error(message);
            Utils.saveLog(hwId, req.body, {}, false, 'ChangeConfigurationV2', message, 0, trigger);
            return res.status(500).send({ auth: 'true', code: "server_error_connecting_charging_station", message });
        }

        Utils.chekIfChargerExists(chargerServiceProxy, { hwId })
            .then(charger => {
                if (!charger) {
                    const message = `Charger ${hwId} does not exist`;
                    Utils.saveLog(hwId, req.body, {}, false, 'ChangeConfigurationV2', message, 0, trigger);
                    return res.status(404).send({ auth: true, status: false, message });
                }

                updateManyConfigurationKeys(configuration, charger, client, eventEmitter, action, res);
            })
            .catch(error => {
                console.error(`${context} Error verifying charger existence:`, error.message);
                return res.status(500).send({ auth: 'true', code: "server_internal_error", message: error.message });
            });
    }
}

async function updateManyConfigurationKeys(configurationList, charger, client, eventEmitter, action, res) {
    const context = "[ChangeConfigurationV2]";
    let rebootRequired = false;
    let results = [];

    try {
        for (let config of configurationList) {
            const updateResult = await updateConfigurationKey(config, charger, client, eventEmitter, action);

            const isSuccess =
                updateResult.result === process.env.statusAccepted ||
                updateResult.result === process.env.statusRebootRequired;

            results.push({
                key: config.key,
                status: isSuccess ? "Success" : "Error",
                message: updateResult.result === process.env.statusRebootRequired
                    ? "Change will take effect after reboot"
                    : updateResult.message || null
            });

            if (updateResult.result === process.env.statusRebootRequired) {
                rebootRequired = true;
            }
        }

        return res.status(200).send({ rebootRequired, results });

    } catch (error) {
        console.error(`${context} Unexpected error:`, error.message);
        return res.status(500).send({ auth: 'true', code: "server_internal_error", message: error.message });
    }
}

function updateConfigurationKey(config, charger, client, eventEmitter, action) {
    return new Promise((resolve) => {
        const messageId = uuidv4();
        const data = { key: config.key, value: config.value };

        const call = [global.callRequest, messageId, action, data];

        console.log(`[${action}] Sending message to ${client.id}:`, JSON.stringify(call));
        client.send(JSON.stringify(call), function () {
            eventEmitter.once(messageId, async function (result) {
                const remoteStatus = result.status;

                if (remoteStatus === process.env.statusAccepted) {
                    await updateConfigurationKeyValue(charger.hwId, data);

                    await updateChargerMetadataIfNeeded(data, charger);

                    resolve({ result: remoteStatus, data });
                } else {
                    console.log(`[${action}] Failed for key ${data.key}, response:`, JSON.stringify(result));
                    resolve({
                        result: remoteStatus,
                        data,
                        message: `Failed to change configuration. Status: ${remoteStatus}`,
                        errorDetails: result
                    });
                }
            });
        });
    });
}

async function updateConfigurationKeyValue(hwId, data) {
    const lastUpdated = moment.utc().toISOString();
    return ConfigurationKey.updateConfigurationKey(
        { $and: [{ 'hwId': hwId }, { 'keys.key': data.key }] },
        { '$set': { 'keys.$.value': data.value, 'lastUpdated': lastUpdated } }
    ).then(() => {
        console.log(`[ChangeConfigurationV2] Key '${data.key}' updated successfully`);
    }).catch(err => {
        console.error(`[ChangeConfigurationV2] Failed to update key '${data.key}':`, err.message);
    });
}

async function updateChargerMetadataIfNeeded(data, charger) {
    let body = {};
    if (data.key === process.env.heartbeatInterval) {
        body = { _id: charger._id, heartBeatInterval: data.value };
    } else if (data.key === process.env.meterValuesSampledData) {
        body = { _id: charger._id, meterValueSampleInterval: data.value };
    }

    if (Object.keys(body).length > 0) {
        try {
            await axios.patch(chargerServiceUpdateProxy, body);
            console.log(`[ChangeConfigurationV2] Updated charger metadata for key '${data.key}'`);
        } catch (error) {
            console.error(`[ChangeConfigurationV2] Failed updating charger metadata for key '${data.key}':`, error.message);
        }
    }
}
