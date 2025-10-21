const { retrievePreAuthorizationByPSPReference } = require('evio-library-payments').default

const getUserInPreAuthorization = async (adyenReference) => {
    const preAuthorization = await retrievePreAuthorizationByPSPReference(adyenReference, {billingInfo: 1, userId: 1});
    return preAuthorization || null;
}

module.exports = {
    getUserInPreAuthorization
};