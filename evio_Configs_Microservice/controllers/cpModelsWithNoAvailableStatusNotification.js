const CpModelsWithNoAvailableStatusNotification = require('../models/cpModelsWithNoAvailableStatusNotification');
require("dotenv-safe").load();

module.exports = {
    addCpModelsWithNoAvailableStatusNotification: function (req) {
        let context = "Funciton addCpModelsWithNoAvailableStatusNotification";
        return new Promise((resolve, reject) => {

            var cpModelsWithNoAvailableStatusNotification = new CpModelsWithNoAvailableStatusNotification(req.body);

            if (!cpModelsWithNoAvailableStatusNotification.chargerModel) {
                reject({ auth: false, code: 'server_charger_model_required', message: 'Charger model required' });
            }
            else {

                CpModelsWithNoAvailableStatusNotification.find({ chargerModel: cpModelsWithNoAvailableStatusNotification.chargerModel }, (err, results) => {

                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        reject(err);
                    }
                    else {

                        if (results.length > 0) {

                            reject({ auth: false, code: 'server_charger_model_already_exists', message: 'Charger model already exists' });

                        }
                        else {

                            CpModelsWithNoAvailableStatusNotification.createCpModelsWithNoAvailableStatusNotification(cpModelsWithNoAvailableStatusNotification, (err, result) => {

                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                    reject(err);
                                }
                                else {

                                    if (result) {

                                        resolve(result);

                                    }
                                    else {

                                        reject({ auth: false, code: 'server_charger_model_not_added', message: 'Charger model not added' });

                                    };

                                };

                            });

                        };

                    };

                });

            };
        });

    },
    updateCpModelsWithNoAvailableStatusNotification: function (req) {
        let context = "Funciton updateCpModelsWithNoAvailableStatusNotification";
        return new Promise((resolve, reject) => {


            let received = req.body;

            if (!received._id) {
                reject({ auth: false, code: 'server_cpModel_id_required', message: 'Charger model id required' });
            };

            if (received.active != true && received.active != false) {
                rejectd({ auth: false, code: 'server_active_required', message: 'Charger model active is required' });
            };

            let query = { _id: received._id };

            let cpModel = { active: received.active };

            CpModelsWithNoAvailableStatusNotification.findOneAndUpdate(query, { $set: cpModel }, { new: true }, (err, result) => {

                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(result);
                };

            });

        });

    },
    getCpModelsWithNoAvailableStatusNotification: function (req) {
        let context = "Funciton getCpModelsWithNoAvailableStatusNotification";
        return new Promise((resolve, reject) => {

            let query = {
                active: true
            };

            CpModelsWithNoAvailableStatusNotification.find(query, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(result);
                };
            });

        });

    }
};