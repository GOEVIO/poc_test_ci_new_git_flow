
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
        // var data = req.body;
        // if (Utils.isEmptyObject(data))
        //     return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get party id
        // var party_id = data.party_id;
        // if (!party_id)
        //     return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get country cdoe
        // var country_code = data.country_code;
        // if (!country_code)
        //     return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get platform business_details
        // var business_details = data.business_details;
        // if (!business_details)
        //     return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        let ocpiVersion = req.params.version

        try {
            Utils.getPlatformInfo(token , ocpiVersion).then((platform) => {
                var length = platform.tokenLength;

                //Return HTTP status code 405: method not allowed when client was already before
                // if (typeof platform.platformRoles[0] !== 'undefined') {
                //     if (party_id == platform.platformRoles[0].party_id && platform.credendialExchanged == false)
                //         return res.sendStatus(405);
                // }
                // else {
                if (platform.credendialExchanged == false)
                    return res.status(405).send(Utils.response(null, 1000, "Unauthorized to delete credentials"));;
                // }

                var activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: ocpiVersion});
                var evioToken = activeCredentials[0].token;

                var newEvioToken = evioToken;

                if (platform.generateNewTokenDeleteCredentials === true) {
                    newEvioToken = Utils.generateToken(length);
                }

                updatePlatformData(platform, newEvioToken , ocpiVersion).then((result) => {
                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }).catch((e) => {
                    console.log("[deleteCredentials.delete.updatePlatformData] Generic client error " + e);
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                });

            }).catch((e) => {
                console.log("[deleteCredentials.delete.getPlatformInfo] Generic client error ", e);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
            });
        }
        catch (e) {
            console.log("[deleteCredentials.delete] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }


    }
}


function updatePlatformData(platform, newEvioToken , ocpiVersion) {
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