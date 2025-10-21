const ConfigurationKey = require('../models/configurationKeys');
const {
    isChargerModelValid,
    getEvioGuidelineKeys,
    getMandatoryKeys,
    hasMissingOrWrongMandatoryKeys,
    applyMandatoryKeys,
    createConfigurationAlarm,
    markChargerAsInactive,
    createManualRebootAlarm
} = require('../utils/autoHandleOcppKeys');
const Utils = require('../utils');
const global = require('../global');

module.exports = async function handleBootConfiguration(payload, charger, client, eventEmitter) {
    const hwId = charger.hwId;
    const userId = charger.createUser;
    const plugId = (Array.isArray(charger?.plugs) && (charger.plugs.find(p => p?.active)?.plugId || charger.plugs[0]?.plugId)) ||
        'unknown';

    if (!await isChargerModelValid(payload.chargePointModel, payload.chargePointVendor)) {
        console.error(`[handleBootConfiguration] Invalid model or manufacturer: model=${payload.chargePointModel}, manufacturer=${payload.chargePointVendor}`);
        await markChargerAsInactive(charger._id);
        return { accepted: false, reason: 'invalid_model_or_manufacturer' };
    }

    const guideline = await getEvioGuidelineKeys(payload.chargePointModel, payload.chargePointVendor);
    if (!guideline?.keys?.length) {
        console.error(`[handleBootConfiguration] Missing guideline keys for model=${payload.chargePointModel}, manufacturer=${payload.chargePointVendor}`);
        await markChargerAsInactive(charger._id);
        return { accepted: false, reason: 'missing_guideline' };
    }

    const chargerConfig = await ConfigurationKey.findOneConfigurationKeys({ hwId });
    const currentConfigKeys = chargerConfig?.keys || [];

    const mandatoryKeys = getMandatoryKeys(guideline.keys);
    const missingOrWrongKeys = hasMissingOrWrongMandatoryKeys(mandatoryKeys, currentConfigKeys);

    try {
        if (missingOrWrongKeys.length > 0) {
            const applyResult = await applyMandatoryKeys(hwId, missingOrWrongKeys, charger, client, eventEmitter);
            const failedMandatory = applyResult.failedConfigurationKeys.filter(k =>
                missingOrWrongKeys.find(m => m.key === k.key)
            );

            if (failedMandatory.length > 0) {
                for (const failed of failedMandatory) {
                    await createConfigurationAlarm(hwId, failed.key, userId, plugId);
                }
                console.error(`[handleBootConfiguration] Failed to apply mandatory keys: ${JSON.stringify(failedMandatory)}`);
                await markChargerAsInactive(charger._id);
                return { accepted: false, reason: 'mandatory_key_rejected' };
            }

            await createManualRebootAlarm(hwId, userId, plugId);
        }
    } catch (error) {
        console.error(`[handleBootConfiguration] Exception applying mandatory keys: ${error.message}`);
        await markChargerAsInactive(charger._id);
        return { accepted: false, reason: 'mandatory_key_rejected' };
    }

    await Utils.updateChargerData(`${global.charger_microservice_host}/api/private/chargers`, {
        _id: charger._id,
        operationalStatus: "APPROVED"
    });

    return { accepted: true };
};
