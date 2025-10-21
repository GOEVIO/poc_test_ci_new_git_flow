var Platforms = require('../../../models/platforms');
const axios = require('axios');
var _ = require("underscore");
const Platform = require('../../../models/platforms');
const global = require('../../../global');
const Utils = require('../../../utils');
const Details = require('../details/platformDetails')

module.exports = {
    getPlatformVersions: function (endpoint, token) {

        return new Promise((resolve, reject) => {
            axios.get(endpoint, { headers: { 'Authorization': `Token ${token}`} }).then(function (response) {

                if (typeof response.data !== 'undefined') {
                    resolve(response.data);
                }
                else
                    resolve(false);

            }).catch(function (error) {
                console.log(error.response.data)
                reject(error);
            });
        });
    },
    getPlatformVersionsByPlatformCode: function (platformCode) {
        return new Promise((resolve, reject) => {

            var query = { platformCode: platformCode };

            Platforms.findOne(query, (err, platforms) => {
                if (err) {
                    console.error(`[find] Error `, err);
                    reject(err);
                }
                else {
                    resolve(platforms);
                }
                // else {
                //     axios.get(platforms.platformVersionsEndpoint)
                //         .then(function (response) {

                //             if (typeof response.data !== 'undefined') {
                //                 resolve(response.data);
                //             }
                //             else
                //                 resolve(false);

                //         }).catch(function (error) {
                //             resolve(false);
                //         });
                // }
            });
        });
    },
    updateEvioEndpoint: function (req) {
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

            let ocpiVersion = req.params.version

            var newEndpoint = req.body.newEndpoint;

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {

                if (platform) {

                    var platformDetails = platform.platformDetails;

                    var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
                    var platformEndpoints = platformDetails211[0].endpoints;

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

                    var activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: ocpiVersion });
                    var token_C = activeCredentials[0].token;

                    var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion });
                    var token = platformCredentials[0].token;

                    let evioRole = platform.evioRoles.find(role => (role.role === "EMSP") )

                    //Prepare body to request
                    var body = { 
                        token: token_C, 
                        url: newEndpoint, 
                        party_id : evioRole.party_id , 
                        country_code : evioRole.country_code,
                        business_details : evioRole.business_details
                    };

                    //Update evio endpoint on local datbase
                    updatePlatformData(newEndpoint, platform).then((result) => {

                        //Invocar Mobie com novo endpoint
                        updateEndpoint(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            var data = result.data;

                                            let platformRoles = [{
                                                party_id : data.party_id,
                                                country_code : data.country_code,
                                                business_details : data.business_details
                                            }]

                                            var platformToken = data.token;
                                            var platformEndpoint = data.url;

                                            updatePlatformDataCredentials(platform, platformRoles, platformToken, platformEndpoint , ocpiVersion);
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

            var platformCode = req.body.platformCode;

            if (!req.body.newEndpoint) {
                reject({ auth: false, code: "server_newEndpoint_required", message: 'newEndpoint required' });
                return;
            }

            let ocpiVersion = req.params.version


            var newEndpoint = req.body.newEndpoint;

            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {

                if (platform) {

                    var platformDetails = platform.platformDetails;

                    var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
                    var platformEndpoints = platformDetails211[0].endpoints;

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

                    var activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: ocpiVersion });
                    var token_C = activeCredentials[0].token;

                    var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion });
                    var token = platformCredentials[0].token;
                    
                    let evioRole = platform.evioRoles.find(role => (role.role === "EMSP") )

                    //Prepare body to request
                    var body = { 
                        token: token_C, 
                        url: newEndpoint, 
                        party_id : evioRole.party_id , 
                        country_code : evioRole.country_code,
                        business_details : evioRole.business_details
                    };


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

            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            var platformCode = req.body.platformCode;
            let ocpiVersion = req.params.version


            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {

                if (platform) {
                    var length = platform.tokenLength;
                    var platformDetails = platform.platformDetails;

                    var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
                    var platformEndpoints = platformDetails211[0].endpoints;

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

                    var activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: ocpiVersion });
                    var token_C = activeCredentials[0].token;

                    var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion });
                    var token = platformCredentials[0].token;

                    var newEvioToken = Utils.generateToken(length);

                    let evioRole = platform.evioRoles.find(role => (role.role === "EMSP") )

                    //Prepare body to request
                    var body = { 
                        token: newEvioToken, 
                        url: platform.evioURL, 
                        party_id : evioRole.party_id , 
                        country_code : evioRole.country_code,
                        business_details : evioRole.business_details
                    };

                    //Update evio endpoint on local datbase
                    updatePlatformData2(newEvioToken, platform , ocpiVersion).then((result) => {

                        //Invocar Mobie com novo endpoint
                        updateEndpoint(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            var data = result.data;
                                            let platformRoles = [{
                                                party_id : data.party_id,
                                                country_code : data.country_code,
                                                business_details : data.business_details
                                            }]


                                            var platformToken = data.token;
                                            var platformEndpoint = data.url;
                                            console.log(data)

                                            updatePlatformDataCredentials(platform, platformRoles, platformToken, platformEndpoint , ocpiVersion);
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

            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            var platformCode = req.body.platformCode;
            let ocpiVersion = req.params.version


            //Get Mobie credentials endpoint
            this.getPlatformVersionsByPlatformCode(platformCode).then((platform) => {
                
                if (platform) {
                    var length = platform.tokenLength;
                    var platformDetails = platform.platformDetails;

                    var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
                    var platformEndpoints = platformDetails211[0].endpoints;

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

                    var activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: ocpiVersion });
                    var token_C = activeCredentials[0].token;

                    var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion });
                    var token = platformCredentials[0].token;

                    var newEvioToken = Utils.generateToken(length);

                    let evioRole = platform.evioRoles.find(role => (role.role === "EMSP") )

                    //Prepare body to request
                    var body = { 
                        token: token_C, 
                        url: platform.evioURL, 
                        party_id : evioRole.party_id , 
                        country_code : evioRole.country_code,
                        business_details : evioRole.business_details
                    };
                    //console.log(platform.evioRoles);

                    //Update evio endpoint on local datbase
                    updatePlatformDataDelete(platform, newEvioToken , ocpiVersion).then((result) => {

                        //Invocar Mobie com novo endpoint
                        deleteCredentials(endpoint, token, body).then((result) => {

                            if (result) {
                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        if (result.data) {

                                            var data = result.data;
                                            let platformRoles = [{
                                                party_id : data.party_id,
                                                country_code : data.country_code,
                                                business_details : data.business_details
                                            }]

                                            var platformToken = data.token;
                                            var platformEndpoint = data.url;


                                            updatePlatformDataCredentials(platform, platformRoles, platformToken, platformEndpoint , ocpiVersion);
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
    createEvioCredentials : function(req) {
        return new Promise((resolve, reject) => {


            if (!req.body.platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            if (!req.body.token) {
                reject({ auth: false, code: "server_token_required", message: 'token required' });
                return;
            }

            //Get Token A, sent previously to partner
            var platformCode = req.body.platformCode;
            var token_A = req.body.token
            let ocpiVersion = req.params.version

            try {

                //Get Platform
                this.getPlatformVersionsByPlatformCode(platformCode)
                .then((platform) => {
                    var length = platform.tokenLength;

                    let platformVersionsEndpoint = platform.platformVersionsEndpoint;

                    console.log("[Credentials Module Sender - ExchangeTokens] - URL: ", platformVersionsEndpoint);


                    //Get Versions
                    this.getPlatformVersions(platformVersionsEndpoint, token_A).then((result) => {

                        if (result) {

                            if (result.status_code) {
                                if ((Math.round(result.status_code / 1000)) == 1) {

                                    var platformVersions = result.data;

                                    var version211 = _.where(platformVersions, { version: ocpiVersion });

                                    var platformDetailsEndpoint = version211[0].url;
                                    console.log("[Credentials Module Sender - ExchangeTokens] - URL Details: ", platformDetailsEndpoint);

                                    //Get Details
                                    Details.getPlatformDetails(platformDetailsEndpoint, token_A).then((result) => {

                                        if (result) {
                                            if (result.status_code) {
                                                if ((Math.round(result.status_code / 1000)) == 1) {
                                                    var platformDetails = result.data;

                                                    var platformEndpoints = platformDetails.endpoints;

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

                                                    //Generate Token B
                                                    var token_B = Utils.generateToken(length);
                                                    
                                                    let evioRole = platform.evioRoles.find(role => (role.role === "EMSP") )

                                                    //Prepare body to request
                                                    var body = { 
                                                        token: token_B, 
                                                        url: platform.evioURL, 
                                                        party_id : evioRole.party_id , 
                                                        country_code : evioRole.country_code,
                                                        business_details : evioRole.business_details
                                                    };

                                                    //Update evio token on local datbase
                                                    updatePlatformData2(token_B, platform , ocpiVersion).then((result) => {

                                                        //Invocar Mobie com novo endpoint
                                                        createEndpoint(endpoint, token_A, body).then((result) => {

                                                            if (result) {
                                                                if (result.status_code) {

                                                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                                                        if (result.data) {

                                                                            var data = result.data;
                                                                            let platformRoles = [{
                                                                                party_id : data.party_id,
                                                                                country_code : data.country_code,
                                                                                business_details : data.business_details
                                                                            }]


                                                                            var platformToken = data.token;
                                                                            var platformEndpoint = data.url;
                                                                            console.log(data)

                                                                            // updatePlatformDataCredentials(platform, platformRoles, platformToken, platformEndpoint , ocpiVersion);
                                                                            updatePlatformData3(platform, platformVersions, platformDetails, platformEndpoint, platformDetailsEndpoint, token_B, platformToken, platformRoles, ocpiVersion)
                                                                        }

                                                                        //TODO Save result data. Maybe can be relevant informations such as new credentials
                                                                        resolve({ auth: false, code: "endpoint_create_success", message: 'Credentials created with success' });

                                                                    }
                                                                    else {
                                                                        updatePlatformData(platform.evioURL, platform);
                                                                        console.log("Error creating credentials calling platform.", result);
                                                                        reject({ auth: false, code: "server_creating_credentials", message: "Error creating credentials calling platform. Status_code: " + result.status_code + ": Status_message: " + result.status_message + "" });
                                                                        return;
                                                                    }
                                                                }
                                                                else {
                                                                    updatePlatformData(platform.evioURL, platform);
                                                                    console.log("Error creating credentials calling platform. Unable to retrieve status_code", result);
                                                                    reject({ auth: false, code: "server_creating_credentials", message: 'Error creating credentials calling platform. Unable to retrieve status_code!' });
                                                                    return;
                                                                }
                                                            }
                                                            else {
                                                                updatePlatformData(platform.evioURL, platform);
                                                                console.log("Error creating credentials calling platform.", result);
                                                                reject({ auth: false, code: "server_creating_credentials", message: 'Error calling endpoint update!' });
                                                                return;
                                                            }
                                                        });

                                                    }).catch((e) => {
                                                        console.log(e)
                                                        resolve({ auth: false, code: "server_creating_credentials", message: "Error updating endpoint on local DB" });
                                                    });

                                                }
                                                else {
                                                    console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                                                    reject({ auth: false, code: "server_creating_credentials", message: "Unable to use the client’s API Details. Status_code: " + result.status_code + ": Status_message: " + result.status_message });
                                                }

                                            }
                                            else {
                                                console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                                                reject({ auth: false, code: "server_creating_credentials", message: "Unable to use the client’s API Details. Unable to retrieve status_code "});
                                            }

                                        }
                                        else {
                                            console.log('Unable to use the client’s API Details.', result);
                                            reject({ auth: false, code: "server_creating_credentials", message: "Unable to use the client’s API Details."});
                                        }

                                    }).catch((e) => {
                                        console.log("[platformVersions.createEvioCredentials.getPlatformDetails] Generic client error " + e.response.status + "- " + e.response.statusText);
                                        reject({ auth: false, code: "server_creating_credentials", message: "Generic client error " + e.response.status + "- " + e.response.statusText});
                                    });;
                                }
                                else {
                                    console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', result);
                                    reject({ auth: false, code: "server_creating_credentials", message: "Unable to use the client’s API Versions. Status_code: " + result.status_code + ": Status_message: " + result.status_message});
                                }


                            }
                            else {
                                console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', result);
                                reject({ auth: false, code: "server_creating_credentials", message: "Unable to use the client’s API Versions. Unable to retrieve status_code "});
                            }


                        }
                        else {
                            console.log("Unable to use the client’s API Versions.", result);
                            reject({ auth: false, code: "server_creating_credentials", message: "Unable to use the client’s API Versions."});
                        }

                    }).catch((e) => {
                        console.log("[platformVersions.createEvioCredentials.getPlatformVersions] Generic client error ", e);
                        reject({ auth: false, code: "server_creating_credentials", message: "Generic client error "});
                    });

                })
                .catch((e) => {
                    console.log("[platformVersions.createEvioCredentials.getPlatformVersionsByPlatformCode] Generic client error ", e);
                    reject({ auth: false, code: "server_creating_credentials", message: "Generic client error "});


                });
            }
            catch (e) {
                console.log("[platformVersions.createEvioCredentials] Generic client error. ", e);
                reject({ auth: false, code: "server_creating_credentials", message: "Generic client error "});
            }
        })
    }
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

function createEndpoint(endpoint, token, body) {

    return new Promise((resolve, reject) => {
        axios.post(endpoint, body, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

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

        var query = { _id: platform._id };
        var newValues = {
            $set:
            {
                evioURL: evioURL, //Save versions
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

function updatePlatformData2(newToken, platform , ocpiVersion) {
    return new Promise((resolve, reject) => {

        var query = { _id: platform._id, "evioActiveCredentialsToken.version": ocpiVersion };

        var token_C_history = [{ token: newToken, createDate: new Date().toISOString(), version: ocpiVersion }];

        var found = platform.evioActiveCredentialsToken.indexOf(platform.evioActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == ocpiVersion;
        }));

        platform.evioActiveCredentialsToken[found].token = newToken;

        var newValues = {
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
                console.error(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {

                resolve(result);
            };
        });

    });
}

function updatePlatformData3(platform, platformVersions, platformDetails, platformVersionsEndpoint, platformDetailsEndpoint, token_C, token_B, roles, ocpiVersion) {
    return new Promise((resolve, reject) => {

        //Add Token C to evioTokensHistory
        var token_C_history = [{ token: token_C, createDate: new Date().toISOString(), version: ocpiVersion }];

        var token_B_history = [{ token: token_B, createDate: new Date().toISOString(), version: ocpiVersion }];
        var platformActiveCredentialsToken = [{ token: token_B, version: ocpiVersion }];

        //Update Token C in evioActiveCredentialsToken attribute for version ocpiVersion
        var found = platform.evioActiveCredentialsToken.indexOf(platform.evioActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == ocpiVersion;
        }));
        platform.evioActiveCredentialsToken[found].token = token_C;

        var query = { _id: platform._id, "evioActiveCredentialsToken.version": ocpiVersion };
        var newValues = {
            $set:
            {
                platformVersions: platformVersions, //Save versions
                platformDetails: platformDetails,
                platformDetailsEndpoint: platformDetailsEndpoint, //Save Details
                platformVersionsEndpoint: platformVersionsEndpoint,
                platformRoles: roles, //Save Roles 
                "evioActiveCredentialsToken.$": platform.evioActiveCredentialsToken[found],
                credendialExchanged: true,
                active: true
            },
            $push: {
                evioTokensHistory: token_C_history,
                platformTokensHistory: token_B_history, //Add Token B to platformTokensHistory
                platformActiveCredentialsToken: platformActiveCredentialsToken //Save Token B in platformActiveCredentialsToken
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

function updatePlatformDataCredentials(platform, roles, platformToken, platformEndpoint , ocpiVersion) {
    return new Promise((resolve, reject) => {

        var token_B_history = [{ token: platformToken, createDate: new Date().toISOString(), version: ocpiVersion }];
        var platformActiveCredentialsToken = [{ token: platformToken, version: ocpiVersion }];


        var query = { _id: platform._id, "platformActiveCredentialsToken.version": ocpiVersion };
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
function updatePlatformDataDelete(platform, newEvioToken , ocpiVersion) {
    return new Promise((resolve, reject) => {

        var found = platform.evioActiveCredentialsToken.indexOf(platform.evioActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == ocpiVersion;
        }));
        platform.evioActiveCredentialsToken[found].token = newEvioToken;

        var query = { _id: platform._id, "evioActiveCredentialsToken.version": ocpiVersion };
        var newValues = {
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


