const Activation = require('../models/activation');
const ExternalRequestsHandler = require('./externalRequests');
const { logger } = require('../utils/constants');

module.exports = {
    userCodeChangeMobile(user, headers) {
        let context = "Function userActivation";
        try {
            //Generating code
            let code = getRandomInt(10000, 100000);
            let activation = new Activation({
                code: code,
                userId: user._id
            });
            Activation.createActivation(activation, (error, result) => {
                if (error) {
                    console.log(`[${context}] Error`, error)
                }
                if (result) {
                    ExternalRequestsHandler.sendNewMobileSMS(user, code, headers)
                        .then(() => {
                            console.log("SMS sent successfully!");
                        })
                        .catch(() => {
                            console.log("SMS sent unsuccessfully!");
                        })
                }
                else
                    console.log("SMS sent unsuccessfully!");
            });
        } catch (error) {
            console.log(`[${context}] Error`, error)
        };
    }
}

//function to gereta a code of six digits
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
};