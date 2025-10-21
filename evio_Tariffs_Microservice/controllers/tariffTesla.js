const TariffTesla = require('../models/tariffTesla');
require("dotenv-safe").load();

module.exports = {
    addTariffTesla: function (req) {
        let context = "Funciton addTariffTesla";
        return new Promise((resolve, reject) => {

            let tariffTesla = new TariffTesla(req.body);

            validateFields(tariffTesla)
                .then(() => {

                    TariffTesla.markAllAsInactive((err, result) => {
                        if (err) {
                            console.error(`[${context}][markAllAsInactive] Error `, err.message);
                            reject(err);
                        }
                        else {
                            TariffTesla.createTariffTesla(tariffTesla, (err, result) => {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                    reject(err);
                                }
                                else {
                                    resolve(result);
                                };
                            });
                        };
                    });
                })
                .catch((error) => {
                    console.log(`[${context}][validateFields] Error `, error.message);
                    reject(error);
                });

        });
    },
    updateTariffTesla: function (req) {
        let context = "Funciton updateTariffTesla";
        return new Promise((resolve, reject) => {

            let received = req.body;

            validateFields(received)
                .then(() => {

                    let query = {
                        _id: received._id
                    };

                    let newValues = {
                        $set: { received }
                    };

                    TariffTesla.updateTariffTesla(query, newValues, (err, result) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                            reject(err);
                        }
                        else {
                            TariffTesla.find(quer, (err, result) => {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                    reject(err);
                                }
                                else {
                                    resolve(result);
                                };
                            });
                        };
                    });

                })
                .catch((error) => {
                    console.log(`[${context}][validateFields] Error `, error.message);
                    reject(error);
                });
        });
    },
    getTariffTesla: function (req) {
        let context = "Funciton getTariffTesla";
        return new Promise((resolve, reject) => {

            let query = req.query;

            TariffTesla.findOne(query, (err, tariffTeslaFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    resolve(tariffTeslaFound);
                };
            });

        });
    }
}

//========== FUNCTION ==========
//Function to validate fields received 
function validateFields(tariffTesla) {
    return new Promise((resolve, reject) => {
        if (!tariffTesla)
            reject({ auth: false, code: 'server_tariffTesla_data_required', message: "Tesla tariff data required" });
        else if (!tariffTesla.uom)
            reject({ auth: false, code: 'server_uom_required', message: "Unit of measurement required" });
        else if (tariffTesla.value === undefined)
            reject({ auth: false, code: 'server_value_required', message: "Tariff value required" });
        else
            resolve(true);
    });
};