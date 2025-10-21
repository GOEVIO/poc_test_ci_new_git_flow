
const Utils = require('../../../utils');
const Versions = require('../../sender/versions/platformVersions')
const Details = require('../../sender/details/platformDetails')
var _ = require("underscore");
const Platform = require('../../../models/platforms');
const evio_URL = "";

module.exports = {
    put: function (req, res) {

        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));


        var newPlatform_token = data.token;
        if (!newPlatform_token)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        var newPlatform_endpoint = data.url;
        if (!newPlatform_endpoint)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get platform roles
        var roles = data.roles;
        if (!roles)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        var isNewEndpoint = false;
        var isNewToken = false;


        try {

            Utils.getPlatformInfo(token).then((platform) => {
                var length = platform.tokenLength;

                //Check if platform sent new Endpoint
                if (!platform.platformVersionsEndpoint.includes(newPlatform_endpoint))
                    isNewEndpoint = true;

                //Check if platform sent new Credentials token
                var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: platform.cpoActiveCredentialsToken[0].version })
                var platformToken = platformActiveCredentials[0].token;

                //Get active cpo credentials. It will be necessary later
                var activeCredentials = _.where(platform.cpoActiveCredentialsToken, { version: platform.cpoActiveCredentialsToken[0].version });
                var cpoToken = activeCredentials[0].token;

                if (platformToken !== newPlatform_token)
                    isNewToken = true;

                //Get Platform Versions
                Versions.getPlatformVersions(newPlatform_endpoint, newPlatform_token).then((result) => {

                    if (result) {

                        if (result.status_code) {

                            if ((Math.round(result.status_code / 1000)) == 1) {

                                var platformVersions = result.data;

                                var version22 = _.where(platformVersions, { version: platform.cpoActiveCredentialsToken[0].version });

                                var platformDetailsEndpoint = version22[0].url;

                                //Get platform Details
                                Details.getPlatformDetails(platformDetailsEndpoint, newPlatform_token).then((result) => {

                                    if (result) {

                                        if (result.status_code) {

                                            if ((Math.round(result.status_code / 1000)) == 1) {

                                                var platformDetails = result.data;
                                                //Generate Token C

                                                var newCpoToken = cpoToken;

                                                if (isNewToken) {
                                                    newCpoToken = Utils.generateToken(length);
                                                } else if (isNewEndpoint === false && platform.generateNewTokenEndpointUpdate === true) {
                                                    // else if (isNewEndpoint === true && platform.generateNewTokenEndpointUpdate === true)
                                                    newCpoToken = Utils.generateToken(length);
                                                }

                                              

                                                //Prepare Response Data with Token C, Roles and url
                                                var response = { token: newCpoToken, url: platform.cpoURL, roles: platform.cpoRoles };

                                                //Save data
                                                updatePlatformData(platform, platformVersions, platformDetails, newPlatform_endpoint, platformDetailsEndpoint, newCpoToken, newPlatform_token, roles).then((result) => {
                                                    //return res.status(200).send(Utils.response(null, 1000, "OK - Mandar objeto"));
                                                    return res.status(200).send(Utils.response(response, 1000, "Success"));
                                                }).catch((e) => {
                                                    console.log("Generic client error " + e.response.status + "- " + e.response.statusText);
                                                    return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + "- " + e.response.statusText));
                                                });

                                            }
                                            else {
                                                console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                                                return res.status(200).send(Utils.response(null, 3001, "Unable to use the client’s API Details. Status_code: " + result.status_code + ": Status_message: " + result.status_message));
                                            }

                                        }
                                        else {
                                            console.log('Unable to use the client’s API Details. Unable to retrieve status_code', result);
                                            return res.status(200).send(Utils.response(null, 3001, "Unable to use the client’s API Details. Unable to retrieve status_code "));
                                        }

                                    }
                                    else {
                                        console.log('Unable to use the client’s API Details.', result);
                                        return res.status(200).send(Utils.response(null, 3001, "Unable to use the client’s API Details."));
                                    }

                                }).catch((e) => {
                                    console.log("Generic client error " + e.response.status + "- " + e.response.statusText);
                                    return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + "- " + e.response.statusText));
                                });;

                            }
                            else {
                                console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', result);
                                return res.status(200).send(Utils.response(null, 3001, "Unable to use the client’s API Versions. Status_code: " + result.status_code + ": Status_message: " + result.status_message));
                            }

                        }
                        else {
                            console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', result);
                            return res.status(200).send(Utils.response(null, 3001, "Unable to use the client’s API Versions. Unable to retrieve status_code "));
                        }

                    }
                    else {
                        console.log("Unable to use the client’s API Versions.", result);
                        return res.status(200).send(Utils.response(null, 3001, "Unable to use the client’s API Versions."));
                    }

                }).catch((e) => {
                    console.log("Generic client error " + e.response.status + "- " + e.response.statusText);
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + "- " + e.response.statusText));
                });

            }).catch((e) => {
                console.log("Generic client error " + e.response.status + "- " + e.response.statusText);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + "- " + e.response.statusText));
            });
        }
        catch (e) {
            console.log("Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }

    }
}


function updatePlatformData(platform, platformVersions, platformDetails, platformVersionsEndpoint, platformDetailsEndpoint, token_C, token_B, roles) {
    return new Promise((resolve, reject) => {


        let platformVersion = platform.cpoActiveCredentialsToken[0].version
        let oldCpoToken = platform.cpoActiveCredentialsToken[0].token
        let oldPlatformToken = platform.platformActiveCredentialsToken[0].token
        let currentDate = new Date().toISOString()


        //Add Token C to cpoTokensHistory
        var token_C_history = [{ token: token_C, createDate: currentDate, version: platformVersion }];

        var token_B_history = [{ token: token_B, createDate: currentDate, version: platformVersion }];
        var platformActiveCredentialsToken = [{ token: token_B, version: platformVersion }];

        //Update Token C in cpoActiveCredentialsToken attribute for version platformVersion
        var found = platform.cpoActiveCredentialsToken.indexOf(platform.cpoActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == platformVersion;
        }));
        platform.cpoActiveCredentialsToken[found].token = token_C;

        var query = { _id: platform._id, "cpoActiveCredentialsToken.version": platformVersion, "platformActiveCredentialsToken.version": platformVersion };
        var newValues = {
            $set:
            {
                platformVersions: platformVersions, //Save versions
                platformDetails: platformDetails,
                platformDetailsEndpoint: platformDetailsEndpoint, //Save Details
                platformVersionsEndpoint: platformVersionsEndpoint,
                platformRoles: roles, //Save Roles 
                "cpoActiveCredentialsToken.$": platform.cpoActiveCredentialsToken[found],
                credendialExchanged: true,
                "platformActiveCredentialsToken.$": platformActiveCredentialsToken,
            },
            $push: {
                cpoTokensHistory: token_C_history,
                platformTokensHistory: token_B_history //Add Token B to platformTokensHistory
            }

        };

        Platform.updatePlatform(query, newValues, async (err, result) => {
            if (err) {
                console.error(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {
                await Platform.findOneAndUpdate({ _id: platform._id, "cpoTokensHistory.token": oldCpoToken } , {$set : { "cpoTokensHistory.$.expiredDate" :  currentDate}})
                await Platform.findOneAndUpdate({ _id: platform._id, "platformTokensHistory.token": oldPlatformToken } , {$set : { "platformTokensHistory.$.expiredDate" :  currentDate}})
                resolve(result);
            };
        });

    });
}