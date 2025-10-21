const express = require('express');
const router = express.Router({mergeParams:true});
require("dotenv-safe").load();
const axios = require("axios");
var versions = require('../versions/platformVersions');
var details = require('../details/platformDetails');
const global = require('../../../global');
var _ = require("underscore");
const Tariff = require('../../../models/tariffs')
const Platform = require('../../../models/platforms');
const { updateTariffsFromHub } = require('../../../services/ocpi');
const toggle = require('evio-toggle').default;
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


var platformTariffsEndpoint = "";
var task = null;
var tariffsBulkLastUpdateDate = false;
var platformToken = "";
var platformCode = ""


function initJob(req) {
    return new Promise((resolve, reject) => {
        let ocpiVersion = req.params.version
        platformCode = req.params.platformCode

        versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

            //get Mobie Details
            var platformDetails = platform.platformDetails;

            //Get Mobie Endpoint to 2.2 OCPI versions
            var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
            var platformEndpoints211 = platformDetails211[0].endpoints
            var platformTariffsEndpointObject = _.where(platformEndpoints211, { identifier: "tariffs"});


            if (platformTariffsEndpointObject === undefined || platformTariffsEndpointObject.length == 0) {
                reject("Platform does not allow tariffs module");
                return;
            }
            platformTariffsEndpoint = platformTariffsEndpointObject[0].url;

            var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
            platformToken = platformActiveCredentials[0].token;

            tariffsBulkLastUpdateDate = platform.tariffsBulkLastUpdateDate;

            console.log("Tariffs Bulk Job Init");

            task = cron.schedule(platform.tariffsScheduleTimeCronJob, () => {
                console.log('Running Tariffs Job ' + new Date().toISOString());

                startTariffsUpdate();
            }, {
                scheduled: false
            });

            resolve();

        });
    });
};

const startTariffsUpdate = (async (enableGetTariffs=false, url="", token="", source=global.girevePlatformCode, tariffsBulkLastUpdateDate=true) => {

    var endpoint = platformTariffsEndpoint;
    var date_from = "";
    var date_to = "";

    //Check if is to consider dates on request
    if (tariffsBulkLastUpdateDate) {

        versions.getPlatformVersionsByPlatformCode(platformCode)
        .then(async platform => {
            if (platform.tariffsLastRequestDate !== undefined ) {
                var date_from = platform.tariffsLastRequestDate;
                var date_to = new Date().toISOString();
                if (enableGetTariffs) {
                    const tariffsCount = await updateTariffsFromHub(url, token, source, date_from, date_to, "", "")
                    tariffsCount > 0 && await Platform.findOneAndUpdate({platformCode: source}, {tariffsLastRequestDate : date_to})
                    return 
                }
                var result = await getTariffs(endpoint, platformToken, date_from, date_to)
                if (!result.error) {
                    Platform.updatePlatform({platformCode}, {tariffsLastRequestDate : date_to}, (err, result) => {
                        if (err) {
                            console.log(`[updatePlatform] Error `, err);
                        }
                        else {
                            console.log("Updated tariffsLastRequestDate! - " + date_to)
                        };
                    });
                }
            } else {
                var date_from = new Date();
                date_from.setHours(date_from.getHours() - 24);

                //Transform date_from object to string
                date_from = date_from.toISOString()
                var date_to = new Date().toISOString();
                if (enableGetTariffs) {
                    const tariffsCount = await updateTariffsFromHub(url, token, source, date_from, date_to, "", "")
                    tariffsCount > 0 && await Platform.findOneAndUpdate({platformCode}, {tariffsLastRequestDate : date_to})
                    return 
                }
                var result = await getTariffs(endpoint, platformToken, date_from, date_to)
                if (!result.error) {
                    Platform.updatePlatform({platformCode}, {tariffsLastRequestDate : date_to}, (err, result) => {
                        if (err) {
                            console.log(`[updatePlatform] Error `, err);
                        }
                        else {
                            console.log("Updated tariffsLastRequestDate! - " + date_to)
                        };
                    });
                }
            }
        })
        .catch( error => {
            console.log("error" , error.message)
        })

        // Tariff.findOne({}).sort({ "last_updated": -1 }).limit(1).then((doc) => {
        //     if (doc) {
        //         date_from = doc.last_updated;
        //         date_to = new Date().toISOString();

        //         //endpoint = platformTariffsEndpoint + "?date_from=" + date_from + "&date_to=" + date_to + "";
        //     }


        //     //getPlatformTariffs(endpoint, platformToken);
        //     getTariffs(endpoint, platformToken, date_from, date_to).then((result) => {
        //         if (result.error == true)
        //             console.log("Tarrifs update error: " + result.message);
        //         else
        //             console.log("Tarrifs update success: " + result.tariffsCount);

        //     })
        // });

    }
    else {
        if (enableGetTariffs) {
            const tariffsCount = await updateTariffsFromHub(url, token, source, date_from, date_to, "", "")
            tariffsCount > 0 && await Platform.findOneAndUpdate({platformCode}, {tariffsLastRequestDate : date_to})
            return 
        }
        //getPlatformTariffs(endpoint, platformToken);
        getTariffs(endpoint, platformToken, date_from, date_to).then((result) => {
            if (result.error == true)
                console.log("Tarrifs update error: " + result.message);
            else
                console.log("Tarrifs update success: " + result.tariffsCount);

        })
    }

});

const getPlatformTariffs = ((endpoint, token) => {
    return new Promise((resolve, reject) => {

        axios.get(endpoint, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

            if (typeof response.data !== 'undefined') {

                add_updateTariff(response.data);

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

const add_updateTariff = ((tariffsObject) => {
    return new Promise((resolve, reject) => {
        try {

            for (let i = 0; i < tariffsObject.data.length; i++) {
                let tariff = tariffsObject.data[i];

                let query = {
                    id: tariff.id
                };

                Tariff.updateTariff(query, { $set: tariff }, (err, doc) => {
                    if (doc != null) {
                        console.log("Updated " + tariff.id);

                    } else {
                        const new_tariff = new Tariff(tariff);
                        Tariff.create(new_tariff, (err, result) => {
                            if (result) {
                                console.log("Created Tariff " + tariff.id + "");

                            } else {
                                console.log("Tariff not created : " + tariff.id + "", err);

                            }
                        })
                    }
                });
            }
            resolve(true);

        }
        catch (e) {
            console.log("[tariffsJob.add_updateTariff] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }

    });

});

const add_updateTariff2 = ((tariffs , mode) => {
    const context = "add_updateTariff2"
    return new Promise((resolve, reject) => {
        try {

            if (tariffs.length > 0) {
                Promise.all(tariffs.map(tariff => {
                    return new Promise((resolve, reject) => {
                        let query = {
                            id: tariff.id
                        };
                        tariff.source = platformCode
                        //TODO: In 2.1.1 version, we don't get the type of tariff (REGULAR OR AD_HOC_PAYMENT), so we use all REGULAR
                        tariff.type = "REGULAR"
                        if (tariff.min_price !== null && tariff.min_price !== undefined) {
                            tariff.min_price = {
                                excl_vat : tariff.min_price
                            }
                        }
                        tariff.elements = Utils.transformTariffElements(tariff.elements)
                        Tariff.updateTariff(query, { $set: tariff }, (err, doc) => {
                            if (doc != null) {
                                console.log("Updated " + tariff.id);
                                //Send to public Network for update on chargers
                                updatePublicNetwork(tariff)
                                resolve(tariff);
                            } else {
                                const new_tariff = new Tariff(tariff);
                                Tariff.create(new_tariff, (err, result) => {
                                    if (result) {
                                        console.log("Created Tariff " + tariff.id + "");
                                        //Send to public Network for update on chargers
                                        updatePublicNetwork(tariff);
                                        resolve(tariff);
                                    } else {
                                        console.log("Tariff not created : " + tariff.id + "", err);
                                        reject(true);
                                    }
                                })
                            }
                        });
                    })
                }))
                .then(tariffs => {
                    if (mode === "full") {
                        console.log("full mode delete tariffs")
                        deleteMissingTariffs(tariffs)
                    }
                    resolve()
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error.message);
                    resolve()
                })
            } else {
                console.log("No tariffs to update!")
                resolve()
            }

        }
        catch (e) {
            console.log("[tariffsJob.add_updateTariff2] Generic client error. ", e);
            // return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }

    });

});


router.post('/startJob', (req, res) => {
    initJob(req).then(() => {
        task.start();
        console.log("Tariffs bulk Job Started")
        return res.status(200).send('Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/stopJob', (req, res) => {
    task.stop();
    console.log("Tariffs bulk Job Stopped")
    return res.status(200).send('Job Stopped');
});

router.post('/statusJob', (req, res) => {
    var status = "Stopped";
    if (task != undefined) {
        status = task.status;
    }

    return res.status(200).send({ "Tariffs Job Status": status});
});

router.post('/forceJobProcess', (req, res) => {
    let ocpiVersion = req.params.version
    platformCode = req.params.platformCode
    versions.getPlatformVersionsByPlatformCode(platformCode).then(async platform => {

        //get Mobie Details
        var platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        var platformDetails211 = _.where(platformDetails, { version: ocpiVersion });
        var platformEndpoints211 = platformDetails211[0].endpoints
        var platformTariffsEndpointObject = _.where(platformEndpoints211, { identifier: "tariffs"});


        if (platformTariffsEndpointObject === undefined || platformTariffsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'tarrifs_update_error', message: "Platform does not allow tariffs module" });
        }
        platformTariffsEndpoint = platformTariffsEndpointObject[0].url;

        var date_from = "";
        var date_to = "";
        var endpoint = platformTariffsEndpoint;
        var data = req.body;
        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;
                date_to = data.date_to;
                //endpoint = endpoint + "?date_from=" + date_from + "&date_to=" + date_to + "";
            }
        }

        var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
        var platformToken = platformActiveCredentials[0].token;
        const enableGetTariffs = await toggle.isEnable('charge-586-ocpi-tariffs-job');
        if (data && data.periodic != undefined) {
            startTariffsUpdate(enableGetTariffs, endpoint, platformToken, platformCode);
            return res.status(200).send('Job is currently running');
        }

        if (enableGetTariffs) {
            updateTariffsFromHub(endpoint, platformToken, platformCode, date_from, date_to, "", "");
            return res.status(200).send('OK');
        }

        getTariffs(endpoint, platformToken, date_from, date_to).then((result) => {
            if (result.error == true)
                return res.status(400).send({ code: 'tarrifs_update_error', message: "Tarrifs update error: " + result.message });
            else
                return res.status(200).send({ code: 'tarrifs_update_success', message: "Tarrifs update success: " + result.tariffsCount });

        })

        // getPlatformTariffs(endpoint, platformToken).then((result) => {
        //     return res.status(200).send(result);
        // });
    });
});

async function getTariffs(originalEndpoint, token, date_from, date_to) {


    let originalHost = originalEndpoint;
    var host = "";
    var token = token;
    var offset = 0;
    var totalCount = 10;
    var limit = 200;
    var mode = ""

    var date_from = date_from;
    var date_to = date_to;

    if (date_from != "") {
        host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + limit;
        mode = "delta";
    }
    else {
        host = originalHost + "?offset=" + offset + "&limit=" + limit;
        mode = "full"
    }

    var tariffsCount = 0;
    var result;
    var tariffs = []

    console.log(host)
    while (offset < totalCount) {

        result = await new Promise((resolve, reject) => {
            asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, tariffsCount, resolve);
        });

        offset = result.offset;
        totalCount = result.totalCount;
        tariffsCount = result.tariffsCount;
        host = result.host;
        tariffs.push(...result.tariffs)
        console.log(result);
    }

    add_updateTariff2(tariffs , mode)


    return result;

}

async function asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, tariffsCount, resolve) {

    console.log(host);
    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then((result) => {

        var x_total_count = result.headers["x-total-count"];
        console.log("x_total_count", x_total_count);
        if (x_total_count != 0)
            totalCount = x_total_count;
        else
            totalCount = 0
        var x_limit = result.headers["x-limit"]
        let tariffsArray = []

        offset = Number(offset) + Number(x_limit);

        if (result) {

            if (result.data) {

                if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {

                    tariffsCount += result.data.data.length;

                    for (let i = 0; i < result.data.data.length; i++) {
                        let tariff = result.data.data[i];
                        // add_updateTariff2(tariff);
                        tariffsArray.push(tariff)

                    }


                }
            }
        }

        if (date_from != "")
            host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset + "&limit=" + Number(x_limit);
        else
            host = originalHost + "?offset=" + offset + "&limit=" + Number(x_limit);

        resolve({ offset: offset, totalCount: totalCount, tariffsCount: tariffsCount, host: host , tariffs : tariffsArray })

    }).catch((e) => {
        console.log("[TariffsJob]" , e.message);
        resolve({ offset: offset, totalCount: -1, tariffsCount: tariffsCount, error: true, message: e.message , tariffs : [] })
    });
    // });
}


function updatePublicNetwork(tariffOPC) {

    let opcTariff = Utils.tariffResponseBody(tariffOPC);
    let host = process.env.HostPublicNetwork + process.env.PathPublicNetworkUpdateTariffOPC;

    let data = opcTariff;

    axios.patch(host, data)
        .then((result) => {
            console.log("Tariff Updated");
        })
        .catch((error) => {
            console.log("Generic client error. ", error.message);
        });

};

async function deleteMissingTariffs(tariffs) {
    const context = "deleteMissingTariffs"
    try {

        let updatedTariffsIds = tariffs.map(tariff =>{return tariff.id})
        let source = tariffs[0].source
        if (tariffs.length > 0) {
            Tariff.find({source : source}, (err, tariffsFound) => {
                if (err) {
                    console.log(`[${context}] Error `, err.message);
                }
                else {
                    if (tariffsFound.length > 0) {
                        let foundTariffsIds = tariffsFound.map(tariff =>{return tariff.id})
                        let result = foundTariffsIds.filter(id => !updatedTariffsIds.includes(id))
                        console.log(result)
                        if (result.length > 0) {
                            for (let id of result) {
                                let query = {
                                    id
                                }

                                Tariff.removeTariff(query, (error, result) => {
                                    if (error) {
                                        console.log(`[${context}] Error `, error.message);
                                    }
                                    else {
                                        console.log(`Tariff ${id} was removed from GIREVE repository and and from EVIO`)
                                        let host = process.env.HostPublicNetwork + process.env.PathPublicNetworkUpdateTariffOPC;

                                        let data = {
                                            tariffId: id,
                                            initialCost: 0,
                                            elements : [],
                                            costByPower: { "cost": 0, "uom": "kWh" },
                                            costByTime: [{ "minTime": 0, "cost": 0, "uom": "min" }],
                                        }

                                        axios.patch(host, data)
                                            .then((result) => {
                                                console.log("Tariff Updated");
                                            })
                                            .catch((error) => {
                                                console.log("[tariffsJob.deleteMissingTariffs] Generic client error. ", error.message);
                                            });
                                    };
                                });
                            }
                        }
                    };
                };
            });
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}
module.exports = router;
