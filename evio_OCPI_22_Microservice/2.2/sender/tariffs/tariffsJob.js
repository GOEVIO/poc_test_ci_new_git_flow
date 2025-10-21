const express = require('express');
const router = express.Router({mergeParams:true});
require("dotenv-safe").load();
const axios = require("axios");
const versions = require('../versions/platformVersions');
const details = require('../details/platformDetails');
const global = require('../../../global');
const _ = require("underscore");
const Tariff = require('../../../models/tariffs')
const TariffCEME = require('../../../models/tariffCEME')
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
const Utils = require('../../../utils');
const parseLink = require('parse-link-header');



let platformTariffsEndpoint = "";
let task = null;
let tariffsBulkLastUpdateDate = false;
let mobieToken = "";


function initJob() {
    return new Promise((resolve, reject) => {
        versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {

            //get Mobie Details
            const platformDetails = platform.platformDetails;

            //Get Mobie Endpoint to 2.2 OCPI versions
            const platformDetails22 = _.where(platformDetails, { version: "2.2" });
            const platformEndpoints22 = platformDetails22[0].endpoints

            const platformTariffsEndpointObject = _.where(platformEndpoints22, { identifier: "tariffs", role: "SENDER" });
            if (platformTariffsEndpointObject === undefined || platformTariffsEndpointObject.length == 0) {
                reject("Platform does not allow tariffs module");
                return;
            }
            platformTariffsEndpoint = platformTariffsEndpointObject[0].url;

            const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
            mobieToken = platformActiveCredentials[0].token;

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

const startTariffsUpdate = ((enableGetTariffs=false, url="", token="", source=global.mobiePlatformCode, tariffsBulkLastUpdateDate=true) => {

    const endpoint = platformTariffsEndpoint;
    let date_from = "";
    let date_to = "";

    //Check if is to consider dates on request
    if (tariffsBulkLastUpdateDate) {

        Tariff.findOne({source}).sort({ "last_updated": -1 }).limit(1).then((doc) => {
            if (doc) {
                date_from = doc.last_updated;
                date_to = new Date().toISOString();

                //endpoint = platformTariffsEndpoint + "?date_from=" + date_from + "&date_to=" + date_to + "";
            }
            if (enableGetTariffs) {
                updateTariffsFromHub(url, token, source, date_from, date_to, "", "")
                return 
            }

            //getPlatformTariffs(endpoint, mobieToken);
            getTariffs(endpoint, mobieToken, date_from, date_to).then((result) => {
                if (result.error == true)
                    console.log("Tarrifs update error: " + result.message);
                else
                    console.log("Tarrifs update success: " + result.tariffsCount);

            })
        });
    }
    else {
        if (enableGetTariffs) {
            updateTariffsFromHub(url, token, source, date_from, date_to, "", "")
            return 
        }
        //getPlatformTariffs(endpoint, mobieToken);
        getTariffs(endpoint, mobieToken, date_from, date_to).then((result) => {
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
                        updatePublicNetwork(tariff)

                    } else {
                        const new_tariff = new Tariff(tariff);
                        Tariff.create(new_tariff, (err, result) => {
                            if (result) {
                                updatePublicNetwork(tariff)
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
            console.log("[tariffsJob.addUpdateTariff] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    });

});

const add_updateTariff2 = ((tariff) => {
    return new Promise((resolve, reject) => {
        try {
            let query = {
                id: tariff.id
            };

            Tariff.updateTariff(query, { $set: tariff }, (err, doc) => {
                if (doc != null) {
                    console.log("Updated " + tariff.id);
                    updatePublicNetwork(tariff)
                    resolve(true);
                } else {
                    const new_tariff = new Tariff(tariff);
                    Tariff.create(new_tariff, (err, result) => {
                        if (result) {
                            updatePublicNetwork(tariff)
                            console.log("Created Tariff " + tariff.id + "");
                            resolve(true);
                        } else {
                            console.log("Tariff not created : " + tariff.id + "", err);
                            resolve(true);
                        }
                    })
                }
            });

            resolve(true);

        }
        catch (e) {
            console.log("[tariffsJob.addUpdateTariff2] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }
    });
});

router.post('/startJob', (req, res) => {
    initJob().then(() => {
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
    const status = "Stopped";
    if (task != undefined) {
        status = task.status;
    }
    return res.status(200).send({ "Tariffs Job Status": status});
});

router.post('/forceJobProcess', (req, res) => {

    versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(async platform => {

        //get Mobie Details
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
        const platformEndpoints22 = platformDetails22[0].endpoints

        const platformTariffsEndpointObject = _.where(platformEndpoints22, { identifier: "tariffs", role: "SENDER" });
        if (platformTariffsEndpointObject === undefined || platformTariffsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'tarrifs_update_error', message: "Platform does not allow tariffs module" });
        }
        platformTariffsEndpoint = platformTariffsEndpointObject[0].url;

        let date_from = "";
        let date_to = "";
        const endpoint = platformTariffsEndpoint;
        const data = req.body;
        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;
                date_to = data.date_to;
                //endpoint = endpoint + "?date_from=" + date_from + "&date_to=" + date_to + "";
            }
        }

        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
        const mobieToken = platformActiveCredentials[0].token;
        const enableGetTariffs = await toggle.isEnable('charge-586-ocpi-tariffs-job');
        if (data && data.periodic != undefined) {
            startTariffsUpdate(enableGetTariffs, endpoint, mobieToken, platform.platformCode);
            return res.status(200).send('Job is currently running');
        }

        if (enableGetTariffs) {
            console.log("Running new process of get mobie tariffs to add or update...");
            updateTariffsFromHub(endpoint, mobieToken, platform.platformCode, date_from, date_to, "", "")
            return res.status(200).send('OK');
        }
        getTariffs(endpoint, mobieToken, date_from, date_to).then((result) => {
            if (result.error == true)
                return res.status(400).send({ code: 'tarrifs_update_error', message: "Tarrifs update error: " + result.message });
            else
                return res.status(200).send({ code: 'tarrifs_update_success', message: "Tarrifs update success: " + result.tariffsCount });

        })
    });
});

async function getTariffs(originalEndpoint, token, date_from, date_to) {
    let originalHost = originalEndpoint;
    let host = "";
    let offset = 0;
    let totalCount = 10;

    if (date_from != "")
        host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to;
    else
        host = originalHost;

    let tariffsCount = 0;
    let result;

    console.log(host)
    while (offset < totalCount) {

        result = await new Promise((resolve, reject) => {
            asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, tariffsCount, resolve);
        });

        offset = result.offset;
        totalCount = result.totalCount;
        tariffsCount = result.tariffsCount;
        host = result.host;
        console.log(result);
    }
    return result;
}

async function asyncCall(host, offset, totalCount, date_from, date_to, originalHost, token, tariffsCount, resolve) {
    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then(async (result) => {

        const x_total_count = result.headers["x-total-count"];
        if (x_total_count != 0)
            totalCount = x_total_count;

        const x_limit = result.headers["x-limit"]
        const link = result.headers["link"]
        const parsedLink = parseLink(link)

        offset = Number(offset) + Number(x_limit);

        if (result) {
            if (result.data) {
                if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {
                    tariffsCount += result.data.data.length;

                    for (let i = 0; i < result.data.data.length; i++) {
                        let tariff = result.data.data[i];
                        await add_updateTariff2(tariff);
                    }
                }
            }
        }

        if (date_from != "")
            host = originalHost + "?date_from=" + date_from + "&date_to=" + date_to + "&offset=" + offset;
        else
            host = originalHost + "?offset=" + offset;

        if (parsedLink) {
            host = parsedLink?.next?.url
            offset = Number(parsedLink?.next?.offset) || tariffsCount
        }

        resolve({ offset: offset, totalCount: totalCount, tariffsCount: tariffsCount, host: host })

    }).catch((e) => {
        console.log(e);
        resolve({ offset: offset, totalCount: -1, tariffsCount: tariffsCount, error: true, message: e.response.data.message })
    });
}

router.get('/defaultCEMETariff', async (req, res) => {
    let clientName = req.query.clientName
    let tariffCEME = await Utils.getTariffCEME(clientName);
    return res.status(200).send(tariffCEME);
});

router.post('/updateDefaultCEMETariffs', (req, res) => {
    updateDefaultCEMETariffs()
    return res.status(200).send('OK!');
});

cron.schedule('0 7 */7 * *', () => {
    console.log("Running routine to updateDefaultCEMETariffs")
    updateDefaultCEMETariffs()
});


async function updateDefaultCEMETariffs() {
    const context = "Function updateDefaultCEMETariffs"
    try {
        let host = process.env.HostPublicTariffs + process.env.PathGetTariffCEME;
        let allCEMETariffs = await getRequest(host , {})
        await upsertCEMETariffs(allCEMETariffs)

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getRequest(host , params) {
    const context = "Function getRequest";
    try {
        let resp = await axios.get(host, params)
        if (resp.data) {
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function upsertCEMETariffs(allCEMETariffs) {
    const context = "Function upsertCEMETariffs";
    try {
        for (let tariff of allCEMETariffs) {
            await TariffCEME.findOneAndUpdate({_id : tariff._id}, tariff, { new: true, upsert: true });
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
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

module.exports = router;
