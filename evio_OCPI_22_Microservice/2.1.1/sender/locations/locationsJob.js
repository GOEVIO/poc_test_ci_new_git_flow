const express = require('express');
const router = express.Router({mergeParams:true});
require("dotenv-safe").load();
const axios = require("axios");
var versions = require('../versions/platformVersions');
const global = require('../../../global');
var _ = require("underscore");
const Platform = require('../../../models/platforms');
const { updateLocationsFromHub } = require('../../../services/ocpi');
const toggle = require('evio-toggle').default;

const Utils = require('../../../utils');

var platformLocationsEndpointUrl = "";
var platformLocationsEndpoint = "";
var token = "";
var platformCode = ""

const startChargersUpdate = async (useLastDate, enableGetLocations) => {
    platformLocationsEndpoint = platformLocationsEndpointUrl;

    //Check if is to consider dates on request
    if (useLastDate) {
        versions.getPlatformVersionsByPlatformCode(platformCode)
        .then(async platform => {
            console.log("Platform", platformCode, "lastDate", platform.locationsLastRequestDate, "token", token);
            if (platform.locationsLastRequestDate !== undefined ) {
                var date_from = platform.locationsLastRequestDate;
                var date_to = new Date().toISOString();
                if (enableGetLocations) {
                    const locationsCount = await updateLocationsFromHub(platformLocationsEndpoint , token , platformCode , date_from , date_to , "" , "")
                    locationsCount > 0 && await Platform.findOneAndUpdate({platformCode}, {locationsLastRequestDate : date_to})
                    return
                }
                var result = await callServiceLocations(platformLocationsEndpoint, date_from, date_to);
                if (!result.error) {
                    Platform.updatePlatform({platformCode}, {locationsLastRequestDate : date_to}, (err, result) => {
                        if (err) {
                            console.error(`[updatePlatform] Error `, err);
                        }
                        else {
                            console.log("Updated locationsLastRequestDate! - " + date_to)
                        };
                    });
                }
            } else {
                var date_from = new Date();
                date_from.setHours(date_from.getHours() - 24);
    
                //Transform date_from object to string
                date_from = date_from.toISOString()
                var date_to = new Date().toISOString();
                if (enableGetLocations) {
                    const locationsCount = await updateLocationsFromHub(platformLocationsEndpoint , token , platformCode , date_from , date_to , "" , "")
                    locationsCount > 0 && await Platform.findOneAndUpdate({platformCode}, {locationsLastRequestDate : date_to})
                    return
                }
                var result = await callServiceLocations(platformLocationsEndpoint, date_from, date_to);
                if (!result.error) {
                    Platform.updatePlatform({platformCode}, {locationsLastRequestDate : date_to}, (err, result) => {
                        if (err) {
                            console.error(`[updatePlatform] Error `, err);
                        }
                        else {
                            console.log("Updated locationsLastRequestDate! - " + date_to)
                        };
                    });
                }
            }
        })
        .catch((e) => {
            console.log("Error runninng OCPI 2.1.1 locations full update " + e);
            callServiceLocations(platformLocationsEndpoint, "", "");
        });

    }
    else {
        callServiceLocations(platformLocationsEndpoint, "", "");
    }
};

const callServiceLocations = ( async (host, date_from, date_to, countryCode = "" , partyId = "" ) => {

    console.log("Running job to get Gireve chargers to add or update...");
    console.log("Endpoint", host)
    var originalHost = host
    var offset = 0;
    var totalCount = 10;
    var limit = 200;
    var newHost = "";
    var mode = ""
    if (date_from != "") {
        newHost = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + limit;
        mode = "delta";
    }
    else {
        newHost = originalHost + "?offset=" + offset + "&limit=" + limit;
        mode = "full"
    }
    
    var chargersCount = 0;
    var result;
    var chargers = []

    console.log("host", newHost);
    console.log("offset", offset);
    console.log("totalCount", totalCount);
    console.log("countryCode", countryCode);
    console.log("partyId", partyId);
    console.log(mode)

    while (offset < totalCount) {

        result = await new Promise((resolve, reject) => {
            asyncCall(newHost, offset, totalCount, date_from, date_to, originalHost, token, chargersCount, countryCode , partyId , resolve);
        });

        offset = result.offset;
        totalCount = result.totalCount;
        chargersCount = result.chargersCount;
        newHost = result.host;
        chargers.push(...result.chargers)
        
        console.log({ offset: offset, totalCount: totalCount, chargersCount: chargersCount, host: newHost});
        //console.log("testes", result);

    }
    
    if (mode === "full") {
        axios.post(global.publicNetworkUpdateOrCreateChargersProxy, {chargers , mode} , {'maxContentLength': Infinity,'maxBodyLength': Infinity})
        .then(function (response) {

            if (typeof response.data !== 'undefined') {
                
                console.log("Success updating or creating chargers")
            }
            else {
                console.log("[locationsJob.callServiceLocations.axios.post.else full] Generic client error ");
            }

        }).catch(function (e) {
            console.log("[locationsJob.callServiceLocations.axios.post full] Generic client error " + e.message);
        });
    } else {
        chargers = sliceIntoChunks(chargers, 10)
        for (let chargerArray of chargers) {
            await axios.post(global.publicNetworkUpdateOrCreateChargersProxy, {chargers:chargerArray , mode})
            .then(function (response) {

                if (typeof response.data !== 'undefined') {
                    
                    console.log("Success updating or creating chargers")
                }
                else {
                    console.log("[locationsJob.callServiceLocations.axios.post.else] Generic client error ");
                }

            }).catch(function (e) {
                console.log("[locationsJob.callServiceLocations.axios.post] Generic client error " + e.message);
            });
            await Utils.sleep(3000)
        }
    }
    return result
    
});

router.post('/forceJobProcess', async (req, res) => {
    let ocpiVersion = req.params.version
    platformCode = req.params.platformCode

    versions.getPlatformVersionsByPlatformCode(platformCode).then(async platform => {

        //get Mobie Details
        var platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
        var platformEndpoints211 = platformDetails211[0].endpoints
        var platformLocationsEndpointObject = _.where(platformEndpoints211, { identifier: "locations" });

        if (platformLocationsEndpointObject === undefined || platformLocationsEndpointObject.length == 0) {
            reject("Platform does not allow locations module");
            return;
        }
        var data = req.body;

        platformLocationsEndpoint = platformLocationsEndpointObject[0].url;
        const url = platformLocationsEndpointUrl = platformLocationsEndpointObject[0].url;
        const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion });
        token = platformCredentials[0].token;
        const enableGetLocations = await toggle.isEnable('evio-6761');

        if (data && data.periodic != undefined) {
            startChargersUpdate(true, enableGetLocations);
            return res.status(200).send('Job is currently running');
        }

        var date_from = "";
        var date_to = "";
        var countryCode = "" 
        var partyId = ""
        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;
                date_to = data.date_to;
                countryCode = data.countryCode
                partyId = data.partyId
                //url = url + "?date_from=" + date_from + "&date_to=" + date_to + "";
            }
        }
        
        if (enableGetLocations) {
            updateLocationsFromHub(url , token , platformCode , date_from , date_to , countryCode , partyId)
            return res.status(200).send('OK');
        }

        let result = await callServiceLocations(url  ,date_from , date_to , countryCode , partyId)

        if (result.error) {
            return res.status(400).send({ code: 'chargers_update_error', message: "Chargers update error: " + result.message });
        } else {
            return res.status(200).send({ code: 'chargers_update_success', message: "Chargers update success: " + result.chargersCount });
        }

    });

});

router.post('/forceJobProcess/:hwId', (req, res) => {
    let ocpiVersion = req.params.version
    var hwId = req.params.hwId;
    platformCode = req.params.platformCode

    versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

        //get Mobie Details
        var platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
        var platformEndpoints22 = platformDetails22[0].endpoints
        var platformLocationsEndpointObject = _.where(platformEndpoints22, { identifier: "locations" });

        if (platformLocationsEndpointObject === undefined || platformLocationsEndpointObject.length == 0) {
            reject("Platform does not allow locations module");
            return;
        }

        platformLocationsEndpoint = platformLocationsEndpointObject[0].url;
        platformLocationsEndpointUrl = platformLocationsEndpointObject[0].url;

       
        var url = platformLocationsEndpointUrl;
       
        console.log("Endpoint", url)
        

        var platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion });
        var token = platformCredentials[0].token;

        let bodyData = {
            host: url,
            token: token,
            hwId:hwId
        }

        getCharger(bodyData).then((result) => {
            if (result.error == true)
                return res.status(400).send({ code: 'chargers_update_error', message: "Chargers update error: " + result.message });
            else
                return res.status(200).send({ code: 'chargers_update_success', message: "Chargers update success: " + hwId });
        })
    });

});


async function asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, chargersCount, countryCode , partyId , resolve) {
    axios.get(host, { headers: { 'Authorization': `Token ${token}` , 'ocpi-to-country-code' : countryCode , 'ocpi-to-party-id' : partyId } }).then(async (result) => {


        var x_total_count = result.headers["x-total-count"];
        console.log("x_total_count", x_total_count);
        if (x_total_count != 0) {
            totalCount = x_total_count;
        } else {
            totalCount = 0
        }
        var x_limit = result.headers["x-limit"]
        let chargers = []

        offset = Number(offset) + Number(x_limit);

        //console.log(result.data.data);
        if (result) {

            if (result.data) {
                
                if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {

                    for (let i = 0; i < result.data.data.length; i++) {
                        chargersCount++;
                        let charger = result.data.data[i];
                        console.log(JSON.stringify(charger));
                        console.log()
                        charger.source = platformCode
                        let chargerInfo = await Utils.updateOrCreateCharger(charger)

                        chargers.push(chargerInfo)
                    }

                }

            }
        }

        if (date_from != "")
            host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + Number(x_limit);
        else
            host = originalHost + "?offset=" + offset + "&limit=" + Number(x_limit);

        resolve({ offset: offset, totalCount: totalCount, chargersCount: chargersCount, host: host, chargers : chargers})

    }).catch((e) => {
        console.log("[LocationsJob]" , e.message);
        resolve({ offset: offset, totalCount: -1, chargersCount: chargersCount, error: true, message: e.message , chargers : [] })
    });
    // });
}

async function getCharger(bodyData) {


    let originalHost = bodyData.host;
    let hwId = bodyData.hwId;
    var host = "";
    var token = bodyData.token;

    host = originalHost + "/" + hwId;

    var result;
    var chargersCount = 0;
    console.log("host", host);


    result = await new Promise((resolve, reject) => {
        asyncCallSpecificLocation(host, token, chargersCount, resolve);
    });

    chargersCount = result.chargersCount;

    //console.log("testes", result);

    return result;

}
async function asyncCallSpecificLocation(host, token, chargersCount, resolve) {

    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then(async (result) => {

        //console.log(result.data.data);
        if (result) {

            if (result.data) {

                if (typeof result.data.data !== 'undefined' && result.data.data !== null) {

                    chargersCount++;
                    let charger = result.data.data;
                    //console.log(charger);
                    let chargers = []
                    charger.source = platformCode
                    let chargerInfo = await Utils.updateOrCreateCharger(charger)

                    chargers.push(chargerInfo)

                    axios.post(global.publicNetworkUpdateOrCreateChargersProxy, {chargers})
                    .then(function (response) {

                        if (typeof response.data !== 'undefined') {
                            
                            console.log("Success updating or creating charger")
                        }
                        else {
                            console.log("[locationsJob.asyncCallSpecificLocation.axios.post.else] Generic client error ");
                        }

                    }).catch(function (e) {
                        console.log("[locationsJob.asyncCallSpecificLocation.axios.post] Generic client error " + e.response.status + "- " + e.response.statusText);
                    });

                }
            }
        }


        resolve({ chargersCount: chargersCount, host: host })

    }).catch((e) => {
        //console.log(e);
        resolve({ totalCount: -1, chargersCount: chargersCount, error: true, message: e.response.data.status_message })
    });
    // });
}

function sliceIntoChunks(arr, chunkSize) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}
module.exports = router;