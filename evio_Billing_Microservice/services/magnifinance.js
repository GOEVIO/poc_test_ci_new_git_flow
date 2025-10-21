const soap = require('soap');
const Constants = require('../utils/constants');

module.exports = {
    getClientInstance: async() => {
        return soap.createClientAsync(Constants.providers.magnifinance);
    },
    getCredentials: () => {
        if(Constants.environment === 'production') {
            return {
                email: process.env.userEmailPRD,
                token: process.env.companyTokenPRD
            }
        }

        if(Constants.environment === 'pre-production') {
            return {
                email: process.env.userEmailQA,
                token: process.env.companyTokenQA
            }
        }

        return {
            email: process.env.userEmailQA,
            token: process.env.companyTokenQA
        }
    }
};
