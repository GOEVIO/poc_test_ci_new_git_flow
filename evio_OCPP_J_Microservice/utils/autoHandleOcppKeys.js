const axios = require('axios');
const EvioKey = require('../models/evioKeys');
const Utils = require('../utils');
const global = require('../global')

const host = global.charger_microservice_host;
const modelCheckUrl = `${host}${global.getChargerModels}`;
const alarmUrl = `${host}${global.getAlarms}`;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;

async function isChargerModelValid(model, manufacturer) {
    try {
        const res = await axios.get(modelCheckUrl);
        const list = res.data?.data || [];
        return list.some(entry =>
            entry.manufacturer?.toLowerCase() === manufacturer.toLowerCase() &&
            entry.models?.some(m => m.model?.toLowerCase() === model.toLowerCase())
        );
    } catch (err) {
        console.error('[evioConfigurationManager] Error validating charger model:', err.message);
        return false;
    }
}

async function getEvioGuidelineKeys(model, manufacturer) {
    return await EvioKey.findOneEvioKeys({ model, manufacturer });
}

function getMandatoryKeys(evioKeys) {
    return evioKeys.filter(k => k.required === true);
}

async function applyMandatoryKeys(hwId, mandatoryKeys, charger, client, eventEmitter) {
    const configurationList = mandatoryKeys.map(k => ({ key: k.key, value: k.value }));

    try {
        const result = await Utils.updateManyConfigurationKeys(
            configurationList,
            charger,
            client,
            eventEmitter,
            'ChangeConfiguration'
        );

        return result;
    } catch (err) {
        console.error(`[applyMandatoryKeys] Error applying mandatory keys for charger ${hwId}: ${err.message}`);
        return {
            successConfigurationKeys: [],
            failedConfigurationKeys: configurationList.map(k => ({ key: k.key, error: err.message })),
            total: configurationList.length
        };
    }
}

async function createConfigurationAlarm(hwId, key, userId, plugId) {
    const payload = {
        title: {
            code: `alarm_error_change_configuration_${key.toLowerCase()}_title`,
            message: "Configuration Rejected: Mandatory OCPP Key"
        },
        description: {
            code: `alarm_error_change_configuration_${key.toLowerCase()}_description`,
            message: `Failed to apply change configuration. The mandatory OCPP key ${key} cannot be modified. This parameter ensures correct behavior.`
        },
        timestamp: new Date().toISOString(),
        type: 'error',
        status: 'unread',
        userId,
        hwId,
        plugId,
        data: {
            text: "Configuration key supported, but setting could not be changed.",
            responseData: { status: "Rejected" }
        }
    };


    try {
        console.log('[Alarm Payload][createConfigurationAlarm]', JSON.stringify(payload));
        await axios.post(alarmUrl, payload);
    } catch (error) {
        console.error(`[createConfigurationAlarm] Failed to send alarm for hwId ${hwId}, key ${key}:`, error.message);
        if (error.response?.data) {
            console.error('[createConfigurationAlarm] Response body:', error.response.data);
        }
        console.error('[createConfigurationAlarm] Payload sent:', JSON.stringify(payload, null, 2));
    }
}

async function createManualRebootAlarm(hwId, userId, plugId) {
    const payload = {
        title: {
            code: `alarm_manual_reboot_title`,
            message: "Manual Reboot Might Be Required"
        },
        description: {
            code: `alarm_manual_reboot_description`,
            message: "Configuration keys were successfully updated, but the charger might not reboot automatically. Please verify or restart it manually if needed."
        },
        timestamp: new Date().toISOString(),
        type: 'info',
        status: 'unread',
        userId,
        hwId,
        plugId,
        data: {
            text: "Manual reboot is recommended if the charger does not reconnect."
        }
    };

    try {
        console.log('[Alarm Payload][createManualRebootAlarm]', JSON.stringify(payload));
        await axios.post(alarmUrl, payload);
        console.log(`[ManualRebootAlarm] Info alarm sent for charger ${hwId}`);
    } catch (error) {
        console.error(`[ManualRebootAlarm] Failed to send alarm for charger ${hwId}:`, error.message);
        if (error.response?.data) {
            console.error('[ManualRebootAlarm] Response body:', error.response.data);
        }
        console.error('[ManualRebootAlarm] Payload sent:', JSON.stringify(payload, null, 2));
    }
}

async function markChargerAsInactive(chargerId) {
    return await Utils.updateChargerData(chargerServiceUpdateProxy, {
        _id: chargerId,
        operationalStatus: "REJECTED"
    });
}

function hasMissingOrWrongMandatoryKeys(mandatoryKeys, currentConfigKeys) {
    return mandatoryKeys.filter(k => {
        const current = currentConfigKeys.find(c => c.key.toLowerCase() === k.key.toLowerCase());
        return !current || current.value !== k.value;
    });
}

module.exports = {
    isChargerModelValid,
    getEvioGuidelineKeys,
    getMandatoryKeys,
    applyMandatoryKeys,
    createConfigurationAlarm,
    markChargerAsInactive,
    hasMissingOrWrongMandatoryKeys,
    createManualRebootAlarm
};
