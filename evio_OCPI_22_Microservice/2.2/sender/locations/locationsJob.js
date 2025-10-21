const express = require('express');
const router = express.Router({mergeParams:true});
require("dotenv-safe").load();
const axios = require("axios");
const versions = require('../versions/platformVersions');
const global = require('../../../global');
const _ = require("underscore");
const { updateLocationsFromHub } = require('../../../services/ocpi');
const Utils = require('../../../utils');
const toggle = require('evio-toggle').default;

let platformLocationsEndpointUrl = "";
let platformLocationsEndpoint = "";
let token = "";

const startChargersUpdate = async (useLastDate, enableGetLocations) => {
    platformLocationsEndpoint = platformLocationsEndpointUrl;

    const { url, token } = await getPlatformInfo(global.mobiePlatformCode);
    //Check if is to consider dates on request
    if (useLastDate) {

        axios.get(global.publicNetworkLocationsLastUpdatedProxy, {})
            .then((response) => {
                if (response) {
                    if (response) {
                        const date_from = response.data;
                        const date_to = new Date().toISOString();
                        if (enableGetLocations) {
                            updateLocationsFromHub(url , token , global.mobiePlatformCode , date_from , date_to , "" , "")
                            return
                        }

                        //Set dates on URL
                        //platformLocationsEndpoint = platformLocationsEndpointUrl + "?date_from=" + date_from + "&date_to=" + date_to + "";
                        callServiceLocations(platformLocationsEndpoint, date_from, date_to);
                    }
                    else {
                        if (enableGetLocations) {
                            updateLocationsFromHub(url , token , global.mobiePlatformCode , "" , "" , "" , "")
                            return
                        }
                        callServiceLocations(platformLocationsEndpoint, "", "");
                    }
                }
                else {
                    if (enableGetLocations) {
                        updateLocationsFromHub(url , token , global.mobiePlatformCode , "" , "" , "" , "")
                        return
                    }
                    callServiceLocations(platformLocationsEndpoint, "", "");
                }
            }).catch((e) => {
                console.log("[locationsJob.startChargersUpdate] Generic client error " + e);
                if (enableGetLocations) {
                    updateLocationsFromHub(url , token , global.mobiePlatformCode , "" , "" , "" , "")
                    return
                }
                callServiceLocations(platformLocationsEndpoint, "", "");
            });
    }
    else {
        if (enableGetLocations) {
            updateLocationsFromHub(url , token , global.mobiePlatformCode , "" , "" , "" , "")
            return
        }
        callServiceLocations(platformLocationsEndpoint, "", "");
    }
};

const callServiceLocations = ((host, date_from, date_to) => {
    const data = {
        host: host,
        token,
        date_from,
        date_to
    }

    console.log("Running job to get mobie chargers to add or update...");
    console.log("Endpoint", host)
    axios.post(global.publicNetworkUpdateChargersProxyBulk, { data })
        .then((response) => {
            if (response) {
                console.log(response.data)
            }
        }).catch((e) => {
            if (e.response != undefined)
                if (e.response.data != undefined)
                    console.log(e.response.data)
                else
                    console.log(e.response)
            else
                console.log(e.message)
        });;
});

router.post('/forceJobProcess', (req, res) => {
    versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(async platform => {
        const enableGetLocations = await toggle.isEnable('evio-6761');

        //get Mobie Details
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
        const platformEndpoints22 = platformDetails22[0].endpoints

        const platformLocationsEndpointObject = _.where(platformEndpoints22, { identifier: "locations", role: "SENDER" });
        if (platformLocationsEndpointObject === undefined || platformLocationsEndpointObject.length == 0) {
            reject("Platform does not allow locations module");
            return;
        }

        platformLocationsEndpointUrl = platformLocationsEndpoint = platformLocationsEndpointObject[0].url;
        const url = platformLocationsEndpointUrl = platformLocationsEndpointObject[0].url;
        const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" });
        token = platformCredentials[0].token;

        let date_from = "";
        let date_to = "";
        const data = req.body;

        // Check if is to consider last update date
        if (data && data.periodic != undefined) {
            startChargersUpdate(true , enableGetLocations);
            return res.status(200).send('Job is currently running');
        }

        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;
                date_to = data.date_to;
                //url = url + "?date_from=" + date_from + "&date_to=" + date_to + "";
            }
        }

        console.log("Endpoint", platformLocationsEndpointUrl)


        const bulkProxyData = {
            host: platformLocationsEndpointUrl,
            token,
            date_from,
            date_to
        }
        if (enableGetLocations) {
            updateLocationsFromHub(url , token , global.mobiePlatformCode , date_from , date_to , "" , "")
            return res.status(200).send('OK');
        }

        console.log("Running job to get mobie chargers to add or update...");

        axios.post(global.publicNetworkUpdateChargersProxyBulk, { data: bulkProxyData })
            .then((response) => {

                if (response) {
                    return res.status(200).send(response.data);
                }
            }).catch((e) => {

                if (e.response != undefined)
                    if (e.response.data != undefined)
                        return res.status(400).send(e.response.data);
                    else
                        return res.status(400).send(e.message);
                else
                    return res.status(400).send(e.message);
            });
    });

});

router.post('/forceJobProcess/:hwId', (req, res) => {
    const hwId = req.params.hwId;
    versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {
        //get Mobie Details
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
        const platformEndpoints22 = platformDetails22[0].endpoints

        const platformLocationsEndpointObject = _.where(platformEndpoints22, { identifier: "locations", role: "SENDER" });
        if (platformLocationsEndpointObject === undefined || platformLocationsEndpointObject.length == 0) {
            reject("Platform does not allow locations module");
            return;
        }

        platformLocationsEndpoint = platformLocationsEndpointObject[0].url;
        platformLocationsEndpointUrl = platformLocationsEndpointObject[0].url;

        const url = platformLocationsEndpointUrl;

        const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" });
        const token = platformCredentials[0].token;

        const data = {
            host: url,
            token,
            hwId:hwId
        }

        axios.post(global.publicNetworkUpdateChargerProxy, { data })
            .then((response) => {

                if (response) {
                    return res.status(200).send(response.data);
                }
            }).catch((e) => {
                if (e.response != undefined)
                    if (e.response.data != undefined)
                        return res.status(400).send(e.response.data);
                    else
                        return res.status(400).send(e.message);
                else
                    return res.status(400).send(e.message);
            });
    });
});

router.post('/externalMobieEndpoint', (req, res) => {
    versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {
        //get Mobie External Locations
        const url = platform.externalMobieLocationsEndpoint

        let bodyData = {
            host: url
        }

        getCharger(bodyData).then((result) => {
            if (result.error == true)
                return res.status(400).send({ code: 'chargers_update_error', message: "Chargers update error: " + result.message });
            else
                return res.status(200).send(result);
        })
    });
});

router.post('/checkAllChargers', async (req, res) => {
    let publicNetworkHost = process.env.HostPublicNetwork + process.env.PathGetPublicNetworkCharger
    let externalMobiEHost = process.env.PathExternalMobieLocations
    let allChargers = await getAllChargers(publicNetworkHost, {source : global.mobiePlatformCode})
    let externalMobieChargers = await getAllChargers(externalMobiEHost, {})
    allChargers = appendToAllChargers(allChargers , externalMobieChargers)
    if (allChargers.length > 0) {
        Promise.all(
            allChargers.map(chargerInfo => {
                return new Promise((resolve, reject) => {

                    // chargerInfo.operationalStatus = process.env.OperationalStatusApproved;
                    let hwId = chargerInfo.hwId
                    versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {

                        //get Mobie Details
                        const platformDetails = platform.platformDetails;

                        //Get Mobie Endpoint to 2.2 OCPI versions
                        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                        const platformEndpoints22 = platformDetails22[0].endpoints

                        const platformLocationsEndpointObject = _.where(platformEndpoints22, { identifier: "locations", role: "SENDER" });
                        if (platformLocationsEndpointObject === undefined || platformLocationsEndpointObject.length == 0) {
                            reject("Platform does not allow locations module");
                            return;
                        }

                        platformLocationsEndpoint = platformLocationsEndpointObject[0].url;
                        platformLocationsEndpointUrl = platformLocationsEndpointObject[0].url;


                        const url = platformLocationsEndpointUrl;

                        const platformCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" });
                        const token = platformCredentials[0].token;

                        const data = {
                            host: url,
                            token: token,
                            hwId:hwId
                        }

                        axios.post(global.publicNetworkUpdateChargerProxy, { data })
                            .then((response) => {

                                if (response) {
                                    resolve(response.data);
                                }
                            }).catch((e) => {

                                if (e.response != undefined)
                                    if (e.response.data != undefined)
                                        reject(e.response.data);
                                    else
                                        reject(e.message);
                                else
                                    reject(e.message);
                            });

                    });
                })
            })
        ).then((chargers) => {
            return res.status(200).send("Chargers updated");
        }).catch((error) => {
            console.log(`[/checkAllChargers] Error `, error.message);
            return res.status(500).send(error);
        });
    } else {
        return res.status(200).send("No chargers to Update");
    }
});

async function getCharger(bodyData) {
    let originalHost = bodyData.host;
    let hwId = bodyData.hwId;
    var host = "";
    var token = bodyData.token;

    host = originalHost

    let result;
    const chargersCount = 0;

    result = await new Promise((resolve, reject) => {
        asyncCallSpecificLocation(host, token, chargersCount, resolve);
    });

    //console.log("testes", result);
    chargers = sliceIntoChunks(result.chargers, 10)
    for (let chargerArray of chargers) {
        axios.patch(global.publicNetworkUpdatePlugPowerProxy, {chargers : chargerArray})
        .then(function (response) {

            if (typeof response.data !== 'undefined') {
                console.log("Success updating or creating chargers")
            }
            else {
                console.log("[locationsJob.getCharger.axios.patch.else] Generic client error ");
            }
        }).catch(function (e) {
            console.log("[locationsJob.getCharger.axios.patch] Generic client error " + e.response.status + "- " + e.response.statusText);
        });
    }
    return result;
}

async function asyncCallSpecificLocation(host, token, chargersCount, resolve) {
    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then(async (result) => {
        //console.log(result.data.data);
        let chargers = []
        if (result) {

            if (result.data) {

                for (let i = 0; i < result.data.length; i++) {
                    let charger = result.data[i];
                    //console.log(charger);
                    charger.source = "MobiE"
                    let updateCharger = {
                        hwId: charger.id,
                        source: charger.source,
                        plugs: await Utils.getPlugs(charger.evses)
                    }

                    chargers.push(updateCharger)
                }
            }
        }
        resolve({chargers})
    }).catch((e) => {
        //console.log(e);
        resolve({ totalCount: -1, error: true, message: e.message , chargers : [] })
    });
}

function sliceIntoChunks(arr, chunkSize) {
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

function getAllChargers(chargerProxy, params) {
    var context = "Function getAllChargers";
    return new Promise((resolve, reject) => {
        try {
            axios.get(chargerProxy, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve([]);
                    //resolve([]);
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve([]);
        };
    });
};

function appendToAllChargers(allChargers , mobieChargers) {
    for (let charger of mobieChargers) {
        let exists = allChargers.find(element => element.hwId === charger.id)
        if (!exists) {
            allChargers.push(charger)
        }
    }
    return allChargers
}

async function getPlatformInfo(platformCode) {
    const platform = await Utils.findOnePlatform({ platformCode });
    const platformDetails = platform.platformDetails ?? [];
    const platform22 = platformDetails.find(detail => detail.version === "2.2");
    const locationsEndpoint = platform22.endpoints?.find(
        (endpoint) => endpoint.identifier === "locations" && endpoint.role === "SENDER"
    );

    const credentials = (platform.platformActiveCredentialsToken ?? [])
        .find(token => token.version === "2.2");

    return {
        url: locationsEndpoint?.url,
        token: credentials?.token
    }
}
module.exports = router;
