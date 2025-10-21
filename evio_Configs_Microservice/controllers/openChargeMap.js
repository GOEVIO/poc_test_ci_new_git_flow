const OpenChargeMap = require('../models/openChargeMap');
const axios = require("axios");
require("dotenv-safe").load();

module.exports = {
    addOpenChargeMap: function (req) {
        let context = "Funciton addOpenChargeMap";
        return new Promise((resolve, reject) => {

            let openChargeMapConfig = req.body;

            OpenChargeMap.findOne({}, (error, openChargeMapConfigFound) => {
                if (error) {
                    console.error(`[${context}][.then][findOne] Error `, error.message);
                    reject(error);
                }
                else {
                    if (openChargeMapConfigFound) {

                        let query = {
                            _id: openChargeMapConfigFound._id
                        }
                        var newValue = { $set: openChargeMapConfig };

                        OpenChargeMap.updateOpenChargeMap(query, newValue, (err, result) => {
                            if (err) {
                                console.log(`[${context}][updateOpenChargeMap] Error `, err.message);
                                reject(err);
                            }
                            else {

                                console.log(result);

                                if (result) {
                                    resolve({ auth: false, code: 'open_charge_map_configuration_updated', message: "Open Charge Map configurations updated" });
                                }
                                else {
                                    reject({ auth: false, code: 'open_charge_map_configuration_not_updated', message: "Open Charge Map configurations not updated" });
                                }
                            }
                        });

                    }
                    else {
                        let dbConfig = new OpenChargeMap(openChargeMapConfig);

                        OpenChargeMap.createOpenChargeMap(dbConfig, (err, result) => {
                            if (err) {
                                console.log(`[${context}][createOpenChargeMap] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (result) {
                                    resolve({ auth: false, code: 'open_charge_map_configuration_created', message: "Open Charge Map configurations created" });
                                }
                                else {
                                    reject({ auth: false, code: 'open_charge_map_configuration_not_created', message: "Open Charge Map configurations not created" });
                                }
                            }
                        });

                    }
                }
            });

        });
    },
    getOpenChargeMap: function (req) {
        let context = "Funciton getOpenChargeMap";
        return new Promise((resolve, reject) => {
            OpenChargeMap.findOne({}, (err, configsFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (configsFound) {
                        resolve(configsFound);
                    }
                    else {
                        reject({ auth: false, code: 'open_charge_map_configuration_not_found', message: "Open Charge Map configurations not found" });
                    }
                }
            });
        });
    },
    deleteOpenChargeMap: function (req) {
        let context = "Funciton deleteOpenChargeMap";
        return new Promise((resolve, reject) => {
            OpenChargeMap.findOneAndDelete({}, (err, configsFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (configsFound) {
                        resolve({ auth: true, code: 'open_charge_map_configuration_deleted', message: "Open Charge Map configuration deleted" });
                    } else {
                        reject({ auth: true, code: 'open_charge_map_configuration_not_deleted', message: "Open Charge Map configuration not deleted" });
                    }
                }
            });
        });
    }
}