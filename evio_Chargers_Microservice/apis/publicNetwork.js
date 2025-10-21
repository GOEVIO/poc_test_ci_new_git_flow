const { findPublicChargersByNameOrHardwareId } = require("evio-library-chargers").default;
const { captureException } = require('@sentry/node');

async function getChargerOPCM(received, clientName) {
    const context = "Function getChargerOPCM";

    const fallback = [];
    const params = {
        name: received.name,
        countryCode: received.countryCode || ['PT','ES'],
        clientName
    };

    try {
        return findPublicChargersByNameOrHardwareId(params.name, params.clientName, params.countryCode);
    } catch (error) {
        console.error(`[${context}] Error, returning fallback `, error.message);
        captureException(error);

        return fallback;
    }
}

module.exports = { getChargerOPCM };