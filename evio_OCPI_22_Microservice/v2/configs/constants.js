const constants = {
    publicNetworkHost: process.env.HostPublicNetwork || 'http://public-network:3029',
    identityHost: process.env.HostUser || 'http://identity:3003',
    TOTAL_TIMEOUT_MS: process.env.TOTAL_TIMEOUT_MS || 60_000,
    RETRY_INTERVAL_MS: process.env.RETRY_INTERVAL_MS || 5_000,
    MAX_RETRIES_BEFORE_PENDING_DELAY: process.env.MAX_RETRIES_BEFORE_PENDING_DELAY || 3,
    MIN_MS_BEFORE_PENDING_DELAY: process.env.MIN_MS_BEFORE_PENDING_DELAY || 19_000,
    MAX_MS_BEFORE_PENDING_DELAY: process.env.MAX_MS_BEFORE_PENDING_DELAY || 20_000,
    MAX_MS_WAIT_PUT_SESSION: process.env.MAX_MS_WAIT_PUT_SESSION || 70_000,
    HubjectNetwork: process.env.HubjectNetwork || 'Hubject',
    OICPServiceHost: process.env.OICPServiceHost || 'http://oicp:3102',
    APTServiceHost: process.env.APT_SERVICE_HOST || 'http://apt:6001',
    PaymentsV2ServiceHost: process.env.HostPaymentsV2 || 'http://payments-v2:6002',
    PreAuthorizationValueAddToUpdate: process.env.PreAuthorizationValueAddToUpdate || 10, // 10 euros 
    PreAuthorizationMinDiffToNecessaryUpdate: process.env.PreAuthorizationMinDiffToNecessaryUpdate || 5, // 5 euros 
};

module.exports = constants;
