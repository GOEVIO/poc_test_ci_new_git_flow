const AppVersion = require('../models/appVersion');
require("dotenv-safe").load();

module.exports = {
    addAppVersion: function (req) {
        let context = "Funciton addAppVersion";
        return new Promise((resolve, reject) => {

            const appVersions = new AppVersion(req.body);

            var query = {
                version: appVersions.version
            };

            AppVersion.findOne(query, (err, appVersionFound) => {
                if (err) {
                    console.log(`[${context}][createAppVersions] Error `, err.message);
                    reject(err);
                }
                else {
                    if (appVersionFound) {

                        appVersionFound.code = appVersions.code;
                        var newValue = { $set: appVersionFound };

                        AppVersion.updateAppVersion(query, newValue, (err, result) => {
                            if (err) {
                                console.log(`[${context}][updateAppVersion] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (result) {
                                    resolve(result);
                                }
                                else {
                                    reject({ auth: false, code: 'server_code_not_created', message: "Code not created" });
                                }
                            }
                        });
                    }
                    else {
                        AppVersion.createAppVersion(appVersions, (err, result) => {
                            if (err) {
                                console.log(`[${context}][createAppVersion] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (result) {
                                    resolve(result);
                                }
                                else {
                                    reject({ auth: false, code: 'server_code_not_created', message: "Code not created" });
                                };
                            };
                        });
                    }
                }
            });

        });
    },
    getAppVersion: function (req) {
        let context = "Funciton getAppVersion";
        return new Promise((resolve, reject) => {

            var query = req.query;

            AppVersion.find(query, (err, appVersionFound) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (appVersionFound.length > 0) {
                        resolve(appVersionFound);
                    }
                    else {
                        AppVersion.find({}, (err, appVersionFound) => {
                            if (err) {
                                console.log(`[${context}][find] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (appVersionFound.length > 0) {
                                    let result = [];
                                    result.push(appVersionFound[appVersionFound.length - 1]);
                                    resolve(result);
                                }
                                else {
                                    resolve(appVersionFound);
                                };
                            };
                        });
                    };
                };
            });

        });
    },
    deleteAppVersion: function (req) {
        let context = "Funciton deleteAppVersion";
        return new Promise((resolve, reject) => {

            var query = req.body;

            AppVersion.findOneAndDelete(query, (err, result) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result)
                        resolve({ auth: true, code: 'server_code_deleted', message: "Code deleted" });
                    else
                        reject({ auth: true, code: 'server_code_not_deleted', message: "Code not deleted" });
                };
            });

        });
    }
}