var Platforms = require('../../../models/platforms');
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

            const query = { platformCode: platformCode };

            Platforms.findOne(query, (err, platforms) => {
                if (err) {
                    console.log(`[find] Error `, err);
                    reject(err);
                }
                else {
                    resolve(platforms);
                }
            });
        });
    },
    updateEvioEndpoint: function (req) {
        return new Promise((resolve, reject) => {

            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            const platformCode = req.body.platformCode;

            if (!req.body.newEndpoint) {
                reject({ auth: false, code: "server_newEndpoint_required", message: 'newEndpoint required' });
                return;
            }

            const newEndpoint = req.body.newEndpoint;

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {

                if (platform) {

                    const platformDetails = platform.platformDetails;

                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints = platformDetails22[0].endpoints;

                    const EndpointCredentials = _.where(platformEndpoints, { identifier: "credentials" });
                    if (typeof EndpointCredentials === 'undefined' || EndpointCredentials.length == 0) {
                        resolve({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials2 not found!' });
                        return;
                    }

                    const endpoint = EndpointCredentials[0].url;
                    if (typeof endpoint === 'undefined') {
                        reject({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    const activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: "2.2" });
                    const token_C = activeCredentials[0].token;

                    const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" });
                    const token = platformCredentials[0].token;

                    //Prepare body to request
                    const body = { token: token_C, url: newEndpoint, roles: platform.evioRoles };

                    //Update evio endpoint on local datbase
                    updatePlatformData(newEndpoint, platform).then((result) => {

                        //Invocar Mobie com novo endpoint
                        updateEndpoint(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            const data = result.data;
                                            const roles = data.roles;

                                            const platformToken = data.token;
                                            const platformEndpoint = data.url;

                                            updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint);
                                        }
                                        //TODO Save result data. Maybe can be relevant informations such as new credentials
                                        resolve({ auth: false, code: "endpoint_update_success", message: 'Endpoint updated with success' });
                                    }
                                    else {
                                        updatePlatformData(platform.evioURL, platform);
                                        console.log("Error updating endpoint calling platform.", result);
                                        reject({ auth: false, code: "server_calling_endpoint_update", message: "Error updating endpoint calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                        return;
                                    }
                                }
                                else {
                                    updatePlatformData(platform.evioURL, platform);
                                    console.log("Error updating endpoint calling platform. Unable to retrieve status_code", result);
                                    reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error updating endpoint calling platform. Unable to retrieve status_code!' });
                                    return;
                                }
                            }
                            else {
                                updatePlatformData(platform.evioURL, platform);
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
                console.log("[platformVersions.updateEvioEndpoint] Generic client error. ", e);
                reject(e);
                return;
            });;
        });
    },
    updateEvioEndpoint_OLD: function (req) {
        return new Promise((resolve, reject) => {
            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            const platformCode = req.body.platformCode;

            const newEndpoint = req.body.newEndpoint;
            if (!newEndpoint) {
                reject({ auth: false, code: "server_newEndpoint_required", message: 'newEndpoint required' });
                return;
            }

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {

                if (platform) {
                    const platformDetails = platform.platformDetails;

                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints = platformDetails22[0].endpoints;

                    const EndpointCredentials = _.where(platformEndpoints, { identifier: "credentials" });
                    if (typeof EndpointCredentials === 'undefined' || EndpointCredentials.length == 0) {
                        resolve({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials2 not found!' });
                        return;
                    }

                    const endpoint = EndpointCredentials[0].url;

                    if (typeof endpoint === 'undefined') {
                        reject({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    const activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: "2.2" });
                    const token_C = activeCredentials[0].token;

                    const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" });
                    const token = platformCredentials[0].token;

                    //Prepare body to request
                    const body = [{ token: token_C, url: newEndpoint, roles: platform.evioRoles }];

                    //Invocar Mobie com novo endpoint
                    updateEndpoint(endpoint, token, body).then((result) => {
                        if (result) {
                            if (result.status_code) {

                                if ((Math.round(result.status_code / 1000)) == 1) {

                                    //Save data
                                    updatePlatformData(newEndpoint, platform).then((result) => {
                                        //Atualizar platform.evioURL
                                        global.evioURL = newEndpoint;
                                        resolve({ auth: false, code: "success", message: 'Success' });
                                    }).catch((e) => {
                                        console.log(e)
                                        return res.status(200).send(Utils.response(null, 2000, "Generic client error."));
                                    });
                                }
                                else {
                                    console.log("Error updating endpoint calling platform.", result);
                                    reject({ auth: false, code: "server_calling_endpoint_update", message: "Error updating endpoint calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                    return;
                                }
                            }
                            else {
                                console.log("Error updating endpoint calling platform. Unable to retrieve status_code", result);
                                reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error updating endpoint calling platform. Unable to retrieve status_code!' });
                                return;
                            }
                        }
                        else {
                            console.log("Error updating endpoint calling platform.", result);
                            reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error calling endpoint update!' });
                            return;
                        }
                    });
                }
                else {
                    reject({ auth: false, code: "server_platform_notFound", message: 'Platform not found!' });
                    return;
                }
            }).catch((e) => {
                console.log("[platformVersions.updateEvioEndpoint_old] Generic client error. ", e);
                reject(e);
                return;
            });;
        });
    },
    updateEvioCredentials: function (req) {
        return new Promise((resolve, reject) => {

            const platformCode = req.body.platformCode;
            if (!platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {

                if (platform) {
                    const length = platform.tokenLength;
                    const platformDetails = platform.platformDetails;

                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints = platformDetails22[0].endpoints;

                    const EndpointCredentials = _.where(platformEndpoints, { identifier: "credentials" });
                    if (typeof EndpointCredentials === 'undefined' || EndpointCredentials.length == 0) {
                        resolve({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials2 not found!' });
                        return;
                    }

                    const endpoint = EndpointCredentials[0].url;

                    if (typeof endpoint === 'undefined') {
                        reject({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    const activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: "2.2" });
                    const token_C = activeCredentials[0].token;

                    const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" });
                    const token = platformCredentials[0].token;

                    const newEvioToken = Utils.generateToken(length);

                    //Prepare body to request
                    const body = { token: newEvioToken, url: platform.evioURL, roles: platform.evioRoles };

                    //Update evio endpoint on local datbase
                    updatePlatformData2(newEvioToken, platform).then((result) => {

                        //Invocar Mobie com novo endpoint
                        updateEndpoint(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            const data = result.data;
                                            const roles = data.roles;

                                            const platformToken = data.token;
                                            const platformEndpoint = data.url;

                                            updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint);
                                        }

                                        //TODO Save result data. Maybe can be relevant informations such as new credentials
                                        resolve({ auth: false, code: "endpoint_update_success", message: 'Endpoint updated with success' });
                                    }
                                    else {
                                        updatePlatformData(platform.evioURL, platform);
                                        console.log("Error updating endpoint calling platform.", result);
                                        reject({ auth: false, code: "server_calling_endpoint_update", message: "Error updating endpoint calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                        return;
                                    }
                                }
                                else {
                                    updatePlatformData(platform.evioURL, platform);
                                    console.log("Error updating endpoint calling platform. Unable to retrieve status_code", result);
                                    reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error updating endpoint calling platform. Unable to retrieve status_code!' });
                                    return;
                                }
                            }
                            else {
                                updatePlatformData(platform.evioURL, platform);
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
                console.log("[platformVersions.updateEvioCredentials] Generic client error. ", e);
                reject(e);
                return;
            });;
        });
    },
    deleteEvioCredentials: function (req) {
        return new Promise((resolve, reject) => {

            const platformCode = req.body.platformCode;
            if (!platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {

                if (platform) {
                    const length = platform.tokenLength;
                    const platformDetails = platform.platformDetails;

                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints = platformDetails22[0].endpoints;

                    const EndpointCredentials = _.where(platformEndpoints, { identifier: "credentials" });
                    if (typeof EndpointCredentials === 'undefined' || EndpointCredentials.length == 0) {
                        resolve({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials2 not found!' });
                        return;
                    }

                    const endpoint = EndpointCredentials[0].url;

                    if (typeof endpoint === 'undefined') {
                        reject({ auth: false, code: "server_endpointCredentials_notFound", message: 'EndpointCredentials not found!' });
                        return;
                    }

                    const activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: "2.2" });
                    const token_C = activeCredentials[0].token;

                    const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" });
                    const token = platformCredentials[0].token;

                    const newEvioToken = Utils.generateToken(length);

                    //Prepare body to request
                    const body = { token: token_C, url: platform.evioURL, roles: platform.evioRoles };
                    //console.log(platform.evioRoles);

                    //Update evio endpoint on local datbase
                    updatePlatformDataDelete(platform, newEvioToken).then((result) => {

                        //Invocar Mobie com novo endpoint
                        deleteCredentials(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {
                                            const data = result.data;
                                            const roles = data.roles;

                                            const platformToken = data.token;
                                            const platformEndpoint = data.url;

                                            updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint);
                                        }

                                        //TODO Save result data. Maybe can be relevant informations such as new credentials
                                        resolve({ auth: false, code: "endpoint_update_success", message: 'Endpoint updated with success' });
                                    }
                                    else {
                                        updatePlatformData(platform.evioURL, platform);
                                        console.log("Error updating endpoint calling platform.", result);
                                        reject({ auth: false, code: "server_calling_endpoint_update", message: "Error updating endpoint calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                        return;
                                    }
                                }
                                else {
                                    updatePlatformData(platform.evioURL, platform);
                                    console.log("Error updating endpoint calling platform. Unable to retrieve status_code", result);
                                    reject({ auth: false, code: "server_calling_endpoint_update", message: 'Error updating endpoint calling platform. Unable to retrieve status_code!' });
                                    return;
                                }
                            }
                            else {
                                updatePlatformData(platform.evioURL, platform);
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
                console.log("[platformVersions.deleteEvioCredentials] Generic client error. ", e);
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

function updatePlatformData(evioURL, platform) {
    return new Promise((resolve, reject) => {

        const query = { _id: platform._id };
        const newValues = {
            $set:
            {
                evioURL: evioURL, //Save versions
            }
        };

        Platform.updatePlatform(query, newValues, (err, result) => {
            if (err) {
                console.log(`[updatePlatform] Error `, err);
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

        let query = { _id: platform._id, "evioActiveCredentialsToken.version": 2.2 };

        const token_C_history = [{ token: newToken, createDate: new Date().toISOString(), version: 2.2 }];

        const found = platform.evioActiveCredentialsToken.indexOf(platform.evioActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == 2.2;
        }));

        platform.evioActiveCredentialsToken[found].token = newToken;

        const newValues = {
            $set:
            {
                "evioActiveCredentialsToken.$": platform.evioActiveCredentialsToken[found],
            },
            $push: {
                evioTokensHistory: token_C_history
            }

        };

        Platform.updatePlatform(query, newValues, (err, result) => {
            if (err) {
                console.log(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });

    });
}

function updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint) {
    return new Promise((resolve, reject) => {

        const token_B_history = [{ token: platformToken, createDate: new Date().toISOString(), version: 2.2 }];
        const platformActiveCredentialsToken = [{ token: platformToken, version: 2.2 }];

        const query = { _id: platform._id, "platformActiveCredentialsToken.version": 2.2 };
        const newValues = {
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

        Platform.updatePlatform(query, newValues, (err, result) => {
            if (err) {
                console.log(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });

    });
}

function updatePlatformDataDelete(platform, newEvioToken) {
    return new Promise((resolve, reject) => {

        const found = platform.evioActiveCredentialsToken.indexOf(platform.evioActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == 2.2;
        }));
        platform.evioActiveCredentialsToken[found].token = newEvioToken;

        let query = { _id: platform._id, "evioActiveCredentialsToken.version": 2.2 };
        const newValues = {
            $set: {
                platformVersions: [], //Save versions
                platformDetails: [],
                platformDetailsEndpoint: "", //Save Details
                platformVersionsEndpoint: "",
                platformRoles: [], //Save Roles
                platformActiveCredentialsToken: [],
                "evioActiveCredentialsToken.$": platform.evioActiveCredentialsToken[found],
                platformTokensHistory: [],
                active: true,
                credendialExchanged: false
            }
        };

        Platform.updatePlatform(query, newValues, (err, result) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
}


