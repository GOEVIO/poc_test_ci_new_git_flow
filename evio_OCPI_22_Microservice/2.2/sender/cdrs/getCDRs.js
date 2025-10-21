const axios = require('axios');
const _ = require("underscore");
const global = require('../../../global');
const Utils = require('../../../utils');
const versions = require('../versions/platformVersions');

module.exports = {
    getCDRs: function (req, res) {
        return new Promise((resolve, reject) => {

            //Get platform Token 
            const platformCode = req.params.platformCode;
            if (!platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {
                //get Mobie Details
                const platformDetails = platform.platformDetails;

                //Get Mobie Endpoint to 2.2 OCPI versions
                const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                const platformEndpoints22 = platformDetails22[0].endpoints

                const platformCDRsEndpointObject = _.where(platformEndpoints22, { identifier: "cdrs", role: "SENDER" });
                if (platformCDRsEndpointObject === undefined || platformCDRsEndpointObject.length == 0) {
                    reject("Platform does not allow cdrs module");
                    return;
                }

                const platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

                //Get platform Endpoint of cdrs SENDER
                const endpoint = platformCDRsEndpoint;

                //Get CDRs list for a given period
                const data = req.body;
                if (!Utils.isEmptyObject(data)) {
                    if (typeof data !== 'undefined' && data.length !== 0) {
                        const date_from = data.date_from;
                        const date_to = data.date_to;
                        endpoint = endpoint + "?date_from=" + date_from + "&date_to=" + date_to + "";
                    }
                }

                const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                const mobieToken = platformActiveCredentials[0].token;

                getPlatformCDRs(endpoint, mobieToken).then((result) => {
                    resolve(result);
                }).catch((e) => {
                    reject({ auth: false, code: "error getting CDRs from platform", message: e.message, endpoint: endpoint });
                });
            });
        });
    }

}

const getPlatformCDRs = ((endpoint, token) => {
    return new Promise((resolve, reject) => {
        axios.get(endpoint, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {
            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else {
                reject("Response Empty")
            }
        }).catch(function (error) {
            reject(error);
        });
    });
});





