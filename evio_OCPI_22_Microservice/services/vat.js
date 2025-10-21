const Sentry = require("@sentry/node");
const countryList = require('country-list');
const axios = require('axios');
const global = require('../global');

async function getVATwithViesVAT(chargingSession) {
    const context = '[getgetVATwithViesVATFees]';
    try {
        const userIdToBilling = chargingSession?.userIdInfo?.clientType === "APT" ? null : chargingSession?.userIdToBilling;
        const fees = await  getFees({countryCode: chargingSession?.country_code, address: {zipCode: chargingSession?.address?.zipCode}}, userIdToBilling);

        return fees?.IVA;
    }
    catch(error) {
        console.log(`${context} Error`, error);
        Sentry.captureMessage(`${context} Error`, error);
        return chargingSession?.fees?.IVA
    }
}

async function getFees(charger, userId = null) {
    const context = '[getFees]';

    const chargerCountryCode = charger.countryCode || charger.address?.countryCode;
    const countryCode = (!chargerCountryCode || chargerCountryCode === "Portugal") ? "PT" : chargerCountryCode
    const isCountryCodeValid = countryList.getCodes().includes(countryCode);

    if (!isCountryCodeValid) {
        throw { code: 'invalid_country_code', message: 'Invalid country code' };
    }

    const zipCode = charger.address?.zipCode?.split("-")
    const postalCode = zipCode?.length > 1 ? zipCode[0] : "";
    const params = userId ? { countryCode, postalCode, userId } : { countryCode, postalCode };

    try {
        const fees = await axios.get(global.feesConfigEndpoint, { params });
        if (fees.data) {
            return fees.data;
        }
    } catch (error) {
        console.log(`${context} Error `, error.message);
        Sentry.captureException(error);
        throw { code: 'server_error', message: 'Internal Error' };
    }

    console.log(`${context} Any fees retuned with params`, params);
    Sentry.captureMessage(`Any fees returned with params countryCode=${countryCode} postalCode=${postalCode}`);
    throw { code: 'problem_while_get_fees_to_simulation', message: 'At this time it is not possible to obtain a simulation for the position' };
}

module.exports = {
    getVATwithViesVAT,
    getFees
};