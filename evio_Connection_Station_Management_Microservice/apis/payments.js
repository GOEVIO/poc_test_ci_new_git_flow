const axios = require("axios");
const { saveSessionLogs } = require('../helpers/save-session-logs');
const { getErrorMessageFromErrorResponse } = require("../utils/errorUtils");
const { Enums } = require('evio-library-commons').default;

function validatePaymentConditions(userId, newData, baseDataToSaveLog = {}) {
    var context = "Function validatePaymentConditions";
    return new Promise(async (resolve, reject) => {
        try {

            var proxy = process.env.HostPayments + process.env.PathValidatePaymentConditions;

            var data = {
                userId: userId,
                //chargerFound: chargerFound,
                data: newData,
                //plugFound: plugFound
            };

            axios.get(proxy, { data })
                .then((result) => {
                    //console.log("result.data", result.data);
                    resolve(result.data);
                })
                .catch((error) => {
                    const stageValidatePaymentConditions = `[${context}][GET validatePaymentConditions]`
                    const message = getErrorMessageFromErrorResponse(error) || 'An error occurred while validating payment conditions';
                    if (error.response) {
                        console.log(`[${context}][400] Error `, error.response.data);
                        saveSessionLogs({...baseDataToSaveLog, stage: stageValidatePaymentConditions, errorMessage: message})
                        reject(error.response);
                    }
                    else {
                        console.log(`[${context}][500] Error `, error.message);
                        saveSessionLogs({...baseDataToSaveLog, stage: stageValidatePaymentConditions, errorMessage: message, errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR})
                        reject(error);
                    };
                });

        } catch (error) {
            console.log(`[${context}][500] Error `, error.message);
            reject(error);
        };
    });
};

module.exports = {
    validatePaymentConditions
};