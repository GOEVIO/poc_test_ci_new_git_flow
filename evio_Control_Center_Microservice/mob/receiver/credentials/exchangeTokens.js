
const Utils = require('../../../utils');
const Versions = require('../../sender/versions/platformVersions')
const Details = require('../../sender/details/platformDetails')
var _ = require("underscore");
const Platform = require('../../../models/platforms');

//This endpoint is used to exchange credentials. 
module.exports = {
    post: function (req, res) {

        //Get Token A, sent previously to partner
        var token_A = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get Token B
        var token_B = data.token;
        if (!token_B)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get platform roles
        var roles = data.roles;
        if (!roles)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        try {

            //Get Platform
            Utils.getPlatformInfo(token_A).then((platform) => {
                var length = platform.tokenLength;

                //Return HTTP status code 405: method not allowed when client was already before
                if (typeof platform.platformRoles[0] !== 'undefined')
                    if (roles[0].party_id == platform.platformRoles[0].party_id && platform.credendialExchanged == true)
                        return res.sendStatus(405);

                //Get URL
                var platformVersionsEndpoint = data.url;
                if (!platformVersionsEndpoint)
                    return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

                platform.platformVersionsEndpoint = platformVersionsEndpoint;

                console.log("[Credentials Module - ExchangeTokens] - URL: ", platformVersionsEndpoint);


                //Get Versions
                Versions.getPlatformVersions(platformVersionsEndpoint, token_B).then((result) => {

                    if (result) {

                        if (result.status_code) {
                            if ((Math.round(result.status_code / 1000)) == 1) {

                                var platformVersions = result.data;

                                var version22 = _.where(platformVersions, { version: platform.cpoActiveCredentialsToken[0].version });

                                var platformDetailsEndpoint = version22[0].url;
                                console.log("[Credentials Module - ExchangeTokens] - URL Details: ", platformDetailsEndpoint);

                                //Get Details
                                Details.getPlatformDetails(platformDetailsEndpoint, token_B).then((result) => {

                                    if (result) {
                                        if (result.status_code) {
                                            if ((Math.round(result.status_code / 1000)) == 1) {
                                                var platformDetails = result.data;

                                                //Generate Token C
                                                var token_C = Utils.generateToken(length);

                                                //Prepare Response Data with Token C, Roles and url
                                                var response = { token: token_C, url: platform.cpoURL, roles: platform.cpoRoles };

                                                //Save data
                                                updatePlatformData(platform, platformVersions, platformDetails, platformVersionsEndpoint, platformDetailsEndpoint, token_C, token_B, roles).then((result) => {
                                                    //return res.status(200).send(Utils.response(null, 1000, "OK - Mandar objeto"));
                                                    let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                                                    Utils.updateCredentialsHandshake(platform.cpo , cpoCountryCode , platform.platformCode , true)
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
                    console.log("Generic client error ", e);
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                });

            }).catch((e) => {
                console.log("Generic client error ", e);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));

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

        let platformCpoVersion = platform.cpoActiveCredentialsToken[0].version
        let oldCpoToken = platform.cpoActiveCredentialsToken[0].token

        let currentDate = new Date().toISOString()
        //Add Token C to cpoTokensHistory
        var token_C_history = [{ token: token_C, createDate: currentDate, version: platformCpoVersion }];

        var token_B_history = [{ token: token_B, createDate: currentDate, version: platformCpoVersion }];
        var platformActiveCredentialsToken = [{ token: token_B, version: platformCpoVersion }];

        //Update Token C in cpoActiveCredentialsToken attribute for version platformCpoVersion
        var found = platform.cpoActiveCredentialsToken.indexOf(platform.cpoActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == platformCpoVersion;
        }));

        platform.cpoActiveCredentialsToken[found].token = token_C;

        var query = { _id: platform._id, "cpoActiveCredentialsToken.version": platformCpoVersion };
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
                active: true
            },
            $push: {
                cpoTokensHistory: token_C_history,
                platformTokensHistory: token_B_history, //Add Token B to platformTokensHistory
                platformActiveCredentialsToken: platformActiveCredentialsToken //Save Token B in platformActiveCredentialsToken
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