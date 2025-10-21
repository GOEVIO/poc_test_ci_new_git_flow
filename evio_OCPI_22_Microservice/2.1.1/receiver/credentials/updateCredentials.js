
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

        //Get party id
        var party_id = data.party_id;
        if (!party_id)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get country cdoe
        var country_code = data.country_code;
        if (!country_code)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get platform business_details
        var business_details = data.business_details;
        if (!business_details)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        var isNewEndpoint = false;
        var isNewToken = false;

        let ocpiVersion = req.params.version

        try {

            Utils.getPlatformInfo(token , ocpiVersion).then((platform) => {
                var length = platform.tokenLength;

                //Check if platform sent new Endpoint
                if (!platform.platformVersionsEndpoint.includes(newPlatform_endpoint))
                    isNewEndpoint = true;

                //Check if platform sent new Credentials token
                var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                var platformToken = platformActiveCredentials[0].token;

                //Get active evio credentials. It will be necessary later
                var activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: ocpiVersion });
                var evioToken = activeCredentials[0].token;

                if (platformToken !== newPlatform_token)
                    isNewToken = true;

                //Get Platform Versions
                Versions.getPlatformVersions(newPlatform_endpoint, newPlatform_token).then((result) => {

                    if (result) {

                        if (result.status_code) {

                            if ((Math.round(result.status_code / 1000)) == 1) {

                                var platformVersions = result.data;

                                var version211 = _.where(platformVersions, { version: ocpiVersion });

                                var platformDetailsEndpoint = version211[0].url;

                                //Get platform Details
                                Details.getPlatformDetails(platformDetailsEndpoint, newPlatform_token).then((result) => {

                                    if (result) {

                                        if (result.status_code) {

                                            if ((Math.round(result.status_code / 1000)) == 1) {

                                                var platformDetails = result.data;
                                                //Generate Token C

                                                var newEvioToken = evioToken;

                                                if (isNewToken)
                                                    newEvioToken = Utils.generateToken(length);
                                                else if (isNewEndpoint === false && platform.generateNewTokenEndpointUpdate === true)
                                                    // else if (isNewEndpoint === true && platform.generateNewTokenEndpointUpdate === true)
                                                    newEvioToken = Utils.generateToken(length);

                                              

                                                //Prepare Response Data with Token C, Roles and url
                                                let evioRole = platform.evioRoles.find(role => (role.role === "EMSP") )

                                                var response = { 
                                                    token: newEvioToken, 
                                                    url: platform.evioURL, 
                                                    party_id : evioRole.party_id , 
                                                    country_code : evioRole.country_code,
                                                    business_details : evioRole.business_details
                                                };

                                                let platformRoles = [{
                                                    party_id, 
                                                    country_code,
                                                    business_details 
                                                }]
                                                //Save data
                                                updatePlatformData(platform, platformVersions, platformDetails, newPlatform_endpoint, platformDetailsEndpoint, newEvioToken, newPlatform_token, platformRoles).then((result) => {
                                                    //return res.status(200).send(Utils.response(null, 1000, "OK - Mandar objeto"));
                                                    return res.status(200).send(Utils.response(response, 1000, "Success"));
                                                }).catch((e) => {
                                                    console.log("[updateCredentials.put.updatePlatformData] Generic client error " + e.response.status + "- " + e.response.statusText);
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
                                    console.log("[updateCredentials.put.getPlatformDetails] Generic client error " + e.response.status + "- " + e.response.statusText);
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
                    console.log("[updateCredentials.put.getPlatformVersions] Generic client error " + e.response.status + "- " + e.response.statusText);
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + "- " + e.response.statusText));
                });

            }).catch((e) => {
                console.log("[updateCredentials.put.getPlatformInfo] Generic client error " + e.response.status + "- " + e.response.statusText);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error " + e.response.status + "- " + e.response.statusText));
            });
        }
        catch (e) {
            console.log("[updateCredentials.put] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }

    }
}


function updatePlatformData(platform, platformVersions, platformDetails, platformVersionsEndpoint, platformDetailsEndpoint, token_C, token_B, roles , ocpiVersion) {
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

        var query = { _id: platform._id, "evioActiveCredentialsToken.version": ocpiVersion, "platformActiveCredentialsToken.version": ocpiVersion };
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
                "platformActiveCredentialsToken.$": platformActiveCredentialsToken,
            },
            $push: {
                evioTokensHistory: token_C_history,
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