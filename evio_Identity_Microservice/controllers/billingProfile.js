const BillingProfile = require('../models/billingProfile');
const { logger } = require('../utils/constants');

// TODO: this code still used? if not, remove it. I've created a "billingProfile.ts"
module.exports = {
    getBillingProfile: (userId) => {
        const context = "Funciton getBillingProfile";
        return new Promise(async (resolve, reject) => {
            try {
                let billingProfile = await BillingProfile.findOne({ _id: userId });
                resolve(billingProfile)
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    },
    validateBillingProfile: (userId) => {
        const context = "Funciton validateBillingProfile";
        return new Promise(async (resolve, reject) => {
            try {

                let query = {
                    userId: userId,
                    nif: { "$exists": true, "$ne": "" },
                    email: { "$exists": true, "$ne": "" }
                };

                let billingProfileFound = await BillingProfile.findOne(query);
                resolve(billingProfileFound);

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            }
        });
    }
}
