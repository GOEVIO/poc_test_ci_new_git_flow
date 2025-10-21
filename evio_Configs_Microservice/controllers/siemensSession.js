const SiemensSession = require('../models/siemensSession');
require("dotenv-safe").load();

module.exports = {

    addSiemensSession: function (req) {
        var context = "Function addSiemensSession";
        return new Promise((resolve, reject) => {

            let siemensSessionConfig = req.body;

            SiemensSession.findOne({}, (error, siemensSessionConfigFound) => {
                if (error) {
                    console.error(`[${context}][.then][findOne] Error `, error.message);
                    reject(error);
                }
                else {
                    if (siemensSessionConfigFound) {

                        let query = {
                            _id: siemensSessionConfigFound._id
                        }
                        var newValue = { $set: siemensSessionConfig };

                        SiemensSession.updateSiemensSession(query, newValue, (err, result) => {
                            if (err) {
                                console.log(`[${context}][updateSiemensSession] Error `, err.message);
                                reject(err)
                            }
                            else {

                                if (result) {
                                    resolve({ auth: true, code: 'siemens_session_configurations_updated', message: "Siemens session configurations updated" });
                                }
                                else {
                                    reject({ auth: true, code: 'siemens_session_configurations_not_updated', message: "Siemens session configurations not updated" });
                                }
                            }
                        });

                    }
                    else {
                        let sessionConfig = new SiemensSession(siemensSessionConfig);

                        SiemensSession.createSiemensSession(sessionConfig, (err, result) => {
                            if (err) {
                                console.log(`[${context}][createSiemensSession] Error `, err.message);
                                reject(err)
                            }
                            else {
                                if (result) {
                                    resolve({ auth: true, code: 'siemens_session_configurations_created', message: "Siemens session configurations created" });
                                }
                                else {
                                    reject({ auth: true, code: 'siemens_sesison_configurations_not_created', message: "Siemens session configurations not created" });
                                }
                            }
                        });

                    }
                }
            });

        });
    },
    getSiemensSession: function (req) {
        var context = "Function getSiemensSession";
        return new Promise((resolve, reject) => {
            SiemensSession.findOne({}, (err, configsFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err)
                }
                else {
                    if (configsFound) {
                        resolve(configsFound);
                    }
                    else {
                        reject({ auth: true, code: 'siemens_session_configurations_not_found', message: "Siemens session configurations not found" });
                    }
                }
            });
        });
    },
    deleteSiemensSession: function (req) {
        var context = "Function deleteSiemensSession";
        return new Promise((resolve, reject) => {
            SiemensSession.findOneAndDelete({}, (err, configsFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err)
                }
                else {
                    if (configsFound) {
                        resolve({ auth: true, code: 'siemens_session_configurations_deleted', message: "Siemens session configurations deleted" });
                    } else {
                        reject({ auth: true, code: 'siemens_session_configurations_not_deleted', message: "Siemens session configurations not deleted" });
                    }
                }
            });
        });
    }
}