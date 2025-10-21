const APIKey = require('../models/apiKey');
require("dotenv-safe").load();

module.exports = {

    addAPIKey: function (req) {
        let context = "Funciton addAPIKey";
        return new Promise((resolve, reject) => {

            const apiKeyToSave = new APIKey(req.body);

            APIKey.createAPIKey(apiKeyToSave, (err, result) => {
                if (err) {
                    console.log(`[${context}][createAPIKey] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(result);
                };
            });

        });
    },
    getAPIKey: function (req) {
        let context = "Funciton getAPIKey";
        return new Promise((resolve, reject) => {

            APIKey.find({}, (err, result) => {
                if (err) {
                    console.log(`[${context}][] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(result);
                };
            });

        });
    }

};