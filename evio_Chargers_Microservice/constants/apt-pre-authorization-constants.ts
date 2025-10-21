export const aptPreAuthorizationConstants = {
    PaymentsV2ServiceHost: process.env.HostPaymentsV2 || 'http://payments-v2:6002',
    PreAuthorizationValueAddToUpdate: process.env.PreAuthorizationValueAddToUpdate || 10, // 10 euros 
    PreAuthorizationMinDiffToNecessaryUpdate: process.env.PreAuthorizationMinDiffToNecessaryUpdate || 5, // 5 euros 
};