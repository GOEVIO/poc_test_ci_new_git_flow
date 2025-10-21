var Platforms = require('../../../models/platforms');
const axios = require('axios');
var _ = require("underscore");
const Platform = require('../../../models/platforms');
const global = require('../../../global');
const Token = require('../../../models/tokens')
const Utils = require('../../../utils');
var versions = require('../versions/platformVersions');

module.exports = {
    createToken: function (req, res) {
        return new Promise((resolve, reject) => {
            
            try {

                var platformCode = req.params.platformCode;
                if (!platformCode) {
                    reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                    return;
                }

                var data = req.body;
                if (Utils.isEmptyObject(data)) {
                    reject({ auth: false, code: "server_token_data_required", message: 'Token Data required' });
                    return;
                }

                var userId = req.headers['userid'];
                if (!userId) {
                    reject({ auth: false, code: "server_user_id_required", message: 'User ID required' });
                    return;
                }

                let ocpiVersion = req.params.version

                //var query = { platformCode: platformCode };
                const new_token = data;

                //const new_token = new Token(data);
                new_token.last_updated = new Date().toISOString(); //Force last_updated date current datetime

                //TODO
                //Por defeito o token deve estar inativo caso seja RFID apenas
                //new_token.valid = false;
                new_token.source = platformCode;
                new_token.userId = userId;
                new_token.evId = data.evId;
                new_token.party_id = "EVI"
                //Create Object to send to mobie platform
                var body = new_token;

                //console.log("body", body)
                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {


                    //get Mobie Details
                    var platformDetails = platform.platformDetails;

                    //Get Mobie Endpoint to 2.2 OCPI versions
                    var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
                    var platformEndpoints211 = platformDetails211[0].endpoints
                    var platformTokenEndpointObject = _.where(platformEndpoints211, { identifier: "tokens"});

                    if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                        reject("Platform does not allow tokens module");
                        return;
                    }
                    var platformTokenEndpoint = platformTokenEndpointObject[0].url;

                    //Add Country Code and PartyId and Token ID
                    console.log("platformTokenEndpoint", platformTokenEndpoint)

                    var lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

                    if (lastChar == "/")
                        platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
                    else
                        platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;

                    var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                    let mobieToken = platformActiveCredentials[0].token;

                    //Save new Token with valid = false
                    add_updateLocalToken(new_token).then((res) => {

                        if (res) {
                            // TODO In this version, contract_id is auth_id 
                            body.auth_id = body.contract_id
                            delete body.contract_id;
                            delete body.source;
                            delete body.userId;
                            delete body.evId;
                            console.log(platformTokenEndpoint);

                            //Send Token to Mobie Platform
                            callPlatformService(platformTokenEndpoint, mobieToken, body).then((result) => {

                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        // new_token.valid = true;
                                        // add_updateLocalToken(new_token);

                                        resolve({ auth: false, code: "success", message: 'Token created success', refId: res._id });

                                    }
                                    else {
                                        console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - ' + result.status_message })
                                        reject({ auth: false, code: "error_adding_token", message: 'Error creating token' });
                                    }
                                }
                                else {
                                    console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - Unable to retrieve status_code' })
                                    reject({ auth: false, code: "error_adding_token", message: 'Error creating token' });
                                }

                            }).catch((e) => {
                                //TODO
                                //Delete Token ou passar a invalido 
                                console.log({ auth: false, code: "error_adding_token", message: 'Error creating token. Exception 117 ' + e.message })
                                reject({ auth: false, code: "error_adding_token", message: 'Error creating token. ' + e.message });
                            });

                        }
                        else {
                            //TODO
                            var query = { _id: res._id };
                            Token.findOneAndDelete(query, (err, result));
                            console.log({ auth: false, code: "error_adding_token", message: 'Error creating token and locally deleted ' })
                            reject({ auth: false, code: "error_adding_token", message: 'Error creating token. ' });
                        }

                    }).catch((e) => {
                        //TODO
                        //Delete Token ou passar a invalido
                        console.log({ auth: false, code: "error_adding_token", message: 'Error creating token. Exception 132 ' })
                        reject({ auth: false, code: "error_adding_token", message: 'Error creating token. ' + e.message });
                    });


                }).catch((e) => {
                    reject({ auth: false, code: "server_platform_notFound", message: 'Platform not found!' });
                });



            }
            catch (e) {
                console.log(e.message);
                reject({ auth: false, code: "error_adding_token", message: 'Error creating token. ' + e.message });
            }
        });
    },
    updateToken: function (req, res) {
        return new Promise((resolve, reject) => {

            try {


                var platformCode = req.params.platformCode;
                if (!platformCode) {
                    reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                    return;
                }

                var data = req.body;
                if (Utils.isEmptyObject(data)) {
                    reject({ auth: false, code: "server_token_data_required", message: 'Token Data required' });
                    return;
                }

                let ocpiVersion = req.params.version

                var query = { platformCode: platformCode };
                const new_token = data;
                //const new_token = new Token(data);
                new_token.last_updated = new Date().toISOString(); //Force last_updated date current datetime


                //Create Object to send to mobie platform
                var body = new_token;

                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {


                    //get Mobie Details
                    var platformDetails = platform.platformDetails;

                    //Get Mobie Endpoint to 2.2 OCPI versions
                    var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
                    var platformEndpoints211 = platformDetails211[0].endpoints
                    var platformTokenEndpointObject = _.where(platformEndpoints211, { identifier: "tokens"});

                    if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                        reject("Platform does not allow tokens module");
                        return;
                    }
                    var platformTokenEndpoint = platformTokenEndpointObject[0].url;

                    var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                    var mobieToken = platformActiveCredentials[0].token;

                    var lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

                    if (lastChar == "/")
                        platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
                    else
                        platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;



                    //Send Token to Mobie Platform
                    callPlatformServicePatch(platformTokenEndpoint, mobieToken, body).then((result) => {

                        if (result.status_code) {

                            if ((Math.round(result.status_code / 1000)) == 1) {

                                // new_token.valid = true;
                                add_updateLocalToken(new_token);

                                resolve({ auth: true, code: "success", message: 'Token updated success' });

                            }
                            else {
                                resolve({ auth: false, code: "error", message: 'Error updating token' });
                            }
                        }
                        else {
                            resolve({ auth: false, code: "error", message: 'Error updating token' });
                        }

                    }).catch((e) => {
                        console.log(e);
                        resolve({ auth: false, code: "error_adding_token", message: 'Error updating token. ' + e.message });
                    });



                });



            }
            catch (e) {
                console.log(e);
                return;
            }
        });
    },
    getToken: function (endpoint, token) {
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
    createTokenLocal: function (platformCode, data) {
        return new Promise((resolve, reject) => {

            try {


                var query = { platformCode: platformCode };
                const new_token = data;
                //const new_token = new Token(data);
                new_token.last_updated = new Date().toISOString(); //Force last_updated date current datetime

                //TODO
                //Por defeito o token deve estar inativo caso seja RFID apenas
                //new_token.valid = false;
                new_token.source = platformCode;

                let ocpiVersion = process.env.ocpiVersion211 

                //Create Object to send to mobie platform
                var body = new_token;

                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {


                    //get Mobie Details
                    var platformDetails = platform.platformDetails;

                    //Get Mobie Endpoint to 2.2 OCPI versions
                    var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
                    var platformEndpoints22 = platformDetails22[0].endpoints
                    var platformTokenEndpointObject = _.where(platformEndpoints22, { identifier: "tokens"});

                    if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                        reject("Platform does not allow tokens module");
                        return;
                    }
                    var platformTokenEndpoint = platformTokenEndpointObject[0].url;

                    //Add Country Code and PartyId and Token ID
                    console.log("platformTokenEndpoint", platformTokenEndpoint)

                    var lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

                    if (lastChar == "/")
                        platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
                    else
                        platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;

                    var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                    let mobieToken = platformActiveCredentials[0].token;

                    //Save new Token with valid = false
                    add_updateLocalToken(new_token).then((res) => {

                        if (res) {
                            // TODO In this version, contract_id is auth_id 
                            body.auth_id = body.contract_id
                            delete body.contract_id;
                            delete body.source;
                            delete body.userId;
                            delete body.evId;
                            console.log(platformTokenEndpoint);

                            //Send Token to Mobie Platform
                            callPlatformService(platformTokenEndpoint, mobieToken, body).then((result) => {

                                if (result.status_code) {

                                    if ((Math.round(result.status_code / 1000)) == 1) {

                                        // new_token.valid = true;
                                        // add_updateLocalToken(new_token);

                                        resolve({ code: "success", message: 'Token created success', token: new_token });

                                    }
                                    else {
                                        console.log({ code: "error", message: 'Error creating token - ' + result.status_message })
                                        reject({ code: "error", message: 'Error creating token' });
                                    }
                                }
                                else {
                                    console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - Unable to retrieve status_code' })
                                    reject({ code: "error", message: 'Error creating token' });
                                }

                            }).catch((e) => {
                                //TODO
                                //Delete Token ou passar a invalido 
                                console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - Exception 343' })
                                reject({ code: "error_adding_token", message: 'Error creating token. ' + e.message });
                            });

                        }
                        else {
                            //TODO
                            var query = { _id: res._id };
                            Token.findOneAndDelete(query, (err, result));
                            console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - Locally error 351' })
                            reject({ code: "error_adding_token", message: 'Error creating token. ' });
                        }

                    }).catch((e) => {
                        //TODO
                        //Delete Token ou passar a invalido
                        console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - Exception 358' })
                        reject({ code: "error_adding_token", message: 'Error creating token. ' + e.message });
                    });


                }).catch((e) => {
                    console.log("Platform not found!");

                    reject({ code: "server_platform_notFound", message: 'Platform not found!' });
                });

            }
            catch (e) {
                console.log(e.message);
                reject({ auth: false, code: "error_adding_token", message: 'Error creating token. ' + e.message });
            }
        });
    },
    async createTokenSendMultiple(platformCode, data, userId, ocpiVersion) {
        try {
    
            //var query = { platformCode: platformCode };
            const new_token = data;
    
            //const new_token = new Token(data);
            new_token.last_updated = new Date().toISOString(); //Force last_updated date current datetime
    
            //TODO
            //Por defeito o token deve estar inativo caso seja RFID apenas
            //new_token.valid = false;
            new_token.source = platformCode;
            new_token.userId = userId;
            new_token.evId = data.evId;
            new_token.party_id = "EVI"
            //Create Object to send to mobie platform
            var body = new_token;
    
            //console.log("body", body)
            let platform = await versions.getPlatformVersionsByPlatformCode(platformCode)
    
            //get Mobie Details
            var platformDetails = platform.platformDetails;
    
            console.log("platformCode")
            console.log(platformCode)
    
            console.log("platform")
            console.log(platform)
    
    
            //Get Mobie Endpoint to 2.2 OCPI versions
            var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
            var platformEndpoints211 = platformDetails211[0].endpoints
            var platformTokenEndpointObject = _.where(platformEndpoints211, { identifier: "tokens" });
    
            if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                return { code: "server_platform_notFound", message: 'No platform token endpoint object', platformCode: platformCode };
            }
            var platformTokenEndpoint = platformTokenEndpointObject[0].url;
    
            //Add Country Code and PartyId and Token ID
            console.log("platformTokenEndpoint", platformTokenEndpoint)
    
            var lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);
    
            if (lastChar == "/")
                platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
            else
                platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;
    
            var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
            let mobieToken = platformActiveCredentials[0].token;
    
            //Save new Token with valid = false
            let res = await add_updateLocalToken(new_token)
    
            if (res) {
                // TODO In this version, contract_id is auth_id 
                body.auth_id = body.contract_id
                delete body.contract_id;
                delete body.source;
                delete body.userId;
                delete body.evId;
                console.log(platformTokenEndpoint);
    
                //Send Token to Mobie Platform
                let result = await callPlatformService(platformTokenEndpoint, mobieToken, body)
    
                if (result.status_code) {
    
                    if ((Math.round(result.status_code / 1000)) == 1) {
    
                        // new_token.valid = true;
                        // add_updateLocalToken(new_token);
    
                        return { code: "success", message: 'Token created success', refId: res._id, platformCode: platformCode };
    
                    }
                    else {
                        console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - ' + result.status_message })
                        return { code: "error_adding_token", message: 'Error creating token', platformCode: platformCode };
                    }
                }
                else {
                    console.log({ auth: false, code: "error_adding_token", message: 'Error creating token - Unable to retrieve status_code' })
                    return { code: "error_adding_token", message: 'Error creating token' };
                }
    
            }
            else {
                //TODO
                var query = { _id: res._id };
                Token.findOneAndDelete(query, (err, result));
                console.log({ auth: false, code: "error_adding_token", message: 'Error creating token and locally deleted ' })
                return { code: "error_adding_token", message: 'Error creating token. ', platformCode: platformCode };
            }
    
        }
        catch (e) {
            console.log(e.message);
            return { code: "error_adding_token", message: 'Error creating token. ' + e.message, platformCode: platformCode };
        }
    }
}

function callPlatformService(endpoint, token, body) {

    return new Promise((resolve, reject) => {
        console.log(endpoint, body, { headers: { 'Authorization': `Token ${token}` } });
        axios.put(endpoint, body, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else
                resolve(false);

        }).catch(function (error) {

            //console.log(error)
            console.log("[callPlatformService] " + error.message)
            reject(error);
        });
    });
};

function callPlatformServicePatch(endpoint, token, body) {

    return new Promise((resolve, reject) => {
        axios.patch(endpoint, body, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else
                resolve(false);

        }).catch(function (error) {

            reject(error);
        });
    });
};


function add_updateLocalToken(token) {
    return new Promise((resolve, reject) => {

        let query = { uid: token.uid };

        Token.updateToken(query, { $set: token }, (err, doc) => {

            if (doc != null) {
                console.log("Updated token locally " + token.uid);
                resolve(doc);
            } else {
                const new_token = new Token(token);
                Token.create(new_token, (err, result) => {
                    if (result) {
                        console.log("Created Token locally " + token.uid + "");
                        resolve(result);
                    } else {
                        console.log("Token not created locally ", err);
                        reject(err);
                    }
                })
            }
        });

    });
};




