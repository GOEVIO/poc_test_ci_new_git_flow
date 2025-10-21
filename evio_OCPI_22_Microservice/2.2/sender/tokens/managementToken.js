const axios = require('axios');
const _ = require("underscore");
const Platform = require('../../../models/platforms');
const global = require('../../../global');
const Token = require('../../../models/tokens')
const Utils = require('../../../utils');
const versions = require('../versions/platformVersions');



module.exports = {
    createToken: function (req, res) {
        return new Promise((resolve, reject) => {
            try {
                const platformCode = req.params.platformCode;
                if (!platformCode) {
                    reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                    return;
                }

                const data = req.body;
                if (Utils.isEmptyObject(data)) {
                    reject({ auth: false, code: "server_token_data_required", message: 'Token Data required' });
                    return;
                }

                const userId = req.headers['userid'];
                if (!userId) {
                    reject({ auth: false, code: "server_user_id_required", message: 'User ID required' });
                    return;
                }

                const new_token = data;

                //const new_token = new Token(data);
                new_token.last_updated = new Date().toISOString(); //Force last_updated date current datetime

                //TODO
                //Por defeito o token deve estar inativo caso seja RFID apenas
                //new_token.valid = false;
                new_token.source = platformCode;
                new_token.userId = userId;
                new_token.evId = data.evId;

                //Create Object to send to mobie platform
                const body = new_token;

                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {
                    //get Mobie Details
                    const platformDetails = platform.platformDetails;

                    //Get Mobie Endpoint to 2.2 OCPI versions
                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints22 = platformDetails22[0].endpoints

                    const platformTokenEndpointObject = _.where(platformEndpoints22, { identifier: "tokens", role: "RECEIVER" });
                    if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                        reject("Platform does not allow tokens module");
                        return;
                    }
                    let platformTokenEndpoint = platformTokenEndpointObject[0].url;

                    //Add Country Code and PartyId and Token ID
                    console.log("platformTokenEndpoint", platformTokenEndpoint)

                    const lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

                    if (lastChar == "/")
                        platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
                    else
                        platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;

                    const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                    const mobieToken = platformActiveCredentials[0].token;

                    //Save new Token with valid = false
                    add_updateLocalToken(new_token).then((res) => {
                        if (res) {
                            delete body.source;
                            delete body.userId;
                            delete body.evId;
                            console.log(platformTokenEndpoint);

                            platformTokenEndpoint += `?type=${body.type}`

                            console.log(JSON.stringify(body))
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
                    console.log('[ getPlatformVersionsByPlatformCode ] Error -> ',e.message)
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
                const platformCode = req.params.platformCode;
                if (!platformCode) {
                    reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                    return;
                }

                const data = req.body;
                if (Utils.isEmptyObject(data) || typeof data.uid == 'undefined') {
                    reject({ auth: false, code: "server_token_data_required", message: 'Token Data required' });
                    return;
                }

                let query = { platformCode: platformCode };
                const new_token = data;
                //const new_token = new Token(data);
                new_token.last_updated = new Date().toISOString(); //Force last_updated date current datetime


                //Create Object to send to mobie platform
                const body = new_token;

                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {
                    //get Mobie Details
                    const platformDetails = platform.platformDetails;

                    //Get Mobie Endpoint to 2.2 OCPI versions
                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints22 = platformDetails22[0].endpoints

                    const platformTokenEndpointObject = _.where(platformEndpoints22, { identifier: "tokens", role: "RECEIVER" });
                    if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                        reject("Platform does not allow tokens module");
                        return;
                    }
                    let platformTokenEndpoint = platformTokenEndpointObject[0].url;

                    const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                    const mobieToken = platformActiveCredentials[0].token;

                    const lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

                    if (lastChar == "/")
                        platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
                    else
                        platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;

                    platformTokenEndpoint += `?type=${body.type}`
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
    getToken: function (req, res) {
        return new Promise((resolve, reject) => {
                const platformCode = req.params.platformCode;
                if (!platformCode) {
                    reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                    return;
                }

                const uid = req.query.uid;
                if (!uid) {
                    reject({ auth: false, code: "server_tokenUid_required", message: 'Token uid required' });
                    return;
                }

                const type = req.query.type;
                if (!type) {
                    reject({ auth: false, code: "server_tokenUid_required", message: 'Token type required' });
                    return;
                }

                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                    //get Mobie Details
                    const platformDetails = platform.platformDetails;

                    //Get Mobie Endpoint to 2.2 OCPI versions
                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints22 = platformDetails22[0].endpoints

                    const platformTokenEndpointObject = _.where(platformEndpoints22, { identifier: "tokens", role: "RECEIVER" });
                    if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                        reject("Platform does not allow tokens module");
                        return;
                    }
                    let platformTokenEndpoint = platformTokenEndpointObject[0].url;

                    const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                    const mobieToken = platformActiveCredentials[0].token;

                    const lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

                    if (lastChar == "/")
                        platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + uid;
                    else
                        platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + uid;

                    platformTokenEndpoint += `?type=${type}`
                    console.log("platformTokenEndpoint" , JSON.stringify(platformTokenEndpoint))
                    //Send Token to Mobie Platform
                    callPlatformServiceGet(platformTokenEndpoint, mobieToken ).then((result) => {
                        if (result.status_code) {
                            if ((Math.round(result.status_code / 1000)) == 1) {
                                // new_token.valid = true;
                                if (result.data) {
                                    add_updateLocalToken(result.data);
                                }
                                resolve(result);
                            }
                            else {
                                resolve(result);
                            }
                        }
                        else {
                            resolve(result);
                        }

                    }).catch((e) => {
                        console.log(e);
                        resolve({ auth: false, code: "error_adding_token", message: 'Error updating token. ' + e.message });
                    });
                });
        });
    },
    createTokenLocal: function (platformCode, data) {
        return new Promise((resolve, reject) => {
            try {
                let query = { platformCode: platformCode };
                const new_token = data;
                //const new_token = new Token(data);
                new_token.last_updated = new Date().toISOString(); //Force last_updated date current datetime

                //TODO
                //Por defeito o token deve estar inativo caso seja RFID apenas
                //new_token.valid = false;
                new_token.source = platformCode;

                //Create Object to send to mobie platform
                const body = new_token;

                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {


                    //get Mobie Details
                    const platformDetails = platform.platformDetails;

                    //Get Mobie Endpoint to 2.2 OCPI versions
                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                    const platformEndpoints22 = platformDetails22[0].endpoints

                    const platformTokenEndpointObject = _.where(platformEndpoints22, { identifier: "tokens", role: "RECEIVER" });
                    if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                        reject("Platform does not allow tokens module");
                        return;
                    }
                    let platformTokenEndpoint = platformTokenEndpointObject[0].url;

                    //Add Country Code and PartyId and Token ID
                    console.log("platformTokenEndpoint", platformTokenEndpoint)

                    const lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

                    if (lastChar == "/")
                        platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
                    else
                        platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;

                    const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                    const mobieToken = platformActiveCredentials[0].token;

                    //Save new Token with valid = false
                    add_updateLocalToken(new_token).then((res) => {
                        if (res) {
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
                            let query = { _id: res._id };
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

            //Create Object to send to mobie platform
            const body = new_token;

            // console.log("body", body)
            let platform = await versions.getPlatformVersionsByPlatformCode(platformCode)


            //get Mobie Details
            const platformDetails = platform.platformDetails;

            //Get Mobie Endpoint to 2.2 OCPI versions
            const platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
            const platformEndpoints22 = platformDetails22[0].endpoints

            const platformTokenEndpointObject = _.where(platformEndpoints22, { identifier: "tokens", role: "RECEIVER" });
            if (platformTokenEndpointObject === undefined || platformTokenEndpointObject.length == 0) {
                return { code: "server_platform_notFound", message: 'No platform token endpoint object', platformCode: platformCode };
            }
            let platformTokenEndpoint = platformTokenEndpointObject[0].url;

            //Add Country Code and PartyId and Token ID
            console.log("platformTokenEndpoint", platformTokenEndpoint)

            const lastChar = platformTokenEndpoint.charAt(platformTokenEndpoint.length - 1);

            if (lastChar == "/")
                platformTokenEndpoint = platformTokenEndpoint + "PT" + "/EVI/" + body.uid;
            else
                platformTokenEndpoint = platformTokenEndpoint + "/" + "PT" + "/EVI/" + body.uid;

            const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
            const mobieToken = platformActiveCredentials[0].token;

            //Save new Token with valid = false
            let res = await add_updateLocalToken(new_token)

            if (res) {
                delete body.source;
                delete body.userId;
                delete body.evId;
                console.log(platformTokenEndpoint);

                //Send Token to Mobie Platform
                let result = await callPlatformService(platformTokenEndpoint, mobieToken, body)
                if (result.status_code) {
                    if ((Math.round(result.status_code / 1000)) == 1) {
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
                const query = { _id: res._id };
                Token.findOneAndDelete(query, (err, result));
                console.log({ auth: false, code: "error_adding_token", message: 'Error creating token and locally deleted ' })
                return { code: "error_adding_token", message: 'Error creating token. ', platformCode: platformCode };
            }

        } catch (e) {
            //TODO
            //Delete Token ou passar a invalido
            console.log({ auth: false, code: "error_adding_token", message: 'Error creating token. Exception 132 ' })
            return { code: "error_adding_token", message: 'Error creating token. ' + e.message, platformCode: platformCode };
        };
    }
}

function callPlatformService(endpoint, token, body) {
    return new Promise((resolve, reject) => {
        axios.put(endpoint, body, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else
                resolve(false);
        }).catch(function (error) {
            console.log(error)
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

function callPlatformServiceGet(endpoint, token) {
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




