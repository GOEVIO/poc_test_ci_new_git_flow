const axios = require('axios');
var _ = require("underscore");
const global = require('../../../global');
const Utils = require('../../../utils');
var versions = require('../versions/platformVersions');
const CDR = require('../../../models/cdrs')


module.exports = {
    getCDRs: function (req, res) {
        return new Promise((resolve, reject) => {

            //Get platform Token 
            var platformCode = req.params.platformCode;
            if (!platformCode) {
                reject({ auth: false, code: "server_platformcode_required", message: 'platformCode required' });
                return;
            }

            let ocpiVersion = req.params.version

            versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                //get Mobie Details
                var platformDetails = platform.platformDetails;

                //Get Mobie Endpoint to 2.2 OCPI versions
                var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
                var platformEndpoints22 = platformDetails22[0].endpoints
                var platformCDRsEndpointObject = _.where(platformEndpoints22, { identifier: "cdrs"});


                if (platformCDRsEndpointObject === undefined || platformCDRsEndpointObject.length == 0) {
                    reject("Platform does not allow cdrs module");
                    return;
                }
                var platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

                //Get platform Endpoint of cdrs SENDER
                var endpoint = platformCDRsEndpoint;

                //Get CDRs list for a given period
                var data = req.body;
                var date_from = new Date();
                date_from.setHours(date_from.getHours() - 24*30);

                //Transform date_from object to string
                date_from = date_from.toISOString()
                var date_to = new Date().toISOString();
                if (!Utils.isEmptyObject(data)) {
                    if (typeof data !== 'undefined' && data.length !== 0) {
                        date_from = data.date_from;
                        date_to = data.date_to;
                    }
                }
                endpoint = endpoint + "?date_from=" + date_from + "&date_to=" + date_to + "";
                
                var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                var platformToken = platformActiveCredentials[0].token;

                getPlatformCDRs(endpoint, platformToken).then((result) => {
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

        axios.get(endpoint, { headers: { 'Authorization': `Token ${token}` } }).then( async function (response) {

            if (typeof response.data !== 'undefined') {
                if (typeof response.data.data !== 'undefined' && response.data.data.length > 0) {
                    
                    for (let i = 0; i < response.data.data.length; i++) {
                        let cdr = response.data.data[i];
                        
                        //console.log(cdr.id);
                        var res = await processCDR(cdr.id, cdr.id, cdr);
                        if (res) {
                            console.log("CDR with id " + cdr.id + " updated")
                        }
                        
                    }
                    
                    
                }
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


async function processCDR(cdrId, sessionId, data) {

    return new Promise((resolve, reject) => {

        try {

            let query = {
                id: cdrId
            };

            CDR.find(query, { _id: 0 }, async (err, cdr) => {

                if (Utils.isEmptyObject(cdr)) {
                    let query = {
                        authorization_reference : data.authorization_id
                    }

                    let sessionExists = false
                    let cdrSession = data.authorization_id ?  await Utils.chargingSessionFindOne(query) : null
                    if (cdrSession) {
                        data.source = cdrSession.source !== undefined ? cdrSession.source : "Gireve"
                        data.cdr_token = cdrSession.cdr_token !== undefined ? cdrSession.cdr_token : {}
                        data.session_id = cdrSession.id !== undefined ? cdrSession.id : "-1"
                        sessionExists = cdrSession.id !== undefined && cdrSession.id !== null ? true : false
                    } else {
                        //TODO For now it works. We should fall on the if statement though
                        data.source = "Gireve"
                    }
                    console.log(`Process CDR with authorization_reference ${data.authorization_id} from source ${data.source}` )
                    if (sessionExists) {
                        let cdrData = Utils.getCDRModelObj(data)
                        const new_cdr = new CDR(cdrData);
                        CDR.create(new_cdr, (err, result) => {

                            if (result) {

                                console.log("CDR " + cdrId + " created ");
                                Utils.processBillingAndPaymentRoaming(new_cdr.session_id, cdrData);

                                resolve(true);
                            } else {
                                console.log("CDR " + cdrId + " not created ", err);
                                resolve(false);
                            }

                        })
                    } else {
                        console.log("CDR " + cdrId + ` not created - session with sessionId ${sessionId} does not exist yet`);
                    }
                }
                else {
                    console.log("CDR " + cdrId + " not created - CDR already exists");
                    let cdrData = Utils.getCDRModelObj(data)
                    Utils.saveDifferentCdr(cdr, cdrData)
                    resolve(false);
                }
            });
        }
        catch (e) {
            console.log("[getCDRs.processCDR] Generic client error. ", e);
            resolve();
        }

    });
}


