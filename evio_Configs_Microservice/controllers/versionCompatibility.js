const VersionCompatibility = require('../models/versionCompatibility');
const Process = require('process');
require("dotenv-safe").load();

module.exports = {

    addVersionCompatibility: function (req) {
        var context = "Function addVersionCompatibility";
        return new Promise((resolve, reject) => {

            var versionCompatibility = new VersionCompatibility(req.body);
            validateFields(versionCompatibility)
                .then((result) => {

                    var query = {};
                    versionCompatibilityFind(query)
                        .then((result) => {

                            if (result.length === 0) {

                                versionCompatibilityCreate(versionCompatibility)
                                    .then((result) => {

                                        if (result) {
                                            resolve(result);
                                        }
                                        else {
                                            reject({ auth: false, code: 'server_version_compatibility_not_created', message: 'Version compatibility not created' });
                                        };

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][validateFields] Error `, error.message);
                                        reject(error);

                                    });

                            }
                            else {

                                Promise.all(
                                    result.map(version => {
                                        return new Promise((resolve, reject) => {
                                            var query = {
                                                _id: version._id
                                            };
                                            var newValues = {
                                                $set: { active: false }
                                            };
                                            versionCompatibilityUpdate(query, newValues)
                                                .then((result) => {

                                                    resolve(true);

                                                })
                                                .catch((error) => {

                                                    console.error(`[${context}][versionCompatibilityUpdate] Error `, error.message);
                                                    reject(error);

                                                });
                                        })
                                    })
                                ).then(() => {

                                    versionCompatibilityCreate(versionCompatibility)
                                        .then((result) => {

                                            if (result) {
                                                resolve(result);
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_version_compatibility_not_created', message: 'Version compatibility not created' });
                                            };

                                        })
                                        .catch((error) => {

                                            console.error(`[${context}][versionCompatibilityCreate] Error `, error.message);
                                            reject(error);

                                        });
                                }).catch((error) => {

                                    console.error(`[${context}][Promise.all] Error `, error.message);
                                    reject(error);

                                });
                            };

                        })
                        .catch((error) => {

                            console.error(`[${context}][versionCompatibilityFind] Error `, error.message);
                            reject(error);

                        });

                })
                .catch((error) => {

                    console.error(`[${context}][validateFields] Error `, error.message);
                    reject(error);

                });

        });
    },
    getVersionCompatibility: function (req) {
        var context = "Function getVersionCompatibility";
        return new Promise((resolve, reject) => {

            var received = req.query;
            var query = { active: true , clientName : received.clientName };
            console.log("Request getVersionCompatibility" , JSON.stringify(received))
            versionCompatibilityFindOne(query)
                .then((result) => {
                    console.log("versionCompatibilityFindOne result" , JSON.stringify(result))
                    if (received.clientType.includes('iOS')) {
                        //let resultIOSVersion = result.iOSVersion.replace('.', '');
                        //let receivedIOSVersion = received.iOSVersion.replace('.', '');

                        let resultIOSVersion = result.iOSVersion.split('.');
                        let receivedIOSVersion = received.iOSVersion.split('.');

                        /*if (Number(resultIOSVersion) <= Number(receivedIOSVersion)) {
                            resolve(true);
                        }
                        else {
                        resolve(false);
                        };*/

                        if (Number(resultIOSVersion[0]) < Number(receivedIOSVersion[0])) {
                            resolve(true);
                        } else if (Number(resultIOSVersion[0]) > Number(receivedIOSVersion[0])) {
                            resolve(false);
                        };

                        if (Number(resultIOSVersion[0]) < Number(receivedIOSVersion[0])) {
                            resolve(true);
                        } else if (Number(resultIOSVersion[0]) > Number(receivedIOSVersion[0])) {
                            resolve(false);
                        } else {
                            if (Number(resultIOSVersion[1]) < Number(receivedIOSVersion[1])) {
                                resolve(true);
                            } else if (Number(resultIOSVersion[1]) > Number(receivedIOSVersion[1])) {
                                resolve(false);
                            } else {
                                if (Number(resultIOSVersion[2]) <= Number(receivedIOSVersion[2])) {
                                    resolve(true);
                                } else {
                                    resolve(false);
                                }
                            }
                        }
                    } else if (received.clientType.includes('android')) {
                       
                        //let resultAndroidVersion = result.androidVersion.replace('.', '');
                        //let receivedAndroidVersion = received.androidVersion.replace('.', '');

                        let resultAndroidVersion = result.androidVersion.split('.');
                        let receivedAndroidVersion = received.androidVersion.split('.');

                        //console.log("resultAndroidVersion", resultAndroidVersion);
                        //console.log("receivedAndroidVersion", receivedAndroidVersion);

                        if (Number(resultAndroidVersion[0]) < Number(receivedAndroidVersion[0])) {
                            resolve(true);
                        } else if (Number(resultAndroidVersion[0]) > Number(receivedAndroidVersion[0])) {
                            resolve(false);
                        } else {
                            if (Number(resultAndroidVersion[1]) < Number(receivedAndroidVersion[1])) {
                                resolve(true);
                            } else if (Number(resultAndroidVersion[1]) > Number(receivedAndroidVersion[1])) {
                                resolve(false);
                            } else {
                                if (Number(resultAndroidVersion[2]) <= Number(receivedAndroidVersion[2])) {
                                    resolve(true);
                                } else {
                                    resolve(false);
                                }
                            }
                        }
                    } else {
                        resolve(true);
                    }
                    /*
                    if (result) {
                    resolve(true);
                    }
                    else {
                    resolve(false);
                    };
                    */
                })
                .catch((error) => {
                    console.error(`[${context}][versionCompatibilityFindOne] Error `, error.message);
                    reject(error)
                });

        });
    }
}

//========== FUNCTION ==========

function validateFields(versionCompatibility) {
    return new Promise((resolve, reject) => {
        if (!versionCompatibility)
            reject({ auth: false, code: 'server_version_compatibility_data_required', message: 'Version compatibility data required' });
        else if (!versionCompatibility.iOSVersion)
            reject({ auth: false, code: 'server_ios_version_required', message: 'IOS version is required' });
        else if (!versionCompatibility.androidVersion)
            reject({ auth: false, code: 'server_android_version_required', message: 'Android version is required' });
        //else if (!versionCompatibility.webClientVersion)
        //    reject({ auth: false, code: 'server_web_version_required', message: 'Web client version is required' });
        else if (!versionCompatibility.backendVersion)
            reject({ auth: false, code: 'server_backend_version_required', message: 'Backend version is required' });
        //else if (!versionCompatibility.operationsManagementVersion)
        //    reject({ auth: false, code: 'server_operationsManagement_version_required', message: 'Operations management version is required' });
        else
            resolve(true);

    });
};

//Function to creat a version compatibility
function versionCompatibilityCreate(versionCompatibility) {
    var context = "Function versionCompatibilityCreate";
    return new Promise((resolve, reject) => {
        VersionCompatibility.createVersionCompatibility(versionCompatibility, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function versionCompatibilityUpdate(query, newValues) {
    var context = "Function versionCompatibilityUpdate";
    return new Promise((resolve, reject) => {
        VersionCompatibility.updateVersionCompatibility(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function versionCompatibilityFind(query) {
    var context = "Function versionCompatibilityUpdate";
    return new Promise((resolve, reject) => {
        VersionCompatibility.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                if (err.message.includes("pool destryed")) {
                    Process.exit(0);
                }
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function versionCompatibilityFindOne(query) {
    var context = "Function versionCompatibilityFindOne";
    return new Promise((resolve, reject) => {
        VersionCompatibility.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                if (err.message.includes("pool destryed")) {
                    Process.exit(0);
                }
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};