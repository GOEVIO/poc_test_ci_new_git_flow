const axios = require('axios');
var _ = require("underscore");
const Platform = require('../../../models/platforms');
const global = require('../../../global');
const Utils = require('../../../utils');

module.exports = {
    getPlatformVersions: function (endpoint, token) {

        return new Promise((resolve, reject) => {
            axios.get(endpoint, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

                if (typeof response.data !== 'undefined') {
                    resolve(response.data);
                }
                else
                    resolve(false);

            }).catch(function (error) {

                reject(error);
            });
        });
    },
    getPlatformVersionsByPlatformCode: function (platformCode) {
        return new Promise((resolve, reject) => {

            var query = { platformCode: platformCode };

            Platform.findOne(query, (err, platforms) => {
                if (err) {
                    console.error(`[find] Error `, err);
                    reject(err);
                }
                else {
                    resolve(platforms);
                }
            });
        });
    },
    getPlatformVersionsByQuery: function (query) {
        return new Promise((resolve, reject) => {

            Platform.findOne(query, (err, platforms) => {
                if (err) {
                    console.error(`[find] Error `, err);
                    reject(err);
                }
                else {
                    resolve(platforms);
                }
            });
        });
    },
    updateCpoEndpoint: function (req) {
        return new Promise((resolve, reject) => {

            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            var platformCode = req.body.platformCode;

            if (!req.body.newEndpoint) {
                reject({ auth: false, code: "server_newEndpoint_required", message: 'newEndpoint required' });
                return;
            }

            if (!req.body.cpo) {
                reject({ auth: false, code: "server_cpo_required", message: 'cpo required' });
                return;
            }

            var cpo = req.body.cpo;

            var newEndpoint = req.body.newEndpoint;

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByQuery({cpo , platformCode}).then((platform) => {

                if (platform) {

                    var platformDetails = platform.platformDetails;
                    let platformVersion = platform.cpoActiveCredentialsToken[0].version
                    var platformDetails22 = _.where(platformDetails, { version: platformVersion});
                    var platformEndpoints = platformDetails22[0].endpoints;

                    var EndpointCredentials = _.where(platformEndpoints, { identifier: "credentials" });

                    if (typeof EndpointCredentials === 'undefined' || EndpointCredentials.length == 0) {
                        resolve({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    var endpoint = EndpointCredentials[0].url;

                    if (typeof endpoint === 'undefined') {
                        reject({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    var activeCredentials = _.where(platform.cpoActiveCredentialsToken, { version: platformVersion });
                    var token_C = activeCredentials[0].token;

                    var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: platformVersion });
                    var token = platformCredentials[0].token;

                    //Prepare body to request
                    var body = { token: token_C, url: newEndpoint, roles: platform.cpoRoles };

                    //Update cpo endpoint on local datbase
                    updatePlatformData(newEndpoint, platform).then((result) => {

                        //Invocar Mobie com novo endpoint
                        updateEndpoint(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            var data = result.data;
                                            var roles = data.roles;

                                            var platformToken = data.token;
                                            var platformEndpoint = data.url;

                                            updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint);
                                        }
                                        Utils.saveLog("PUT" , body , result , endpoint , token , platform.platformCode , platform.platformName , 200 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)

                                        resolve({ auth: false, code: "endpoint_update_success", message: 'Endpoint updated with success' });

                                    }
                                    else {
                                        Utils.saveLog("PUT" , body , result , endpoint , token , platform.platformCode , platform.platformName , 200 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                        updatePlatformData(platform.cpoURL, platform);
                                        console.log("Error updating endpoint calling platform.", result);
                                        reject({ auth: false, code: "server_calling_endpoint_update", message: "Error updating endpoint calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                        return;
                                    }
                                }
                                else {
                                    let responseBody = result 
                                    if (result.response) {
                                        if (result.response.data) {
                                            if (typeof result.response.data === 'string' || result.response.data instanceof String) {
                                                responseBody = {message : result.response.data}
                                            } else {
                                                responseBody = result.response.data
                                            }
                                        }
                                    }
                                    Utils.saveLog("PUT" , body , responseBody , endpoint , token , platform.platformCode , platform.platformName , Utils.getHttpStatus(result.response) , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                    updatePlatformData(platform.cpoURL, platform);
                                    console.log("Error updating endpoint calling platform. Unable to retrieve status_code", result);
                                    reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error updating endpoint calling platform. Unable to retrieve status_code!' });
                                    return;
                                }
                            }
                            else {
                                Utils.saveLog("PUT" , body , {} , endpoint , token , platform.platformCode , platform.platformName , 204 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                updatePlatformData(platform.cpoURL, platform);
                                console.log("Error updating endpoint calling platform.", result);
                                reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error calling endpoint update!' });
                                return;
                            }
                        });

                    }).catch((e) => {
                        console.log(e)
                        resolve({ auth: false, code: "server_saving_new_endpoint", message: "Error updating endpoint on local DB" });
                    });

                }
                else {
                    reject({ auth: false, code: "server_platform_notFound", message: 'Platform not found!' });
                    return;
                }

            }).catch((e) => {
                console.log("Generic client error. ", e);
                reject(e);
                return;
            });;
        });
    },
    updateCpoCredentials: function (req) {
        return new Promise((resolve, reject) => {

            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            var platformCode = req.body.platformCode;

            if (!req.body.cpo) {
                reject({ auth: false, code: "server_cpo_required", message: 'cpo required' });
                return;
            }

            var cpo = req.body.cpo;

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByQuery({cpo , platformCode}).then((platform) => {

                if (platform) {
                    var length = platform.tokenLength;
                    var platformDetails = platform.platformDetails;
                    let platformVersion = platform.cpoActiveCredentialsToken[0].version

                    var platformDetails22 = _.where(platformDetails, { version: platformVersion });
                    var platformEndpoints = platformDetails22[0].endpoints;

                    var EndpointCredentials = _.where(platformEndpoints, { identifier: "credentials" });

                    if (typeof EndpointCredentials === 'undefined' || EndpointCredentials.length == 0) {
                        resolve({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials2 not found!' });
                        return;
                    }

                    var endpoint = EndpointCredentials[0].url;

                    if (typeof endpoint === 'undefined') {
                        reject({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    var activeCredentials = _.where(platform.cpoActiveCredentialsToken, { version: platformVersion });
                    var token_C = activeCredentials[0].token;

                    var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: platformVersion });
                    var token = platformCredentials[0].token;

                    var newCpoToken = Utils.generateToken(length);

                    //Prepare body to request
                    var body = { token: newCpoToken, url: platform.cpoURL, roles: platform.cpoRoles };

                    //Update cpo endpoint on local datbase
                    updatePlatformData2(newCpoToken, platform).then((result) => {

                        //Invocar Mobie com novo endpoint
                        updateEndpoint(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            var data = result.data;
                                            var roles = data.roles;

                                            var platformToken = data.token;
                                            var platformEndpoint = data.url;
                                            console.log(data)

                                            updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint);
                                        }
                                        Utils.saveLog("PUT" , body , result , endpoint , token , platform.platformCode , platform.platformName , 200 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                        resolve({ auth: false, code: "credentials_update_success", message: 'Updated credentials with success' });

                                    }
                                    else {
                                        Utils.saveLog("PUT" , body , result , endpoint , token , platform.platformCode , platform.platformName , 200 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                        updatePlatformData(platform.cpoURL, platform);
                                        console.log("Error updating endpoint calling platform.", result);
                                        reject({ auth: false, code: "server_calling_endpoint_update", message: "Error updating endpoint calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                        return;
                                    }
                                }
                                else {
                                    let responseBody = result 
                                    if (result.response) {
                                        if (result.response.data) {
                                            if (typeof result.response.data === 'string' || result.response.data instanceof String) {
                                                responseBody = {message : result.response.data}
                                            } else {
                                                responseBody = result.response.data
                                            }
                                        }
                                    }
                                    Utils.saveLog("PUT" , body , responseBody , endpoint , token , platform.platformCode , platform.platformName , Utils.getHttpStatus(result.response) , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                    updatePlatformData(platform.cpoURL, platform);
                                    console.log("Error updating endpoint calling platform. Unable to retrieve status_code", result);
                                    reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error updating endpoint calling platform. Unable to retrieve status_code!' });
                                    return;
                                }
                            }
                            else {
                                Utils.saveLog("PUT" , body , {} , endpoint , token , platform.platformCode , platform.platformName , 204 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                updatePlatformData(platform.cpoURL, platform);
                                console.log("Error updating endpoint calling platform.", result);
                                reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error calling endpoint update!' });
                                return;
                            }
                        });

                    }).catch((e) => {
                        console.log(e)
                        resolve({ auth: false, code: "server_saving_new_endpoint", message: "Error updating endpoint on local DB" });
                    });

                }
                else {
                    reject({ auth: false, code: "server_platform_notFound", message: 'Platform not found!' });
                    return;
                }

            }).catch((e) => {
                console.log("Generic client error. ", e);
                reject(e);
                return;
            });;
        });
    },
    deleteCpoCredentials: function (req) {
        return new Promise((resolve, reject) => {

            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            var platformCode = req.body.platformCode;
            
            if (!req.body.cpo) {
                reject({ auth: false, code: "server_cpo_required", message: 'cpo required' });
                return;
            }

            var cpo = req.body.cpo;
            //Get Mobie credentials endpoint
            this.getPlatformVersionsByQuery({cpo , platformCode}).then((platform) => {
                
                if (platform) {
                    var length = platform.tokenLength;
                    var platformDetails = platform.platformDetails;
                    let platformVersion = platform.cpoActiveCredentialsToken[0].version

                    var platformDetails22 = _.where(platformDetails, { version: platformVersion });
                    var platformEndpoints = platformDetails22[0].endpoints;

                    var EndpointCredentials = _.where(platformEndpoints, { identifier: "credentials" });

                    if (typeof EndpointCredentials === 'undefined' || EndpointCredentials.length == 0) {
                        resolve({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials2 not found!' });
                        return;
                    }

                    var endpoint = EndpointCredentials[0].url;

                    if (typeof endpoint === 'undefined') {
                        reject({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    var activeCredentials = _.where(platform.cpoActiveCredentialsToken, { version: platformVersion });
                    var token_C = activeCredentials[0].token;

                    var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: platformVersion });
                    var token = platformCredentials[0].token;

                    var newCpoToken = Utils.generateToken(length);

                    //Prepare body to request
                    var body = { token: token_C, url: platform.cpoURL, roles: platform.cpoRoles };
                    //console.log(platform.cpoRoles);

                    //Update cpo endpoint on local datbase
                    updatePlatformDataDelete(platform, newCpoToken).then((result) => {

                        //Invocar Mobie com novo endpoint
                        deleteCredentials(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            var data = result.data;
                                            var roles = data.roles;

                                            var platformToken = data.token;
                                            var platformEndpoint = data.url;


                                            updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint);
                                        }
                                        Utils.saveLog("DELETE" , body , result , endpoint , token , platform.platformCode , platform.platformName , 200 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                        let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                                        Utils.updateCredentialsHandshake(platform.cpo , cpoCountryCode , platform.platformCode , false)

                                        resolve({ auth: false, code: "delete_credentials_success", message: 'Deleted credentials with success' });

                                    }
                                    else {
                                        Utils.saveLog("DELETE" , body , result , endpoint , token , platform.platformCode , platform.platformName , 200 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                        updatePlatformData(platform.cpoURL, platform);
                                        console.log("Error updating endpoint calling platform.", result);
                                        reject({ auth: false, code: "server_calling_endpoint_update", message: "Error updating endpoint calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                        return;
                                    }
                                }
                                else {
                                    let responseBody = result 
                                    if (result.response) {
                                        if (result.response.data) {
                                            if (typeof result.response.data === 'string' || result.response.data instanceof String) {
                                                responseBody = {message : result.response.data}
                                            } else {
                                                responseBody = result.response.data
                                            }
                                        }
                                    }
                                    Utils.saveLog("DELETE" , body , responseBody , endpoint , token , platform.platformCode , platform.platformName , Utils.getHttpStatus(result.response) , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                    updatePlatformData(platform.cpoURL, platform);
                                    console.log("Error updating endpoint calling platform. Unable to retrieve status_code", result);
                                    reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error updating endpoint calling platform. Unable to retrieve status_code!' });
                                    return;
                                }
                            }
                            else {
                                Utils.saveLog("DELETE" , body , {} , endpoint , token , platform.platformCode , platform.platformName , 204 , process.env.triggerCPO , process.env.moduleCredentials , platform.cpo)
                                updatePlatformData(platform.cpoURL, platform);
                                console.log("Error updating endpoint calling platform.", result);
                                reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error calling endpoint update!' });
                                return;
                            }
                        });

                    }).catch((e) => {
                        console.log(e)
                        resolve({ auth: false, code: "server_saving_new_endpoint", message: "Error updating endpoint on local DB" });
                    });

                }
                else {
                    reject({ auth: false, code: "server_platform_notFound", message: 'Platform not found!' });
                    return;
                }

            }).catch((e) => {
                console.log("Generic client error. ", e);
                reject(e);
                return;
            });;
        });
    },
}

function updateEndpoint(endpoint, token, body) {

    return new Promise((resolve, reject) => {
        axios.put(endpoint, body, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else
                resolve(false);

        }).catch(function (error) {
            resolve(error);
        });
    });
};

function deleteCredentials(endpoint, token, body) {


    return new Promise((resolve, reject) => {
        axios.delete(endpoint, { headers: { 'Authorization': `Token ${token}` },  data: body  }).then(function (response) {

            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else
                resolve(false);

        }).catch(function (error) {
            resolve(error);
        });
    });
};

function updatePlatformData(cpoURL, platform) {
    return new Promise((resolve, reject) => {

        var query = { _id: platform._id };
        var newValues = {
            $set:
            {
                cpoURL: cpoURL, //Save versions
            }

        };

        Platform.updatePlatform(query, newValues, (err, result) => {
            if (err) {
                console.error(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {

                resolve(result);
            };
        });

    });
}

function updatePlatformData2(newToken, platform) {
    return new Promise((resolve, reject) => {
        let platformVersion = platform.cpoActiveCredentialsToken[0].version
        let oldCpoToken = platform.cpoActiveCredentialsToken[0].token
        let currentDate = new Date().toISOString()
        var query = { _id: platform._id, "cpoActiveCredentialsToken.version": platformVersion };

        var token_C_history = [{ token: newToken, createDate: currentDate, version: platformVersion }];

        var found = platform.cpoActiveCredentialsToken.indexOf(platform.cpoActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == platformVersion;
        }));

        platform.cpoActiveCredentialsToken[found].token = newToken;

        var newValues = {
            $set:
            {
                "cpoActiveCredentialsToken.$": platform.cpoActiveCredentialsToken[found],
            },
            $push: {
                cpoTokensHistory: token_C_history
            }

        };

        Platform.updatePlatform(query, newValues, async (err, result) => {
            if (err) {
                console.error(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {
                await Platform.findOneAndUpdate({ _id: platform._id, "cpoTokensHistory.token": oldCpoToken } , {$set : { "cpoTokensHistory.$.expiredDate" :  currentDate}})
                resolve(result);
            };
        });

    });
}

function updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint) {
    return new Promise((resolve, reject) => {

        let platformVersion = platform.cpoActiveCredentialsToken[0].version
        let oldPlatformToken = platform.platformActiveCredentialsToken[0].token
        let currentDate = new Date().toISOString()
        var token_B_history = [{ token: platformToken, createDate: currentDate, version: platformVersion }];
        var platformActiveCredentialsToken = [{ token: platformToken, version: platformVersion }];

        var query = { _id: platform._id, "platformActiveCredentialsToken.version": platformVersion };
        var newValues = {
            $set:
            {
                platformRoles: roles,
                "platformActiveCredentialsToken.$": platformActiveCredentialsToken,
                platformVersionsEndpoint: platformEndpoint,
            },
            $push: {
                platformTokensHistory: token_B_history //Add Token B to platformTokensHistory
            }

        };

        Platform.updatePlatform(query, newValues, async (err, result) => {
            if (err) {
                console.error(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {
                await Platform.findOneAndUpdate({ _id: platform._id, "platformTokensHistory.token": oldPlatformToken } , {$set : { "platformTokensHistory.$.expiredDate" :  currentDate}})
                resolve(result);
            };
        });

    });
}
function updatePlatformDataDelete(platform, newCpoToken) {
    return new Promise((resolve, reject) => {
        let platformVersion = platform.cpoActiveCredentialsToken[0].version
        var found = platform.cpoActiveCredentialsToken.indexOf(platform.cpoActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == platformVersion;
        }));
        platform.cpoActiveCredentialsToken[found].token = newCpoToken;
        let cpoTokensHistory = [{ token: newCpoToken, createDate: new Date().toISOString(), version: platformVersion }];

        var query = { _id: platform._id, "cpoActiveCredentialsToken.version": platformVersion };
        var newValues = {
            $set: {
                platformVersions: [], //Save versions
                platformDetails: [],
                platformDetailsEndpoint: "", //Save Details
                platformVersionsEndpoint: "",
                platformRoles: [], //Save Roles 
                platformActiveCredentialsToken: [],
                "cpoActiveCredentialsToken.$": platform.cpoActiveCredentialsToken[found],
                platformTokensHistory: [],
                cpoTokensHistory: cpoTokensHistory,
                active: true,
                credendialExchanged: false
            }
        };

        Platform.updatePlatform(query, newValues, async (err, result) => {
            if (err) {

                reject(err);
            }
            else {
                resolve(result);
            };
        });

    });
}


