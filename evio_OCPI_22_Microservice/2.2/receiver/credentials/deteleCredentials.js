
const Utils = require('../../../utils');
const Versions = require('../../sender/versions/platformVersions')
const Details = require('../../sender/details/platformDetails')
const _ = require("underscore");
const Platform = require('../../../models/platforms');

module.exports = {
    delete: function (req, res) {
        //Get Token, sent previously to partner
        const token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        const data = req.body;
        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        //Get platform roles
        const roles = data.roles;
        if (!roles)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        const ocpiVersion = req.params.version

        try {
            Utils.getPlatformInfo(token , ocpiVersion).then((platform) => {
                const length = platform.tokenLength;

                //Return HTTP status code 405: method not allowed when client was already before
                if (typeof platform.platformRoles[0] !== 'undefined') {
                    if (roles[0].party_id == platform.platformRoles[0].party_id && platform.credendialExchanged == false)
                        return res.sendStatus(405);
                }
                else {
                    if (platform.credendialExchanged == false)
                        return res.sendStatus(405);
                }

                const activeCredentials = _.where(platform.evioActiveCredentialsToken, { version: "2.2" });
                const evioToken = activeCredentials[0].token;

                let newEvioToken = evioToken;

                if (platform.generateNewTokenDeleteCredentials === true) {
                    newEvioToken = Utils.generateToken(length);
                }

                updatePlatformData(platform, newEvioToken).then((result) => {
                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }).catch((e) => {
                    console.error("[deleteCredentials.delete.updatePlatformData] Generic client error " + e);
                    return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                });

            }).catch((e) => {
                console.error("[deleteCredentials.delete.getPlatformInfo] Generic client error ", e);
                return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
            });
        }
        catch (e) {
            console.error("[deleteCredentials.delete] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}

function updatePlatformData(platform, newEvioToken) {
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