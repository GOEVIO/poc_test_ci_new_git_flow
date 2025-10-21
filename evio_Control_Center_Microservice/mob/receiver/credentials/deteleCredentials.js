
const Utils = require('../../../utils');
const Versions = require('../../sender/versions/platformVersions')
const Details = require('../../sender/details/platformDetails')
var _ = require("underscore");
const Platform = require('../../../models/platforms');

module.exports = {
    delete: function (req, res) {

        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get platform roles
        var roles = data.roles;
        if (!roles)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));


        try {
            Utils.getPlatformInfo(token).then((platform) => {
                var length = platform.tokenLength;

                //Return HTTP status code 405: method not allowed when client was already before
                if (typeof platform.platformRoles[0] !== 'undefined') {
                    if (roles[0].party_id == platform.platformRoles[0].party_id && platform.credendialExchanged == false)
                        return res.sendStatus(405);
                }
                else {
                    if (platform.credendialExchanged == false)
                        return res.sendStatus(405);
                }

                var activeCredentials = _.where(platform.cpoActiveCredentialsToken, { version: platform.cpoActiveCredentialsToken[0].version });
                var cpoToken = activeCredentials[0].token;

                var newCpoToken = cpoToken;

                if (platform.generateNewTokenDeleteCredentials === true) {
                    newCpoToken = Utils.generateToken(length);
                }

                updatePlatformData(platform, newCpoToken).then((result) => {
                    let cpoCountryCode = platform.cpoRoles.find( roleObj => roleObj.role === process.env.cpoRole).country_code
                    Utils.updateCredentialsHandshake(platform.cpo , cpoCountryCode , platform.platformCode , false)
                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }).catch((e) => {
                    console.log("Generic client error " + e);
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


function updatePlatformData(platform, newCpoToken) {
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
                cpoTokensHistory: cpoTokensHistory,
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