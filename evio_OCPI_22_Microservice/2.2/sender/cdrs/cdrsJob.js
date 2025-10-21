const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const versions = require('../versions/platformVersions');
const global = require('../../../global');
const _ = require("underscore");
const CDR = require('../../../models/cdrs')
const Session = require('../../../models/sessions')
const vatService = require('../../../services/vat')
const Sentry = require("@sentry/node");
const { TariffsService } = require('evio-library-ocpi');
const { Enums } = require('evio-library-commons').default;
const { getAllUserInfo, getEmspTariffWithIdTag } = require('evio-library-identity').default;

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
const moment = require('moment');
const Utils = require('../../../utils');
const addressS = require("../../../services/address");

let Client = require("ssh2-sftp-client");
let sftp = new Client();
const fs = require('fs')
const xml2js = require('xml2js');
const timeZoneMoment = require('moment-timezone');
require('dotenv').config();
const parseLink = require('parse-link-header');



const connectionConfigs = {
    host: process.env.sftpHost,
    port: process.env.sftpPort,
    username: process.env.sftpUsername,
    password: process.env.sftpPassword,
}

let platformCDRsEndpoint = "";
let task = null;
let mobieToken = "";
let taskSftp = null

function initJob() {
    return new Promise((resolve, reject) => {
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
            platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

            const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
            mobieToken = platformActiveCredentials[0].token;

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

    const endpoint = platformCDRsEndpoint;

    getCDRs(endpoint, mobieToken, date_from).then((result) => {
        if (result.error == true)
            console.log("CDRs not processed. Error: " + result.message);
        else
            console.log("CDRs processed: " + result.cdrsCount + ". New CDRs: " + result.newCDRs);

    })

});

async function getCDRs(originalEndpoint, token, date_from) {

    let originalHost = originalEndpoint;
    let host = "";
    let offset = 0;
    let totalCount = 1;

    if (date_from != "")
        host = originalHost + "?date_from=" + date_from + "&offset=" + offset + "&limit=1";
    else
        host = originalHost + "?offset=" + offset + "&limit=1";;

    let cdrsCount = 0;
    let newCDRs = 0;
    let result;

    while (offset <= totalCount) {

        result = await new Promise((resolve, reject) => {
            asyncCall(host, offset, totalCount, date_from, originalHost, token, cdrsCount, resolve, newCDRs);
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

async function asyncCall(host, offset, totalCount, date_from, originalHost, token, cdrsCount, resolve, newCDRs) {
    axios.get(host, { headers: { 'Authorization': `Token ${token}` } }).then(async (result) => {

        const x_total_count = result.headers["x-total-count"];
        if (x_total_count != 0)
            totalCount = x_total_count;

        const x_limit = result.headers["x-limit"]
        const link = result.headers["link"]
        const parsedLink = parseLink(link)

        offset = Number(offset) + 1;

        if (result) {
            if (result.data) {
                if (typeof result.data.data !== 'undefined' && result.data.data.length > 0) {

                    cdrsCount += result.data.data.length;

                    for (let i = 0; i < result.data.data.length; i++) {
                        let cdr = result.data.data[i];

                        const res = await processCDR(cdr.id, cdr.session_id, cdr);
                        if (res)
                            newCDRs += 1;

                    }
                }
            }
        }

        if (date_from != "")
            host = originalHost + "?date_from=" + date_from + "&offset=" + offset + "&limit=1";
        else
            host = originalHost + "?offset=" + offset + "&limit=1";

        console.log("parsedLink" , JSON.stringify(parsedLink))
        if (parsedLink) {
            host = parsedLink?.next?.url
            offset = Number(parsedLink?.next?.offset) || cdrsCount
        }
        resolve({ offset: offset, totalCount: totalCount, cdrsCount: cdrsCount, host: host, newCDRs: newCDRs })

    }).catch((e) => {
        console.log(e);
        resolve({ offset: offset, totalCount: -1, cdrsCount: cdrsCount, error: true, message: e?.response?.data?.message, newCDRs: newCDRs })
    });
}

async function processCDR(cdrId, sessionId, data) {
    return new Promise((resolve, reject) => {
        try {

            let query = {
                "$or": [
                    { id: cdrId },
                    { session_id: sessionId }
                ]
            };

            CDR.find(query, { _id: 0 }, async (err, cdr) => {

                if (Utils.isEmptyObject(cdr)) {

                    let query = {
                        id: sessionId
                    }

                    let sessionExists = false
                    let cdrSession = sessionId ? await Utils.chargingSessionFindOne(query) : null
                    if (cdrSession) {
                        if (cdrSession.status === global.SessionStatusSuspended) return resolve(false);
                        data.source = cdrSession.source !== undefined ? cdrSession.source : "MobiE"
                        sessionExists = cdrSession.id !== undefined && cdrSession.id !== null ? true : false
                    } else {
                        //TODO For now it works. We should fall on the if statement though
                        data.source = "MobiE"
                    }
                    console.log(`Process CDR with SessionId ${sessionId} from source ${data.source}`)

                    if (sessionExists) {
                        const new_cdr = new CDR(data);
                        CDR.create(new_cdr, (err, result) => {

                            if (result) {
                                console.log("CDR " + cdrId + " created ");
                                Utils.processBillingAndPayment(sessionId, data);
                                resolve(true);
                            } else {
                                console.log("CDR " + cdrId + " not created ", err);
                                resolve(false);
                            }
                        })
                    } else {
                        console.log("CDR " + cdrId + ` not created - session with sessionId ${sessionId} does not exist yet`);
                        resolve(false);
                    }
                }
                else {
                    console.log("CDR " + cdrId + " not created - CDR already exists");
                    Utils.saveDifferentCdr(cdr, data)
                    resolve(false);
                }
            });
        }
        catch (e) {
            console.log("[cdrsJob.processCDR] Generic client error. ", e);
            resolve(false);
        }
    });
}

router.post('/startJob', (req, res) => {
    initJob().then(() => {
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
    versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {

        //get Mobie Details
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
        const platformEndpoints22 = platformDetails22[0].endpoints
        const platformCDRsEndpointObject = _.where(platformEndpoints22, { identifier: "cdrs", role: "SENDER" });


        if (platformCDRsEndpointObject === undefined || platformCDRsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'tarrifs_update_error', message: "Platform does not allow cdrs module" });
        }
        platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

        let date_from = "";
        const endpoint = platformCDRsEndpoint;
        const data = req.body;
        if (!Utils.isEmptyObject(data)) {
            if (typeof data !== 'undefined' && data.length !== 0) {
                date_from = data.date_from;
            }
        }

        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
        const mobieToken = platformActiveCredentials[0].token;

        getCDRs(endpoint, mobieToken, date_from).then((result) => {
            console.log(result)
            if (result.error == true)
                return res.status(400).send({ code: 'cdrs_update_error', message: "CDRs update error: " + result.message });
            else
                return res.status(200).send({ code: 'cdrs_update_success', message: "CDRs processed: " + result.cdrsCount + ". New CDRs: " + result.newCDRs });
        })
    });
});

function initJobSftp() {
    return new Promise((resolve, reject) => {

        versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode).then(platform => {


            let timer = platform.sftpCdrsScheduleTimeCronJob !== null && platform.sftpCdrsScheduleTimeCronJob !== undefined ? platform.sftpCdrsScheduleTimeCronJob : "30 22 * * *"
            console.log(timer);
            taskSftp = cron.schedule(timer, () => {
                let date = new Date().toISOString();

                // let lastMonthDate = moment.utc(date).add(-1 , "months").format()
                let lastMonthDate = moment.utc(date).format()

                console.log('Running SFTP CDRs Job of current month ' + lastMonthDate);

                getStfpCdrs(lastMonthDate, global.monthDateFormat)
            }, {
                scheduled: false
            });
            resolve();
        });
    });
};

router.post('/sftp/forceJobProcess/day', async (req, res) => {
    let date = req.body.date ? req.body.date : new Date().toISOString()
    let result = await getStfpCdrs(date, global.dayDateFormat)
    return res.status(200).send(result);
});

router.post('/sftp/forceJobProcess/month', async (req, res) => {
    let date = req.body.date ? req.body.date : new Date().toISOString()
    let result = await getStfpCdrs(date, global.monthDateFormat)
    return res.status(200).send(result);
});

cron.schedule('30 23 7 * *', () => {
    console.log("Running monthly routine to fetch sftp cdrs from previous month")
    let date = new Date()
    date.setDate(0)
    //TODO Add function to fetch month n-2
    getStfpCdrs(date.toISOString(), global.monthDateFormat)
});

router.post('/startJobSftp', (req, res) => {
    initJobSftp().then(() => {
        taskSftp.start();
        console.log("STFP CDRs Job Started")
        return res.status(200).send('STFP CDRs Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/stopJobSftp', (req, res) => {
    taskSftp.stop();
    console.log("STFP CDRs Job Stopped")
    return res.status(200).send('STFP CDRs Job Stopped');
});

router.post('/statusJobSftp', (req, res) => {
    var status = "Stopped";
    if (taskSftp != undefined) {
        status = taskSftp.status;
    }

    return res.status(200).send({ "STFP CDRs Job Status": status });
});


function filterDate(name, filterIsoDate, dateFormat) {
    var fileDate = moment(filterIsoDate).format(dateFormat);
    return (
        name.slice(0, fileDate.length) === fileDate &&
        name.slice(
            global.fullDateLength,
            global.fullDateLength + global.evioFinalEnum.length
        ) === global.evioFinalEnum
    );
}

async function getStfpCdrs(fetchDate, dateFormat) {
    const context = "Function getStfpCdrs"
    try {
        console.log("connectionConfigs", connectionConfigs)
        // Create a connection to sftp server with provided connection configs
        await sftp.connect(connectionConfigs)

        // Get list of all files in the clients remote path
        let allCdrsList = await sftp.list(process.env.mobieSftpRemotePath);

        // We can process the cdrs of a specific month or specific day, so we filter all cdrs with those parameters
        let filteredCdrs = allCdrsList.filter((file) => filterDate(file.name, fetchDate, dateFormat));

        // console.log("filteredCdrs" , filteredCdrs)

        let result = await parseAndProcessCdrs(filteredCdrs)

        sftp.end()
        console.log("=== STFP RESULT ===")
        console.log(JSON.stringify(result, null, 2))
        return result

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { cdrsProcessed: 0, newSessions: 0, newCdrs: 0 }
    }
}

async function parseAndProcessCdrs(filteredCdrs) {
    const context = "Function parseAndProcessCdrs"
    let res = { cdrsProcessed: 0, newSessions: 0, newCdrs: 0 }
    try {
        for (let cdrFile of filteredCdrs) {
            let remotePath = process.env.mobieSftpRemotePath + cdrFile.name
            let localPath = `./${cdrFile.name}`
            await sftp.fastGet(remotePath, localPath)
            const xmlFileString = fs.readFileSync(localPath);
            let result = await parseXmlString(xmlFileString)
            res.cdrsProcessed += result.cdrsProcessed
            res.newSessions += result.newSessions
            res.newCdrs += result.newCdrs
            fs.unlinkSync(localPath)
        }
        return res

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { cdrsProcessed: res.cdrsProcessed, newSessions: res.newSessions, newCdrs: res.newCdrs }
    }
}

function parseXmlString(xmlFileString) {
    const context = "Function parseXmlString"
    return new Promise((resolve, reject) => {
        xml2js.parseString(xmlFileString, { mergeAttrs: true }, async (err, jsonCdrs) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                resolve({ cdrsProcessed: 0, newSessions: 0, newCdrs: 0 })
            }
            let result = await processJsonCdrs(jsonCdrs.Usages.Usage)
            resolve(result)
        });
    })
}

async function processJsonCdrs(jsonCdrs) {
    const context = "Function parseAndProcessCdrs"

    let result = { cdrsProcessed: 0, newSessions: 0, newCdrs: 0 }
    try {
        for (let cdrJson of jsonCdrs) {
            result.cdrsProcessed += 1
            let cdr = fixCdrArrayKeys(cdrJson)
            cdr = await transformCdrJsonModel(cdr)
            let isNewSession = await processSession(cdr)
            if (isNewSession) result.newSessions += 1
            let isNewCdr = await processCDR(cdr.id, cdr.session_id, cdr)
            if (isNewCdr) result.newCdrs += 1
        }
        return result

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { cdrsProcessed: result.cdrsProcessed, newSessions: result.newSessions, newCdrs: result.newCdrs }

    }
}
async function transformCdrJsonModel(cdrJson) {
    const context = "Function transformCdrJsonModel"
    try {
        let tokenUid = await Utils.getUserId(cdrJson.idInternalNumber)
        let chargerResult = await Utils.getChargerWithEVSE(cdrJson.idChargingStation, cdrJson.idEVSE)
        // console.log(JSON.stringify)
        // let splitedId = cdrJson.SubUsage.idSubUsage.split("-")
        // let idSubUsage = splitedId.length > Number(process.env.idSessionElementsLength) ? splitedId.slice(0,splitedId.length - 1).join("-") : cdrJson.SubUsage.idSubUsage

        let address = addressS.parseAddressStreetToString(chargerResult.charger.address)

        return {
            country_code: "PT",
            id: `ftp-${Utils.generateToken(8)}-${Utils.generateToken(8)}`,
            party_id: cdrJson.idNetworkOperator,
            last_updated: new Date().toISOString(),
            start_date_time: parseDateMobiE(cdrJson.startTimestamp),
            end_date_time: parseDateMobiE(cdrJson.stopTimestamp),
            session_id: cdrJson.idUsage, //Turns out the session id key was cdrJson.idUsage and NOT cdrJson.SubUsage.idSubUsage
            cdr_token: {
                uid: cdrJson.idInternalNumber,
                type: tokenUid ? tokenUid.type : "UNKNOWN",
                contract_id: cdrJson.idExternalNumber
            },
            auth_method: "WHITELIST",
            cdr_location: !chargerResult ? {} : {
                id: chargerResult.charger.hwId,
                address: address,
                city: chargerResult.charger.address.city,
                country: chargerResult.charger.country ? chargerResult.charger.country : "PRT",
                coordinates: {
                    latitude: chargerResult.charger.geometry.coordinates[1],
                    longitude: chargerResult.charger.geometry.coordinates[0]
                },
                postal_code: chargerResult.charger.address.zipCode,
                evse_uid: chargerResult.plug.uid,
                evse_id: chargerResult.plug.evse_id,
                connector_id: chargerResult.plug.plugId,
                connector_standard: chargerResult.plug.connectorType,
                connector_format: chargerResult.plug.connectorFormat,
                connector_power_type: chargerResult.plug.connectorPowerType,
            },
            currency: "EUR",
            total_cost: {
                excl_vat: cdrJson.SubUsage.map(obj => obj.preco_opc).reduce((a, b) => a + b, 0)
            },
            total_energy: cdrJson.energia_total_transacao,
            total_time: cdrJson.totalDuration / 60,
            total_time_cost: {
                excl_vat: cdrJson.SubUsage.map(obj => obj.preco_opc_tempo).reduce((a, b) => a + b, 0)
            },
            mobie_cdr_extension: {
                usage: {
                    idUsage: cdrJson.idUsage,
                    idContract: cdrJson.idContract,
                    idServiceProvider: cdrJson.idServiceProvider,
                    idExternalNumber: cdrJson.idExternalNumber,
                    idInternalNumber: cdrJson.idInternalNumber,
                    type: tokenUid?.type || "UNKNOWN",
                    idNetworkOperator: cdrJson.idNetworkOperator,
                    idChargingStation: cdrJson.idChargingStation,
                    idEVSE: cdrJson.idEVSE,
                    startTimestamp: cdrJson.startTimestamp,
                    stopTimestamp: cdrJson.stopTimestamp,
                    totalDuration: cdrJson.totalDuration,
                    energia_total_transacao: cdrJson.energia_total_transacao,
                    opcao_horaria_ciclo: cdrJson.opcao_horaria_ciclo,
                    apoio_mobilidade_eletrica_ceme: (cdrJson.apoio_mobilidade_eletrica_ceme !== null && cdrJson.apoio_mobilidade_eletrica_ceme !== undefined) ? cdrJson.apoio_mobilidade_eletrica_ceme : 0,
                    evse_max_power: (cdrJson.evse_max_power !== null && cdrJson.evse_max_power !== undefined) ? cdrJson.evse_max_power : 0,
                    renewables_100: cdrJson.renewables_100
                },
                subUsages: cdrJson.SubUsage
            }
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function parseDateMobiE(dateString) {
    /*
        The date provided in the string is not in UTC as all dates are in cdrs.
        Is actually just a string with appended numbers of date...
        We need to transform it in UTC, assuming all of them are made in continental Portugal
    */
    let year = dateString.slice(0, 4)
    let month = dateString.slice(4, 6)
    let day = dateString.slice(6, 8)
    let hour = dateString.slice(8, 10)
    let minute = dateString.slice(10, 12)
    let second = dateString.slice(12, 14)

    let offset = timeZoneMoment.tz("Europe/Lisbon")._offset
    return moment.utc(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).add(-offset, "minutes").format()
}

function removeArraysOfKeysFromObj(cdr) {
    const context = "Function removeArraysOfKeysFromObj"
    try {
        let regExp = /[a-zA-Z]/g
        if (!Array.isArray(cdr)) {
            Object.keys(cdr).forEach(key => {
                cdr[key] = !regExp.test(cdr[key][0]) && key !== "idDay" && key !== "idInternalNumber" && !key.includes("Timestamp") ? Number(cdr[key][0]) : (key !== "SubUsage" ? cdr[key][0] : cdr[key])
            })
            return cdr
        } else {
            let subUsages = cdr.map(subUsageI => {
                Object.keys(subUsageI).forEach(key => {
                    subUsageI[key] = !regExp.test(subUsageI[key][0]) && key !== "idDay" && key !== "idInternalNumber" && !key.includes("Timestamp") ? Number(subUsageI[key][0]) : (key !== "SubUsage" ? subUsageI[key][0] : subUsageI[key])
                })
                return subUsageI
            })
            return subUsages
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function fixCdrArrayKeys(cdrJson) {
    const context = "Function fixCdrArrayKeys"
    try {
        let cdr = removeArraysOfKeysFromObj(cdrJson)
        cdr.SubUsage = removeArraysOfKeysFromObj(cdr.SubUsage)
        return cdr
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

async function processSession(cdr) {
    const context = "Function processSession"

    return new Promise(async (resolve, reject) => {
        try {
            let query = {
                id: cdr.session_id
            }

            Utils.chargingSessionFindOne(query).then(async (session) => {

                if (Utils.isEmptyObject(session)) {
                    let sessionModel = buildSessionModel(cdr)
                    var new_session = await setSession(sessionModel);
                    new_session.createdWay = "SFTP_SESSION"
                    // console.log("new_session", new_session);
                    Session.create(new_session, (err, result) => {
                        if (result) {
                            console.log("Session created - " + cdr.session_id)
                            resolve(true);
                        } else {
                            console.log("Session not created ", err);
                            resolve(false);
                        }
                    })
                }
                else {
                    console.log(`[${context}] Charging session ${cdr.session_id} already exists`)
                    resolve(false)
                }
            });
        }
        catch (e) {
            console.log("[cdrsJob.processSession] Generic client error. ", e);
            resolve(false);
        }
    });
}

function buildSessionModel(cdr) {
    return {
        id: cdr.session_id,
        status: global.SessionStatusStopped,
        country_code: cdr.country_code,
        party_id: cdr.party_id,
        last_updated: new Date().toISOString(),
        start_date_time: cdr.start_date_time,
        end_date_time: cdr.end_date_time,
        kwh: cdr.total_energy,
        cdr_token: cdr.cdr_token,
        token_uid: cdr.cdr_token.uid,
        token_type: cdr.cdr_token.type,
        auth_method: cdr.auth_method,
        location_id: cdr.cdr_location.id,
        evse_uid: cdr.cdr_location.evse_uid,
        connector_id: cdr.cdr_location.connector_id,
        currency: cdr.currency
    }
}

async function setSession(data) {
    return new Promise(async (resolve, reject) => {
        let idTag = "";
        if (data.cdr_token !== undefined && data.cdr_token !== null) {
            idTag = data.cdr_token.uid;
            data.token_uid = idTag
        } else {
            idTag = data.token_uid;
        }

        const tokenUid = await Utils.getUserId(idTag);
        const result = await Utils.getCharger(data.location_id, data.connector_id);

        let evOwner = "-1";
        let evId = "-1";
        let invoiceType = "-1"
        let invoiceCommunication = "-1"
        let evDetails,fleetDetails
        let userId = "Unknown"

        if (tokenUid) {
            //evOwner = tokenUid.evId != "-1" ? await Utils.getEVByEvId(tokenUid.evId) : "-1"
            evId = tokenUid.evId;
            userId = tokenUid.userId
            if (tokenUid.evId != "-1") {
                const evInfo = await Utils.getEvInfo(evId, userId)
                evOwner = evInfo?.evOwner;
                invoiceType = evInfo?.invoiceType;
                invoiceCommunication = evInfo?.invoiceCommunication;
                evDetails = evInfo?.evDetails;
                fleetDetails = evInfo?.fleetDetails;
                userId = evInfo?.userId;
            }
        }

        const fees = { IEC: 0.001, IVA: 0.23 }
        const voltageLevel = "BTN";
        let address = ""
        let cpoCountryCode = ""
        let geometry = {}
        let timeZone = ""
        const plug = result?.plug;
        if (result) {
            fees = await vatService.getFees(result.charger)
            voltageLevel = result.charger.voltageLevel;
            address = result.charger.address
            cpoCountryCode = result.charger.cpoCountryCode
            geometry = result.charger.geometry
            timeZone = result.charger.timeZone
            if (!timeZone) {
                let { latitude, longitude } = Utils.getChargerLatitudeLongitude(geometry)
                timeZone = Utils.getTimezone(latitude, longitude)
            }
        }
        else
            fees = { IEC: 0.001, IVA: 0.23 }

        let plugId = "";
        let tariffId;
        let plugPower = 22
        let plugVoltage = 400
        if (plug) {
            tariffId = plug.tariffId[0];
            plugId = plug.plugId;
            plugPower = plug.power
            plugVoltage = plug.voltage
        }

        const tariffOPC = await TariffsService.getOcpiCpoTariff(
            result?.charger,
            plug?.serviceCost?.tariffs,
            '',
            result?.charger?.geometry?.coordinates?.[1],
            result?.charger?.geometry?.coordinates?.[0],
            plug?.power,
            userId,
            evOwner
        ) ?? await Utils.getDefaultOPCTariff();
        // var tariffCEME = await Utils.getTariffCEME("EVIO");

        const new_session = new Session(data);
        new_session.source = "MobiE";
        new_session.evId = evId;
        if (invoiceType != "-1")
            new_session.invoiceType = invoiceType
        if (invoiceCommunication != "-1")
            new_session.invoiceCommunication = invoiceCommunication
        new_session.evOwner = evOwner
        new_session.evDetails = evDetails
        new_session.fleetDetails = fleetDetails
        new_session.userId = userId
        new_session.tariffOPC = tariffOPC;
        new_session.chargerType = process.env.chargerTypeMobie
        // new_session.tariffCEME = tariffCEME;
        new_session.voltageLevel = voltageLevel;
        new_session.address = address;
        new_session.cpoCountryCode = cpoCountryCode;
        new_session.fees = fees;
        new_session.cdrId = "-1"
        new_session.plugPower = plugPower
        new_session.plugVoltage = plugVoltage
        if (data.authorization_reference === null || typeof data.authorization_reference === 'undefined') {
            const authorization_reference = Utils.generateToken(24);
            new_session.authorization_reference = authorization_reference;
        }
        // new_session.authorization_reference = authorization_reference;

        //Get Conditions Payment
        const paymentConditionsInit = {
            paymentType: "AD_HOC",
            paymentMethod: "Unknown",
            paymentMethodId: "-1",
            walletAmount: -1,
            reservedAmount: -1,
            confirmationAmount: -1,
            userIdWillPay: "Unknown",
            userIdToBilling: "Unknown",
            adyenReference: "-1",
            transactionId: "-1",
            clientType: "b2b",
            clientName: "EVIO"
        };

        const paymentConditions = {};

        let userIdWillPay = ""
        let userIdToBilling = ""

        if (tokenUid) {
            const idTagToPaymentCondition = await Utils.verifyFlagIsActiveToSendIdTagToPaymentConditions(idTag)
            paymentConditions = await Utils.getPaymentConditions(new_session.userId, evId, data.location_id, plugId, process.env.chargerTypeMobie, fees, idTagToPaymentCondition).catch((e) => {
                console.log("Get payment conditions failed. Reason ", e)
                new_session.notes = "Get payment conditions failed - " + JSON.stringify(e.message)
                userIdWillPay = e.userIdWillPay ? e.userIdWillPay : ""
                userIdToBilling = e.userIdToBilling ? e.userIdToBilling : ""
            });

            if (!paymentConditions) {

                if (userIdWillPay && userIdToBilling) {
                    paymentConditionsInit.userIdWillPay = userIdWillPay;
                    paymentConditionsInit.userIdToBilling = userIdToBilling;
                } else {
                    let evValidation = await Utils.validateEV(evId, new_session.userId, new_session.evDetails)
                    if (evValidation.userIdWillPay && evValidation.userIdToBilling) {
                        paymentConditionsInit.userIdWillPay = evValidation.userIdWillPay
                        paymentConditionsInit.userIdToBilling = evValidation.userIdToBilling
                    } else {
                        paymentConditionsInit.userIdWillPay = new_session.userId;
                        paymentConditionsInit.userIdToBilling = new_session.userId;
                    }

                }
                let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await getAllUserInfo({userId, userIdWillPay: paymentConditionsInit.userIdWillPay, userIdToBilling: paymentConditionsInit.userIdToBilling})
                new_session.userIdInfo = userIdInfo
                new_session.userIdWillPayInfo = userIdWillPayInfo
                new_session.userIdToBillingInfo = userIdToBillingInfo
                // let userInfo = await Utils.getUserInfo(paymentConditionsInit.userIdWillPay)
                if (userIdWillPayInfo) {
                    paymentConditionsInit.clientType = userIdWillPayInfo?.clientType
                    paymentConditionsInit.clientName = userIdWillPayInfo?.clientName
                    paymentConditionsInit.paymentType = userIdWillPayInfo?.paymentPeriod ?? "AD_HOC"
                }
                paymentConditions = paymentConditionsInit;
            } else {
                let {userIdInfo ,userIdWillPayInfo , userIdToBillingInfo} = await getAllUserInfo({userId, userIdWillPay: paymentConditions.userIdWillPay, userIdToBilling: paymentConditions.userIdToBilling})
                new_session.userIdInfo = userIdInfo
                new_session.userIdWillPayInfo = userIdWillPayInfo
                new_session.userIdToBillingInfo = userIdToBillingInfo
            }
        }
        else {
            paymentConditions = paymentConditionsInit;
            new_session.userId = "Unknown";
        }

        new_session.operator = data.party_id;
        new_session.chargeOwnerId = data.party_id;

        //Check if payment will be done at the end of charging session or end of the month. if user is b2c, he MUST to pay at the end of session, if user is b2b ,monthly.
        if (paymentConditions.clientType) {
            new_session.paymentType = paymentConditions.paymentType;
        }
        else {
            new_session.paymentType = paymentConditionsInit.paymentType;
        }

        if (paymentConditions.clientName) {
            new_session.clientName = paymentConditions.clientName;
        } else {
            new_session.clientName = paymentConditionsInit.clientName;
        }

        if (paymentConditions.cardNumber) {
            new_session.cardNumber = paymentConditions.cardNumber;
        }

        // Check if tariffCEME is sent
        /*
            When charging in MobiE, paymentConditions.ceme is an object with the keys plan,schedule and tar
        */
        let tariffCEME = ""
        if (paymentConditions.ceme) {
            if (!Utils.isEmptyObject(paymentConditions.ceme.plan)) {
                // new_session.tariffCEME = paymentConditions.ceme.plan
                tariffCEME = paymentConditions.ceme.plan
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
                tariffCEME.tariff = tariffArray
                new_session.tariffCEME = tariffCEME
            } else {
                // new_session.tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Mobie);
                if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
                let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
                tariffCEME.tariff = tariffArray
                new_session.tariffCEME = tariffCEME
            }
        } else {
            //Default value for now
            tariffCEME = await getEmspTariffWithIdTag(tokenUid?.uid, Enums.ChargerNetworks.Mobie);
            if (!tariffCEME) tariffCEME = await Utils.getTariffCEME(new_session.clientName);
            let tariffArray = Utils.getTariffCemeByDate(tariffCEME, data.start_date_time)
            tariffCEME.tariff = tariffArray
            new_session.tariffCEME = tariffCEME
        }

        // GET TAR AND SCHEDULES
        let { tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(tariffCEME._id, timeZone, "MobiE", new_session.clientName)

        new_session.schedulesCEME = TAR_Schedule
        new_session.tariffTAR = tariffTAR
        new_session.timeZone = timeZone

        if (paymentConditions.billingPeriod) {
            new_session.billingPeriod = paymentConditions.billingPeriod;
        } else {
            new_session.billingPeriod = new_session?.userIdToBillingInfo?.billingPeriod
        }

        new_session.paymentMethod = paymentConditions.paymentMethod;
        new_session.paymentMethodId = paymentConditions.paymentMethodId;
        new_session.walletAmount = paymentConditions.walletAmount;
        new_session.reservedAmount = paymentConditions.reservedAmount;
        new_session.confirmationAmount = paymentConditions.confirmationAmount;
        new_session.plafondId = paymentConditions.plafondId;

        new_session.viesVAT = paymentConditions.viesVAT

        if (paymentConditions.userIdWillPay)
            new_session.userIdWillPay = paymentConditions.userIdWillPay;
        else
            new_session.userIdWillPay = paymentConditionsInit.userIdWillPay;

        if (paymentConditions.userIdToBilling)
            new_session.userIdToBilling = paymentConditions.userIdToBilling;
        else
            new_session.userIdToBilling = paymentConditionsInit.userIdToBilling;


        new_session.adyenReference = paymentConditions.adyenReference;
        new_session.transactionId = paymentConditions.transactionId;
        new_session.paymentStatus = "UNPAID"
        
        if (evDetails) {
            if (evDetails.acceptKMs) new_session.acceptKMs = evDetails.acceptKMs
            if (evDetails.updateKMs) new_session.updateKMs = evDetails.updateKMs
        }

        if (result) 
            new_session.fees = await vatService.getFees(result.charger, new_session.userIdToBilling)
        resolve(new_session);

    });
}

router.post('/startCronJob', async (req, res) => {
    try {
        console.log("\nOCPI - 2.2 - CDRs Job Started from EKS\n")

        const platform = await versions.getPlatformVersionsByPlatformCode(global.mobiePlatformCode)
        //get Mobie Details
        const platformDetails = platform.platformDetails;

        //Get Mobie Endpoint to 2.2 OCPI versions
        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
        const platformEndpoints22 = platformDetails22[0].endpoints
        const platformCDRsEndpointObject = _.where(platformEndpoints22, { identifier: "cdrs", role: "SENDER" });

        if (platformCDRsEndpointObject === undefined || platformCDRsEndpointObject.length == 0) {
            return res.status(400).send({ code: 'cdrs_update_error', message: "Platform does not allow cdrs module" });
        }
        platformCDRsEndpoint = platformCDRsEndpointObject[0].url;

        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
        mobieToken = platformActiveCredentials[0].token;

        console.log("CDRs Job Init");
        console.log(platform.cdrsScheduleTimeCronJob);

        console.log('Running CDRs Job ' + new Date().toISOString());

        let date = new Date();
        //Fetching the last 6 hours by default
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
