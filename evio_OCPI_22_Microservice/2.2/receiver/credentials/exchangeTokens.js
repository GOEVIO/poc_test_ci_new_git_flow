
const Utils = require('../../../utils');
const Versions = require('../../sender/versions/platformVersions')
const Details = require('../../sender/details/platformDetails')
const _ = require("underscore");
const Platform = require('../../../models/platforms');
const evio_URL = "";



//This endpoint is used to exchange credentials.
module.exports = {
    post: function (req, res) {
        //Get Token A, sent previously to partner
        const token_A = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        const data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get Token B
        const token_B = data.token;
        if (!token_B)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get platform roles
        const roles = data.roles;
        if (!roles)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        const ocpiVersion = req.params.version

        try {
            //Get Platform
            Utils.getPlatformInfo(token_A , ocpiVersion).then((platform) => {
                const length = platform.tokenLength;

                //Return HTTP status code 405: method not allowed when client was already before
                if (typeof platform.platformRoles[0] !== 'undefined')
                    if (roles[0].party_id == platform.platformRoles[0].party_id && platform.credendialExchanged == true)
                        return res.sendStatus(405);

                //Get URL
                const platformVersionsEndpoint = data.url;
                if (!platformVersionsEndpoint)
                    return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

                platform.platformVersionsEndpoint = platformVersionsEndpoint;

                console.log("[Credentials Module - ExchangeTokens] - URL: ", platformVersionsEndpoint);

                //Get Versions
                Versions.getPlatformVersions(platformVersionsEndpoint, token_B).then((result) => {
                    if (result) {
                        if (result.status_code) {
                            if ((Math.round(result.status_code / 1000)) == 1) {

                                const platformVersions = result.data;

                                const version22 = _.where(platformVersions, { version: "2.2" });

                                const platformDetailsEndpoint = version22[0].url;
                                console.log("[Credentials Module - ExchangeTokens] - URL Details: ", platformDetailsEndpoint);

                                //Get Details
                                Details.getPlatformDetails(platformDetailsEndpoint, token_B).then((result) => {
                                    if (result) {
                                        if (result.status_code) {
                                            if ((Math.round(result.status_code / 1000)) == 1) {
                                                const platformDetails = result.data;

                                                //Generate Token C
                                                const token_C = Utils.generateToken(length);

                                                //Prepare Response Data with Token C, Roles and url
                                                const response = { token: token_C, url: platform.evioURL, roles: platform.evioRoles };

                                                //Save data
                                                updatePlatformData(platform, platformVersions, platformDetails, platformVersionsEndpoint, platformDetailsEndpoint, token_C, token_B, roles).then((result) => {
                                                    //return res.status(200).send(Utils.response(null, 1000, "OK - Mandar objeto"));
                                                    return res.status(200).send(Utils.response(response, 1000, "Success"));
                                                }).catch((e) => {
                                                    console.log("[exchangeTokens.post.updatePlatformData] Generic client error " + e.response.status + "- " + e.response.statusText);
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
                                    console.log("[exchangeTokens.post.getPlatformDetails] Generic client error " + e.response.status + "- " + e.response.statusText);
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
                    console.log("[exchangeTokens.post.getPlatformVersions] Generic client error ", e);
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                });
            }).catch((e) => {
                console.log("[exchangeTokens.post.getPlatformInfo] Generic client error ", e);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
            });
        }
        catch (e) {
            console.log("[exchangeTokens.post] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}

function updatePlatformData(platform, platformVersions, platformDetails, platformVersionsEndpoint, platformDetailsEndpoint, token_C, token_B, roles) {
    return new Promise((resolve, reject) => {
        //Add Token C to evioTokensHistory
        const token_C_history = [{ token: token_C, createDate: new Date().toISOString(), version: 2.2 }];

        const token_B_history = [{ token: token_B, createDate: new Date().toISOString(), version: 2.2 }];
        const platformActiveCredentialsToken = [{ token: token_B, version: 2.2 }];

        //Update Token C in evioActiveCredentialsToken attribute for version 2.2
        const found = platform.evioActiveCredentialsToken.indexOf(platform.evioActiveCredentialsToken.find((activeCredential) => {
            return activeCredential.version == 2.2;
        }));
        platform.evioActiveCredentialsToken[found].token = token_C;

        let query = { _id: platform._id, "evioActiveCredentialsToken.version": 2.2 };
        const newValues = {
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
                console.log(`[updatePlatform] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
}
