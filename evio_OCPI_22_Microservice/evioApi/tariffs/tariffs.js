const Tariff = require('../../models/tariffs')
const DefaultTariffs = require('../../models/defaultTariffs')
const Utils = require('../../utils')
const axios = require('axios');
const global = require('../../global');
const mobieScheduleTime = require('../../models/schedulesCEME.json')
const moment = require('moment');
const vatService = require('../../services/vat')
const { TariffsService } = require("evio-library-ocpi");
const toggle = require('evio-toggle').default

module.exports = {
    OPCtariffs: function (req, res) {
        return new Promise(async (resolve, reject) => {
            let context = "GET /api/private/tariffs/OPCtariffs";
            try {
                const tariffId = req.query.tariffId

                let query = {
                    id: tariffId
                }

                Tariff.findOne(query, async (err, foundTariff) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {
                        if (foundTariff) {
                            let opcTariff = Utils.tariffResponseBody(foundTariff)
                            resolve(opcTariff);
                        } else {
                            if (tariffId) {
                                let foundDefaultTariff = await DefaultTariffs.findOne({ id: tariffId })
                                if (foundDefaultTariff) {
                                    let opcTariff = Utils.tariffResponseBody(foundDefaultTariff)
                                    resolve(opcTariff);
                                } else {
                                    resolve([])
                                }
                            } else {
                                resolve([])
                            }
                        }

                    };
                });
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        })
    },
    opcTariffsPrices: async function (req, res) {
        return new Promise(async (resolve, reject) => {
            let context = "POST /api/private/tariffs/opcTariffsPrices";
            console.log(`[${context}] Request `, req.body);
            try {
                let data = req.body;
                let userId = req.headers['userid'] ?? data.userId;
                data.clientName ??= req.headers['clientname']

                const platforms = {
                    [process.env.MobiePlatformCode]: {
                        validate: validateMobieFields,
                        calculate: calculateMobieOpcTariffs,
                        wallet: userId ? await Utils.walletFindOne(userId) : null
                    },
                    [process.env.GirevePlatformCode]: {
                        validate: validateGireveFields,
                        calculate: calculateRoamingOpcTariffs
                    },
                    [process.env.HubjectNetwork]: {
                        validate: validateGireveFields,
                        calculate: calculateRoamingOpcTariffs
                    },
                    [process.env.EvioNetwork]: {
                        validate: validateEVIOFields,
                        calculate: calculateEvioPrices
                    },
                    [process.env.TeslaNetwork]: {
                        validate: validateTeslaFields,
                        calculate: calculateTeslaPrices
                    },
                    'default': {
                        validate: validateEVIOFields,
                        calculate: calculateEvioPrices
                    }
                };

                const platform = platforms[data.source] || platforms['default'];

                if (platform.validate(data)) reject(platform.validate(data))

                try {
                    const result = await platform.calculate(data, platform.wallet);
                    console.log(`[${context}] Response `, result);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        })
    },
    priceSimulation: async function (req) {
        let context = "POST /api/private/tariffs/priceSimulation";
        try {
            let {
                contract,
                timeCharger,
                sessionStartDate,
                sessionStopDate,
                capTotalBateriaEV,
                capCarregamentoEV,
                capCarregamentoInternaEV,
                priceRange,
                coordinates,
                chargers
            } = req.body;

            const newChargers = [];

            chargers = chargers.filter(charger => charger.chargerType !== process.env.TeslaCharger);

            let walletFound = contract.userId ? await Utils.walletFindOne(contract.userId) : null
            for (let charger of chargers) {
                if (charger.plugs.length > 0) {
                    charger = JSON.parse(JSON.stringify(charger));
                    charger.distance = getDistance(coordinates, charger.geometry.coordinates);
                    let address = charger.address;
                    let fees = await vatService.getFees({ address });

                    for (let plug of charger.plugs) {
                        let dateNow = new Date();
                        let timeZone = Utils.getTimezone(charger.geometry.coordinates[1], charger.geometry.coordinates[0]);
                        let statusChangeDate = plug.statusChangeDate ? new Date(plug.statusChangeDate) : new Date(charger.updatedAt);
                        plug.statusTime = ((dateNow.getTime() - statusChangeDate.getTime()) / 60000);

                        if (plug.power === undefined) {
                            continue;
                        }

                        let value1 = Math.min(plug.power, capCarregamentoEV, capTotalBateriaEV);
                        let value2 = Math.min(timeCharger, (capTotalBateriaEV / (plug.power >= capCarregamentoEV ? capCarregamentoEV : plug.power)) * 60) / 60;
                        if (!["CCS 1", "CCS 2", "CHAdeMO", "CHADEMO"].includes(plug.connectorType.toUpperCase())) {
                            value1 = Math.min(plug.power, capCarregamentoInternaEV, capTotalBateriaEV);
                        }
                        let consumo = Utils.round(value1 * value2, 0);
                        let roamingPlanId = contract["tariffRoaming"] ? contract["tariffRoaming"].planId : "";
                        let planId = contract["tariff"] ? contract["tariff"].planId : "";

                        let data, value;
                        switch (charger.chargerType) {
                            case process.env.MobieCharger:
                                data = { elements: plug.serviceCost.elements, planId, sessionStartDate, sessionStopDate, power: plug.power, voltageLevel: charger.voltageLevel, total_energy: consumo, total_charging_time: Utils.round(timeCharger / 60, 6), total_parking_time: 0, countryCode: charger.countryCode, source: charger.source, latitude: charger.geometry.coordinates[1], longitude: charger.geometry.coordinates[0], address: charger.address, timeZone };
                                value = await calculateMobieOpcTariffsPriceSimulation(data, walletFound);
                                break;
                            case process.env.TeslaCharger:
                            case process.env.OCMCharger:
                                data = { total_charging_time: Utils.round(timeCharger / 60, 6), address: charger.address, power: plug.power };
                                value = await calculateTeslaPricesPriceSimulation(data);
                                break;
                            case process.env.GireveCharger:
                            case process.env.HubjectNetwork:
                                data = { roamingPlanId, sessionStartDate, sessionStopDate, power: plug.power, voltageLevel: charger.voltageLevel, total_energy: consumo, total_charging_time: Utils.round(timeCharger / 60, 6), total_parking_time: 0, countryCode: charger.countryCode, source: charger.source, latitude: charger.geometry.coordinates[1], longitude: charger.geometry.coordinates[0], evseGroup: plug.evseGroup, elements: plug.serviceCost ? plug.serviceCost.elements : null, currency: plug.serviceCost ? plug.serviceCost.currency : null, timeZone };
                                value = await calculateRoamingOpcTariffsPriceSimulation(data);
                                break;
                            default:
                                let tariff = getEvioTariff(charger, plug, contract.fleetId, contract.userId);
                                if (tariff) {
                                    let { total } = getPriceEVIO(tariff, Utils.round(timeCharger / 60, 6), consumo, fees);
                                    value = { total };
                                } else {
                                    continue;
                                }
                                break;
                        }

                        plug.price = value.total;
                        if (priceRange ? (plug.price / timeCharger <= priceRange.max) : true) {
                            charger.plugs.sort((a, b) => (a.price > b.price) ? 1 : ((b.price > a.price) ? -1 : 0));
                            newChargers.push(charger);
                        }
                    }
                }
            }
            return newChargers;
        } catch (error) {
            console.log(`[${context}] Error `, error);
            throw error;
        }
    },
    chargerTariffs: function (req, res) {
        return new Promise((resolve, reject) => {
            let context = "GET /api/private/tariffs/chargerTariffs";

            try {

                let data = req.body
                if (Utils.isEmptyObject(data))
                    reject({ auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' });

                let chargers = req.body.chargers;
                if (chargers.length > 0) {
                    Promise.all(
                        chargers.map(chargerInfo => {
                            return new Promise(async (resolve, reject) => {
                                let query = {
                                    hwId: chargerInfo.hwId,
                                    source: chargerInfo.source,
                                }
                                if (chargerInfo.plugs[0].id !== null && chargerInfo.plugs[0].id !== undefined) {
                                    for (let plug of chargerInfo.plugs) {
                                        await updateOrCreateChargerTariff(query, plug.id, plug.tariffId)
                                    }
                                    resolve()
                                } else {
                                    let chargerPlugs = await getChargerPlugs(chargerInfo.hwId)
                                    let tariffId = chargerInfo.plugs[0].tariffId
                                    for (let plug of chargerPlugs) {
                                        await updateOrCreateChargerTariff(query, plug.plugId, tariffId)
                                    }
                                    resolve()
                                }
                            })
                        })
                    ).then((chargerTariffs) => {
                        resolve("ChargerTariffs updated with tariffId");

                    }).catch((error) => {
                        console.log(`[${context}] Error `, error.message);
                        reject(error);
                    });
                } else {
                    resolve("No chargers to Update");
                }

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    linkWithEVSE: function (req, res) {
        return new Promise(async (resolve, reject) => {
            let context = "GET /api/private/tariffs/linkWithEVSE";

            try {
                let source = req.query.source ? req.query.source : global.girevePlatformCode

                // Fetch all Locations and all Tariffs from a specific source
                let publicNetworkHost = process.env.HostPublicNetwork + process.env.PathGetPublicNetworkCharger
                let allLocations = await getAllChargers(publicNetworkHost, { source })
                let allTariffs = await Tariff.find({ source }).lean()

                // Get total number of Locations and Tariffs
                let totalNumberLocations = allLocations.length
                let totalNumberTariffs = allTariffs.length

                /*
                    Build an array of objects for each CPO with the following information :

                    - Total number of tariffs and locations
                    - Total number of locations without a tariffId
                    - Total number of locations with tariffId but that tariffId doesn't exist in the Tariffs DB
                    - Total number of tariffs that don't have a link to a specific EVSE
                */
                let cpoArray = []
                allLocations.forEach(async (location) => await checkEvseNullTariffs(location, cpoArray, allTariffs))
                allTariffs.forEach(async (tariff) => await checkTariffsNullEvse(tariff, cpoArray, allLocations))

                /*
                    Get totals in variables of the last 3 points previously noted
                */
                //Locations
                let totalNumberLocationsWithoutTariff = cpoArray.reduce((accumulator, item) => accumulator + item.locations.withoutTariff, 0)
                let totalNumberLocationsWithInexistingTariff = cpoArray.reduce((accumulator, item) => accumulator + item.locations.withInexistingTariff, 0)
                let totalNumberLocationsWithTariff = cpoArray.reduce((accumulator, item) => accumulator + item.locations.existingTariff, 0)

                //Location Connectors
                let totalNumberConnectors = cpoArray.reduce((accumulator, item) => accumulator + item.connectors.total, 0)
                let totalNumberConnectorsWithoutTariff = cpoArray.reduce((accumulator, item) => accumulator + item.connectors.withoutTariff, 0)
                let totalNumberConnectorsWithInexistingTariff = cpoArray.reduce((accumulator, item) => accumulator + item.connectors.withInexistingTariff, 0)
                let totalNumberConnectorsWithTariff = cpoArray.reduce((accumulator, item) => accumulator + item.connectors.existingTariff, 0)

                //Tariffs
                let totalNumberTariffsWithoutEvse = cpoArray.reduce((accumulator, item) => accumulator + item.tariffs.withoutEVSE, 0)
                let totalNumberTariffsWithEvse = cpoArray.reduce((accumulator, item) => accumulator + item.tariffs.withEVSE, 0)
                cpoArray = cpoArray.sort((a, b) => b.locations.total - a.locations.total)
                resolve({
                    locations: {
                        "total": totalNumberLocations,
                        "without_tariffId": totalNumberLocationsWithoutTariff,
                        "with_tariffId_but_inexisting_on_tariffs": totalNumberLocationsWithInexistingTariff,
                        "with_tariffId_and_existing_on_tariffs": totalNumberLocationsWithTariff,
                    },
                    connectors: {
                        "total": totalNumberConnectors,
                        "without_tariffId": totalNumberConnectorsWithoutTariff,
                        "with_tariffId_but_inexisting_on_tariffs": totalNumberConnectorsWithInexistingTariff,
                        "with_tariffId_and_existing_on_tariffs": totalNumberConnectorsWithTariff
                    },
                    tariffs: {
                        "total": totalNumberTariffs,
                        "does_not_exist_on_an_evse": totalNumberTariffsWithoutEvse,
                        "exists_on_an_evse": totalNumberTariffsWithEvse,
                    },
                    cpoArray,
                })
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    detailedTariffs: function (req, res) {
        return new Promise(async (resolve, reject) => {
            let context = "GET /api/private/tariffs/detailedTariffs";
            try {
                let data = req.body
                if (data.source === process.env.MobiePlatformCode) {
                    // ======= Detailed tariffs for MobiE ======= //

                    // Validate mandatory fields for MobiE
                    if (validateDetailedTariffsMobiE(data)) reject(validateDetailedTariffsMobiE(data))

                    detailedTariffsMobiE(data, resolve, reject)

                } else if (data.source === process.env.GirevePlatformCode || data.source === process.env.HubjectPlatformCode) {
                    // ======= Detailed tariffs for Gireve and Hubject ======= //

                    // Validate mandatory fields for Gireve
                    if (validateDetailedTariffsRoaming(data)) reject(validateDetailedTariffsRoaming(data))

                    // Calculate
                    detailedTariffsRoaming(data, resolve, reject)
                } else if (data.source === process.env.EvioNetwork) {
                    // ======= Detailed tariffs for EVIO ======= //

                    // Validate mandatory fields for EVIO
                    if (validateDetailedTariffsEvio(data)) reject(validateDetailedTariffsEvio(data))

                    // Calculate
                    detailedTariffsEvio(data, resolve, reject)
                } else {
                    // ======= Detailed tariffs for EVIO ======= //

                    // Validate mandatory fields for EVIO
                    if (validateDetailedTariffsEvio(data)) reject(validateDetailedTariffsEvio(data))

                    // Calculate
                    detailedTariffsEvio(data, resolve, reject)
                }

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                resolve({ cpo: {}, ceme: {}, fees: {}, tariffType: "", detail: {} })
            };

        })
    },
    createDefaultOpcTariffs: function (req, res) {
        return new Promise(async (resolve, reject) => {
            let context = "POST /api/private/tariffs/defaultOpcTariffs";

            try {
                const newDefaultOpcTariff = new DefaultTariffs(req.body);
                let response = await newDefaultOpcTariff.save()
                resolve(response)
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
}

function getRoamingPlanTariff(params) {
    var context = "Function getRoamingPlanTariff";
    return new Promise((resolve, reject) => {
        try {
            var serviceProxy = process.env.HostPublicTariffs + process.env.PathGetRoamingPlanTariff;

            axios.get(serviceProxy, { params })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                    resolve({});
                });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            resolve({});
        };
    });
};

function getChargerPlugs(hwId) {
    return new Promise(async (resolve, reject) => {
        var chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
        axios.get(chargersEndpoint, {}, {}).then(function (response) {

            if (typeof response.data !== 'undefined' && response.data !== '') {

                var charger = response.data;
                //console.log(charger);
                var plugs = charger.plugs;

                resolve(plugs);

            }
            else {
                console.log("Charger not found " + hwId)
                resolve([]);
            }

        }).catch(function (e) {
            console.log("[Tariffs api getCharger - Charger not found " + hwId + ". Error: " + e.message)
            resolve([]);
        });
    });
}

function updateOrCreateChargerTariff(query, plugId, tariffId) {
    return new Promise(async (resolve, reject) => {
        query.plugId = plugId
        ChargerTariffs.updateChargerTariff(query, { $set: { tariffId: tariffId } }, (err, doc) => {
            if (doc != null) {
                console.log("Updated chargerTariff")
                resolve(doc)
            } else {
                query.tariffId = tariffId
                let newChargerTariff = new ChargerTariffs(query)
                ChargerTariffs.create(newChargerTariff, (err, result) => {
                    if (result) {
                        console.log("Created chargerTariff")
                        resolve(result)
                    } else {
                        console.log(err);
                        resolve(err)
                    }
                })
            }
        })
    })
}

function getTariffCEMEbyPlan(planId, source, clientName = "EVIO") {
    var context = "Function getTariffCEMEbyPlan";
    return new Promise(async (resolve, reject) => {

        if (planId) {
            let params = {
                _id: planId
            };

            getTariffCEME(params)
                .then((result) => {

                    resolve(result);

                })
                .catch((error) => {

                    console.log(`[${context}][.catch] Error `, error.message);
                    resolve({});

                });
        } else {
            let params = {
                CEME: `EVIO ${source}`
            };
            if (source === process.env.MobiePlatformCode) {
                params = {
                    planName: `server_plan_${clientName}`
                };
            }

            getTariffCEMEbyName(params)
                .then((result) => {

                    resolve(result);

                })
                .catch((error) => {

                    console.log(`[${context}][.catch] Error `, error.message);
                    resolve({});

                });
        }

    });
};

function getTariffCEME(params) {
    var context = "Function getTariffCEME";
    return new Promise((resolve, reject) => {
        var host = process.env.HostTariffCEME + process.env.PathTariffCEME;
        axios.get(host, { params })
            .then((result) => {
                resolve(result.data.plan);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            });
    });
};

function getTariffCEMEbyName(params) {
    var context = "Function getTariffCEME";
    return new Promise((resolve, reject) => {
        var host = process.env.HostTariffCEME + process.env.PathTariffCEMEbyName;
        axios.get(host, { params })
            .then((result) => {
                resolve(result.data[0]);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            });
    });
};

async function checkEvseNullTariffs(location, cpoArray, allTariffs) {
    const context = "Function checkEvseNullTariffs"
    try {
        let partyId = location.partyId
        let plugs = location.plugs
        let nullTariffs = []
        let inexistingTariffs = []

        let equalCpoIndex = cpoArray.findIndex(obj => obj.partyId == partyId)
        if (equalCpoIndex < 0) {
            cpoArray.push({ partyId, locations: { total: 0, withoutTariff: 0, withInexistingTariff: 0, existingTariff: 0, withoutTariffIds: [], withInexistingTariffIds: [] }, connectors: { total: 0, withoutTariff: 0, withInexistingTariff: 0, existingTariff: 0 }, tariffs: { total: 0, withoutEVSE: 0, withEVSE: 0 } });
        }
        let cpoIndex = cpoArray.findIndex(obj => obj.partyId == partyId)

        for (let plug of plugs) {
            let tariffId = plug.tariffId
            if (
                tariffId === null ||
                tariffId === undefined ||
                tariffId[0] === null ||
                tariffId[0] === undefined ||
                tariffId[0] === "TEST-TARIFF" ||
                tariffId[0] === "TIAGO-MENDES"
            ) {
                nullTariffs.push(true)
                cpoArray[cpoIndex].connectors.withoutTariff += 1
            } else {
                let foundTariff = allTariffs.find(tariff => tariff.id === tariffId || tariff.id === tariffId[0])
                if (!foundTariff) {
                    inexistingTariffs.push(true)
                    cpoArray[cpoIndex].connectors.withInexistingTariff += 1
                } else {
                    inexistingTariffs.push(false)
                    cpoArray[cpoIndex].connectors.existingTariff += 1
                }
            }
            cpoArray[cpoIndex].connectors.total += 1

        }
        let hasNullTariffs = nullTariffs.some(elem => elem)
        let hasInexistingTariffs = inexistingTariffs.some(elem => elem)
        let hasExistingTariffs = inexistingTariffs.some(elem => !elem)

        cpoArray[cpoIndex].locations.total += 1

        if (hasNullTariffs) {
            cpoArray[cpoIndex].locations.withoutTariff += 1
            if (!cpoArray[cpoIndex].locations.withoutTariffIds.includes(location.hwId)) {
                cpoArray[cpoIndex].locations.withoutTariffIds.push(location.hwId)
            }
        }
        if (hasInexistingTariffs) {
            cpoArray[cpoIndex].locations.withInexistingTariff += 1
            if (!cpoArray[cpoIndex].locations.withInexistingTariffIds.includes(location.hwId)) {
                cpoArray[cpoIndex].locations.withInexistingTariffIds.push(location.hwId)
            }
        }
        if (hasExistingTariffs) {
            cpoArray[cpoIndex].locations.existingTariff += 1
        }
        return hasNullTariffs
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return false
    }
}

async function checkTariffsNullEvse(tariff, cpoArray, locations) {
    const context = "Function checkTariffsNullEvse"
    try {
        let tariffId = tariff.id
        let partyId = tariff.party_id

        let existsTariff = locations.some(location => location.plugs.some(plug => equalsTariffId(plug, tariffId)))

        let equalCpoIndex = cpoArray.findIndex(obj => obj.partyId == partyId)
        if (equalCpoIndex < 0) {
            cpoArray.push({ partyId, locations: { total: 0, withoutTariff: 0, withInexistingTariff: 0, existingTariff: 0, withoutTariffIds: [], withInexistingTariffIds: [] }, connectors: { total: 0, withoutTariff: 0, withInexistingTariff: 0, existingTariff: 0 }, tariffs: { total: 0, withoutEVSE: 0, withEVSE: 0 } });
        }
        let cpoIndex = cpoArray.findIndex(obj => obj.partyId == partyId)
        cpoArray[cpoIndex].tariffs.total += 1

        if (!existsTariff) {
            cpoArray[cpoIndex].tariffs.withoutEVSE += 1
            return true
        } else {
            cpoArray[cpoIndex].tariffs.withEVSE += 1
            return false
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return false
    }
}

function equalsTariffId(plug, tariffId) {
    try {
        let equalTariffs = false
        if (plug.tariffId === tariffId || plug.tariffId[0] === tariffId) {
            equalTariffs = true
        }
        return equalTariffs
    } catch (error) {
        return false
    }
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
            //resolve([]);
        };
    });
};
async function fetchMobieAsyncData(data) {
    let { planId, timeZone, source, countryCode, address, clientName } = data;

    let [tariffData, fees, foundPlatform] = await Promise.all([
        Utils.getCEMEandTar(planId, timeZone, source),
        vatService.getFees({ countryCode, address }),
        Utils.findOnePlatform({ platformCode: source })
    ]);

    let { tariffCEME, tariffTAR, TAR_Schedule } = tariffData;

    let acpDifference = null;
    if (clientName === process.env.WhiteLabelACP) {
        acpDifference = await getAcpDifference(
            tariffCEME,
            emsp.entries,
            timeZone,
            source,
            offset,
            sessionStartDate,
            sessionStopDate,
            total_charging_time,
            total_energy,
            voltageLevel,
            fees,
            totalPriceCpo,
            total_incl_vat
        );
    }

    return { tariffCEME, tariffTAR, TAR_Schedule, fees, foundPlatform };
}
async function calculateMobieOpcTariffs(data, walletFound) {
    const context = "Function calculateMobieOpcTariffs";

    try {
        let {
            elements = [],
            planId,
            sessionStartDate,
            sessionStopDate,
            offset = 0,
            power,
            voltage,
            total_energy,
            total_charging_time,
            total_parking_time,
            countryCode,
            timeZone,
            source,
            latitude,
            longitude,
            voltageLevel = "BTN",
            address,
            clientName,
            evEfficiency = 171,
            onlyDoAsyncCalculations = false
        } = data;


        if (onlyDoAsyncCalculations) {

            return fetchMobieAsyncData(data);
        }
        const totalKmToUse = 100;

        const evEfficiencyPerKwhPerKm = evEfficiency / 1000; //Change from watts to kW
        if (
            elements.length > 0
        ) {
            elements = Utils.createTariffElementsAccordingToRestriction(
                elements,
                sessionStartDate,
                sessionStopDate
            );
        }

        if (
            (countryCode !== null && countryCode !== undefined) ||
            (latitude !== null &&
                latitude !== undefined &&
                longitude !== null &&
                longitude !== undefined)
        ) {
            offset = Utils.getChargerOffset(
                timeZone,
                countryCode,
                latitude,
                longitude
            );
        }

        voltageLevel = getVoltageLevel(voltageLevel);

        total_charging_time = Utils.round(total_charging_time, 6);
        total_energy = Utils.round(Utils.round(total_energy, 6), 0);

        let [flat, energy, time, parking] = Utils.opcTariffsPrices(
            null,
            elements,
            sessionStartDate,
            sessionStopDate,
            offset,
            power,
            voltage,
            total_energy,
            total_charging_time,
            total_parking_time,
            source
        );
        let [
            OCP_PRICE_FLAT,
            OCP_PRICE_ENERGY,
            OCP_PRICE_TIME,
            OCP_PRICE_PARKING_TIME,
        ] = [flat.price, energy.price, time.price, parking.price];

        let OPC_Price =
            OCP_PRICE_FLAT +
            OCP_PRICE_ENERGY +
            OCP_PRICE_TIME +
            OCP_PRICE_PARKING_TIME;

        let opc = { flat, energy, time, parking, price: OPC_Price };

        timeZone = timeZone ? timeZone : Utils.getTimezone(latitude, longitude);
        let { tariffCEME, tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(
            planId,
            timeZone,
            source
        );

        let localSessionStartDate = moment
            .utc(sessionStartDate)
            .add(offset, "minutes")
            .format();
        let localSessionStopDate = moment
            .utc(sessionStopDate)
            .add(offset, "minutes")
            .format();

        let tariffArray = Utils.getTariffCemeByDate(
            tariffCEME,
            localSessionStartDate
        );
        tariffCEME.tariff = tariffArray;

        let { ceme, tar } = Utils.calculateCemeAndTar(
            TAR_Schedule,
            tariffCEME,
            tariffTAR,
            total_charging_time,
            total_energy,
            localSessionStartDate,
            localSessionStopDate,
            voltageLevel
        );

        let fees = await vatService.getFees({ countryCode, address });
        let iec = { price: fees.IEC * total_energy };

        let activationFee = tariffCEME.activationFeeAdHoc
            ? tariffCEME.activationFeeAdHoc.value > 0
                ? tariffCEME.activationFeeAdHoc.value
                : Number(process.env.AD_HOC_Activation_Fee_Card)
            : Number(process.env.AD_HOC_Activation_Fee_Card);
        let emsp = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
        let cpo = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
        let vat = {
            total: 0,
            totalBykWh: 0,
            percentage: fees.IVA * 100,
            totalByKmh: 0,
        };
        let total = { total: 0, totalBykWh: 0, totalKm:0, totalByTime: 0, totalByKmh: 0 };

        energy.info = adjustCpoEnergyArray(energy.info, total_energy);
        time.info = adjustCpoTimeArray(
            time.info,
            Utils.round(total_charging_time * 3600, 0)
        );
        pushOpcInfo(cpo.entries, flat.info, "cpoFlat");
        pushOpcInfo(cpo.entries, energy.info, "cpoEnergy");
        pushOpcInfo(cpo.entries, time.info, "cpoTime");

        let totalPriceCpo = sumTotal(cpo.entries);
        console.log("totalPriceCpo - ", totalPriceCpo);
        let totalBykWhCpo =
            total_energy > 0 ? Utils.round(totalPriceCpo / total_energy
            ) : 0;

        let totalByKmhCpo =
            total_energy > 0
                ? Utils.round(
                    (totalPriceCpo /
                        (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse

                )
                : 0;
        cpo.total = totalPriceCpo;
        cpo.totalBykWh = totalBykWhCpo;
        cpo.totalByKmh = totalByKmhCpo;
        console.log("cpo - ", cpo);

        let foundPlatform = await Utils.findOnePlatform({
            platformCode: source,
        });


        let mobieDiscount
        let dateNow = new Date();
        if (dateNow < new Date("2024-01-01T00:00:00.000Z"))
            mobieDiscount = foundPlatform
                ? foundPlatform.discount
                    ? foundPlatform.discount
                    : Number(process.env.MobiE_Grant)
                : Number(process.env.MobiE_Grant);
        else if(dateNow < new Date("2025-01-01T00:00:00.000Z"))
            mobieDiscount = foundPlatform ? (foundPlatform.discount ? foundPlatform.discount : Number(process.env.MobiE_GrantNew)) : Number(process.env.MobiE_GrantNew)
        else mobieDiscount = foundPlatform ? (foundPlatform.discount ? foundPlatform.discount : 0) : 0

        mobieDiscount = total_charging_time * 60 >= 2 ? mobieDiscount : 0;
        console.log("mobieDiscount - ", mobieDiscount);
        let activationEntry = {
            label: "activationFee",
            unit: "UN",
            unitPrice: activationFee,
            quantity: 1,
            total: Utils.round(activationFee, 2),
            group: "activation",
            title: defaultTitle("activationFee"),
        };
        let mobieDiscountEntry = {
            label: "mobieDiscount",
            unit: "UN",
            unitPrice: mobieDiscount,
            quantity: 1,
            total: Utils.round(mobieDiscount, 2),
            group: "activation",
            title: defaultTitle("mobieDiscount"),
        };

        let totalActivationWithDiscount = Utils.round(
            activationEntry.total + mobieDiscountEntry.total,
            2
        );
        let totalUnitPriceActivationWithDiscount = Utils.round(
            activationEntry.unitPrice + mobieDiscountEntry.unitPrice,
            4
        );

        let activationWithDiscountEntry = {
            label: "activationFeeWithDiscount",
            unit: "UN",
            unitPrice: totalUnitPriceActivationWithDiscount,
            quantity: 1,
            total: totalActivationWithDiscount,
            title: defaultTitle("activationFeeWithDiscount"),
            collapsable: true,
            collapseGroup: "activation",
        };

        emsp.entries.push(activationWithDiscountEntry);
        emsp.entries.push(activationEntry);
        emsp.entries.push(mobieDiscountEntry);

        let emspEntries = [];
        ceme.info = adjustCemeTarEnergyArray(ceme.info, total_energy);
        tar.info = adjustCemeTarEnergyArray(tar.info, total_energy);
        pushCemeAndTarInfo(emspEntries, ceme.info, "ceme", "energy");
        pushCemeAndTarInfo(emspEntries, tar.info, "tar", "energy");

        let iecEntry = {
            label: "iec",
            unit: "kWh",
            unitPrice: fees.IEC,
            quantity: total_energy,
            total: Utils.round(iec.price),
            group: "energy",
            title: defaultTitle("iec"),
        };
        emspEntries.push(iecEntry);

        if (clientName === process.env.WhiteLabelSC) {
            var unroundedValue = await getUnroundedValue(emspEntries);

            console.log("unroundedValue - ", unroundedValue);

            unroundedValue = unroundedValue / total_energy;

            console.log("unroundedValue 2- ", unroundedValue);

        }
        let groupEnergyTotal = sumTotal(
            emspEntries.filter((elem) => elem.group === "energy")
        );
        let groupEnergyUnitPrice =
            total_energy > 0
                ? clientName === process.env.WhiteLabelSC
                    ? Utils.round(unroundedValue, 4)
                    : Utils.round(groupEnergyTotal / total_energy, 2)
                : 0;
        let energyEntry = {
            label: "cemeTarIec",
            unit: "kWh",
            unitPrice: groupEnergyUnitPrice,
            quantity: total_energy,
            total: groupEnergyTotal,
            title: defaultTitle("cemeTarIec"),
            collapsable: true,
            collapseGroup: "energy",
        };
        emsp.entries.push(energyEntry);
        emsp.entries.push(...emspEntries);

        let totalPriceEmsp = sumTotal(
            emsp.entries.filter((elem) => elem.collapsable)
        );
        let totalBykWhEmsp =
            total_energy > 0 ? Utils.round(totalPriceEmsp / total_energy) : 0;
        let totalByKmhEmsp =
            total_energy > 0
                ? Utils.round(
                    (totalPriceEmsp /
                        (total_energy / (evEfficiencyPerKwhPerKm)) * totalKmToUse)

                )
                : 0;
        emsp.total = totalPriceEmsp;
        emsp.totalBykWh = totalBykWhEmsp;
        emsp.totalByKmh = totalByKmhEmsp;

        let totalUnitPriceVat = Utils.round(totalPriceEmsp + totalPriceCpo);
        let totalPriceVat = Utils.round(totalUnitPriceVat * fees.IVA);

        vat.total = totalPriceVat;
        vat.totalBykWh =
            total_energy > 0 ? Utils.round(totalPriceVat / total_energy) : 0;
        vat.totalByKmh =
            total_energy > 0
                ? Utils.round(
                    (totalPriceVat /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        let totalPrice = Utils.round(
            totalPriceEmsp + totalPriceCpo + totalPriceVat
        );
        let totalPriceBykWh =
            total_energy > 0 ? Utils.round(totalPrice / total_energy) : 0;
        let totalPriceByKmh =
            total_energy > 0
                ? Utils.round(
                    (totalPrice /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;
        let totalKmGivenEnergy =
            total_energy > 0
                ? Utils.round(
                    (total_energy / evEfficiencyPerKwhPerKm)
                )
                : 0;
        total.total = totalPrice;
        total.totalBykWh = totalPriceBykWh;
        total.totalByTime =
            total_charging_time > 0
                ? Utils.round(totalPrice / (total_charging_time * 60))
                : 0;
        total.totalByKmh = totalPriceByKmh;
        total.totalKm = totalKmGivenEnergy;
        total.totalEnergy = total_energy;

        let { opcPrice, cemePrice, feesPrice, total_incl_vat } = getFinalValues(
            totalPriceCpo,
            emsp,
            fees
        );

        if (walletFound) {
            console.log("walletFound - ", walletFound);
            let walletAmount = walletFound.amount.value;
            if (walletAmount >= total_incl_vat + 1) {
                activationFee = tariffCEME.activationFee
                    ? tariffCEME.activationFee.value > 0
                        ? tariffCEME.activationFee.value
                        : Number(process.env.AD_HOC_Activation_Fee_Wallet)
                    : Number(process.env.AD_HOC_Activation_Fee_Wallet);

                const activationEntryIndex = emsp.entries.findIndex(
                    (object) => object.label === "activationFee"
                );
                const activationWithDiscountEntryIndex = emsp.entries.findIndex(
                    (object) => object.label === "activationFeeWithDiscount"
                );

                if (
                    activationEntryIndex >= 0 &&
                    activationWithDiscountEntryIndex >= 0
                ) {
                    emsp.entries[activationEntryIndex].unitPrice =
                        activationFee;
                    emsp.entries[activationEntryIndex].total =
                        Utils.round(activationFee);

                    totalActivationWithDiscount = Utils.round(
                        Utils.round(activationFee) + mobieDiscountEntry.total,
                        2
                    );
                    totalUnitPriceActivationWithDiscount = Utils.round(
                        activationFee + mobieDiscountEntry.unitPrice,
                        4
                    );

                    emsp.entries[activationWithDiscountEntryIndex].unitPrice =
                        totalUnitPriceActivationWithDiscount;
                    emsp.entries[activationWithDiscountEntryIndex].total =
                        totalActivationWithDiscount;
                    totalBykWhEmsp =
                        total_energy > 0
                            ? Utils.round(totalPriceEmsp / total_energy)
                            : 0;
                    totalByKmhEmsp =
                        total_energy > 0
                            ? Utils.round(
                                (totalPriceEmsp /
                                    (total_energy / (evEfficiencyPerKwhPerKm)) * totalKmToUse)

                            )
                            : 0;
                    emsp.total = totalPriceEmsp;
                    emsp.totalBykWh = totalBykWhEmsp;
                    emsp.totalByKmh = totalByKmhEmsp;

                    totalUnitPriceVat = Utils.round(
                        totalPriceEmsp + totalPriceCpo
                    );
                    totalPriceVat = Utils.round(totalUnitPriceVat * fees.IVA);

                    vat.total = totalPriceVat;
                    vat.totalBykWh =
                        total_energy > 0
                            ? Utils.round(totalPriceVat / total_energy)
                            : 0;
                    vat.totalByKmh =
                        total_energy > 0
                            ? Utils.round(
                                (totalPriceVat /
                                    (total_energy / evEfficiencyPerKwhPerKm)) *
                                totalKmToUse
                            )
                            : 0;

                    let final = getFinalValues(totalPriceCpo, emsp, fees);
                    console.log("final - ", final);
                    opcPrice = final.opcPrice;
                    cemePrice = final.cemePrice;
                    feesPrice = final.feesPrice;
                    total_incl_vat = final.total_incl_vat;

                    totalPrice = Utils.round(
                        totalPriceEmsp + totalPriceCpo + totalPriceVat
                    );
                    totalPriceBykWh =
                        total_energy > 0
                            ? Utils.round(totalPrice / total_energy)
                            : 0;
                    totalPriceByKmh =
                        total_energy > 0
                            ? Utils.round(
                                (totalPrice /
                                    (total_energy / evEfficiencyPerKwhPerKm)) *
                                totalKmToUse
                            )
                            : 0;

                    total.total = totalPrice;
                    total.totalBykWh = totalPriceBykWh;
                    total.totalByTime =
                        total_charging_time > 0
                            ? Utils.round(
                                totalPrice / (total_charging_time * 60)
                            )
                            : 0;
                    total.totalByKmh = totalPriceByKmh;
                }
            }
        }

        if (clientName === process.env.WhiteLabelACP) {
            var acpDifference = await getAcpDifference(
                tariffCEME,
                emsp.entries,
                timeZone,
                source,
                offset,
                sessionStartDate,
                sessionStopDate,
                total_charging_time,
                total_energy,
                voltageLevel,
                fees,
                totalPriceCpo,
                total_incl_vat
            );
        }

        return {
            opc: opcPrice,
            ceme: cemePrice,
            fees: feesPrice,
            total: total_incl_vat,
            detail: { emsp, cpo, vat, total, acpDifference },
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        throw error;
    }
}

function calculateMobieOpcTariffsPriceSimulation(data, walletFound) {
    var context = "Function calculateMobieOpcTariffsPriceSimulation";
    return new Promise(async (resolve, reject) => {
        try {
            resolve(calculateMobieOpcTariffs(data, walletFound));
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error.message);
        }
    });
}
async function fetchRoamingAsyncData(data) {

    let { source, countryCode, elements } = data;

    let [tariffOPC, fees, roamingTariff, foundPlatform] = await Promise.all([
        elements && elements.length > 0 ? Utils.getDefaultOPCTariff() : undefined,
        vatService.getFees({ countryCode }),
        getTariffCEMEbyPlan(null, source),
        Utils.findOnePlatform({ platformCode: source }),
    ]);
    return { tariffOPC, fees, roamingTariff, foundPlatform };
}
async function calculateRoamingOpcTariffs(data) {
    var context = "Function calculateRoamingOpcTariffs";
    try {
        let {
            elements = [],
            roamingPlanId,
            sessionStartDate,
            sessionStopDate,
            offset = 0,
            power,
            voltage,
            total_energy,
            total_charging_time,
            total_parking_time,
            charging_periods,
            countryCode,
            timeZone,
            partyId,
            source,
            evseGroup,
            currency = "EUR",
            latitude,
            longitude,
            evEfficiency = 171,
            onlyDoAsyncCalculations = false,
            tariffs = [],
        } = data;

        if (onlyDoAsyncCalculations) {
            return fetchRoamingAsyncData(data);
        }
        const totalKmToUse = 100;
        const SECONDS_IN_HOUR = 3600;
        const MINUTES_IN_HOUR = 60;
        const ROUND_DECIMALS = 6;
        const ROUND_TO_INT = 0;
        const evEfficiencyPerKwhPerKm = evEfficiency / 1000; //Change from watts to kW

        if (countryCode || (latitude && longitude)) {

            offset = Utils.getChargerOffset(
                timeZone,
                countryCode,
                latitude,
                longitude
            );
        }

        if (Array.isArray(elements) && elements.length > 0) {

            elements = Utils.createTariffElementsAccordingToRestriction(
                elements,
                sessionStartDate,
                sessionStopDate
            );
        } else {

            if (Array.isArray(tariffs) && tariffs.length > 0) {
                const localSessionStartDate = moment.utc(sessionStartDate).add(offset, 'minutes').format();
                const matchingTariff = TariffsService.findMatchingTariff(tariffs , localSessionStartDate);
                elements = Utils.createTariffElementsAccordingToRestriction(
                    matchingTariff.elements,
                    sessionStartDate,
                    sessionStopDate
                );
            } else {
                let tariffOPC = (await Utils.getDefaultOPCTariff()) ?? {};
                elements = tariffOPC.elements
                    ? Utils.createTariffElementsAccordingToRestriction(
                        tariffOPC.elements,
                        sessionStartDate,
                        sessionStopDate
                    )
                    : [];
                currency = tariffOPC.currency || currency;
            }
        }


        // ======================= CPO TARIFFS ======================= //

        total_charging_time = Utils.round(total_charging_time, ROUND_DECIMALS);
        total_energy = Utils.round(
            Utils.round(total_energy, ROUND_DECIMALS),
            ROUND_TO_INT
        );
        let fees = await vatService.getFees({ countryCode });
        let totalTimeConsumedSeconds = Utils.round(
            total_charging_time * SECONDS_IN_HOUR,
            ROUND_TO_INT
        );
        let totalTimeConsumedMinutes = Utils.round(
            total_charging_time * MINUTES_IN_HOUR,
            ROUND_DECIMALS
        );

        let cpo = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
        let emsp = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
        let priceComponent = {
            entries: [],
            total: 0,
            totalBykWh: 0,
            totalByKmh: 0,
        };
        let vat = {
            total: 0,
            totalBykWh: 0,
            percentage: fees.IVA * 100,
            totalByKmh: 0,
        };
        let total = { total: 0, totalBykWh: 0, totalByTime: 0, totalByKmh: 0 };

        let [flat, energy, time, parking] = Utils.opcTariffsPrices(
            null,
            elements,
            sessionStartDate,
            sessionStopDate,
            0,
            power,
            voltage,
            total_energy,
            total_charging_time,
            total_parking_time,
            source
        );

        let [
            OCP_PRICE_FLAT,
            OCP_PRICE_ENERGY,
            OCP_PRICE_TIME,
            OCP_PRICE_PARKING_TIME,
        ] = [flat.price, energy.price, time.price, parking.price];

        energy.info = adjustCpoEnergyArray(energy.info, total_energy);
        time.info = adjustCpoTimeArray(time.info, totalTimeConsumedSeconds);
        pushOpcInfo(cpo.entries, flat.info, "cpoFlat");
        pushOpcInfo(cpo.entries, energy.info, "cpoEnergy");
        pushOpcInfo(cpo.entries, time.info, "cpoTime");

        let totalPriceCpo = sumTotal(cpo.entries);
        let totalBykWhCpo =
            total_energy > 0 ? Utils.round(totalPriceCpo / total_energy) : 0;
        let totalByKmhCpo =
            total_energy > 0
                ? Utils.round(
                    (totalPriceCpo /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        cpo.total = totalPriceCpo;
        cpo.totalBykWh = totalBykWhCpo;
        cpo.totalByKmh = totalByKmhCpo;

        // ======================= EMSP TARIFFS ======================= //
        //TODO: We should get the roamingTariff by the id and not by the source. We'll probably have many Roaming cemes to a specific network
        let roamingTariff = await getTariffCEMEbyPlan(null, source);
        let tariffArray = Utils.getTariffCemeByDate(
            roamingTariff,
            sessionStartDate
        );
        roamingTariff.tariff = tariffArray;
        let CEME_FLAT = roamingTariff.tariff.find(
            (tariff) => tariff.type === "flat"
        );
        let CEME_POWER = roamingTariff.tariff.find(
            (tariff) => tariff.type === "energy"
        );
        let CEME_TIME = roamingTariff.tariff.find(
            (tariff) => tariff.type === "time"
        );
        let CEME_PERCENTAGE = roamingTariff.tariff.find(
            (tariff) => tariff.type === "percentage"
        );

        const CEME_Price_FLAT = CEME_FLAT?.price || 0;
        const CEME_Price_POWER = CEME_POWER?.price || 0;
        const CEME_Price_TIME = CEME_TIME?.price || 0;
        const evioPercentage = CEME_PERCENTAGE?.price || 0;

        // for Hubject
        let CEME_START_PERCENTAGE = roamingTariff.tariff.find(
            (tariff) => tariff.type === "start_percentage"
        );
        let CEME_ENERGY_PERCENTAGE = roamingTariff.tariff.find(
            (tariff) => tariff.type === "energy_percentage"
        );
        let CEME_TIME_PERCENTAGE = roamingTariff.tariff.find(
            (tariff) => tariff.type === "time_percentage"
        );
        let CEME_Price_Start_Percentage = CEME_START_PERCENTAGE
            ? CEME_START_PERCENTAGE.price
            : 0;
        let CEME_Price_Energy_Percentage = CEME_ENERGY_PERCENTAGE
            ? CEME_ENERGY_PERCENTAGE.price
            : 0;
        let CEME_Price_Time_Percentage = CEME_TIME_PERCENTAGE
            ? CEME_TIME_PERCENTAGE.price
            : 0;

        let chargingSessionTime = total_charging_time;
        if (CEME_TIME) {
            switch (true) {
                case CEME_TIME.uom.includes("min"):
                    chargingSessionTime = totalTimeConsumedMinutes;
                    break;
                case CEME_TIME.uom.includes("h"):
                    chargingSessionTime = total_charging_time;
                    break;
                case CEME_TIME.uom.includes("s"):
                    chargingSessionTime = totalTimeConsumedSeconds;
                    break;
            }
        }
        let foundPlatform = await Utils.findOnePlatform({
            platformCode: source,
        });
        let hubFee;
        if (source === process.env.GirevePlatformCode)
            hubFee = foundPlatform
                ? foundPlatform.hubFee
                    ? foundPlatform.hubFee
                    : Number(process.env.GireveCommission)
                : Number(process.env.GireveCommission);
        else if (source === process.env.HubjectPlatformCode)
            hubFee = foundPlatform
                ? foundPlatform.hubFee
                    ? foundPlatform.hubFee
                    : Number(process.env.HubjectCommission)
                : Number(process.env.HubjectCommission);

        hubFee =
            /*Utils.round(totalTimeConsumedSeconds, 0) <=
                Number(process.env.MinimumChargingTimeToBilling) ||*/
            total_energy * 1000 <=
                Number(process.env.MinimumEnergyToBillingGireve)
                ? 0
                : hubFee;

        let emspFlatCost = Utils.round(CEME_Price_FLAT) + Utils.round(hubFee);

        let emspEnergyCost = Utils.round(
            Utils.round(CEME_Price_POWER) * Utils.round(total_energy)
        );

        let emspTimeCost = Utils.round(
            Utils.round(CEME_Price_TIME) * Utils.round(chargingSessionTime)
        );

        let percentageFlatCost = Utils.round(
            Utils.round(evioPercentage) * Utils.round(OCP_PRICE_FLAT, 4) +
            Utils.round(CEME_Price_Start_Percentage) *
            Utils.round(OCP_PRICE_FLAT, 4)
        );
        let percentageEnergyCost = Utils.round(
            Utils.round(evioPercentage) * Utils.round(OCP_PRICE_ENERGY, 4) +
            Utils.round(CEME_Price_Energy_Percentage) *
            Utils.round(OCP_PRICE_ENERGY, 4)
        );
        let percentageTimeCost = Utils.round(
            Utils.round(evioPercentage) * Utils.round(OCP_PRICE_TIME, 4) +
            Utils.round(CEME_Price_Time_Percentage) *
            Utils.round(OCP_PRICE_TIME, 4)
        );

        let finalEmspFlatCost = Utils.round(emspFlatCost + percentageFlatCost);
        let finalEmspEnergyCost = Utils.round(
            emspEnergyCost + percentageEnergyCost
        );
        let finalEmspTimeCost = Utils.round(emspTimeCost + percentageTimeCost);

        let flatEntry = createProviderEntry(
            1,
            "UN",
            finalEmspFlatCost,
            finalEmspFlatCost,
            finalEmspFlatCost,
            1,
            { type: "FLAT" },
            null,
            source
        );
        let energyEntry = createProviderEntry(
            total_energy,
            "kWh",
            finalEmspEnergyCost,
            finalEmspEnergyCost,
            total_energy > 0
                ? Utils.round(finalEmspEnergyCost / total_energy, 4)
                : 0,
            1,
            { type: "ENERGY" },
            null,
            source
        );
        let timeEntry = createProviderEntry(
            totalTimeConsumedSeconds,
            "s",
            finalEmspTimeCost,
            finalEmspTimeCost,
            totalTimeConsumedMinutes > 0
                ? Utils.round(finalEmspTimeCost / totalTimeConsumedMinutes, 4)
                : 0,
            1,
            { type: "TIME" },
            null,
            source
        );
        //Push emsp entries
        if (finalEmspFlatCost)
            pushProviderInfo(emsp.entries, flatEntry, "defaultFlat", currency);
        if (finalEmspEnergyCost)
            pushProviderInfo(
                emsp.entries,
                energyEntry,
                "defaultEnergy",
                currency
            );
        if (finalEmspTimeCost)
            pushProviderInfo(emsp.entries, timeEntry, "defaultTime", currency);

        let totalPriceProvider = sumTotal(emsp.entries);
        let totalBykWhProvider =
            total_energy > 0
                ? Utils.round(totalPriceProvider / total_energy)
                : 0;
        let totalByKmhProvider =
            total_energy > 0
                ? Utils.round(
                    (totalPriceProvider /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        emsp.total = totalPriceProvider;
        emsp.totalBykWh = totalBykWhProvider;
        emsp.totalByKmh = totalByKmhProvider;

        // //Add labels
        // // let energyLabelValue = OPC_UN_ENERGY + CEME_Price_POWER + EVIO_PERCENTAGE_UN_ENERGY
        // let energyLabelValue = energy.price > 0 && total_energy > 0 ? energy.price / (total_energy) : 0
        // let energyLabelUom = `kWh`
        // // let timeLabelValue = OPC_UN_TIME + CEME_Price_TIME + EVIO_PERCENTAGE_UN_TIME
        // let timeLabelValue = time.price > 0 && total_charging_time > 0 ? time.price / (total_charging_time * 60) : 0
        // let timeLabelUom = `min`
        // // let parkingTimeLabelValue = OPC_UN_PARKING_TIME + EVIO_PERCENTAGE_UN_PARKING_TIME
        // let parkingTimeLabelValue = parking.price > 0 && total_parking_time > 0 ? parking.price / (total_parking_time * 60) : 0
        // let parkingTimeLabelUom = `min`

        //Push priceComponent Entries
        let priceComponentCpoEntries = addEmspPercentagePriceToCpo(
            cpo.entries,
            evioPercentage,
            CEME_Price_Start_Percentage,
            CEME_Price_Energy_Percentage,
            CEME_Price_Time_Percentage
        );

        let emspFlatEntry = createProviderEntry(
            1,
            "UN",
            emspFlatCost,
            emspFlatCost,
            emspFlatCost,
            1,
            { type: "FLAT" },
            null,
            source
        );
        let emspEnergyEntry = createProviderEntry(
            total_energy,
            "kWh",
            emspEnergyCost,
            emspEnergyCost,
            total_energy > 0
                ? Utils.round(emspEnergyCost / total_energy, 4)
                : 0,
            1,
            { type: "ENERGY" },
            null,
            source
        );
        let emspTimeEntry = createProviderEntry(
            totalTimeConsumedSeconds,
            "s",
            emspTimeCost,
            emspTimeCost,
            totalTimeConsumedMinutes > 0
                ? Utils.round(emspTimeCost / totalTimeConsumedMinutes, 4)
                : 0,
            1,
            { type: "TIME" },
            null,
            source
        );

        priceComponentCpoEntries = emspFlatCost
            ? addEmspTariffsToCpo(
                priceComponentCpoEntries,
                emspFlatEntry,
                "defaultFlat",
                currency
            )
            : priceComponentCpoEntries;
        priceComponentCpoEntries = emspEnergyCost
            ? addEmspTariffsToCpo(
                priceComponentCpoEntries,
                emspEnergyEntry,
                "defaultEnergy",
                currency
            )
            : priceComponentCpoEntries;
        priceComponentCpoEntries = emspTimeCost
            ? addEmspTariffsToCpo(
                priceComponentCpoEntries,
                emspTimeEntry,
                "defaultTime",
                currency
            )
            : priceComponentCpoEntries;

        priceComponent.entries = priceComponentCpoEntries;
        let totalPricePriceComponent = sumTotal(priceComponent.entries);
        let totalBykWhPriceComponent =
            total_energy > 0
                ? Utils.round(totalPricePriceComponent / total_energy)
                : 0;
        let totalByKmhPriceComponent =
            total_energy > 0
                ? Utils.round(
                    (totalPricePriceComponent /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        priceComponent.total = totalPricePriceComponent;
        priceComponent.totalBykWh = totalBykWhPriceComponent;
        priceComponent.totalByKmh = totalByKmhPriceComponent;
        // Total Sums

        // let totalEntries = [...cpo.entries , ...emsp.entries]
        let totalEntries = [...priceComponent.entries];
        let totalFlatSum = sumTotal(
            totalEntries.filter((elem) => elem.label.includes("Flat"))
        );
        let totalEnergySum = sumTotal(
            totalEntries.filter((elem) => elem.label.includes("Energy"))
        );
        let totalTimeSum = sumTotal(
            totalEntries.filter((elem) => elem.label.includes("Time"))
        );

        // VAT
        let totalUnitPriceVat = Utils.round(totalPricePriceComponent);
        let totalPriceVat = Utils.round(totalUnitPriceVat * fees.IVA);

        vat.total = totalPriceVat;
        vat.totalBykWh =
            total_energy > 0 ? Utils.round(totalPriceVat / total_energy) : 0;
        vat.totalByKmh =
            total_energy > 0
                ? Utils.round(
                    (totalPriceVat /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        // Total price cpo + emsp
        let totalPrice = Utils.round(totalUnitPriceVat + totalPriceVat);
        let totalPriceBykWh =
            total_energy > 0 ? Utils.round(totalPrice / total_energy) : 0;
        let totalPriceByKmh =
            total_energy > 0
                ? Utils.round(
                    (totalPrice /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        total.total = Utils.round(totalUnitPriceVat + totalPriceVat);
        total.totalBykWh = totalPriceBykWh;
        total.totalByTime =
            total_charging_time > 0
                ? Utils.round(totalPrice / (total_charging_time * 60))
                : 0;
        total.totalByKmh = totalPriceByKmh;
        let totalKmGivenEnergy =
            total_energy > 0
                ? Utils.round(
                    (total_energy / evEfficiencyPerKwhPerKm)
                )
                : 0;
        total.totalKm = totalKmGivenEnergy;
        total.totalEnergy = total_energy;
        flat.price = totalFlatSum;
        energy.price = totalEnergySum;
        time.price = totalTimeSum;

        //Add labels
        // let energyLabelValue = OPC_UN_ENERGY + CEME_Price_POWER + EVIO_PERCENTAGE_UN_ENERGY
        let energyLabelValue =
            energy.price > 0 && total_energy > 0
                ? energy.price / total_energy
                : 0;
        let energyLabelUom = `kWh`;
        // let timeLabelValue = OPC_UN_TIME + CEME_Price_TIME + EVIO_PERCENTAGE_UN_TIME
        let timeLabelValue =
            time.price > 0 && total_charging_time > 0
                ? time.price / (total_charging_time * 60)
                : 0;
        let timeLabelUom = `min`;
        // let parkingTimeLabelValue = OPC_UN_PARKING_TIME + EVIO_PERCENTAGE_UN_PARKING_TIME
        let parkingTimeLabelValue =
            parking.price > 0 && total_parking_time > 0
                ? parking.price / (total_parking_time * 60)
                : 0;
        let parkingTimeLabelUom = `min`;

        /*
            It's always relevant to keep all decimal places and round it up in the end, but for this purpose,
            I think we can show up to 3 decimals in each dimension e round up to 2 in the final cost (unless mobile rounds it all up)
        */

        flat.label = { value: 1, uom: "un" };
        energy.label = {
            value: Number(energyLabelValue.toFixed(4)),
            uom: energyLabelUom,
        };
        time.label = {
            value: Number(timeLabelValue.toFixed(4)),
            uom: timeLabelUom,
        };
        parking.label = {
            value: Number(parkingTimeLabelValue.toFixed(4)),
            uom: parkingTimeLabelUom,
        };

        flat.price = Number(flat.price.toFixed(3));
        energy.price = Number(energy.price.toFixed(3));
        time.price = Number(time.price.toFixed(3));
        parking.price = Number(parking.price.toFixed(3));

        let total_exc_vat =
            flat.price + energy.price + time.price + parking.price;
        let total_incl_vat =
            Utils.round(total_exc_vat) + Utils.round(total_exc_vat * fees.IVA);
        let total_cost = {
            excl_vat: Utils.round(total_exc_vat),
            incl_vat: Utils.round(total_incl_vat),
        };

        vat.value = Utils.round(total_exc_vat * fees.IVA);
        vat.percentage = fees.IVA * 100;
        console.log("vat.value - ", vat.value);
        return {
            flat,
            energy,
            time,
            parking,
            total_cost,
            currency,
            vat /*,cpo , emsp */,
            detail: { priceComponent, vat, total },
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        throw error.message;
    }
}

function calculateRoamingOpcTariffsPriceSimulation(data) {
    var context = "Function calculateRoamingOpcTariffsPriceSimulation";
    return new Promise(async (resolve, reject) => {
        try {
            resolve(calculateRoamingOpcTariffs(data));
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error.message)
        }
    });
}

function validateGireveFields(data) {
    const context = "Function validateGireveFields"
    try {
        if (Utils.isEmptyObject(data))
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }

        // if (!data.elements)
        //     return { auth: false, code: "server_elements_required", message: 'Tariff elements required' }

        if (!data.sessionStartDate)
            return { auth: false, code: "server_sessionStartDate_required", message: 'Session Start Date required' }

        if (!data.sessionStopDate)
            return { auth: false, code: "server_sessionStopDate_required", message: 'Session Stop Date required' }

        // if (!("offset" in data))
        //     return { auth: false, code: "server_offset_required", message: 'Charger offset required' }

        if (!("power" in data))
            return { auth: false, code: "server_power_required", message: 'Plug power required' }

        // if (!("voltage" in data))
        //     return { auth: false, code: "server_voltage_required", message: 'Plug voltage required' }

        if (!("total_energy" in data))
            return { auth: false, code: "server_total_energy_required", message: 'Session total energy required' }

        if (!("total_charging_time" in data))
            return { auth: false, code: "server_total_charging_time_required", message: 'Session total charging time required' }

        if (!("total_parking_time" in data))
            return { auth: false, code: "server_total_parking_time_required", message: 'Session total parking time required' }


        if (!("countryCode" in data))
            return { auth: false, code: "server_countryCode_required", message: 'countryCode required' }


        if (!("partyId" in data))
            return { auth: false, code: "server_partyId_required", message: 'partyId required' }

        if (!("source" in data))
            return { auth: false, code: "server_source_required", message: 'source required' }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}

function validateEVIOFields(data) {
    const context = "Function validateEVIOFields"
    try {
        if (Utils.isEmptyObject(data))
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }

        // if (!data.elements)
        //     return { auth: false, code: "server_elements_required", message: 'Tariff elements required' }

        // if (!data.sessionStartDate)
        //     return { auth: false, code: "server_sessionStartDate_required", message: 'Session Start Date required' }

        // if (!data.sessionStopDate)
        //     return { auth: false, code: "server_sessionStopDate_required", message: 'Session Stop Date required' }

        // if (!("offset" in data))
        //     return { auth: false, code: "server_offset_required", message: 'Charger offset required' }

        // if (!("power" in data))
        //     return { auth: false, code: "server_power_required", message: 'Plug power required' }

        // if (!("voltage" in data))
        //     return { auth: false, code: "server_voltage_required", message: 'Plug voltage required' }

        if (data.address === null || data.address === undefined)
            return { auth: false, code: "server_address_required", message: 'address required' }

        if (data.tariff === null || data.tariff === undefined || Object.prototype.toString.call(data.tariff) !== '[object Object]')
            return { auth: false, code: "server_tariff_required", message: 'tariff required' }

        if (data.total_energy === null || data.total_energy === undefined || data.total_energy < 0)
            return { auth: false, code: "server_total_energy_required", message: 'Session total energy required' }

        if (data.total_charging_time === null || data.total_charging_time === undefined || data.total_charging_time < 0)
            return { auth: false, code: "server_total_charging_time_required", message: 'Session total charging time required' }

        // if (!("total_parking_time" in data))
        //     return { auth: false, code: "server_total_parking_time_required", message: 'Session total parking time required' }


        // if (!("countryCode" in data))
        //     return { auth: false, code: "server_countryCode_required", message: 'countryCode required' }


        // if (!("partyId" in data))
        //     return { auth: false, code: "server_partyId_required", message: 'partyId required' }

        if (data.source === null || data.source === undefined)
            return { auth: false, code: "server_source_required", message: 'source required' }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}

function validateTeslaFields(data) {
    const context = "Function validateTeslaFields"
    try {
        if (Utils.isEmptyObject(data))
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }

        // if (!data.elements)
        //     return { auth: false, code: "server_elements_required", message: 'Tariff elements required' }

        // if (!data.sessionStartDate)
        //     return { auth: false, code: "server_sessionStartDate_required", message: 'Session Start Date required' }

        // if (!data.sessionStopDate)
        //     return { auth: false, code: "server_sessionStopDate_required", message: 'Session Stop Date required' }

        // if (!("offset" in data))
        //     return { auth: false, code: "server_offset_required", message: 'Charger offset required' }

        if (data.power === null || data.power === undefined || data.power < 0)
            return { auth: false, code: "server_power_required", message: 'Plug power required' }

        // if (!("voltage" in data))
        //     return { auth: false, code: "server_voltage_required", message: 'Plug voltage required' }

        if (data.address === null || data.address === undefined)
            return { auth: false, code: "server_address_required", message: 'address required' }

        // if (!("tariff" in data) && data.tariff !== null)
        //     return { auth: false, code: "server_tariff_required", message: 'tariff required' }

        // if (!("total_energy" in data) && data.total_energy !== null)
        //     return { auth: false, code: "server_total_energy_required", message: 'Session total energy required' }

        if (data.total_charging_time === null || data.total_charging_time === undefined || data.total_charging_time < 0)
            return { auth: false, code: "server_total_charging_time_required", message: 'Session total charging time required' }

        // if (!("total_parking_time" in data))
        //     return { auth: false, code: "server_total_parking_time_required", message: 'Session total parking time required' }


        // if (!("countryCode" in data))
        //     return { auth: false, code: "server_countryCode_required", message: 'countryCode required' }


        // if (!("partyId" in data))
        //     return { auth: false, code: "server_partyId_required", message: 'partyId required' }

        if (data.source === null || data.source === undefined)
            return { auth: false, code: "server_source_required", message: 'source required' }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}

function validateHubjectFields(data) {
    const context = "Function validateHubjectFields"
    try {
        if (Utils.isEmptyObject(data))
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }

        // if (!data.elements)
        //     return { auth: false, code: "server_elements_required", message: 'Tariff elements required' }

        // if (!data.sessionStartDate)
        //     return { auth: false, code: "server_sessionStartDate_required", message: 'Session Start Date required' }

        // if (!data.sessionStopDate)
        //     return { auth: false, code: "server_sessionStopDate_required", message: 'Session Stop Date required' }

        // if (!("offset" in data))
        //     return { auth: false, code: "server_offset_required", message: 'Charger offset required' }

        if (data.power === null || data.power === undefined || data.power < 0)
            return { auth: false, code: "server_power_required", message: 'Plug power required' }

        // if (!("voltage" in data))
        //     return { auth: false, code: "server_voltage_required", message: 'Plug voltage required' }

        if (data.address === null || data.address === undefined)
            return { auth: false, code: "server_address_required", message: 'address required' }

        // if (!("tariff" in data) && data.tariff !== null)
        //     return { auth: false, code: "server_tariff_required", message: 'tariff required' }

        // if (!("total_energy" in data) && data.total_energy !== null)
        //     return { auth: false, code: "server_total_energy_required", message: 'Session total energy required' }

        if (data.total_charging_time === null || data.total_charging_time === undefined || data.total_charging_time < 0)
            return { auth: false, code: "server_total_charging_time_required", message: 'Session total charging time required' }

        // if (!("total_parking_time" in data))
        //     return { auth: false, code: "server_total_parking_time_required", message: 'Session total parking time required' }


        // if (!("countryCode" in data))
        //     return { auth: false, code: "server_countryCode_required", message: 'countryCode required' }


        // if (!("partyId" in data))
        //     return { auth: false, code: "server_partyId_required", message: 'partyId required' }

        if (data.source === null || data.source === undefined)
            return { auth: false, code: "server_source_required", message: 'source required' }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}

function calculateCemeAndTar(TAR_Schedule, tariffCEME, tariffTAR, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel) {
    const context = "Function calculateCemeAndTar"
    try {
        let ceme = {
            flat: {
                price: tariffCEME.activationFee ? tariffCEME.activationFee.value : Number(process.env.AD_HOC_Activation_Fee_Wallet)
            },
            time: {
                price: 0
            },
            energy: {
                price: 0
            },
            price: 0,
            info: [],
            tariff: tariffCEME,
        }

        let tar = {
            price: 0,
            info: [],
            tariff: tariffTAR,
        }
        if (TAR_Schedule) {
            let schedules = TAR_Schedule.schedules
            let schedulesWithoutRestrictions = schedules.every(schedule => schedule.weekDays === "all" && schedule.season === "all")
            if (schedulesWithoutRestrictions) {
                let firstIntervals = schedules.map(schedule => { return getIntervals(schedule, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) })
                dailyIntervals(firstIntervals, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar)
                delete ceme.tariff
                delete tar.tariff
                return { ceme, tar }
            } else {
                delete ceme.tariff
                delete tar.tariff
                //TODO Contemplate seasons and weekdays restrictions
                return { ceme, tar }

            }
        } else {
            delete ceme.tariff
            delete tar.tariff
            return { ceme, tar }
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return {
            ceme: {
                price: 0,
                info: [],
            },
            tar: {
                price: 0,
                info: [],
            }
        }
    }
}

function getIntervals(schedule, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) {
    const context = "Function getIntervals"
    try {
        /*
            Get timestamp intervals for each scheduleCEME
        */
        // Start
        let scheduleStartHours = parseInt(schedule.startTime.slice(0, 2))
        let scheduleStartMinutes = parseInt(schedule.startTime.slice(3))

        let momentObjStart = moment(sessionStartDate).utc()
        momentObjStart.set({ hour: scheduleStartHours, minute: scheduleStartMinutes, second: 0, millisecond: 0 })
        let startDateString = momentObjStart.toISOString()
        let startDateTimestamp = Date.parse(startDateString)

        // End

        let scheduleEndHours = parseInt(schedule.endTime.slice(0, 2))
        let scheduleEndMinutes = parseInt(schedule.endTime.slice(3))

        let momentObjEnd = moment(sessionStartDate).utc()
        momentObjEnd.set({ hour: scheduleEndHours, minute: scheduleEndMinutes, second: 0, millisecond: 0 })
        let endDateString = momentObjEnd.toISOString()
        let endDateTimestamp = Date.parse(endDateString)

        let sessionStartDateTimestamp = Date.parse(sessionStartDate)
        let sessionStopDateTimestamp = Date.parse(sessionStopDate)

        let totalChargingTimeMinutes = total_charging_time * 60
        let consumedEnergyPerMinute = totalChargingTimeMinutes > 0 ? total_energy / totalChargingTimeMinutes : 0

        let { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod } = getPeriodTimeAndEnergy(sessionStartDateTimestamp, startDateTimestamp, sessionStopDateTimestamp, endDateTimestamp, consumedEnergyPerMinute)

        // CEME
        calculateCEME(schedule.tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel)

        // TAR
        calculateTAR(schedule.tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod)

        return {
            start: startDateTimestamp,
            stop: endDateTimestamp,
            tariffType: schedule.tariffType
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null
    }
}

function dailyIntervals(firstIntervals, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) {
    // We add one day just to be sure to cover all charging time period
    let multiplier = Math.ceil(total_charging_time / 24) + 1
    let hoursInDay = 24
    for (let i = 1; i <= multiplier; i++) {
        let millisecondsToAdd = i * hoursInDay * 3600 * 1000
        calculateOtherIntervals(firstIntervals, millisecondsToAdd, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar)
    }
    ceme.price = ceme.flat.price + ceme.time.price + ceme.energy.price
}

function calculateOtherIntervals(firstIntervals, millisecondsToAdd, total_charging_time, total_energy, sessionStartDate, sessionStopDate, voltageLevel, ceme, tar) {
    const context = "Function calculateOtherIntervals"
    try {
        for (let interval of firstIntervals) {

            // Start
            let startDateTimestamp = interval.start + millisecondsToAdd

            // End
            let endDateTimestamp = interval.stop + millisecondsToAdd

            let sessionStartDateTimestamp = Date.parse(sessionStartDate)
            let sessionStopDateTimestamp = Date.parse(sessionStopDate)

            let totalChargingTimeMinutes = total_charging_time * 60
            let consumedEnergyPerMinute = total_energy / totalChargingTimeMinutes

            let { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod } = getPeriodTimeAndEnergy(sessionStartDateTimestamp, startDateTimestamp, sessionStopDateTimestamp, endDateTimestamp, consumedEnergyPerMinute)

            // CEME
            calculateCEME(interval.tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel)

            // TAR
            calculateTAR(interval.tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod)
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function getScheduleCEME() {
    try {
        return mobieScheduleTime
    } catch (error) {
        return []
    }
}

function calculateCEME(tariffType, periodConsumedEnergy, periodInMinutes, ceme, startPeriod, endPeriod, voltageLevel) {
    const context = "Function calculateCEME"
    try {
        // let CEME_FLAT = ceme.tariff.tariff.find(elem => ( elem.tariffType === tariffType && elem.uom.includes(process.env.flatDimension) ) )
        let CEME_POWER = ceme.tariff.tariff.find(elem => (elem.tariffType === tariffType && elem.uom.includes(process.env.powerDimension) && elem.voltageLevel === voltageLevel))
        let CEME_TIME = ceme.tariff.tariff.find(elem => (elem.tariffType === tariffType && elem.uom.includes(process.env.timeDimension) && elem.voltageLevel === voltageLevel))

        // let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
        let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
        let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0

        // let flatPrice = CEME_Price_FLAT
        let energyPrice = CEME_Price_POWER * periodConsumedEnergy
        let timePrice = CEME_Price_TIME * periodInMinutes

        let cemePrice = /*flatPrice + */ energyPrice + timePrice
        if (periodConsumedEnergy > 0 || periodInMinutes > 0) {
            //Add prices
            // ceme.price += cemePrice
            // ceme.flat.price += flatPrice
            ceme.energy.price += energyPrice
            ceme.time.price += timePrice

            //Push details
            ceme.info.push({
                startPeriod,
                endPeriod,
                // flatPrice,
                energyPrice,
                timePrice,
                totalPrice: cemePrice,
                consumedEnergykWh: periodConsumedEnergy,
                consumedTimeMinutes: periodInMinutes,
                tariff: ceme.tariff.tariff.filter(element => element.tariffType === tariffType),
            })
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function calculateTAR(tariffType, periodConsumedEnergy, periodInMinutes, voltageLevel, tar, startPeriod, endPeriod) {
    const context = "Function calculateTAR"
    try {
        let tarTariff = tar.tariff.tariff.find(element => element.voltageLevel === voltageLevel && element.tariffType === tariffType)
        let tarPrice = tarTariff.price * periodConsumedEnergy
        if (periodConsumedEnergy > 0 || periodInMinutes > 0) {
            tar.price += tarPrice
            tar.info.push({
                startPeriod,
                endPeriod,
                totalPrice: tarPrice,
                consumedEnergykWh: periodConsumedEnergy,
                consumedTimeMinutes: periodInMinutes,
                tariff: tarTariff
            })
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function getPeriodTimeAndEnergy(sessionStartDateTimestamp, startDateTimestamp, sessionStopDateTimestamp, endDateTimestamp, consumedEnergyPerMinute) {

    try {
        let periodInMinutes = 0
        let periodConsumedEnergy = 0
        let startPeriod = new Date(startDateTimestamp).toISOString()
        let endPeriod = new Date(endDateTimestamp).toISOString()
        if (sessionStartDateTimestamp <= startDateTimestamp && sessionStopDateTimestamp >= endDateTimestamp) {
            periodInMinutes = (endDateTimestamp - startDateTimestamp) / (1000 * 60)
            periodConsumedEnergy = consumedEnergyPerMinute * periodInMinutes
            startPeriod = new Date(startDateTimestamp).toISOString()
            endPeriod = new Date(endDateTimestamp).toISOString()
        } else if (sessionStartDateTimestamp >= startDateTimestamp && sessionStopDateTimestamp <= endDateTimestamp) {
            periodInMinutes = (sessionStopDateTimestamp - sessionStartDateTimestamp) / (1000 * 60)
            periodConsumedEnergy = consumedEnergyPerMinute * periodInMinutes
            startPeriod = new Date(sessionStartDateTimestamp).toISOString()
            endPeriod = new Date(sessionStopDateTimestamp).toISOString()
        } else if (sessionStartDateTimestamp <= startDateTimestamp && sessionStopDateTimestamp > startDateTimestamp) {
            periodInMinutes = (sessionStopDateTimestamp - startDateTimestamp) / (1000 * 60)
            periodConsumedEnergy = consumedEnergyPerMinute * periodInMinutes
            startPeriod = new Date(startDateTimestamp).toISOString()
            endPeriod = new Date(sessionStopDateTimestamp).toISOString()
        } else if (sessionStartDateTimestamp < endDateTimestamp && sessionStopDateTimestamp >= endDateTimestamp) {
            periodInMinutes = (endDateTimestamp - sessionStartDateTimestamp) / (1000 * 60)
            periodConsumedEnergy = consumedEnergyPerMinute * periodInMinutes
            startPeriod = new Date(sessionStartDateTimestamp).toISOString()
            endPeriod = new Date(endDateTimestamp).toISOString()
        }

        return { periodInMinutes, periodConsumedEnergy, startPeriod, endPeriod }
    } catch (error) {
        return { periodInMinutes: 0, periodConsumedEnergy: 0, startPeriod: new Date(startDateTimestamp).toISOString(), endPeriod: new Date(endDateTimestamp).toISOString() }
    }
}

function validateMobieFields(data) {
    const context = "Function validateMobieFields"
    try {

        if (Utils.isEmptyObject(data))
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }

        // if (!data.elements)
        //     return { auth: false, code: "server_elements_required", message: 'Tariff elements required' }

        if (!data.sessionStartDate)
            return { auth: false, code: "server_sessionStartDate_required", message: 'Session Start Date required' }

        if (!data.sessionStopDate)
            return { auth: false, code: "server_sessionStopDate_required", message: 'Session Stop Date required' }

        // if (!("offset" in data))
        //     return { auth: false, code: "server_offset_required", message: 'Charger offset required' }

        if (!("power" in data))
            return { auth: false, code: "server_power_required", message: 'Plug power required' }

        // if (!("voltage" in data))
        //     return { auth: false, code: "server_voltage_required", message: 'Plug voltage required' }

        if (!("total_energy" in data))
            return { auth: false, code: "server_total_energy_required", message: 'Session total energy required' }

        if (!("total_charging_time" in data))
            return { auth: false, code: "server_total_charging_time_required", message: 'Session total charging time required' }

        if (!("total_parking_time" in data))
            return { auth: false, code: "server_total_parking_time_required", message: 'Session total parking time required' }

        if (!("countryCode" in data))
            return { auth: false, code: "server_countryCode_required", message: 'countryCode required' }

        if (!("source" in data))
            return { auth: false, code: "server_source_required", message: 'source required' }

        if (!("latitude" in data))
            return { auth: false, code: "server_latitude_required", message: 'latitude required' }

        if (!("longitude" in data))
            return { auth: false, code: "server_longitude_required", message: 'longitude required' }

        // if (!("voltageLevel" in data))
        //     return { auth: false, code: "server_voltageLevel_required", message: 'voltageLevel required' }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}

function getVoltageLevel(voltageLevel) {
    const context = "Function getVoltageLevel"
    try {
        let existingVoltageLevels = ["BTN", "BTE", "MT"]
        return existingVoltageLevels.includes(voltageLevel) ? voltageLevel : "BTN"
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return "BTN"
    }
}

async function calculateEvioPrices(data) {
    var context = "Function calculateEvioPrices";
    console.log("calculateEvioPrices")
    try {
        const newSimulation = await toggle.isEnable('charge-839-price-simulation');
        if (newSimulation) {
            let {
                sessionStartDate,
                sessionStopDate,
                power,
                voltage,
                total_energy,
                total_charging_time,
                total_parking_time,
                countryCode,
                timeZone,
                source,
                latitude,
                longitude,
                evEfficiency = 171,
                fees,
                tariff,
              } = data;
              const elements = tariff?.elements || [];
            
              const totalKmToUse = 100;
              const ROUND_DECIMALS = 6;
              const ROUND_TO_INT = 0;
              const evEfficiencyPerKwhPerKm = evEfficiency / 1000; 
            
              total_charging_time = Utils.round(total_charging_time, ROUND_DECIMALS);
              total_energy = Utils.round(Utils.round(total_energy, ROUND_DECIMALS), ROUND_TO_INT);
            
              const [flat, energy, time, parking] = TariffsService.calculateCpoPrices(
                elements,
                sessionStartDate,
                sessionStopDate,
                timeZone,
                countryCode,
                power,
                voltage,
                total_energy,
                total_charging_time,
                total_parking_time,
                source,
                latitude,
                longitude
              );
            
              const cpo = calculateCpoDetails(
                flat.info,
                energy.info,
                time.info,
                total_energy,
                totalKmToUse,
                evEfficiencyPerKwhPerKm
              );
              const vat = calculateVatDetails(
                cpo.total,
                total_energy,
                totalKmToUse,
                evEfficiencyPerKwhPerKm,
                fees
              );
              const total = calculateTotalDetails(
                cpo.total + vat.total,
                total_energy,
                total_charging_time,
                totalKmToUse,
                evEfficiencyPerKwhPerKm
              );
            
              return {
                total,
                vat,
                detail: { priceComponent: cpo, vat, total },
              };
        }

        let {
            total_energy, total_charging_time, tariff, evEfficiency = 171 //The evEfficiency is sent like this from Mobile. this is the value for the ID.3
        } = data

        let fees = await vatService.getFees(data)

        let evioPrices = getPriceEVIO(tariff, total_charging_time, total_energy, fees)
        createEvioDetailedResponse(evioPrices, total_energy, total_charging_time, fees, evEfficiency)

        return evioPrices;

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        throw error.message;
    }
}

function getPriceEVIO(tariff, timeCharged, totalPower, fees) {
    const context = "Funciton getPriceEVIO";
    try {
        switch (tariff?.tariffType) {
            case process.env.TariffByPower:
                console.log(process.env.TariffByPower)
                return energyBaseTariff(tariff, timeCharged, totalPower, fees)

            case process.env.TariffByTime:
                console.log(process.env.TariffByTime)
                return timeBaseTariff(tariff, timeCharged, totalPower, fees)

            default:
                console.log("Others")
                return timeBaseTariff(tariff, timeCharged, totalPower, fees)
        };
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        let detail = {
            booking: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "UN"
            },
            activationFee: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "UN"
            },
            charging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "kWh"
            },
            parkingDuringCharging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "min"
            },
            parkingAfterCharging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "min"
            },
            vat: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "%"
            }

        }
        return {
            total: { excl_vat: 0, incl_vat: 0 },
            totalBooking: 0,
            totalCharging: 0,
            totalParking: 0,
            totalFees: 0,
            detail,
        }
    }
};

function energyBaseTariff(tariff, timeCharged, totalPower, fees) {
    const context = "Funciton energyBaseTariff";
    try {
        let parkingDuringChargingAmount;
        let parkingDuringChargingAmountQuantity;
        switch (tariff.tariff.parkingDuringChargingAmount.uom) {
            case 's':
                parkingDuringChargingAmountQuantity = Utils.round(timeCharged * 3600)
                parkingDuringChargingAmount = parkingDuringChargingAmountQuantity * tariff.tariff.parkingDuringChargingAmount.value;
                break;
            case 'h':
                parkingDuringChargingAmountQuantity = Utils.round(timeCharged)
                parkingDuringChargingAmount = parkingDuringChargingAmountQuantity * tariff.tariff.parkingDuringChargingAmount.value;
                break;
            default:
                parkingDuringChargingAmountQuantity = Utils.round(timeCharged * 60)
                parkingDuringChargingAmount = parkingDuringChargingAmountQuantity * tariff.tariff.parkingDuringChargingAmount.value;
                break;
        };

        let iva;
        if (fees.IVA) {
            iva = fees.IVA;
        } else {
            iva = 0.23
        }

        let costDuringCharge = totalPower * tariff.tariff.chargingAmount.value;
        let activationFee = tariff.tariff.activationFee;

        let bookingValue = tariff.tariff.bookingAmount ? (tariff.tariff.bookingAmount.value ? tariff.tariff.bookingAmount.value : 0) : 0
        let parkingValue = tariff.tariff.parkingAmount ? (tariff.tariff.parkingAmount.value ? tariff.tariff.parkingAmount.value : 0) : 0
        let parkingAmount = parkingValue * 0
        //Round to two decimal places
        parkingDuringChargingAmount = parseFloat(parkingDuringChargingAmount.toFixed(2));
        activationFee = parseFloat(activationFee.toFixed(2));
        costDuringCharge = parseFloat(costDuringCharge.toFixed(2));
        bookingValue = parseFloat(bookingValue.toFixed(2));
        parkingAmount = parseFloat(parkingAmount.toFixed(2));

        // let costDetails = {
        //     activationFee: activationFee,
        //     parkingDuringCharging: parkingDuringChargingAmount,
        //     parkingAmount: 0,
        //     timeCharged: timeCharged,
        //     totalTime: timeCharged,
        //     totalPower: totalPower,
        //     costDuringCharge: costDuringCharge
        // };

        let excl_vat = Utils.round(costDuringCharge + parkingDuringChargingAmount + activationFee + bookingValue + parkingAmount)
        let vatValue = Utils.round(excl_vat * iva)
        let incl_vat = Utils.round(excl_vat + vatValue)

        let detail = {
            booking: {
                total: bookingValue,
                unitPrice: bookingValue,
                quantity: 1,
                unit: "UN"
            },
            activationFee: {
                total: activationFee,
                unitPrice: activationFee,
                quantity: 1,
                unit: "UN"
            },
            charging: {
                total: costDuringCharge,
                unitPrice: tariff.tariff.chargingAmount.value,
                quantity: totalPower,
                unit: tariff.tariff.chargingAmount.uom
            },
            parkingDuringCharging: {
                total: parkingDuringChargingAmount,
                unitPrice: tariff.tariff.parkingDuringChargingAmount.value,
                quantity: parkingDuringChargingAmountQuantity,
                unit: tariff.tariff.parkingDuringChargingAmount.uom
            },
            parkingAfterCharging: {
                total: parkingAmount,
                unitPrice: parkingAmount,
                quantity: 0,
                unit: "min"
            },
            vat: {
                total: vatValue,
                unitPrice: Utils.round(iva * 100),
                quantity: excl_vat,
                unit: "%"
            }

        }

        let totalBooking = Utils.round(detail.booking.total)
        let totalCharging = Utils.round(detail.charging.total)
        let totalParking = Utils.round(detail.parkingDuringCharging.total + detail.parkingAfterCharging.total)
        let totalFees = Utils.round(detail.activationFee.total + detail.vat.total)

        let total = {
            excl_vat: parseFloat(excl_vat.toFixed(2)),
            incl_vat: parseFloat(incl_vat.toFixed(2))
        };

        return {
            total,
            totalBooking,
            totalCharging,
            totalParking,
            totalFees,
            detail,
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        let detail = {
            booking: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "UN"
            },
            activationFee: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "UN"
            },
            charging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "kWh"
            },
            parkingDuringCharging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "min"
            },
            parkingAfterCharging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "min"
            },
            vat: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "%"
            }

        }
        return {
            total: { excl_vat: 0, incl_vat: 0 },
            totalBooking: 0,
            totalCharging: 0,
            totalParking: 0,
            totalFees: 0,
            detail,
        }
    }
};

function timeBaseTariff(tariff, timeCharged, totalPower, fees) {
    const context = "Funciton timeBaseTariff";
    try {
        // let excl_vat = 0;
        // let incl_vat = 0;
        let parkingDuringChargingAmount = 0;
        let activationFee = tariff.tariff.activationFee;
        let costDuringCharge = 0;
        let parkingDuringChargingAmountQuantity;
        switch (tariff.tariff.parkingDuringChargingAmount.uom) {
            case 's':
                parkingDuringChargingAmountQuantity = Utils.round(timeCharged * 3600)
                parkingDuringChargingAmount = parkingDuringChargingAmountQuantity * tariff.tariff.parkingDuringChargingAmount.value;
                break;
            case 'h':
                parkingDuringChargingAmountQuantity = Utils.round(timeCharged)
                parkingDuringChargingAmount = parkingDuringChargingAmountQuantity * tariff.tariff.parkingDuringChargingAmount.value;
                break;
            default:
                parkingDuringChargingAmountQuantity = Utils.round(timeCharged * 60)
                parkingDuringChargingAmount = parkingDuringChargingAmountQuantity * tariff.tariff.parkingDuringChargingAmount.value;
                break;
        };
        let costDuringChargeQuantity;
        switch (tariff.tariff.chargingAmount.uom) {
            case 's':
                costDuringChargeQuantity = timeCharged * 3600
                costDuringCharge = timeCharged * 3600 * tariff.tariff.chargingAmount.value;
                break;
            case 'h':
                costDuringChargeQuantity = timeCharged
                costDuringCharge = timeCharged * tariff.tariff.chargingAmount.value;
                break;
            default:
                costDuringChargeQuantity = timeCharged * 60
                costDuringCharge = timeCharged * 60 * tariff.tariff.chargingAmount.value;
                break;
        };

        let iva;
        if (fees.IVA) {
            iva = fees.IVA;
        } else {
            iva = 0.23
        }
        let bookingValue = tariff.tariff.bookingAmount ? (tariff.tariff.bookingAmount.value ? tariff.tariff.bookingAmount.value : 0) : 0
        let parkingValue = tariff.tariff.parkingAmount ? (tariff.tariff.parkingAmount.value ? tariff.tariff.parkingAmount.value : 0) : 0
        let parkingAmount = parkingValue * 0
        //Round to two decimal places
        parkingDuringChargingAmount = parseFloat(parkingDuringChargingAmount.toFixed(2));
        activationFee = parseFloat(activationFee.toFixed(2));
        costDuringCharge = parseFloat(costDuringCharge.toFixed(2));
        bookingValue = parseFloat(bookingValue.toFixed(2));
        parkingAmount = parseFloat(parkingAmount.toFixed(2));

        // let costDetails = {
        //     activationFee: activationFee,
        //     parkingDuringCharging: parkingDuringChargingAmount,
        //     parkingAmount: 0,
        //     timeCharged: timeCharged,
        //     totalTime: timeCharged,
        //     totalPower: totalPower,
        //     costDuringCharge: costDuringCharge
        // };

        let excl_vat = Utils.round(costDuringCharge + parkingDuringChargingAmount + activationFee + bookingValue + parkingAmount)
        let vatValue = Utils.round(excl_vat * iva)
        let incl_vat = Utils.round(excl_vat + vatValue)

        let detail = {
            booking: {
                total: bookingValue,
                unitPrice: bookingValue,
                quantity: 1,
                unit: "UN"
            },
            activationFee: {
                total: activationFee,
                unitPrice: activationFee,
                quantity: 1,
                unit: "UN"
            },
            charging: {
                total: costDuringCharge,
                unitPrice: tariff.tariff.chargingAmount.value,
                quantity: costDuringChargeQuantity,
                unit: tariff.tariff.chargingAmount.uom
            },
            parkingDuringCharging: {
                total: parkingDuringChargingAmount,
                unitPrice: tariff.tariff.parkingDuringChargingAmount.value,
                quantity: parkingDuringChargingAmountQuantity,
                unit: tariff.tariff.parkingDuringChargingAmount.uom
            },
            parkingAfterCharging: {
                total: parkingAmount,
                unitPrice: parkingAmount,
                quantity: 0,
                unit: "min"
            },
            vat: {
                total: vatValue,
                unitPrice: Utils.round(iva * 100),
                quantity: excl_vat,
                unit: "%"
            }

        }

        let totalBooking = Utils.round(detail.booking.total)
        let totalCharging = Utils.round(detail.charging.total)
        let totalParking = Utils.round(detail.parkingDuringCharging.total + detail.parkingAfterCharging.total)
        let totalFees = Utils.round(detail.activationFee.total + detail.vat.total)

        let total = {
            excl_vat: parseFloat(excl_vat.toFixed(2)),
            incl_vat: parseFloat(incl_vat.toFixed(2))
        };

        return {
            total,
            totalBooking,
            totalCharging,
            totalParking,
            totalFees,
            detail,
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        let detail = {
            booking: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "UN"
            },
            activationFee: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "UN"
            },
            charging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "kWh"
            },
            parkingDuringCharging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "min"
            },
            parkingAfterCharging: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "min"
            },
            vat: {
                total: 0,
                unitPrice: 0,
                quantity: 0,
                unit: "%"
            }

        }
        return {
            total: { excl_vat: 0, incl_vat: 0 },
            totalBooking: 0,
            totalCharging: 0,
            totalParking: 0,
            totalFees: 0,
            detail,
        }
    }
};

async function calculateTeslaPrices(data, resolve, reject) {
    const context = "Function calculateTeslaPrices";
    try {

        let {
            total_charging_time, address, power
        } = data

        let tariffTesla = await getTeslaTariff();

        //Tesla Model S Performance
        let capTotalBateriaEV = 100.00;
        let capCarregamentoEV;
        if (power >= 50) {
            // Fastcharge_Power_Max
            capCarregamentoEV = 200.00;
        } else {
            // Charge_Standard_Power
            capCarregamentoEV = 16.50;
        };


        let value1 = (power >= capCarregamentoEV) ? capCarregamentoEV : Math.min(power, capTotalBateriaEV);
        let value2 = Math.min(total_charging_time, (power >= capCarregamentoEV ? (capTotalBateriaEV / capCarregamentoEV) : (capTotalBateriaEV / power)) * 60)

        let consumo = value1 * value2;

        let excl_vat = 0;
        let incl_vat = 0;

        let iva;
        let fees = await vatService.getFees({ address })
        if (fees.IVA) {
            iva = fees.IVA;
        } else {
            iva = 0.23
        }

        excl_vat = consumo * tariffTesla.value;
        incl_vat = excl_vat + (excl_vat * iva);


        let totalPrice = {
            excl_vat: parseFloat(excl_vat.toFixed(2)),
            incl_vat: parseFloat(incl_vat.toFixed(2))
        };

        resolve({ total: totalPrice })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        reject(error.message)
    }
};

function calculateTeslaPricesPriceSimulation(data) {
    const context = "Function calculateTeslaPricesPriceSimulation";
    return new Promise(async (resolve, reject) => {
        try {

            let {
                total_charging_time, address, power
            } = data

            let tariffTesla = await getTeslaTariff();

            //Tesla Model S Performance
            let capTotalBateriaEV = 100.00;
            let capCarregamentoEV;
            if (power >= 50) {
                // Fastcharge_Power_Max
                capCarregamentoEV = 200.00;
            } else {
                // Charge_Standard_Power
                capCarregamentoEV = 16.50;
            };


            let value1 = (power >= capCarregamentoEV) ? capCarregamentoEV : Math.min(power, capTotalBateriaEV);
            let value2 = Math.min(total_charging_time, (power >= capCarregamentoEV ? (capTotalBateriaEV / capCarregamentoEV) : (capTotalBateriaEV / power)) * 60)

            let consumo = value1 * value2;

            let excl_vat = 0;
            let incl_vat = 0;

            let iva;
            let fees = await vatService.getFees({ address })
            if (fees.IVA) {
                iva = fees.IVA;
            } else {
                iva = 0.23
            }

            excl_vat = consumo * tariffTesla.value;
            incl_vat = excl_vat + (excl_vat * iva);


            let totalPrice = {
                excl_vat: parseFloat(excl_vat.toFixed(2)),
                incl_vat: parseFloat(incl_vat.toFixed(2))
            };

            resolve({ total: totalPrice })
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error.message)
        }
    });
};

function getTeslaTariff() {
    var context = "Function getTeslaTariff";
    return new Promise(async (resolve, reject) => {
        try {

            var proxy = process.env.TarriffServiceHost + process.env.PathTeslaTariff;
            var params = {
                active: true
            };

            axios.get(proxy, { params })
                .then((result) => {
                    if (result.data)
                        resolve(result.data);
                    else
                        resolve({
                            uom: 'KWh',
                            value: 0.262
                        })
                })
                .catch((error) => {
                    console.log(`[${context}] [${proxy}] Error `, error.message);
                    //reject(error);
                    resolve({
                        uom: 'KWh',
                        value: 0.262
                    })
                });

        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            //reject(error);
            resolve({
                uom: 'KWh',
                value: 0.262
            })
        };
    });
};

function getDistance(coordinatesApp, coordinatesCharger) {
    let latApp = coordinatesApp.lat
    let logApp = coordinatesApp.lng
    let latCharger = coordinatesCharger[1]
    let logCharger = coordinatesCharger[0]

    if (latApp === latCharger && logApp === logCharger)
        return 0;
    else {
        let radlat1 = Math.PI * latApp / 180;
        let radlat2 = Math.PI * latCharger / 180;
        let theta = logApp - logCharger;
        let radtheta = Math.PI * theta / 180;
        let dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        dist = dist * 1.609344

        return Number(dist.toFixed(2));
    }
};

function pushCemeAndTarInfo(emsp, info, label, group) {
    const context = "Function pushCemeAndTarInfo";
    try {
        for (let entry of info) {
            let equalPeriod = emsp.findIndex(elem => elem.unitPrice === entry.tariff.price && elem.tariffType === entry.tariff.tariffType && elem.label == label)
            if (equalPeriod > -1) {
                emsp[equalPeriod].quantity = Utils.round(emsp[equalPeriod].quantity + entry.consumedEnergykWh, 0)
                emsp[equalPeriod].total = Utils.round(emsp[equalPeriod].total + entry.totalPrice, 2)
            } else {
                emsp.push(
                    {
                        label: label,
                        unit: "kWh",
                        unitPrice: entry.tariff.price,
                        quantity: entry.consumedEnergykWh,
                        total: entry.totalPrice,
                        tariffType: entry.tariff.tariffType,
                        title: defaultTitle(label),
                        group: group,
                    }
                )
            }
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
};

function pushOpcInfo(cpo, info, label) {
    const context = "Function pushOpcInfo";
    try {
        for (let entry of info) {
            let title = getTitle(entry)
            cpo.push(
                {
                    label: label,
                    unit: entry.unit,
                    unitPrice: entry.componentPrice,
                    quantity: entry.quantity,
                    total: entry.totalPrice >= 0 ? entry.totalPrice : entry.cost,
                    title: [
                        ...removeUnnecessaryDateRestriction(title.flat),
                        ...removeUnnecessaryDateRestriction(title.energy),
                        ...removeUnnecessaryDateRestriction(title.time),
                        ...removeUnnecessaryDateRestriction(title.parking)
                    ],
                }
            )
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
};

function adjustCpoEnergyArray(info, totalEnergy) {
    const context = "Function adjustCpoEnergyArray";
    try {
        let totalCalculatedEnergy = 0
        let roundedQuantitiesArray = info.map(element => {
            let quantity = Utils.round(element.quantity, 0)
            totalCalculatedEnergy += quantity
            let totalPrice = Utils.getEnergyPrice(quantity, element.componentPrice, element.componentStepSize)
            return {
                ...element,
                quantity,
                totalPrice: Utils.round(totalPrice, 2),
            }
        })
        let withoutRestrinctionIndex = roundedQuantitiesArray.findIndex(element => {
            let restrictions = element.restrictions ? JSON.parse(JSON.stringify(element.restrictions)) : element.restrictions
            Utils.adjustRestrictions(restrictions)
            return Utils.isEmptyObject(restrictions)
        })
        if (Math.abs(totalEnergy - totalCalculatedEnergy) <= roundedQuantitiesArray.length) {
            if (withoutRestrinctionIndex > -1) {
                roundedQuantitiesArray[withoutRestrinctionIndex].quantity += (totalEnergy - totalCalculatedEnergy)
            } else {
                let withoutMaxRestrictions = roundedQuantitiesArray.findIndex(element => (element.restrictions.max_duration === null || element.restrictions.max_duration === undefined)
                    && (element.restrictions.max_kwh === null || element.restrictions.max_kwh === undefined))
                if (withoutMaxRestrictions > -1) {
                    roundedQuantitiesArray[withoutMaxRestrictions].quantity += (totalEnergy - totalCalculatedEnergy)
                } else {
                    if (roundedQuantitiesArray.length > 0) {
                        roundedQuantitiesArray[0].quantity += (totalEnergy - totalCalculatedEnergy)
                    }
                }
            }
        }
        return roundedQuantitiesArray.map(element => {
            let quantity = Utils.round(element.quantity, 0)
            let totalPrice = Utils.getEnergyPrice(quantity, element.componentPrice, element.componentStepSize)
            return {
                ...element,
                quantity,
                totalPrice: Utils.round(totalPrice, 2),
            }
        })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        []
    }
};

function adjustCemeTarEnergyArray(info, totalEnergy) {
    const context = "Function adjustCemeTarEnergyArray";
    try {
        let totalCalculatedEnergy = 0
        let roundedQuantitiesArray = info.map(element => {
            let consumedEnergykWh = Utils.round(element.consumedEnergykWh, 0)
            totalCalculatedEnergy += consumedEnergykWh
            let totalPrice = Utils.round(element.tariff.price * consumedEnergykWh, 2)
            return {
                ...element,
                consumedEnergykWh,
                totalPrice
            }
        })
        roundedQuantitiesArray[0].consumedEnergykWh += (totalEnergy - totalCalculatedEnergy)
        return roundedQuantitiesArray.map(element => {
            let consumedEnergykWh = Utils.round(element.consumedEnergykWh, 0)
            let totalPrice = Utils.round(element.tariff.price * consumedEnergykWh, 2)
            return {
                ...element,
                consumedEnergykWh,
                totalPrice
            }
        })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        []
    }
};

function adjustCpoTimeArray(info, totalTime) {
    const context = "Function adjustTimeEnergyArray";
    try {
        let totalCalculatedTime = 0
        let roundedQuantitiesArray = info.map(element => {
            let quantity = Utils.round(element.quantity, 0)
            totalCalculatedTime += quantity
            let totalPrice = Utils.getTimePrice(quantity / 3600, element.componentPrice, element.componentStepSize, element.source)
            return {
                ...element,
                quantity,
                totalPrice: Utils.round(totalPrice, 2),
            }
        })
        let withoutRestrinctionIndex = roundedQuantitiesArray.findIndex(element => {
            let restrictions = element.restrictions ? JSON.parse(JSON.stringify(element.restrictions)) : element.restrictions
            Utils.adjustRestrictions(restrictions)
            return Utils.isEmptyObject(restrictions)
        })
        if (Math.abs(totalTime - totalCalculatedTime) <= roundedQuantitiesArray.length) {
            if (withoutRestrinctionIndex > -1) {
                roundedQuantitiesArray[withoutRestrinctionIndex].quantity += (totalTime - totalCalculatedTime)
            } else {
                let withoutMaxRestrictions = roundedQuantitiesArray.findIndex(element => (element.restrictions.max_duration === null || element.restrictions.max_duration === undefined)
                    && (element.restrictions.max_kwh === null || element.restrictions.max_kwh === undefined))
                if (withoutMaxRestrictions > -1) {
                    roundedQuantitiesArray[withoutMaxRestrictions].quantity += (totalTime - totalCalculatedTime)
                } else {
                    if (roundedQuantitiesArray.length > 0) {
                        roundedQuantitiesArray[0].quantity += (totalTime - totalCalculatedTime)
                    }
                }
            }
        }
        return roundedQuantitiesArray.map(element => {
            let quantity = Utils.round(element.quantity, 0)
            let totalPrice = Utils.getTimePrice(quantity / 3600, element.componentPrice, element.componentStepSize, element.source)
            return {
                ...element,
                componentPrice: element.source === global.girevePlatformCode || element.source === global.hubjectPlatformCode ? Utils.round(element.componentPrice / 60, 4) : element.componentPrice,
                quantity,
                totalPrice: Utils.round(totalPrice, 2),
            }
        })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        []
    }
};


function sumTotal(array) {
    const context = "Function sumTotal";
    try {
        return array.reduce((accumulator, object) => Utils.round(accumulator + object.total), 0)
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return 0
    }
}


function getTitle(entry, currency = "EUR") {
    const context = "Function getTitle";
    try {
        let title = {
            flat: [],
            time: [],
            energy: [],
            parking: []
        }
        let restrictions = entry.restrictions ? JSON.parse(JSON.stringify(entry.restrictions)) : entry.restrictions
        Utils.adjustRestrictions(restrictions)
        let isEmpty = Utils.isEmptyObject(restrictions)
        let price = entry.componentPrice
        let step_size = entry.componentStepSize
        if (entry.component.type == 'ENERGY') {
            if (!isEmpty) {
                Utils.createRestrictionObjects(title, 'energy', restrictions, price, step_size, 'kWh', currency)
            } else {
                title['energy'].push({
                    restrictionType: 'defaultEnergy',
                    values: [
                        {
                            restrictionValues: {},
                            price,
                            step: step_size,
                            uom: 'kWh',
                            currency
                        }
                    ]
                })
            }
        } else if (entry.component.type == 'TIME') {
            if (!isEmpty) {
                Utils.createRestrictionObjects(title, 'time', restrictions, price, step_size, 'min', currency)
            } else {
                title['time'].push({
                    restrictionType: 'defaultTime',
                    values: [
                        {
                            restrictionValues: {},
                            price,
                            step: step_size,
                            uom: entry.unit,
                            currency
                        }
                    ]
                })
            }
        } else if (entry.component.type == 'FLAT') {
            if (!isEmpty) {
                Utils.createRestrictionObjects(title, 'flat', restrictions, price, step_size, 'UN', currency)
            } else {
                title['flat'].push({
                    restrictionType: 'defaultFlat',
                    values: [
                        {
                            restrictionValues: {},
                            price: price,
                            step: 1,
                            uom: 'UN',
                            currency
                        }
                    ]
                })
            }
        } else if (entry.component.type == 'PARKING_TIME') {
            if (!isEmpty) {
                Utils.createRestrictionObjects(title, 'parking', restrictions, price, step_size, 'min', currency)
            } else {
                title['parking'].push({
                    restrictionType: 'defaultParking',
                    values: [
                        {
                            restrictionValues: {},
                            price,
                            step: step_size,
                            uom: entry.unit,
                            currency
                        }
                    ]
                })
            }
        }
        return title
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function defaultTitle(label) {
    return [{
        "restrictionType": `session_simulator_${label}`,
        "values": [
            {
                "restrictionValues": {},
            }
        ]
    }]
}


function getFinalValues(totalPriceCpo, emsp, fees) {
    const context = "Function getFinalValues";
    try {
        let opcPrice = Utils.round(totalPriceCpo)
        let totalCemePrice = sumTotal(emsp.entries.filter(elem => elem.label === "ceme" || elem.label === "activationFeeWithDiscount"))
        let cemePrice = Utils.round(totalCemePrice)
        let totalTarPrice = sumTotal(emsp.entries.filter(elem => elem.label === "tar"))
        let tarPrice = Utils.round(totalTarPrice)
        let totalIecPrice = sumTotal(emsp.entries.filter(elem => elem.label === "iec"))
        let iecPrice = Utils.round(totalIecPrice)
        let total_exc_vat = Utils.round(opcPrice + cemePrice + tarPrice + iecPrice)
        let vatPrice = Utils.round(total_exc_vat * fees.IVA)
        let feesPrice = Utils.round(tarPrice + iecPrice + vatPrice)
        let total_incl_vat = Utils.round(total_exc_vat + vatPrice)

        return {
            opcPrice,
            totalCemePrice,
            cemePrice,
            totalTarPrice,
            tarPrice,
            totalIecPrice,
            iecPrice,
            total_exc_vat,
            vatPrice,
            feesPrice,
            total_incl_vat,
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return {
            opcPrice: 0,
            totalCemePrice: 0,
            cemePrice: 0,
            totalTarPrice: 0,
            tarPrice: 0,
            totalIecPrice: 0,
            iecPrice: 0,
            total_exc_vat: 0,
            vatPrice: 0,
            feesPrice: 0,
            total_incl_vat: 0,
        }
    }
}


function getEvioTariff(charger, plug, fleetId, userId) {
    const context = "Function getEvioTariff"
    try {
        let tariff = null

        if (charger.accessType !== process.env.ChargerAccessPrivate) {
            let foundTariff = plug.tariff.find(tariff => { return tariff.fleetId === fleetId && tariff.tariff.tariffId !== "" })
            if (foundTariff) {
                tariff = foundTariff
            } else {
                let group = charger.listOfGroups.find(group => {
                    if (group.listOfUsers) {
                        return group.listOfUsers.find(user => {
                            return user.userId === userId
                        })
                    } else {
                        return null
                    }
                })
                if (group) {
                    tariff = plug.tariff.find(tariff => { return tariff.groupId === group.groupId && tariff.tariff.tariffId !== "" })
                } else {
                    if (charger.accessType === process.env.ChargerAccessPublic) {
                        tariff = plug.tariff.find(tariff => { return tariff.groupName === "Public" && tariff.tariff.tariffId !== "" })
                    } else {
                        if (plug.tariff[0]) {
                            tariff = plug.tariff.find(tariff => { return tariff.tariffId !== "" })
                        }
                    }
                }
            }
        } else {
            tariff = plug.tariff.find(tariff => { return tariff.groupName === "Public" && tariff.tariff.tariffId !== "" })
        }
        return tariff
    } catch (error) {
        console.log(`[${context}] Error `, error.message)
        return null
    }
}

function pushProviderInfo(provider, entry, label, currency) {
    const context = "Function pushProviderInfo";
    try {
        let title = getTitle(entry, currency)
        provider.push(
            {
                label: label,
                unit: entry.unit,
                unitPrice: entry.componentPrice,
                quantity: entry.quantity,
                total: entry.totalPrice >= 0 ? entry.totalPrice : entry.cost,
                title: [...title.flat, ...title.energy, ...title.time, ...title.parking],
            }
        )
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
};

function createProviderEntry(quantity, unit, cost, totalPrice, componentPrice, componentStepSize, component, restrictions, source) {
    const context = "Function createProviderEntry";
    try {
        return {
            quantity,
            unit,
            cost,
            totalPrice,
            componentPrice,
            componentStepSize,
            component,
            restrictions,
            source,
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return {}
    }
};

function removeUnnecessaryDateRestriction(array) {
    const context = "Function removeUnnecessaryDateRestriction";
    try {
        // console.log("array" , JSON.stringify(array))
        // console.log()
        const foundTime = array.find(element => element.restrictionType === 'time');
        const foundDate = array.find(element => element.restrictionType === 'date');
        const foundDay = array.find(element => element.restrictionType === 'day');
        if ((foundTime || foundDay) && foundDate) {
            let remove = array.filter(element => element.restrictionType === 'date').every(element => isOneDay(element.values[0].restrictionValues.start, element.values[0].restrictionValues.end))
            return remove ? array.filter(element => element.restrictionType !== 'date') : array
        } else {
            return array
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return array
    }
}

function isOneDay(start, end) {
    const context = "Function isOneDay";
    try {
        if (start && end) {
            let startDate = moment(start + 'T00:00:00').utc()
            let endDate = moment(end + 'T00:00:00').utc()
            let duration = moment.duration(endDate.diff(startDate))
            return duration.asDays() === 1
        } else {
            return false
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return false
    }
}

function addEmspPercentagePriceToCpo(cpoEntries, evioPercentage, cemeStartPercentage, cemePriceEnergyPercentage, cemePriceTimePercentage) {
    const context = "Function addEmspPercentagePriceToCpo";
    try {
        let entries = []
        for (let element of cpoEntries) {
            if (element.label.includes('Flat')) {
                let total = Utils.round(element.total + element.total * evioPercentage + element.total * cemeStartPercentage)
                let unitPrice = total
                let title = element.title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: unitPrice } }) } })
                if (total) {
                    entries.push({ ...element, total, unitPrice, title })
                }
            } else if (element.label.includes('Energy')) {

                let unitPrice = element.quantity > 0 ? Utils.round(element.unitPrice + element.unitPrice * evioPercentage + element.unitPrice * cemePriceEnergyPercentage, 4) : 0
                let total = Utils.round(element.quantity * unitPrice)

                // let total = Utils.round(element.total + element.total * evioPercentage)
                // let unitPrice = element.quantity > 0 ? Utils.round(total / element.quantity, 4) : 0
                let title = element.title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: unitPrice } }) } })
                if (total) {
                    entries.push({ ...element, total, unitPrice, title })
                }
            } else if (element.label.includes('Time')) {
                let unitPrice = element.quantity > 0 ? Utils.round(element.unitPrice + element.unitPrice * evioPercentage + element.unitPrice * cemePriceTimePercentage, 4) : 0
                let total = Utils.round((element.quantity / 60) * unitPrice)
                // let total = Utils.round(element.total + element.total * evioPercentage)
                // let unitPrice = element.quantity > 0 ? Utils.round(total / (element.quantity / 60), 4) : 0
                let title = element.title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: unitPrice } }) } })
                if (total) {
                    entries.push({ ...element, total, unitPrice, title })
                }
            } else {
                entries.push(element)
            }
        }
        return entries
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return cpoEntries
    }
}

function addEmspTariffsToCpo(cpoEntries, entry, label, currency) {
    const context = "Function addEmspTariffsToCpo";
    try {
        if (entry.totalPrice > 0) {
            let defaultEntryIndex = cpoEntries.findIndex(obj => obj.title.find(title => title.restrictionType === label))
            if (defaultEntryIndex > -1) {
                if (cpoEntries[defaultEntryIndex].label.includes('Flat')) {
                    let total = Utils.round(cpoEntries[defaultEntryIndex].total + entry.totalPrice)
                    let unitPrice = total
                    let title = cpoEntries[defaultEntryIndex].title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: unitPrice } }) } })
                    cpoEntries[defaultEntryIndex] = { ...cpoEntries[defaultEntryIndex], total, unitPrice, title }
                } else if (cpoEntries[defaultEntryIndex].label.includes('Energy')) {
                    let total = Utils.round(cpoEntries[defaultEntryIndex].total + entry.totalPrice)
                    let unitPrice = Utils.round(total / cpoEntries[defaultEntryIndex].quantity, 4)
                    let title = cpoEntries[defaultEntryIndex].title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: unitPrice } }) } })
                    cpoEntries[defaultEntryIndex] = { ...cpoEntries[defaultEntryIndex], total, unitPrice, title }
                } else if (cpoEntries[defaultEntryIndex].label.includes('Time')) {
                    let total = Utils.round(cpoEntries[defaultEntryIndex].total + entry.totalPrice)
                    let unitPrice = Utils.round(total / (cpoEntries[defaultEntryIndex].quantity / 60), 4)
                    let title = cpoEntries[defaultEntryIndex].title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: unitPrice } }) } })
                    cpoEntries[defaultEntryIndex] = { ...cpoEntries[defaultEntryIndex], total, unitPrice, title }
                }
            } else {
                pushProviderInfo(cpoEntries, entry, label, currency)
            }
        }
        return cpoEntries

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return cpoEntries
    }
};

function createEvioDetailedResponse(
    response,
    total_energy,
    total_charging_time,
    fees,
    evEfficiency
) {
    const context = "Function createEvioDetailedResponse";
    console.log("createEvioDetailedResponse");
    try {
        const evEfficiencyPerKwhPerKm = evEfficiency / 1000; //Change from watts to kW
        const totalKmToUse = 100;
        let cpo = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
        let emsp = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };
        let priceComponent = {
            entries: [],
            total: 0,
            totalBykWh: 0,
            totalByKmh: 0,

        };
        let vat = {
            total: 0,
            totalBykWh: 0,
            percentage: fees.IVA * 100,
            totalByKmh: 0,
        };
        let total = { total: 0, totalBykWh: 0, totalByTime: 0, totalByKmh: 0, totalKm: 0, totalEnergy: 0 };

        if (response.detail.booking.total) {
            pushEvioInfo(
                cpo.entries,
                "myChargersTariffs_reserve",
                response.detail.booking.unit,
                response.detail.booking.unitPrice,
                response.detail.booking.quantity,
                response.detail.booking.total
            );
            pushEvioInfo(
                priceComponent.entries,
                "myChargersTariffs_reserve",
                response.detail.booking.unit,
                response.detail.booking.unitPrice,
                response.detail.booking.quantity,
                response.detail.booking.total
            );
        }
        if (response.detail.activationFee.total) {
            pushEvioInfo(
                cpo.entries,
                "myChargersTariffs_activation",
                response.detail.activationFee.unit,
                response.detail.activationFee.unitPrice,
                response.detail.activationFee.quantity,
                response.detail.activationFee.total
            );
            pushEvioInfo(
                priceComponent.entries,
                "myChargersTariffs_activation",
                response.detail.activationFee.unit,
                response.detail.activationFee.unitPrice,
                response.detail.activationFee.quantity,
                response.detail.activationFee.total
            );
        }
        if (response.detail.charging.total) {
            pushEvioInfo(
                cpo.entries,
                "myChargersTariffs_charging",
                response.detail.charging.unit,
                response.detail.charging.unitPrice,
                response.detail.charging.quantity,
                response.detail.charging.total
            );
            pushEvioInfo(
                priceComponent.entries,
                "myChargersTariffs_charging",
                response.detail.charging.unit,
                response.detail.charging.unitPrice,
                response.detail.charging.quantity,
                response.detail.charging.total
            );
        }
        if (response.detail.parkingDuringCharging.total) {
            pushEvioInfo(
                cpo.entries,
                "myChargersTariffs_parking_during_charging",
                response.detail.parkingDuringCharging.unit,
                response.detail.parkingDuringCharging.unitPrice,
                response.detail.parkingDuringCharging.quantity,
                response.detail.parkingDuringCharging.total
            );
            pushEvioInfo(
                priceComponent.entries,
                "myChargersTariffs_parking_during_charging",
                response.detail.parkingDuringCharging.unit,
                response.detail.parkingDuringCharging.unitPrice,
                response.detail.parkingDuringCharging.quantity,
                response.detail.parkingDuringCharging.total
            );
        }
        if (response.detail.parkingAfterCharging.total) {
            pushEvioInfo(
                cpo.entries,
                "myChargersTariffs_parking_after_charging",
                response.detail.parkingAfterCharging.unit,
                response.detail.parkingAfterCharging.unitPrice,
                response.detail.parkingAfterCharging.quantity,
                response.detail.parkingAfterCharging.total
            );
            pushEvioInfo(
                priceComponent.entries,
                "myChargersTariffs_parking_after_charging",
                response.detail.parkingAfterCharging.unit,
                response.detail.parkingAfterCharging.unitPrice,
                response.detail.parkingAfterCharging.quantity,
                response.detail.parkingAfterCharging.total
            );
        }

        let totalPricePriceComponent = sumTotal(priceComponent.entries);
        let totalBykWhPriceComponent =
            total_energy > 0
                ? Utils.round(totalPricePriceComponent / total_energy)
                : 0;
        let totalByKmhPriceComponent =
            total_energy > 0
                ? Utils.round(
                    (totalPricePriceComponent /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        priceComponent.total = totalPricePriceComponent;
        priceComponent.totalBykWh = totalBykWhPriceComponent;
        priceComponent.totalByKmh = totalByKmhPriceComponent;

        // VAT
        let totalUnitPriceVat = Utils.round(totalPricePriceComponent);
        let totalPriceVat = Utils.round(totalUnitPriceVat * fees.IVA);

        vat.total = totalPriceVat;
        vat.totalBykWh =
            total_energy > 0 ? Utils.round(totalPriceVat / total_energy) : 0;
        vat.totalByKmh =
            total_energy > 0
                ? Utils.round(
                    (totalPriceVat /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        let totalPrice = Utils.round(totalUnitPriceVat + totalPriceVat);
        let totalPriceBykWh =
            total_energy > 0 ? Utils.round(totalPrice / total_energy) : 0;
        let totalPriceByKmh =
            total_energy > 0
                ? Utils.round(
                    (totalPrice /
                        (total_energy / evEfficiencyPerKwhPerKm)) *
                    totalKmToUse
                )
                : 0;

        total.total = Utils.round(totalUnitPriceVat + totalPriceVat);
        total.totalBykWh = totalPriceBykWh;
        total.totalByTime =
            total_charging_time > 0
                ? Utils.round(totalPrice / (total_charging_time * 60))
                : 0;
        total.totalByKmh = totalPriceByKmh;
        let totalKmGivenEnergy =
            total_energy > 0
                ? Utils.round(
                    (total_energy / evEfficiencyPerKwhPerKm)
                )
                : 0;
        total.totalKm = totalKmGivenEnergy;
        total.totalEnergy = total_energy;
        response.detail.priceComponent = priceComponent;
        response.detail.vat = { ...response.detail.vat, ...vat };
        response.detail.total = total;
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function pushEvioInfo(array, label, unit, unitPrice, quantity, total) {
    const context = "Function pushEvioInfo";
    try {
        array.push(
            {
                label,
                unit,
                unitPrice,
                quantity,
                total,
                title: [{
                    "restrictionType": label,
                    "values": [
                        {
                            "restrictionValues": {},
                        }
                    ]
                }],
            }
        )
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
};

async function getAcpDifference(originalCEME, originalEmspEntries, timeZone, source, offset, sessionStartDate, sessionStopDate, total_charging_time, total_energy, voltageLevel, fees, totalPriceCpo, total_incl_vat) {
    const context = "Function getAcpDifference"
    try {
        // console.log("originalEmspEntries" , JSON.stringify(originalEmspEntries))
        // console.log("totalPriceCpo" , JSON.stringify(totalPriceCpo))
        // console.log("total_incl_vat" , JSON.stringify(total_incl_vat))
        let oldPlanName = originalCEME.planName
        let isPartner = oldPlanName === process.env.acpPartnerPlanName

        if (isPartner) {
            var { tariffCEME, tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(null, timeZone, source, 'EVIO_ad_hoc_acp')
        } else {
            var { tariffCEME, tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(null, timeZone, source, 'EVIO_ad_hoc_acp_discount')
        }


        //We get local iso dates because of TAR schedules
        let localSessionStartDate = moment.utc(sessionStartDate).add(offset, 'minutes').format()
        let localSessionStopDate = moment.utc(sessionStopDate).add(offset, 'minutes').format()

        let tariffArray = Utils.getTariffCemeByDate(tariffCEME, localSessionStartDate)
        tariffCEME.tariff = tariffArray

        let { ceme } = Utils.calculateCemeAndTar(TAR_Schedule, tariffCEME, tariffTAR, total_charging_time, total_energy, localSessionStartDate, localSessionStopDate, voltageLevel)

        let emspEntries = []
        ceme.info = adjustCemeTarEnergyArray(ceme.info, total_energy)
        pushCemeAndTarInfo(emspEntries, ceme.info, "ceme", "energy")


        let emspToChange = JSON.parse(JSON.stringify(originalEmspEntries))
        emspToChange = emspToChange.filter(elem => elem.label !== "ceme")
        emspToChange = [...emspToChange, ...emspEntries]
        // console.log("emspToChange 1" , JSON.stringify(emspToChange))

        // // Collapsable energy entry
        let groupEnergyTotal = sumTotal(emspToChange.filter(elem => elem.group === "energy"))
        let groupEnergyUnitPrice = total_energy > 0 ? Utils.round(groupEnergyTotal / total_energy, 2) : 0
        let energyEntry = { label: "cemeTarIec", unit: "kWh", unitPrice: groupEnergyUnitPrice, quantity: total_energy, total: groupEnergyTotal, title: defaultTitle("cemeTarIec"), collapsable: true, collapseGroup: "energy" }
        // console.log("energyEntry" , JSON.stringify(energyEntry))

        let cemeTarIecIndex = emspToChange.findIndex(elem => elem.label === "cemeTarIec")

        // console.log("cemeTarIecIndex" , JSON.stringify(cemeTarIecIndex))


        emspToChange[cemeTarIecIndex] = energyEntry

        // console.log("emspToChange 2" , JSON.stringify(emspToChange))


        let final = getFinalValues(totalPriceCpo, { entries: emspToChange }, fees)
        // console.log("total_incl_vat" , total_incl_vat)
        // console.log("final.total_incl_vat" , final.total_incl_vat)
        let difference = Utils.round(Math.abs(total_incl_vat - final.total_incl_vat))

        return {
            label: isPartner ? "acpDifference_Partner" : "acpDifference_NotPartner",
            difference,
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return undefined
    }
}

async function detailedTariffsMobiE(data, resolve, reject) {
    const context = "Function detailedTariffsMobiE";
    try {

        let { tariffId, planId, source, voltageLevel, countryCode, currentDate, latitude, longitude, address } = data

        let offset = Utils.getChargerOffset(null, "PT", latitude, longitude)

        let query = {
            id: tariffId
        }
        voltageLevel = getVoltageLevel(voltageLevel)

        let foundTariff = await Tariff.findOne(query).lean()
        if (foundTariff) {
            let cpo = Utils.tariffResponseBody(foundTariff).detailedTariff
            let timeZone = Utils.getTimezone(latitude, longitude)
            let { tariffCEME, tariffTAR, TAR_Schedule } = await Utils.getCEMEandTar(planId, timeZone, source)

            //We get local iso dates because of TAR schedules
            let localSessionStartDate = moment.utc(currentDate).add(offset, 'minutes').format()
            let addSecondsDate = moment.utc(localSessionStartDate).add(1, 'seconds').format()

            let tariffArray = Utils.getTariffCemeByDate(tariffCEME, localSessionStartDate)
            tariffCEME.tariff = tariffArray
            let { ceme, tar } = Utils.calculateCemeAndTar(TAR_Schedule, tariffCEME, tariffTAR, 0, 0, localSessionStartDate, addSecondsDate, voltageLevel)


            let cemeTime = 0
            let cemeEnergy = ceme.info[0].tariff.price
            let activationFee = tariffCEME.activationFee ? (tariffCEME.activationFee.value > 0 ? tariffCEME.activationFee.value : Number(process.env.AD_HOC_Activation_Fee_Wallet)) : Number(process.env.AD_HOC_Activation_Fee_Wallet)
            ceme = {
                flat: ceme.flat.price + activationFee,
                time: cemeTime,
                energy: cemeEnergy,
            }

            let feesObj = await vatService.getFees({ countryCode, address })

            let fees = {
                iec: feesObj.IEC,
                tar: tar.info[0].tariff.price,
                iva: feesObj.IVA * 100,
            }
            let tariffType = tar.info[0].tariff.tariffType

            let foundPlatform = await Utils.findOnePlatform({ platformCode: source })

            let mobieDiscount;
            let dateNow = new Date();
            console.log("dateNow", dateNow)
            console.log("dateNow<Date(2024-01-01T00:00:00.000Z)", dateNow > new Date("2024-01-01T00:00:00.000Z"));

            if (dateNow < new Date("2024-01-01T00:00:00.000Z"))
                mobieDiscount = foundPlatform ? (foundPlatform.discount ? foundPlatform.discount : Number(process.env.MobiE_Grant)) : Number(process.env.MobiE_Grant)
            else if(dateNow < new Date("2025-01-01T00:00:00.000Z"))
                mobieDiscount = foundPlatform ? (foundPlatform.discount ? foundPlatform.discount : Number(process.env.MobiE_GrantNew)) : Number(process.env.MobiE_GrantNew)
            else mobieDiscount = foundPlatform ? (foundPlatform.discount ? foundPlatform.discount : 0) : 0

            // Detail of the tariffs
            let detailedTariffsCpo = createDetailedTariffsCpo(foundTariff, source)
            let detailedTariffsEmsp = createDetailedTariffsEmspMobiE(tariffCEME, tariffTAR, feesObj, activationFee, mobieDiscount)

            resolve({ cpo, ceme, fees, tariffType, detail: { emsp: detailedTariffsEmsp, cpo: detailedTariffsCpo } });
        } else {
            resolve({ cpo: {}, ceme: {}, fees: {}, tariffType: "", detail: {} })
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        reject(error.message)
    }

}


function validateDetailedTariffsMobiE(data) {
    const context = "Function validateDetailedTariffsMobiE"
    try {
        if (Utils.isEmptyObject(data)) {
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }
        } else if (!data.tariffId) {
            return { auth: false, code: "server_tariffId_required", message: 'Missing tariffId parameter' }
        } else if (!data.planId) {
            return { auth: false, code: "server_planId_required", message: 'Missing planId parameter' }
        } else if (!data.source) {
            return { auth: false, code: "server_source_required", message: 'Missing source parameter' }
        } else if (!data.voltageLevel) {
            return { auth: false, code: "server_voltageLevel_required", message: 'Missing voltageLevel parameter' }
        } else if (!data.countryCode) {
            return { auth: false, code: "server_countryCode_required", message: 'Missing countryCode parameter' }
        } else if (data.latitude === null || data.latitude === undefined || isNaN(data.latitude)) {
            return { auth: false, code: "server_latitude_required", message: 'Missing latitude parameter' }
        } else if (data.longitude === null || data.longitude === undefined || isNaN(data.longitude)) {
            return { auth: false, code: "server_longitude_required", message: 'Missing longitude parameter' }
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}


function createDetailedTariffsCpo(foundTariff, source) {
    const context = "Function createDetailedTariffsCpo";
    try {
        let detailedTariffsCpo = []
        for (let element of foundTariff.elements) {
            let restrictions = element.restrictions
            for (let component of element.price_components) {
                // console.log( "restrictions" , JSON.stringify(restrictions))
                let { priceRoundGranularity, priceRoundRule, stepRoundGranularity, stepRoundRule } = Utils.roundingsValidation(component)
                if (source === global.girevePlatformCode || source === global.hubjectPlatformCode) {
                    component.price = Utils.roundingGranularityRules(priceRoundGranularity, priceRoundRule, component.price)
                    component.step_size = Utils.roundingGranularityRules(stepRoundGranularity, stepRoundRule, component.step_size)
                }
                let info = buildInfoObject(component, restrictions, source)
                let title = getTitle(info)

                let titleArray = [
                    ...removeUnnecessaryDateRestriction(title.flat),
                    ...removeUnnecessaryDateRestriction(title.energy),
                    ...removeUnnecessaryDateRestriction(title.time),
                    ...removeUnnecessaryDateRestriction(title.parking)
                ]
                infoArray = restructureTitleArrayDayRestriction(titleArray)
                detailedTariffsCpo.push(
                    {
                        label: info.label,
                        unit: info.unit,
                        unitPrice: info.componentPrice,
                        quantity: info.quantity,
                        total: info.totalPrice >= 0 ? info.totalPrice : info.cost,
                        title: titleArray,
                    }
                )

            }
        }
        return detailedTariffsCpo
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function buildInfoObject(component, restrictions, source) {
    const context = "Function buildInfoObject";
    try {
        return {
            quantity: 1,
            unit: unitByComponentType(component.type, source, component.step_size),
            cost: component.price,
            componentPrice: component.price,
            componentStepSize: component.step_size,
            component: component,
            restrictions: restrictions,
            source,
            label: labelByComponentType(component.type)
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return {
            quantity: 0,
            unit: "",
            cost: 0,
            componentPrice: 0,
            componentStepSize: 0,
            component: {},
            restrictions: {},
            source,
            label: "",
        }
    }
}

function unitByComponentType(type, source, step_size) {
    const context = "Function unitByComponentType"
    try {
        switch (type) {
            case 'ENERGY':
                return "kWh"
            case 'TIME':
                if (source === global.girevePlatformCode || source === global.hubjectPlatformCode) return "h"
                else return "min"
            case 'FLAT':
                return "UN"
            case 'PARKING_TIME':
                return source === global.girevePlatformCode ? "h" : "min"
            default:
                return "UN"
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return "UN"
    }
}

function labelByComponentType(type) {
    const context = "Function labelByComponentType"
    try {
        switch (type) {
            case 'ENERGY':
                return "cpoEnergy"
            case 'TIME':
                return "cpoTime"
            case 'FLAT':
                return "cpoFlat"
            case 'PARKING_TIME':
                return "cpoParkingTime"
            default:
                return "cpoFlat"
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return "cpoFlat"
    }
}

function restructureTitleArrayDayRestriction(array) {
    const context = "Function restructureTitleArrayDayRestriction"
    try {
        let dayIndex = array.findIndex(elem => elem.restrictionType === "day")
        if (dayIndex >= 0) {
            let insertElements = array[dayIndex].values.map(obj => buildRestrictionDayObj(obj))
            array.splice(dayIndex, 1, ...insertElements);
        }
        return array
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function buildRestrictionDayObj(obj) {
    const context = "Function buildRestrictionDayObj"
    try {
        return {
            restrictionType: "day",
            values: [
                {
                    "restrictionUom": obj.restrictionUom,
                    "restrictionValues": obj.restrictionValues,
                    "price": obj.price,
                    "step": obj.step,
                    "uom": obj.uom,
                    "currency": obj.currency,
                }
            ]
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return {}
    }
}

function createDetailedTariffsEmspMobiE(tariffCEME, tariffTAR, fees, activationFee, mobieDiscount) {
    const context = "Function createDetailedTariffsEmspMobiE";
    try {
        let detailedTariffsEmsp = []

        // Activation Entries
        let activationEntry = { label: "activationFee", unit: "UN", unitPrice: activationFee, group: "activation", title: defaultTitle("activationFee") }
        let mobieDiscountEntry = { label: "mobieDiscount", unit: "UN", unitPrice: mobieDiscount, group: "activation", title: defaultTitle("mobieDiscount") }
        let totalUnitPriceActivationWithDiscount = Utils.round(activationEntry.unitPrice + mobieDiscountEntry.unitPrice, 4)
        let activationWithDiscountEntry = { label: "activationFeeWithDiscount", unit: "UN", unitPrice: totalUnitPriceActivationWithDiscount, title: defaultTitle("activationFeeWithDiscount"), collapsable: true, collapseGroup: "activation" }

        detailedTariffsEmsp.push(activationWithDiscountEntry)
        detailedTariffsEmsp.push(activationEntry)
        detailedTariffsEmsp.push(mobieDiscountEntry)

        // Energy By Tariff Type Entries

        buildDetailedTariffsByTariffType(detailedTariffsEmsp, tariffCEME, tariffTAR, fees)

        return detailedTariffsEmsp



    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}


function buildDetailedTariffsByTariffType(detailedTariffsEmsp, tariffCEME, tariffTAR, fees) {
    const context = "Function buildDetailedTariffsByTariffType";
    try {

        // =================== Empty Entries =================== //

        // CEME
        let lowVoltageCemeEmpty = findElementInTariffArray(tariffCEME.tariff, process.env.voltageLevelBT, process.env.TariffTypeEmpty)
        let mediumVoltageCemeEmpty = findElementInTariffArray(tariffCEME.tariff, process.env.voltageLevelMT, process.env.TariffTypeEmpty)

        // TAR
        let lowVoltageTarEmpty = findElementInTariffArray(tariffTAR.tariff, process.env.voltageLevelBT, process.env.TariffTypeEmpty)
        let mediumVoltageTarEmpty = findElementInTariffArray(tariffTAR.tariff, process.env.voltageLevelMT, process.env.TariffTypeEmpty)

        // Push Entries
        let cemeEmptyEntry = {}
        let tarEmptyEntry = {}
        if (lowVoltageCemeEmpty && mediumVoltageCemeEmpty) {
            cemeEmptyEntry = {
                label: "ceme",
                unit: "kWh",
                // unitPrice : Utils.round((lowVoltageCemeEmpty.price + mediumVoltageCemeEmpty.price ) / 2 , 4),
                unitPriceLowVoltage: lowVoltageCemeEmpty.price,
                unitPriceMediumVoltage: mediumVoltageCemeEmpty.price,
                group: "energyEmpty",
                title: defaultTitle("ceme")
            }

        }

        if (lowVoltageTarEmpty && mediumVoltageTarEmpty) {
            tarEmptyEntry = {
                label: "tar",
                unit: "kWh",
                // unitPrice : Utils.round((lowVoltageTarEmpty.price + mediumVoltageTarEmpty.price ) / 2 , 4),
                unitPriceLowVoltage: lowVoltageTarEmpty.price,
                unitPriceMediumVoltage: mediumVoltageTarEmpty.price,
                group: "energyEmpty",
                title: defaultTitle("tar")
            }
        }


        let iecEmptyEntry = { label: "iec", unit: "kWh", /*unitPrice : fees.IEC, */ unitPriceLowVoltage: fees.IEC, unitPriceMediumVoltage: fees.IEC, group: "energyEmpty", title: defaultTitle("iec") }
        let cemeEmptyLowVoltagePrice = cemeEmptyEntry.unitPriceLowVoltage ?? 0
        let cemeEmptyMediumVoltagePrice = cemeEmptyEntry.unitPriceMediumVoltage ?? 0
        let tarEmptyLowVoltagePrice = tarEmptyEntry.unitPriceLowVoltage ?? 0
        let tarEmptyMediumVoltagePrice = tarEmptyEntry.unitPriceMediumVoltage ?? 0

        let emptyEntry = {
            label: "cemeTarIecEmpty",
            unit: "kWh",
            unitPriceLowVoltage: Utils.round(cemeEmptyLowVoltagePrice + tarEmptyLowVoltagePrice + iecEmptyEntry.unitPriceLowVoltage, 4),
            unitPriceMediumVoltage: Utils.round(cemeEmptyMediumVoltagePrice + tarEmptyMediumVoltagePrice + iecEmptyEntry.unitPriceMediumVoltage, 4),
            title: defaultTitle("cemeTarIecEmpty"),
            collapsable: true,
            collapseGroup: "energyEmpty"
        }

        detailedTariffsEmsp.push(emptyEntry)

        if (!Utils.isEmptyObject(cemeEmptyEntry)) detailedTariffsEmsp.push(cemeEmptyEntry)
        if (!Utils.isEmptyObject(tarEmptyEntry)) detailedTariffsEmsp.push(tarEmptyEntry)
        detailedTariffsEmsp.push(iecEmptyEntry)

        // =================== Out Empty Entries =================== //

        // CEME
        let lowVoltageCemeOutEmpty = findElementInTariffArray(tariffCEME.tariff, process.env.voltageLevelBT, process.env.TariffTypeOutEmpty)
        let mediumVoltageCemeOutEmpty = findElementInTariffArray(tariffCEME.tariff, process.env.voltageLevelMT, process.env.TariffTypeOutEmpty)

        // TAR
        let lowVoltageTarOutEmpty = findElementInTariffArray(tariffTAR.tariff, process.env.voltageLevelBT, process.env.TariffTypeOutEmpty)
        let mediumVoltageTarOutEmpty = findElementInTariffArray(tariffTAR.tariff, process.env.voltageLevelMT, process.env.TariffTypeOutEmpty)

        // Push Entries
        let cemeOutEmptyEntry = {}
        let tarOutEmptyEntry = {}
        if (lowVoltageCemeOutEmpty && mediumVoltageCemeOutEmpty) {
            cemeOutEmptyEntry = {
                label: "ceme",
                unit: "kWh",
                // unitPrice : Utils.round((lowVoltageCemeOutEmpty.price + mediumVoltageCemeOutEmpty.price ) / 2 , 4),
                unitPriceLowVoltage: lowVoltageCemeOutEmpty.price,
                unitPriceMediumVoltage: mediumVoltageCemeOutEmpty.price,
                group: "energyOutEmpty",
                title: defaultTitle("ceme")
            }

        }

        if (lowVoltageTarOutEmpty && mediumVoltageTarOutEmpty) {
            tarOutEmptyEntry = {
                label: "tar",
                unit: "kWh",
                // unitPrice : Utils.round((lowVoltageTarOutEmpty.price + mediumVoltageTarOutEmpty.price ) / 2 , 4),
                unitPriceLowVoltage: lowVoltageTarOutEmpty.price,
                unitPriceMediumVoltage: mediumVoltageTarOutEmpty.price,
                group: "energyOutEmpty",
                title: defaultTitle("tar")
            }
        }


        let iecOutEmptyEntry = { label: "iec", unit: "kWh", /*unitPrice : fees.IEC, */ unitPriceLowVoltage: fees.IEC, unitPriceMediumVoltage: fees.IEC, group: "energyOutEmpty", title: defaultTitle("iec") }
        let cemeOutEmptyLowVoltagePrice = cemeOutEmptyEntry.unitPriceLowVoltage ?? 0
        let cemeOutEmptyMediumVoltagePrice = cemeOutEmptyEntry.unitPriceMediumVoltage ?? 0
        let tarOutEmptyLowVoltagePrice = tarOutEmptyEntry.unitPriceLowVoltage ?? 0
        let tarOutEmptyMediumVoltagePrice = tarOutEmptyEntry.unitPriceMediumVoltage ?? 0

        let outEmptyEntry = {
            label: "cemeTarIecOutEmpty",
            unit: "kWh",
            unitPriceLowVoltage: Utils.round(cemeOutEmptyLowVoltagePrice + tarOutEmptyLowVoltagePrice + iecOutEmptyEntry.unitPriceLowVoltage, 4),
            unitPriceMediumVoltage: Utils.round(cemeOutEmptyMediumVoltagePrice + tarOutEmptyMediumVoltagePrice + iecOutEmptyEntry.unitPriceMediumVoltage, 4),
            title: defaultTitle("cemeTarIecOutEmpty"),
            collapsable: true,
            collapseGroup: "energyOutEmpty"
        }

        detailedTariffsEmsp.push(outEmptyEntry)

        if (!Utils.isEmptyObject(cemeOutEmptyEntry)) detailedTariffsEmsp.push(cemeOutEmptyEntry)
        if (!Utils.isEmptyObject(tarOutEmptyEntry)) detailedTariffsEmsp.push(tarOutEmptyEntry)
        detailedTariffsEmsp.push(iecOutEmptyEntry)

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function findElementInTariffArray(array, voltageLevel, tariffType) {
    const context = "Function findElementInTariffArray";
    try {
        return array.find(elem => elem.voltageLevel === voltageLevel && elem.tariffType === tariffType)
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null
    }
}

function validateDetailedTariffsRoaming(data) {
    const context = "Function validateDetailedTariffsRoaming"
    try {
        if (Utils.isEmptyObject(data)) {
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }
        } else if (!data.tariffId) {
            return { auth: false, code: "server_tariffId_required", message: 'Missing tariffId parameter' }
            // } else if (!data.planId) {
            //     return { auth: false, code: "server_planId_required", message: 'Missing planId parameter' }
        } else if (!data.source) {
            return { auth: false, code: "server_source_required", message: 'Missing source parameter' }
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}

async function detailedTariffsRoaming(data, resolve, reject) {
    const context = "Function detailedTariffsRoaming";
    try {

        let { tariffId, planId, source } = data

        let query = {
            id: tariffId
        }

        let foundTariff = await Tariff.findOne(query).lean()

        if (foundTariff) {
            let detailedTariffsCpo = createDetailedTariffsCpo(foundTariff, source)
            // temporary simplify rework
            let detailedTariffsComponentPrice = await createDetailedTariffsEmspRoaming(source, detailedTariffsCpo)

            // OLD Method, don't delete it will be reworked in the future
            // need to uncomment some things in createDetailedTariffsEmspGireve too
            //
            // let { detailedTariffsEmsp, foundPlatform, roamingTariff } = await createDetailedTariffsEmspRoaming(planId, source, detailedTariffsCpo)
            // let detailedTariffsComponentPrice = createDetailedTariffsComponentPriceGireve(foundPlatform, roamingTariff, detailedTariffsCpo)
            resolve({ detail: { /*emsp : detailedTariffsEmsp , cpo : detailedTariffsCpo , */ priceComponent: detailedTariffsComponentPrice } })
        } else {
            foundTariff = await Utils.getDefaultOPCTariff()
            if (foundTariff) {
                let detailedTariffsCpo = createDetailedTariffsCpo(foundTariff, source)
                let detailedTariffsComponentPrice = await createDetailedTariffsEmspRoaming(source, detailedTariffsCpo)
                // OLD Method, don't delete it will be reworked in the future
                // need to uncomment some things in createDetailedTariffsEmspGireve too
                //
                // let { detailedTariffsEmsp, foundPlatform, roamingTariff } = await createDetailedTariffsEmspGireve(planId, source, detailedTariffsCpo)
                // let detailedTariffsComponentPrice = createDetailedTariffsComponentPriceGireve(foundPlatform, roamingTariff, detailedTariffsCpo)

                resolve({ detail: { /* emsp : detailedTariffsEmsp , cpo : detailedTariffsCpo , */ priceComponent: detailedTariffsComponentPrice } })
            } else {
                resolve({ detail: {} })
            }
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        reject(error.message)
    }
}

async function createDetailedTariffsEmspRoaming(source, detailedTariffsCpo) {
    const context = "Function createDetailedTariffsEmspGireve";
    try {
        let detailedTariffsEmsp = []

        let foundPlatform = await Utils.findOnePlatform({ platformCode: source })
        let hubFee = null
        if (source === process.env.GirevePlatformCode) hubFee = foundPlatform ? (foundPlatform.hubFee ? foundPlatform.hubFee : Number(process.env.GireveCommission)) : Number(process.env.GireveCommission)
        else if (source === process.env.HubjectPlatformCode) hubFee = foundPlatform ? (foundPlatform.hubFee ? foundPlatform.hubFee : Number(process.env.HubjectCommission)) : Number(process.env.HubjectCommission)
        let planId = null

        //TODO: We should get the roamingTariff by the id and not by the source. We'll probably have many Roaming cemes to a specific network
        let roamingTariff = await getTariffCEMEbyPlan(null, source)


        let CEME_FLAT = roamingTariff.tariff.find(tariff => tariff.type === "flat")
        let CEME_POWER = roamingTariff.tariff.find(tariff => tariff.type === "energy")
        let CEME_TIME = roamingTariff.tariff.find(tariff => tariff.type === "time")
        let CEME_PERCENTAGE = roamingTariff.tariff.find(tariff => tariff.type === "percentage")
        // for Hubject
        let CEME_START_PERCENTAGE = roamingTariff.tariff.find(tariff => tariff.type === "start_percentage")
        let CEME_ENERGY_PERCENTAGE = roamingTariff.tariff.find(tariff => tariff.type === "energy_percentage")
        let CEME_TIME_PERCENTAGE = roamingTariff.tariff.find(tariff => tariff.type === "time_percentage")

        // for Hubject
        let CEME_Price_Start_Percentage = CEME_START_PERCENTAGE ? CEME_START_PERCENTAGE.price : 0
        let CEME_Price_Energy_Percentage = CEME_ENERGY_PERCENTAGE ? CEME_ENERGY_PERCENTAGE.price : 0
        let CEME_Price_Time_Percentage = CEME_TIME_PERCENTAGE ? CEME_TIME_PERCENTAGE.price : 0

        let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
        let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
        let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
        let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

        let cemeFlatUom = CEME_FLAT ? CEME_FLAT.uom : "UN"
        let cemePowerUom = CEME_POWER ? CEME_POWER.uom : "kWh"
        let cemeTimeUom = CEME_TIME ? CEME_TIME.uom : "min"

        let flatEntry = { label: "defaultFlat", unit: cemeFlatUom.toUpperCase(), unitPrice: Utils.round(CEME_Price_FLAT + hubFee, 4), title: defaultTitle("defaultFlat") }
        let energyEntry = { label: "defaultEnergy", unit: cemePowerUom, unitPrice: CEME_Price_POWER, title: defaultTitle("defaultEnergy") }
        let timeEntry = { label: "defaultTime", unit: cemeTimeUom, unitPrice: CEME_Price_TIME, title: defaultTitle("defaultTime") }

        if (CEME_Price_FLAT + hubFee) detailedTariffsEmsp.push(flatEntry)
        if (CEME_Price_POWER) detailedTariffsEmsp.push(energyEntry)
        if (CEME_Price_TIME) detailedTariffsEmsp.push(timeEntry)

        // OLD format, it will be needed in the future so don't delete !!
        //
        // let detailedTariffsEmspPercentage = buildDetailedTariffsEmspPercentage(detailedTariffsCpo, evioPercentage)
        // detailedTariffsEmsp = joinUnitPriceArrays(detailedTariffsEmsp, detailedTariffsEmspPercentage)
        // return { detailedTariffsEmsp, evioPercentage, foundPlatform, roamingTariff }

        // New format temporary
        let detailedTariffsComponentPricePercentage = buildDetailedTariffsComponentPricePercentage(detailedTariffsCpo, evioPercentage, CEME_Price_Start_Percentage, CEME_Price_Energy_Percentage, CEME_Price_Time_Percentage)
        const detailedTariffsComponentPrice = joinUnitPriceArrays(detailedTariffsEmsp, detailedTariffsComponentPricePercentage)

        return detailedTariffsComponentPrice

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return { detailedTariffsEmsp: [], evioPercentage: 0, foundPlatform: {}, roamingTariff: {} }
    }
}

function buildDetailedTariffsEmspPercentage(detailedTariffsCpo, evioPercentage) {
    const context = "Function buildDetailedTariffsEmspPercentage";
    try {
        return detailedTariffsCpo.map(element => mapEmspToPercentage(element, evioPercentage)).filter(obj => obj)
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function mapEmspToPercentage(element, evioPercentage) {
    const context = "Function mapEmspToPercentage";
    try {
        let title = element.title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: Utils.round(value.price * evioPercentage, 4) } }) } })
        let unitPrice = Utils.round(element.unitPrice * evioPercentage, 4)
        return {
            ...element,
            unitPrice,
            title,
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null
    }
}

function joinUnitPriceArrays(array, arrayToJoin) {
    const context = "Function joinUnitPriceArrays";
    try {
        for (let element of arrayToJoin) {
            let restrictionType = element.title[0].restrictionType
            let defaultEntryIndex = array.findIndex(obj => obj.title.find(title => restrictionType.includes('default') && title.restrictionType.includes(restrictionType)))
            if (defaultEntryIndex > -1) {
                let unitPrice = Utils.round(array[defaultEntryIndex].unitPrice + element.unitPrice, 4)
                let title = array[defaultEntryIndex].title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: unitPrice } }) } })
                array[defaultEntryIndex] = { ...array[defaultEntryIndex], unitPrice, title }
            } else {
                array.push(element)
            }
        }
        return array
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return array
    }
}

function createDetailedTariffsComponentPriceGireve(foundPlatform, roamingTariff, detailedTariffsCpo) {
    const context = "Function createDetailedTariffsComponentPriceGireve";
    try {
        let detailedTariffsComponentPrice = []

        let hubFee = foundPlatform ? (foundPlatform.hubFee ? foundPlatform.hubFee : Number(process.env.GireveCommission)) : Number(process.env.GireveCommission)


        let CEME_FLAT = roamingTariff.tariff.find(tariff => tariff.type === "flat")
        let CEME_POWER = roamingTariff.tariff.find(tariff => tariff.type === "energy")
        let CEME_TIME = roamingTariff.tariff.find(tariff => tariff.type === "time")
        let CEME_PERCENTAGE = roamingTariff.tariff.find(tariff => tariff.type === "percentage")

        let CEME_Price_FLAT = CEME_FLAT ? CEME_FLAT.price : 0
        let CEME_Price_POWER = CEME_POWER ? CEME_POWER.price : 0
        let CEME_Price_TIME = CEME_TIME ? CEME_TIME.price : 0
        let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

        let cemeFlatUom = CEME_FLAT ? CEME_FLAT.uom : "UN"
        let cemePowerUom = CEME_POWER ? CEME_POWER.uom : "kWh"
        let cemeTimeUom = CEME_TIME ? CEME_TIME.uom : "min"

        let flatEntry = { label: "defaultFlat", unit: cemeFlatUom.toUpperCase(), unitPrice: Utils.round(CEME_Price_FLAT + hubFee, 4), title: defaultTitle("defaultFlat") }
        let energyEntry = { label: "defaultEnergy", unit: cemePowerUom, unitPrice: CEME_Price_POWER, title: defaultTitle("defaultEnergy") }
        let timeEntry = { label: "defaultTime", unit: cemeTimeUom, unitPrice: CEME_Price_TIME, title: defaultTitle("defaultTime") }

        if (CEME_Price_FLAT + hubFee) detailedTariffsComponentPrice.push(flatEntry)
        if (CEME_Price_POWER) detailedTariffsComponentPrice.push(energyEntry)
        if (CEME_Price_TIME) detailedTariffsComponentPrice.push(timeEntry)

        // detailedTariffsComponentPrice.push(flatEntry)
        // detailedTariffsComponentPrice.push(energyEntry)
        // detailedTariffsComponentPrice.push(timeEntry)

        let detailedTariffsComponentPricePercentage = buildDetailedTariffsComponentPricePercentage(detailedTariffsCpo, evioPercentage)
        detailedTariffsComponentPrice = joinUnitPriceArrays(detailedTariffsComponentPrice, detailedTariffsComponentPricePercentage)

        return detailedTariffsComponentPrice

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function buildDetailedTariffsComponentPricePercentage(detailedTariffsCpo, evioPercentage, cemePriceStartPercentage, cemePriceEnergyPercentage, cemePriceTimePercentage) {
    const context = "Function buildDetailedTariffsComponentPricePercentage";
    try {
        return detailedTariffsCpo.map(element => mapJoinPercentage(element, evioPercentage, cemePriceStartPercentage, cemePriceEnergyPercentage, cemePriceTimePercentage)).filter(obj => obj)
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function mapJoinPercentage(element, evioPercentage, cemePriceStartPercentage, cemePriceEnergyPercentage, cemePriceTimePercentage) {
    const context = "Function mapJoinPercentage";
    try {
        let cemePercentage = 0
        if (element.label.includes("Flat") && cemePriceStartPercentage) cemePercentage = cemePriceStartPercentage
        else if (element.label.includes('Energy') && cemePriceEnergyPercentage) cemePercentage = cemePriceEnergyPercentage
        else if (element.label.includes('Time') && cemePriceTimePercentage) cemePercentage = cemePriceTimePercentage
        let title = element.title.map(title => { return { ...title, values: title.values.map(value => { return { ...value, price: Utils.round(value.price + value.price * evioPercentage + cemePercentage * value.price, 4) } }) } })
        let unitPrice = Utils.round(element.unitPrice + element.unitPrice * evioPercentage + cemePercentage * element.unitPrice, 4)
        return {
            ...element,
            unitPrice,
            title,
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null
    }
}

function validateDetailedTariffsEvio(data) {
    const context = "Function validateDetailedTariffsEvio"
    try {
        if (Utils.isEmptyObject(data)) {
            return { auth: false, code: "server_body_required", message: 'Invalid or missing id parameters' }
        } else if (Utils.isEmptyObject(data.tariff) || Object.prototype.toString.call(data.tariff) !== '[object Object]') {
            return { auth: false, code: "server_tariff_required", message: 'tariff required' }
        } else if (!data.source) {
            return { auth: false, code: "server_source_required", message: 'Missing source parameter' }
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return { auth: false, code: "", message: error.message }
    }
}

async function detailedTariffsEvio(data, resolve, reject) {
    const context = "Function detailedTariffsEvio";
    try {
        let detailedTariffs = buildDetailedTariffsCpoEvio(data.tariff)
        resolve({ detail: { priceComponent: detailedTariffs } })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        reject(error.message)
    }

}

function buildDetailedTariffsCpoEvio(tariff) {
    const context = "Function buildDetailedTariffsCpoEvio";
    try {
        switch (tariff.tariffType) {
            case process.env.TariffByPower:
                return pushDetailedTariffsCpoEntriesEvio(tariff, 'defaultEnergy')
            case process.env.TariffByTime:
                return pushDetailedTariffsCpoEntriesEvio(tariff, 'defaultTime')
            default:
                return pushDetailedTariffsCpoEntriesEvio(tariff, 'defaultTime')
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function pushDetailedTariffsCpoEntriesEvio(tariff, chargingLabel) {
    const context = "Function pushDetailedTariffsCpoEntriesEvio";
    try {
        let entries = []
        let evioTariff = tariff.tariff ? JSON.parse(JSON.stringify(tariff.tariff)) : tariff.tariff
        Utils.adjustRestrictions(evioTariff)
        if (!Utils.isEmptyObject(evioTariff)) {
            // Activation Fee
            pushEntry(entries, 'defaultFlat', 'UN', evioTariff.activationFee)

            // Booking
            pushEntry(entries, 'myChargersTariffs_reserve', evioTariff.bookingAmount.uom, evioTariff.bookingAmount.value)

            // Charging
            pushEntry(entries, chargingLabel, evioTariff.chargingAmount.uom, evioTariff.chargingAmount.value)

            // Parking
            pushEntry(entries, 'myChargersTariffs_parking_after_charging', evioTariff.parkingAmount.uom, evioTariff.parkingAmount.value)

            // Parking During Charging
            pushEntry(entries, 'myChargersTariffs_parking_during_charging', evioTariff.parkingDuringChargingAmount.uom, evioTariff.parkingDuringChargingAmount.value)
        } else {
            console.log(`[${context}] Tariff detailed object is empty`)
        }
        return entries
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function buildEntry(label, unit, unitPrice) {
    const context = "Function buildEntry";
    try {
        return { label, unit, unitPrice, title: [{ "restrictionType": label, "values": [{ "restrictionValues": {} }] }], }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null
    }
}

function pushEntry(array, label, unit, unitPrice) {
    const context = "Function pushEntry";
    try {
        let entry = buildEntry(label, unit, unitPrice)
        if (entry && entry.unitPrice >= 0) {
            array.push(entry)
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
    }
}

function getUnroundedValue(emspEntries) {
    try {
        let cleanEmspEntries = emspEntries.filter((emsp, index, self) =>
            emsp.quantity > 0 && index === self.findIndex(t => (t.label === emsp.label && t.unitPrice === emsp.unitPrice))
        );

        return cleanEmspEntries.reduce((accumulator, object) => accumulator + (object.unitPrice * object.quantity), 0);
    } catch (error) {
        console.log(`[Function getUnroundedValue] Error `, error.message);
        return 0;
    }
}

function calculateCpoDetails(
  flatInfo,
  energyInfo,
  timeInfo,
  total_energy,
  totalKmToUse,
  evEfficiencyPerKwhPerKm
) {
  const cpo = { entries: [], total: 0, totalBykWh: 0, totalByKmh: 0 };

  pushOpcInfo(cpo.entries, flatInfo, "cpoFlat");
  pushOpcInfo(cpo.entries, energyInfo, "cpoEnergy");
  pushOpcInfo(cpo.entries, timeInfo, "cpoTime");

  const totalPriceCpo = sumTotal(cpo.entries);
  const totalBykWhCpo =
    total_energy > 0 ? Utils.round(totalPriceCpo / total_energy) : 0;

  const totalByKmhCpo =
    total_energy > 0
      ? Utils.round(
          (totalPriceCpo / (total_energy / evEfficiencyPerKwhPerKm)) *
            totalKmToUse
        )
      : 0;
  cpo.total = totalPriceCpo;
  cpo.totalBykWh = totalBykWhCpo;
  cpo.totalByKmh = totalByKmhCpo;

  return cpo;
}

function calculateVatDetails(
  total,
  total_energy,
  totalKmToUse,
  evEfficiencyPerKwhPerKm,
  fees
) {
  const vat = {
    total: 0,
    totalBykWh: 0,
    percentage: fees.IVA * 100,
    totalByKmh: 0,
  };

  const totalUnitPriceVat = Utils.round(total);
  const totalPriceVat = Utils.round(totalUnitPriceVat * fees.IVA);

  vat.total = totalPriceVat;
  vat.totalBykWh = total_energy > 0 ? Utils.round(totalPriceVat / total_energy) : 0;
  vat.totalByKmh =
    total_energy > 0
      ? Utils.round(
          (totalPriceVat / (total_energy / evEfficiencyPerKwhPerKm)) *
            totalKmToUse
        )
      : 0;

  return vat;
}

function calculateTotalDetails(
  totalInclVat,
  total_energy,
  total_charging_time,
  totalKmToUse,
  evEfficiencyPerKwhPerKm
) {
  const total = {
    total: 0,
    totalBykWh: 0,
    totalKm: 0,
    totalByTime: 0,
    totalByKmh: 0,
  };

  const totalPrice = Utils.round(totalInclVat);
  const totalPriceBykWh =
    total_energy > 0 ? Utils.round(totalPrice / total_energy) : 0;
  const totalPriceByKmh =
    total_energy > 0
      ? Utils.round(
          (totalPrice / (total_energy / evEfficiencyPerKwhPerKm)) * totalKmToUse
        )
      : 0;
  const totalKmGivenEnergy =
    total_energy > 0 ? Utils.round(total_energy / evEfficiencyPerKwhPerKm) : 0;
  total.total = totalPrice;
  total.totalBykWh = totalPriceBykWh;
  total.totalByTime =
    total_charging_time > 0
      ? Utils.round(totalPrice / (total_charging_time * 60))
      : 0;
  total.totalByKmh = totalPriceByKmh;
  total.totalKm = totalKmGivenEnergy;
  total.totalEnergy = total_energy;

  return total;
}