const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
var versions = require('../versions/platformVersions');
var details = require('../details/platformDetails');
const global = require('../../../global');
var _ = require("underscore");
const CDR = require('../../../models/cdrs')
const Sentry = require("@sentry/node");

// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
var moment = require('moment');
const Utils = require('../../../utils');
const Platform = require('../../../models/platforms');



var platformCDRsEndpoint = "";
var task = null;
var platformToken = "";
var platformCode = ""

function initJob(req) {
    return new Promise((resolve, reject) => {

        let ocpiVersion = "2.1.1"
        platformCode = "Gireve"

        versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

            //get Mobie Details
            var platformDetails = platform.platformDetails;

            //Get Mobie Endpoint to 2.2 OCPI versions
            var platformDetails22 = _.where(platformDetails, { version: ocpiVersion});
            var platformEndpoints22 = platformDetails22[0].endpoints
            var platformCDRsEndpointObject = _.where(platformEndpoints22, { identifier: "cdrs"});


            if (platformCDRsEndpointObject === undefined || platformCDRsEndpointObject.length == 0) {
                reject("Platform does not allow cdrs module");
                return;
            }
            platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

            var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion})
            platformToken = platformActiveCredentials[0].token;

            console.log("CDRs Job Init");
            console.log(platform.cdrsScheduleTimeCronJob);

            task = cron.schedule(platform.cdrsScheduleTimeCronJob, () => {
                console.log('Running CDRs Job ' + new Date().toISOString());

                let date = new Date();
                //Fetching the last 6 hours by default
                let fetchPastHours = 6
                date.setHours(date.getHours() - fetchPastHours);

                //Transform date object to string
                date = date.toISOString()

                processCDRs(date);
            }, {
                scheduled: false
            });

            resolve();

        });
    });
};

const processCDRs = (async (date_from) => {

    var endpoint = platformCDRsEndpoint;

    versions.getPlatformVersionsByPlatformCode(platformCode)
    .then(async platform => {
        if (platform.cdrsLastRequestDate !== undefined ) {
            var date_from = platform.cdrsLastRequestDate;
            var date_to = new Date().toISOString();
            var result = await getCDRs(endpoint, platformToken, date_from , date_to);
            if (!result.error) {
                Platform.updatePlatform({platformCode}, {cdrsLastRequestDate : date_to}, (err, result) => {
                    if (err) {
                        console.error(`[updatePlatform] Error `, err);
                    }
                    else {
                        console.log("Updated cdrsLastRequestDate! - " + date_to)
                    };
                });
            }
        } else {
            var date_from = new Date();
            date_from.setHours(date_from.getHours() - 24);

            //Transform date_from object to string
            date_from = date_from.toISOString()
            var date_to = new Date().toISOString();
            var result = await getCDRs(endpoint, platformToken, date_from , date_to);
            if (!result.error) {
                Platform.updatePlatform({platformCode}, {cdrsLastRequestDate : date_to}, (err, result) => {
                    if (err) {
                        console.error(`[updatePlatform] Error `, err);
                    }
                    else {
                        console.log("Updated cdrsLastRequestDate! - " + date_to)
                    };
                });
            }
        }
    })
    .catch(async error => {
        console.log(error.message)
    })

});

async function getCDRs(originalEndpoint, token, date_from , date_to) {

    let originalHost = originalEndpoint;
    var host = "";
    var token = token;
    var offset = 0;
    var totalCount = 1;
    var limit = 10;

    var date_from = date_from;

    if (date_from != "")
        host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + limit;
    else
        host = originalHost + "?offset=" + offset + "&limit=" + limit;

    var cdrsCount = 0;
    var newCDRs = 0;
    var result;

    while (offset <= totalCount) {

        result = await new Promise((resolve, reject) => {
            asyncCall(host, offset, totalCount, date_from, date_to , originalHost, token, cdrsCount, resolve, newCDRs);
        });

        offset = result.offset;
        totalCount = result.totalCount;
        cdrsCount = result.cdrsCount;
        host = result.host;
        newCDRs = result.newCDRs;
        console.log(JSON.stringify(result));
    }

    return result;

}

async function asyncCall(host, offset, totalCount, date_from, date_to , originalHost, token, cdrsCount, resolve, newCDRs) {

    console.log("host", host)

    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then(async (result) => {

        var x_total_count = result.headers["x-total-count"];
        console.log("x_total_count", x_total_count);
        if (x_total_count != 0)
            totalCount = x_total_count;
        var x_limit = result.headers["x-limit"]

        offset = Number(offset) + Number(x_limit);

        if (result) {

            if (result.data) {

                if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {

                    cdrsCount += result.data.data.length;

                    for (let i = 0; i < result.data.data.length; i++) {
                        let cdr = result.data.data[i];

                        //console.log(cdr.id);

                        var res = await processCDR(cdr.id, cdr.id, cdr);
                        if (res)
                            newCDRs += 1;

                    }


                }
            }
        }

        if (date_from != "")
            host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + Number(x_limit);
        else
            host = originalHost + "?offset=" + offset + "&limit=" + Number(x_limit);

        resolve({ offset: offset, totalCount: totalCount, cdrsCount: cdrsCount, host: host, newCDRs: newCDRs })

    }).catch((e) => {
        console.log("[CdrsJob]" , e.message);
        resolve({ offset: offset, totalCount: -1, cdrsCount: cdrsCount, error: true, message: e.message, newCDRs: newCDRs })
    });
    // });
}


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
                    let cdrSession = data.authorization_id ? await Utils.chargingSessionFindOne(query) : null
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
                        console.log("CDR " + cdrId + ` not created - session with authorization_reference ${data.authorization_id} does not exist yet`);
                        resolve(false);
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
            console.log("[cdrsJob.processCDR] Generic client error. ", e);
            resolve();
        }

    });
}

router.post('/startJob', (req, res) => {
    initJob(req).then(() => {
        task.start();
        console.log("CDRs Job Started")
        return res.status(200).send('CDRs Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/stopJob', (req, res) => {
    task.stop();
    console.log("CDRs Job Stopped")
    return res.status(200).send('CDRs Job Stopped');
});

router.post('/statusJob', (req, res) => {
    var status = "Stopped";
    if (task != undefined) {
        status = task.status;
    }

    return res.status(200).send({ "CDRs Job Status": status });
});

router.post('/forceJobProcess', (req, res) => {
    let ocpiVersion = "2.1.1"
    platformCode = "Gireve"

    versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

        //get Mobie Details
        var platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
        var platformEndpoints22 = platformDetails22[0].endpoints
        var platformCDRsEndpointObject = _.where(platformEndpoints22, { identifier: "cdrs" });


        if (platformCDRsEndpointObject === undefined || platformCDRsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'tarrifs_update_error', message: "Platform does not allow cdrs module" });
        }
        platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

        var date_from = new Date();
        date_from.setHours(date_from.getHours() - 24*30);

        //Transform date_from object to string
        date_from = date_from.toISOString()
        var date_to = new Date().toISOString();
        var endpoint = platformCDRsEndpoint;
        var data = req.body;
        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;
                date_to = data.date_to;
            }
        }

        var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
        var platformToken = platformActiveCredentials[0].token;

        getCDRs(endpoint, platformToken, date_from , date_to).then((result) => {
            console.log(result)
            if (result.error == true)
                return res.status(400).send({ code: 'cdrs_update_error', message: "CDRs update error: " + result.message });
            else
                return res.status(200).send({ code: 'cdrs_update_success', message: "CDRs processed: " + result.cdrsCount + ". New CDRs: " + result.newCDRs });

        })

    });
});

router.post('/startCronJob', async (req, res) => {
    try {
        console.log("\nOCPI - 2.1.1 - CDRs Job Started from EKS\n")
        platformCode = "Gireve";
        const ocpiVersion = "2.1.1";
        const platform = await versions.getPlatformVersionsByPlatformCode(platformCode);
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: ocpiVersion});
        const platformEndpoints22 = platformDetails22[0].endpoints
        const platformCDRsEndpointObject = _.where(platformEndpoints22, { identifier: "cdrs"});


        if (platformCDRsEndpointObject === undefined || platformCDRsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'cdrs_update_error', message: "CDRs update error: Platform does not allow cdrs module" });
        }

        platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion})
        platformToken = platformActiveCredentials[0].token;

        console.log("CDRs Job Init");
        console.log(platform.cdrsScheduleTimeCronJob);

        let date = new Date();
        
        let fetchPastHours = 6
        date.setHours(date.getHours() - fetchPastHours);

        //Transform date object to string
        date = date.toISOString()

        await processCDRs(date);

        return res.status(200).send({ "CDRs Job Status": "Started" });
    } catch (error) {
        Sentry.captureException(error);
        return res.status(400).send({ code: 'cdrs_update_error', message: "CDRs update error: " + error.message });
    }
    
});

module.exports = router;