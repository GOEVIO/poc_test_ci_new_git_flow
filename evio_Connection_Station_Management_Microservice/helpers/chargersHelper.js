const axios = require("axios");
const { findPublicChargersToRankings } = require("evio-library-chargers").default;
const { connectChargerType } = require("../services/publicNetworkService");
const { getChargersEVIONetWork } = require("../services/chargerService");
const { getSession } = require("../apis/ocpi_22");
const { verifyNotifymeHistory } = require("../services/notificationService");
const { getTeslaTariff } = require("../apis/publicTariff");
const { mapLatLng } = require("../mappers/chargersMapper");
const { PlugStatus, ChargerSubStatus } = require("../utils/enums/enumPlugs");
const {
    addAdditionalTariffInfo,
    calculatePercentage,
    calculatePowerValue,
    calculateTimeValue,
    getChargerOffset,
    getTimezone,
    updatePlugTariff,
} = require('../utils/utils');
const { calculateOpcTariffPrices } = require('../services/tariff/opcTariffHandler');
const { getOpcTariffsPrices } = require("../apis/ocpi_22");
const { getCEMEandTar, getTariffCEMEbyPlan } = require("../caching/tariffs");
const { getFees } = require("../caching/fees");
const { findOnePlatform } = require("../caching/platforms");
const Constants = require("../utils/constants");
const toggle = require('evio-toggle').default;
const { TariffsService } = require("evio-library-ocpi");
const { Enums } = require('evio-library-commons').default;

async function getAllPublicChargers(publicHost, params, dataPublic, res, clientName, userId, filter, req) {
    const context = "Function getAllPublicChargers";
    try {
        return await findPublicChargersToRankings(params, dataPublic, userId);
    } catch (error) {
        console.error(`${context} - Error`, error.message);
        throw error;
    }
}



async function getAllChargers(host, publicHost, params, data, dataPublic, res, clientName, userId, filter, req) {
    const context = "Function getAllChargers";
    try {
        const headers = {
            clientname: clientName,
            ...(userId && { userId: userId })
        };

        let [evioChargers, publicChargers] = await Promise.all([
            getChargersEVIONetWork(host, headers, params, data),
            connectChargerType(publicHost, headers, params, dataPublic)
        ]);
        const chargersToFilterForDuplicates = [...evioChargers, ...publicChargers];
        if (chargersToFilterForDuplicates.length === 0) {
            return [];
        } else {
            return chargersToFilterForDuplicates.filter(isUniqueOrAvailableCharger);
        }
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    };
};

function isUniqueOrAvailableCharger(charger, index, chargersArray) {
    const isAvailable = charger.status === PlugStatus.AVAILABLE;
    const isFirstOccurrence = chargersArray.findIndex(c => c.hwId === charger.hwId) === index;

    return isAvailable || (isFirstOccurrence);
}


function sortPlugPrices(plugPriceA, plugPriceB, filterBy , onlyAvailable = false , onlyOnline = false) {
    switch (filterBy) {
        case process.env.FILTERBYUNITPRICE:
            return calculateSortingValue(plugPriceA.priceBy100Km.value , plugPriceB.priceBy100Km.value, plugPriceA.status , plugPriceB.status , onlyAvailable , onlyOnline)
        case process.env.FILTERBYTOTALPRICE:
            return calculateSortingValue(plugPriceA.totalPrice.value , plugPriceB.totalPrice.value, plugPriceA.status , plugPriceB.status , onlyAvailable , onlyOnline)
        case process.env.FILTERBYENERGY:
            if (plugPriceB.morePercentage === plugPriceA.morePercentage) {
                return calculateSortingValue(plugPriceB.power , plugPriceA.power, plugPriceA.status , plugPriceB.status , onlyAvailable , onlyOnline)
            } else {
                return calculateSortingValue(plugPriceB.moreKwh , plugPriceA.moreKwh, plugPriceA.status , plugPriceB.status , onlyAvailable , onlyOnline)
            }
        default:
            return 0;
    }
}

function calculateSortingValue(priceA , priceB, statusA , statusB , onlyAvailable , onlyOnline) {
    const isAvailable = status => status === PlugStatus.AVAILABLE;
    const isOnline = status => status !== PlugStatus.UNAVAILABLE;

    if (onlyAvailable) {
        // Prioritize availability
        if (isAvailable(statusA) && !isAvailable(statusB)) return -1; // "A" comes first
        if (!isAvailable(statusA) && isAvailable(statusB)) return 1;  // "B" comes first
    } else if (onlyOnline) {
        // Prioritize not offline status
        if (isOnline(statusA) && !isOnline(statusB)) return -1; // "A" comes first
        if (!isOnline(statusA) && isOnline(statusB)) return 1;  // "B" comes first
    }

    // Default sorting based on price
    return priceA - priceB;
}

function sortChargers(filterBy, newChargers, locationCoordinates , onlyAvailable , onlyOnline) {
    if (!Array.isArray(newChargers) || newChargers.length === 0) {
        return [];
    }

    newChargers = newChargers.filter((charger) => charger && charger.plugPrice && charger.plugPrice.length > 0);

    newChargers.forEach((charger) => {
        charger.plugPrice.sort((plugPriceA, plugPriceB) => sortPlugPrices(plugPriceA, plugPriceB, filterBy , onlyAvailable , onlyOnline));
    });

    newChargers.sort((chargerA, chargerB) => {
        if (filterBy === process.env.FILTERBYDISTANCE) {
            return (
                getDistance(locationCoordinates, chargerA.latLng) - getDistance(locationCoordinates, chargerB.latLng)
            );
        }
        /* 
            Here we don't need to pass the onlyAvailable and onlyOnline parameters since the plugs are already sorted between them.
            This function here is actually sorting the cargers based on their plug price.
        */
        return sortPlugPrices(chargerA.plugPrice[0], chargerB.plugPrice[0], filterBy);
    });

    const chargersToResponse = newChargers.slice(0, 10);
    return chargersToResponse;
}

function getDistance(coordinatesApp, coordinatesCharger) {
    const context = "Function getDistance";

    return new Promise(async (resolve, reject) => {
        let latApp = coordinatesApp.lat;
        let logApp = coordinatesApp.lng;
        let latCharger = coordinatesCharger[1];
        let logCharger = coordinatesCharger[0];

        if (latApp === latCharger && logApp === logCharger) resolve(0);
        else {
            let radlat1 = (Math.PI * latApp) / 180;
            let radlat2 = (Math.PI * latCharger) / 180;
            let theta = logApp - logCharger;
            let radtheta = (Math.PI * theta) / 180;
            let dist =
                Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
            if (dist > 1) {
                dist = 1;
            }
            dist = Math.acos(dist);
            dist = (dist * 180) / Math.PI;
            dist = dist * 60 * 1.1515;
            dist = dist * 1.609344;

            resolve(Number(dist.toFixed(2)));
        }
    });
}

function filterChargersMapResponse(chargers, mapFunction) {
    const context = 'Function ChargersHandlers filterChargersResponse';
    try {
        return chargers.map((charger) => mapFunction(charger));
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return chargers;
    }
}


function chargerMapObject(charger) {
    const { _id, plugs, chargerType, status, createUser, name, clientName, icons } = charger;
    let plugStatusAvailable = status;
    if (status === PlugStatus.AVAILABLE) {
        plugStatusAvailable = getChargerStatus(plugs)
    }

    const latLng = charger.latLng ? charger.latLng : mapLatLng(charger);

    return {
        _id,
        latLng,
        chargerType,
        status: plugStatusAvailable,
        createUser,
        clientName,
        name,
        icons,
    };
}

  /**
   * Return the charger status by checking the status of its plugs.
   * The logic is as follows:
   * - If at least one plug is available, return PlugStatus.AVAILABLE
   * - If all plugs are in use, return PlugStatus.IN_USE
   * - If all plugs are unavailable, return PlugStatus.OFFLINE
   * - If none of the conditions match, return PlugStatus.IN_USE (this will mean that there are some plugs in use and some unavailable)
   * @param plugs the plugs of the charger
   * @returns the status of the charger
   */
function getChargerStatus(plugs) {
    // Check if at least one status is "10"
    if (plugs.some(plug => plug.status === PlugStatus.AVAILABLE)) {
      return PlugStatus.AVAILABLE;
    }
    
    // Check if all statuses are "20"
    if (plugs.every(plug => plug.status === PlugStatus.IN_USE)) {
      return PlugStatus.IN_USE;
    }
    
    // Check if all statuses are "40"
    if (plugs.every(plug => plug.status === PlugStatus.UNAVAILABLE)) {
      return PlugStatus.OFFLINE;
    }
    
    // If none of the conditions match, return the charger as charging
    return PlugStatus.IN_USE;
  }

function chargerMapReturnObject(charger) {
    try {
        const { _id, geometry, plugs, chargerType, status, createUser, name } = charger;
        return {
            _id,
            geometry,
            plugs: plugs.map((plug) => plugReturnObject(plug)),
            chargerType,
            status,
            createUser,
            name,
        };
    } catch (error) {
        return charger;
    }
}

function plugReturnObject(plug) {
    try {
        return {
            status: plug.status,
        };
    } catch (error) {
        return plug;
    }
}

async function updatePlug(plugUnit, chargerFound, userId) {
    const context = "function updatePlug";
    const find = buildFindQuery(plugUnit, userId);

    plugUnit.statusTime = plugUnit.statusTime || calculateStatusTime(chargerFound);

    if (plugUnit.subStatus !== ChargerSubStatus.AVAILABLE) {
        try {

            let canBeNotified = await verifyNotifymeHistory(find);
            plugUnit.canBeNotified = canBeNotified;

            if (plugUnit.canBeNotified) {
                await handleChargerTypes(plugUnit, chargerFound, userId, context);
            }
        } catch (error) {
            console.error(`[${context}][.catch] Error `, error.message);
            throw error;
        }
    }
}

function buildFindQuery(plugUnit, userId) {
    return {
        hwId: plugUnit.hwId,
        plugId: plugUnit.plugId,
        listOfUsers: {
            $elemMatch: {
                userId: userId,
            },
        },
        active: true,
    };
}

function calculateStatusTime(chargerFound) {
    const dateNow = new Date();
    const updatedAt = new Date(chargerFound.updatedAt);
    return (dateNow.getTime() - updatedAt.getTime()) / 60000;
}

async function handleChargerTypes(plugUnit, chargerFound, userId, context) {
    const body = {
        $and: [{ userId: userId }, { connector_id: plugUnit.plugId }, { status: "ACTIVE" }],
    };
    const chargerTypes = process.env.PublicNetworkChargerType;

    if (chargerTypes.includes(chargerFound.chargerType)) {
        try {
            const result = await getSession(body);
            plugUnit.canBeNotified = result.length <= 0;
        } catch (err) {
            console.error(`[${context}][ChargingSession.findOne] Error `, err.message);
            throw err;
        }
    }
}

function extractRequestData(request) {
    const {
        headers: { userid },
        body: {
            useableBatteryCapacity = 62.0,
            maxFastChargingPower,
            internalChargePower = 11.0,
            evEfficiency = 171,
            fleetId,
            sessionStartDate,
            chargingTime,
            planId,
            roamingPlanId,
        },
    } = request;

    return {
        userid,
        useableBatteryCapacity,
        maxFastChargingPower,
        internalChargePower,
        evEfficiency,
        fleetId,
        sessionStartDate,
        chargingTime,
        planId,
        roamingPlanId,
    };
}


function initializeCaches() {
    return {
        tariffCache: new Map(),
        tariffDataCache: new Map(),
        roamingTariffCache: new Map(),
        feesCache: new Map(),
        platformCache: new Map(),
    };
}

async function populateTariffCaches(foundChargers, planId, roamingPlanId, caches) {
    await populateTariffInformation(
        foundChargers,
        planId,
        roamingPlanId,
        caches.tariffDataCache,
        caches.roamingTariffCache,
        caches.feesCache,
        caches.platformCache
    );
}


async function calculatePlugTariffs(plug, chargerData, caches, context, response, request, isPublicNetwork, callCache, userGroupCSUsers=[]) {
    const {
        userid,
        totalBatteryCapacityEV,
        chargingCapacityEV,
        internalChargingCapacityEV,
        evEfficiencyEV,
        sessionStartDate,
        sessionStopDate,
        fleetId,
        chargingTime,
        planId,
        roamingPlanId,
        defaultTariff,
        countryCode,
        timeZone,
        offset,
        ccsAndChademoTypes,
        userTariffs,
        fleetOwner,
    } = chargerData;

    const isFastCharging = ccsAndChademoTypes.includes(plug.connectorType);
    const powerValue = calculatePowerValue(
        plug,
        isFastCharging ? chargingCapacityEV : internalChargingCapacityEV,
        totalBatteryCapacityEV
    );
    const timeValue = calculateTimeValue(
        plug,
        isFastCharging ? chargingCapacityEV : internalChargingCapacityEV,
        totalBatteryCapacityEV,
        chargingTime
    );
    const consumption = Math.round(powerValue * timeValue);

    const tariffsToCalculate = determineTariffsToCalculate(plug, isPublicNetwork, fleetId, userGroupCSUsers);
    const userTariff = TariffsService.getUserTariffOnMap(userTariffs, fleetOwner, chargerData.foundCharger.partyId, countryCode, plug.power);

    const plugTariffPromises = tariffsToCalculate.map(async (tariff) => {
        const data = createData(
            sessionStartDate,
            sessionStopDate,
            offset,
            plug,
            consumption,
            chargingTime,
            countryCode,
            chargerData.foundCharger,
            evEfficiencyEV,
            isPublicNetwork ? chargerData.foundCharger.source : Constants.networks.evio.name,
            isPublicNetwork ? { _id: tariff } : tariff,
            timeZone,
            planId,
            roamingPlanId,
            chargerData.internalChargePower,
            chargerData.maxFastChargingPower,
            chargerData.useableBatteryCapacity,
            caches.tariffDataCache.get(
                `${planId}-${timeZone}-${chargerData.foundCharger.source ?? Constants.networks.evio.name}`
            ),
            caches.feesCache.get(`${countryCode}:${chargerData.zone}`),
            caches.platformCache.get(chargerData.foundCharger.source),
            defaultTariff,
            caches.roamingTariffCache.get(chargerData.foundCharger.source),
            userTariff,
        );

        return calculateTariff(
            caches.tariffCache,
            data,
            context,
            consumption,
            totalBatteryCapacityEV,
            plug,
            timeZone,
            offset,
            countryCode,
            powerValue,
            callCache,
            response,
            request
        );
    });

    return Promise.all(plugTariffPromises);
}

function determineTariffsToCalculate(plug, isPublicNetwork, fleetId, userGroupCSUsers=[]) {
    if (isPublicNetwork) {
        return plug.tariffId;
    } else {
        return plug.tariff.filter((tariff) => {
            if (fleetId && tariff.fleetId === fleetId) {
                return true;
            }

            if (tariff.groupId && Array.isArray(userGroupCSUsers)) {
                return userGroupCSUsers.includes(tariff.groupId);
            }

            return tariff.groupName === 'Public';
        });
    }
}

function extractChargerDetails(foundCharger) {
    const countryCode = foundCharger.countryCode || Constants.defaultCountry;
    const [longitude, latitude] = foundCharger.geometry.coordinates;
    const timeZone = getTimezone(latitude, longitude);

    const zone =
        foundCharger?.address?.zone ?? (countryCode === Constants.defaultCountry ? Constants.defaultZone : null);
    const offset = getChargerOffset(timeZone, countryCode);

    return {
        countryCode,
        timeZone,
        zone,
        offset,
        longitude,
        latitude,
    };
}

async function processFoundCharger(
    foundCharger,
    chargerData,
    caches,
    context,
    response,
    request,
    mappingFunction,
    isPublicNetwork,
    callCache,
    userGroupCSUsers=[]
) {
    const chargerDetails = extractChargerDetails(foundCharger);

    const tariffPromises = foundCharger.plugs
        .map((plug) =>
            calculatePlugTariffs(
                plug,
                { ...chargerData, foundCharger, ...chargerDetails },
                caches,
                context,
                response,
                request,
                isPublicNetwork,
                callCache,
                userGroupCSUsers
            )
        )
        .flat();

    await Promise.all(tariffPromises);
    return mappingFunction(foundCharger, chargerData.userid);
}

function createData(
    sessionStartDate,
    sessionStopDate,
    offset,
    plug,
    consumption,
    timeCharger,
    countryCode,
    chargerFound,
    evEfficiency,
    source,
    tariff,
    timeZone,
    planId,
    roamingPlanId,
    internalChargerPower,
    maxFastChargingPower,
    useableBatteryCapacity,
    tariffData,
    fees,
    platform,
    defaultTariff,
    roamingTariff,
    userTariff,
) {
    return {
        sessionStartDate,
        sessionStopDate,
        offset,
        power: plug.power,
        voltage: plug.voltage,
        total_energy: consumption,
        total_charging_time: timeCharger / 60,
        total_parking_time: 0,
        countryCode,
        partyId: chargerFound.partyId,
        source: source,
        evseGroup: plug.evseGroup,
        evEfficiency: evEfficiency,
        longitude: chargerFound.geometry.coordinates[0],
        latitude: chargerFound.geometry.coordinates[1],
        tariff: tariff,
        address: chargerFound.address,
        timeZone: timeZone,
        voltageLevel: chargerFound.voltageLevel,
        planId: planId,
        roamingPlanId: roamingPlanId,
        internalChargerPower: internalChargerPower,
        maxFastChargingPower: maxFastChargingPower,
        useableBatteryCapacity: useableBatteryCapacity,
        elements: userTariff ? userTariff.elements : plug.serviceCost?.elements,
        tariffCEME: tariffData?.tariffCEME,
        tariffTAR: tariffData?.tariffTAR,
        TAR_Schedule: tariffData?.TAR_Schedule,
        fees: fees,
        platform: platform,
        defaultTariff: defaultTariff,
        roamingTariff: roamingTariff,
        tariffs : userTariff ? [userTariff] : plug.serviceCost?.tariffs
    };
}
async function calculateTariff(
    tariffCache,
    tariffData,
    context,
    consumption,
    totalBatteryCapacityEV,
    plug,
    timeZone,
    offset,
    countryCode,
    powerValue,
    callCache,
    response,
    request
) {
    const tariffKey = generateTariffKey(tariffData, plug);

    if (!tariffCache.has(tariffKey)) {
        try {
            await calculateAndSetTariff(
                tariffCache,
                tariffKey,
                tariffData,
                callCache,
                request,
                response,
                consumption,
                totalBatteryCapacityEV,
                powerValue,
                offset,
                timeZone,
                countryCode
            );
        } catch (error) {
            handleTariffError(context, error, tariffCache, tariffKey);
        }
    }

    updatePlugTariff(plug, tariffCache.get(tariffKey), tariffData);
}

function generateTariffKey(tariffData, plug) {
    const elementsKey = tariffData?.elements?.map((element) => element._id).join('');
    return (
        (tariffData?.tariff?._id || '') +
        (plug?.power || '') +
        (plug?.voltage || '') +
        (elementsKey || '') +
        (tariffData?.voltageLevel || '')
    );
}

async function calculateAndSetTariff(
    tariffCache,
    tariffKey,
    tariffData,
    callCache,
    request,
    response,
    consumption,
    totalBatteryCapacityEV,
    powerValue,
    offset,
    timeZone,
    countryCode
) {
    let tariff = callCache
        ? calculateOpcTariffPrices(tariffData, request, response)
        : await getOpcTariffsPrices(tariffData);
    tariff.detail.total.totalPercentage = calculatePercentage(consumption, totalBatteryCapacityEV);
    tariff.power = powerValue;

    addAdditionalTariffInfo(tariff, offset, timeZone, countryCode);
    if (!tariff._id) tariff._id = tariffData.tariff._id;
    tariffCache.set(tariffKey, tariff);
}

function handleTariffError(context, error, tariffCache, tariffKey) {
    console.error(`[${context}][getOpcTariffsPrices] Error `, error.response?.data?.message ?? error);
    tariffCache.set(tariffKey, {});
}

async function populateTariffInformation(
    foundChargers,
    planId,
    roamingPlanId,
    tariffDataCache,
    roamingTariffCache,
    feesCache,
    platformCache
) {
    const defaultCountryCode = "PT";
    for (let i = 0; i < foundChargers.length; i++) {
        const charger = foundChargers[i];
        const timeZone = getTimezone(charger.geometry.coordinates[1], charger.geometry.coordinates[0]);
        const source = charger.source;
        if (source === Constants.networks.mobie.name) {
            const tariffKey = `${planId}-${timeZone}-${charger.source ?? Constants.networks.evio.name}`;

            if (!tariffDataCache.has(tariffKey)) {
                tariffDataCache.set(
                    tariffKey,
                    await getCEMEandTar(planId, timeZone, charger.source ?? Constants.networks.evio.name)
                );
            }
        } else if (source === Constants.networks.gireve.name || source === Constants.networks.hubject.name) {
            if (!roamingTariffCache.has(source)) {
                roamingTariffCache.set(source, await getTariffCEMEbyPlan(roamingPlanId, charger.source));
            }
        }

        const countryCode = charger?.countryCode ?? charger?.address?.countryCode ?? charger?.address?.country ?? defaultCountryCode;
        const zone =
            charger?.address?.zone ?? (countryCode === Constants.defaultCountry ? Constants.defaultZone : null);
        const feeKey = `${countryCode}:${zone}`;

        if (!feesCache.has(feeKey)) {
            feesCache.set(feeKey, await getFees(charger));
        }
        const sourceKey = charger.source;
        if (!platformCache.has(sourceKey)) {
            platformCache.set(
                sourceKey,
                await findOnePlatform({
                    platformCode: charger.source,
                })
            );
        }
    }
}
module.exports = {
    getAllPublicChargers,
    filterChargersMapResponse,
    sortChargers,
    getTeslaTariff,
    updatePlug,
    getAllChargers,
    chargerMapObject,
    chargerMapReturnObject,
    extractRequestData,
    initializeCaches,
    populateTariffCaches,
    processFoundCharger,
    determineTariffsToCalculate,
    generateTariffKey,
    buildFindQuery,
    calculateStatusTime,
    handleChargerTypes
};