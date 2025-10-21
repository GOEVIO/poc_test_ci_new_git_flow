require("dotenv-safe").load();

const moment = require("moment");
const Sentry = require("@sentry/node");
const Constants = require("../utils/constants");
const Filter = require("../models/filters");
const axios = require("axios");
const toggle = require('evio-toggle').default;

const { calculateUserDebt } = require('evio-library-payments').default;
const { retrieveNotifyMeHistoryBulk } = require("evio-library-notifications").default;
const { findGroupCSUsersByUserId } = require("evio-library-identity").default;
const { findFleetById } = require('evio-library-evs').default;
const { TariffsService } = require("evio-library-ocpi");
const { PlugStatus, ChargerSubStatus } = require("../utils/enums/enumPlugs");

const {
    validateConnectorType,
    validateRequestBody,
    validateChargersToCompare,
    addFilterToQuery,
    checkTariffTypeValidity,
    createDataForFiltering,
	checkRatingValidity,
    filterChargersByConnectorType,
    filterTeslaStations,
    excludeTeslaChargers,
    getSecondaryConnectorTypes
} = require('../middlewares/chargers');


const { validateOptionalParams, validateRequiredParams } = require('../utils/validationUtils');
const { FilterByEnum } = require('../utils/enums/enumPlugs');
const { StationsEnum } = require('../utils/enums/enumStations');
const { getDetailsPublicNetWork } = require("../services/publicNetworkService");
const { getPrivateDetailsEVIONetWork } = require("../services/chargerService");
const { verifyNotifymeHistoryBulk } = require("../services/notificationService");

const { mapChargerSupport, mapChargerRankings, mapChargerSummary } = require("../mappers/chargersMapper");
const {
    getAllPublicChargers,
    sortChargers,
    updatePlug,
    getAllChargers,
    filterChargersMapResponse,
    chargerMapObject,
    processFoundCharger,
    extractRequestData,
    initializeCaches,
    populateTariffCaches,
    buildFindQuery,
    calculateStatusTime,
    handleChargerTypes
} = require("../helpers/chargersHelper");
const { getDefaultOPCTariff } = require("../caching/defaultTariff");
const { attachIconsToStations } = require("../helpers/mapIcons");

async function handleChargerRequest(mapFunction, request, response) {
	const context = "POST /api/private/connectionStation/ [handleChargerRequest]";
	const { chargerType, _id } = request.query;
	const { useableBatteryCapacity, internalChargePower, evEfficiency, sessionStartDate, chargingTime } = request.body;
	const { userid : userId } = request.headers;
	const query = request.query;

	const requiredParams = [
		{ param: chargerType, name: "chargerType" },
		{ param: _id, name: "_id" },
		{ param: sessionStartDate, name: "sessionStartDate" },
		{ param: chargingTime, name: "chargingTime" },
	];

	const optionalParams = [
		{ param: useableBatteryCapacity, name: "useableBatteryCapacity" },
		{ param: internalChargePower, name: "internalChargePower" },
		{ param: evEfficiency, name: "evEfficiency" },
	];

	const requiredParamsValid = validateRequiredParams(requiredParams, response);
	if (!requiredParamsValid) return response;
	const optionalParamsValid = validateOptionalParams(optionalParams, response);
	if (!optionalParamsValid) {
		return response;
	}
	const publicChargerTypes = (Constants.services.publicNetworkChargerType || "").split(",");
	try {
        const found = publicChargerTypes.find((type) => type === chargerType);

        let chargerFound = {};
        if (found) {
            chargerFound = await getDetailsPublicNetWork(query, request.headers);
        } else {
            chargerFound = await getPrivateDetailsEVIONetWork(query, request.headers);
        }

        const useEvioCache = await toggle.isEnable('charge-839-price-simulation');
        const results = await processPlugs(mapFunction, chargerFound, request, response, context, !!found, !!found || useEvioCache);
		const chargerToReturn = results[0];
        const plugPrices = chargerToReturn.plugPrice;
        const plugUnits = plugPrices.flatMap((plugPrice) => plugPrice.plugUnit);
        const updatePromises = plugUnits.map((plugUnit) => updatePlug(plugUnit, chargerFound, userId));

        await Promise.all(updatePromises);


        const [user, debtValue] = await Promise.all([
            getUserAccount(userId),
            calculateUserDebt(userId)
        ]);

        if (!user) {
            return response.status(404).json({
                auth: false,
                code: "server_user_not_found",
                message: "User not found"
            });
        }

        const userDeletionStatus = {
            accountDeletionRequested: user.accountDeletionRequested,
            blocked: user.blocked || false,
            ...(debtValue?.value > 0 && {
                debtValue: {
                    value: debtValue.value,
                    currency: debtValue.currency
                }
            })
        };

        return response.status(200).json({
            charger: chargerToReturn,
            userDeletionStatus
        });

    } catch (error) {
		console.error(`[${context}][getSummaryDetails] Error `, error?.response?.data?.message ?? error.message);
		const status = error.auth !== undefined ? 400 : 500;
		return response.status(status).json(error?.response?.data ?? error.message);
	}
}

async function getUserAccount(userId) {
    const context = "Function getUserAccount";
    const host = `${process.env.IdentityHost}${process.env.UsersAccountsPath}`;
    const headers = { userid: userId };

    try {
        const result = await axios.get(host, { headers });
        return result.data;
    } catch (error) {
        console.error(`[${context}] Error`, error);
    }
}


async function processPlugs(mappingFunction, foundChargers, request, response, context, isPublicNetwork = false, callCache = false) {
	const requestData = extractRequestData(request);
	const sessionStopDate = moment.utc(requestData.sessionStartDate).add(requestData.chargingTime, "minutes").format();

	const caches = initializeCaches();

	try {
	  const defaultTariff = await getDefaultOPCTariff() ?? {};
      /**
       * I changed the roamingPlanId to "" to force the get of the
       * roaming emsp tariff cache by the source of the charger
       */
      if (!Array.isArray(foundChargers)) {
		foundChargers = [foundChargers];
	  }
      await populateTariffCaches(foundChargers, requestData.planId, "", caches);

      const { userTariffs, fleetOwner } = await getUserCpoTariffs(foundChargers, requestData.fleetId , requestData.userid);

	  const chargerData = {
		...requestData,
		totalBatteryCapacityEV: requestData.useableBatteryCapacity,
		chargingCapacityEV: requestData.maxFastChargingPower || requestData.internalChargePower,
		internalChargingCapacityEV: requestData.internalChargePower,
		evEfficiencyEV: requestData.evEfficiency,
		sessionStopDate,
		defaultTariff,
		ccsAndChademoTypes: ["CCS 1", "CCS 2", "CHAdeMO", "CHADEMO"],
        userTariffs,
        fleetOwner,
	  };

      const userGroupCSUsers = await findGroupCSUsersByUserId(requestData.userid);

	  const chargersPromises = foundChargers.map((foundCharger) =>
		processFoundCharger(foundCharger, chargerData, caches, context, response, request, mappingFunction, isPublicNetwork, callCache, userGroupCSUsers)
	  );

	return Promise.all(chargersPromises);
	} catch (error) {
	  console.error(`[${context}][processPlugs] Error `, error.message);
	  throw error;
	}
  }

async function handleSupportChargerRequest(request, response) {
	const context = "POST /api/private/connectionStation/chargerSupport";
	const { chargerType, _id } = request.query;
	const query = request.query;

	const requiredParams = [
		{ param: chargerType, name: "chargerType" },
		{ param: _id, name: "_id" },
	];

	const requiredParamsValid = validateRequiredParams(requiredParams, response);
	if (!requiredParamsValid) {
		return response;
	}

	const publicChargerTypes = (Constants.services.publicNetworkChargerType || "").split(",");
	try {
		const found = publicChargerTypes.find((type) => type === chargerType);

		let chargerFound = {};
		if (found) {
			chargerFound = await getDetailsPublicNetWork(query, request.headers);
		} else {
			chargerFound = await getPrivateDetailsEVIONetWork(query, request.headers);
		}

		return response.status(200).send(mapChargerSupport(chargerFound));
	} catch (error) {
		console.error(`[${context}]Error `, error?.response?.data?.message ?? error.message);
		const status = error.auth !== undefined ? 400 : 500;
		return response.status(status).json(error?.response?.data ?? error.message);
	}
}


async function handleRankingsRequest(req, res) {
    const context = 'POST /api/private/connectionstation/rankings';
    const { lat, lng, distance, countryCode } = req.query;

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
            auth: false,
            code: `server_body_required`,
            message: `Body is required`,
        });
    }

    const {
        useableBatteryCapacity,
        internalChargePower,
        evEfficiency,
        filterBy,
        onlyOnline = false,
        chargingTime,
        tariffType,
        connectorType,
        onlyAvailable = false,
        availableStations,
        powerRange,
        stations,
        rating,
    } = req.body;

    const requiredParams = [
        { param: lat, name: 'latitude' },
        { param: lng, name: 'longitude' },
        { param: distance, name: 'distance' },
        { param: filterBy, name: 'filterBy' },
        { param: chargingTime, name: 'chargingTime' },
    ];

    const optionalParams = [
        { param: useableBatteryCapacity, name: 'useableBatteryCapacity' },
        { param: internalChargePower, name: 'internalChargePower' },
        { param: evEfficiency, name: 'evEfficiency' },
    ];

    const optionalParamsValid = validateOptionalParams(optionalParams, res);
    if (!optionalParamsValid) return res;

    const requiredParamsValid = validateRequiredParams(requiredParams, res);
    if (!requiredParamsValid) return res;

    let connectorsWithSecondaryTypes = connectorType;
    if (connectorsWithSecondaryTypes) {
        if (!Array.isArray(connectorsWithSecondaryTypes)) {
            connectorsWithSecondaryTypes = [connectorsWithSecondaryTypes];
        }
        const validationConnectorType = validateConnectorType(connectorsWithSecondaryTypes);
        if (!validationConnectorType) {
            return res.status(400).json({
                auth: false,
                code: `server_invalid_connector_type`,
                message: `Invalid connector type.`,
            });
        }
        connectorsWithSecondaryTypes = [...new Set(connectorsWithSecondaryTypes.flatMap(getSecondaryConnectorTypes))];
    }

    if (tariffType && !checkTariffTypeValidity(tariffType, res)) return;
    if (rating && !checkRatingValidity(rating, res)) return;

    if (!Object.values(FilterByEnum).includes(filterBy)) {
        return res.status(400).json({
            auth: false,
            code: `server_invalid_enum`,
            message: `Invalid filterBy value. It must be either "totalPrice", "unitPrice", "energy" or "distance".`,
        });
    }

    try {
        const publicHost = Constants.services.publicChargersHost + Constants.services.publicGetChargerPathPrivate;
        const userId = req.headers['userid'];
        const clientName = req.headers['clientname'];
        const params = { lat, lng, distance, countryCode };

        if (stations && stations.length === 1 && stations.includes(StationsEnum.tesla)) {
            console.log('No charger can be returned with Tesla as only station selected');
            return res.status(200).send([]);
        }

        const stationsWithoutTesla = filterTeslaStations(stations);

        const filter = new Filter({
            onlyOnline,
            tariffType,
            connectorType: connectorsWithSecondaryTypes,
            onlyAvailable,
            availableStations,
            stations: stationsWithoutTesla,
            powerRange,
            rating,
        });

        let { dataPublic } = await createDataForFiltering(filter, userId, clientName);
        dataPublic = excludeTeslaChargers(stationsWithoutTesla, dataPublic);
        dataPublic = addFilterToQuery(tariffType, onlyOnline, onlyAvailable, dataPublic);

        const chargers = await callGetAllPublicChargers(
            publicHost,
            params,
            dataPublic,
            res,
            clientName,
            userId,
            filter,
            req
        );

        let chargersWithRelevantConnectors = filterChargersByConnectorType(chargers, connectorType);

        if (!chargersWithRelevantConnectors || chargersWithRelevantConnectors.length === 0) {
            console.log('No charger was found with the filter', params);
            return res.status(200).send([]);
        } else {
            let formattedChargers = await processPlugs(
                mapChargerRankings,
                chargersWithRelevantConnectors,
                req,
                res,
                context,
                true,
                true
            );

            const coordinates = {
                lat: parseFloat(lat),
                lng: parseFloat(lng),
            };
            formattedChargers = sortChargers(filterBy, formattedChargers, coordinates , onlyAvailable , onlyOnline);

            let updatePromises = [];
            let batchQueries = [];
            //Firstly, we create a query for notifications to see if the user has a notification active for any of the plugs
            for (const charger of formattedChargers) {
                for (const plugPrice of charger.plugPrice) {
                    for (const plugUnit of plugPrice.plugUnit) {
                        const find = buildFindQuery(plugUnit, userId);
                        batchQueries.push(find);
                    }
                }
            }
            
            const canBeNotifiedResults = (batchQueries.length > 0) ? await retrieveNotifyMeHistoryBulk({ $or: batchQueries }) : [];
            console.log(`[${context}] Retrieved ${canBeNotifiedResults.length} notify me records for ${batchQueries.length} queries`);

            /*Once we get the information back, we check if the notification is there already:
            if the notification is there we can't notify twice, the notify indicates to the front
            if the symbol is clickable.
            If it isn't, we can notify.*/
            for (const charger of formattedChargers) {
                for (const plugPrice of charger.plugPrice) {
                    for (const plugUnit of plugPrice.plugUnit) {
                        plugUnit.statusTime = plugUnit.statusTime || calculateStatusTime(charger);
                        plugUnit.canBeNotified = true;

                        const isPartOfTheOriginalQuery = !Array.isArray(canBeNotifiedResults) ? false : canBeNotifiedResults.length === 0 ? false :
                            canBeNotifiedResults.find((result) => result.hwId === plugUnit.hwId && result.plugId === plugUnit.plugId);

                        if (isPartOfTheOriginalQuery) {
                            for (const user of isPartOfTheOriginalQuery.listOfUsers) {
                                const foundUser = plugUnit?.listOfUsers ? plugUnit.listOfUsers.find(
                                    (queryUser) => queryUser.userId === user.userId
                                ) : null;
                                if (foundUser) {
                                    plugUnit.canBeNotified = false;
                                    updatePromises.push(handleChargerTypes(plugUnit, charger, userId, context));
                                }
                            }
                        }
                    }
                }
            }

            await Promise.all(updatePromises);

            return res.status(200).send(formattedChargers);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return res.status(500).send(error.message);
    }
}


async function handleCompareRequest(request, response, cache) {
    const context = 'POST /api/private/connectionstation/compare';
    if (!request.body || Object.keys(request.body).length === 0) {
        return response.status(400).json({
            auth: false,
            code: `server_body_required`,
            message: `Body is required`,
        });
    }

    const {
        chargersToCompare,
        chargingTime,
        sessionStartDate,
        useableBatteryCapacity,
        internalChargePower,
        evEfficiency,
        planId,
    } = request.body;

    const requiredParameters = [
        { param: chargersToCompare, name: 'chargersToCompare' },
        { param: sessionStartDate, name: 'sessionStartDate' },
        { param: chargingTime, name: 'chargingTime' },
    ];

    const optionalParameters = [
        { param: useableBatteryCapacity, name: 'useableBatteryCapacity' },
        { param: internalChargePower, name: 'internalChargePower' },
        { param: evEfficiency, name: 'evEfficiency' },
    ];
    const areOptionalParamsValid = validateOptionalParams(optionalParameters, response);
    if (!areOptionalParamsValid) {
        return response;
    }

    const areRequiredParamsValid = validateRequiredParams(requiredParameters, response);
    if (!areRequiredParamsValid) {
        return response;
    }
    const areChargersValid = validateChargersToCompare(chargersToCompare, response);
    if (!areChargersValid) {
        return response;
    }

    const chargerIds = chargersToCompare.map(({ chargerId }) => chargerId);
    const plugPriceIds = chargersToCompare.map(({ plugPriceId }) => plugPriceId);
    const publicHostUrl = Constants.services.publicChargersHost + Constants.services.PublicGetChargerPath;
    const userId = request.headers['userid'];
    const clientName = request.headers['clientname'];
    const publicData = { _id: chargerIds };

    try {
        let chargers = await callGetAllPublicChargers(
            publicHostUrl,
            undefined,
            publicData,
            response,
            clientName,
            userId,
            undefined,
            request
        );

        if (!chargers || chargers.length === 0) {
            return response.status(200).send([]);
        } else {
			let chargerPromises =  processPlugs(mapChargerSummary, chargers, request, response, context, true, true);


            let processedChargers = await Promise.all(chargerPromises);
            let updatedChargers = processedChargers.map((charger) => {
                let updatedCharger = { ...charger };
                updatedCharger.plugPrice = charger.plugPrice.filter((plugPrice) =>
                    plugPriceIds.includes(plugPrice._id)
                );
                return updatedCharger;
            });

            return response.status(200).send(updatedChargers);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return response.status(500).send(error.message);
    }
}



async function handleMapRequest(req, res) {
    const context = 'POST /api/private/connectionstation/chargers';
    const { lat, lng, distance, countryCode } = req.query;
    const {
        tariffType,
        onlyAvailable = false,
        onlyOnline = false,
        powerRange,
        stations,
        availableStations,
        connectorType,
        rating,
    } = req.body;
    const { userid: userId, clientname: clientName } = req.headers;
    let connectorsWithSecondaryTypes = connectorType;
	if (rating && !checkRatingValidity(rating, res)) return;
    if (tariffType && !checkTariffTypeValidity(tariffType, res)) return;

    try {
        const host = Constants.services.chargersServiceProxy + Constants.services.chargerPrivateServiceProxy;
        const publicHost = Constants.services.publicChargersHost + Constants.services.publicNetworkMaps;
        const params = { lat, lng, distance, countryCode };
        if(connectorsWithSecondaryTypes) {
            if(!Array.isArray(connectorsWithSecondaryTypes)){
                connectorsWithSecondaryTypes = [connectorsWithSecondaryTypes];
            }
            const validationConnectorType = validateConnectorType(connectorsWithSecondaryTypes);
            if (!validationConnectorType) {
                return res.status(400).json({
                    auth: false,
                    code: `server_invalid_connector_type`,
                    message: `Invalid connector type.`,
                });
            }
            connectorsWithSecondaryTypes = [...new Set(connectorsWithSecondaryTypes.flatMap(getSecondaryConnectorTypes))];

        }

		let filter = new Filter({
			onlyOnline,
			tariffType,
			connectorType: connectorsWithSecondaryTypes,
			onlyAvailable,
			availableStations,
			stations,
			powerRange,
            rating,
		});

		let { data, dataPublic } = await createDataForFiltering(filter, userId, clientName);

		data = addFilterToQuery(tariffType, onlyOnline, onlyAvailable,  data);
		dataPublic = addFilterToQuery(tariffType, onlyOnline, onlyAvailable, dataPublic);
        const chargers = await getAllChargers(
            host,
            publicHost,
            params,
            data,
            dataPublic,
            res,
            clientName,
            userId,
            filter,
            req
        );

        if (!chargers || chargers.length === 0) {
            return res.status(200).send([]);
        } else {
            const chargersWithIcons = await attachIconsToStations(chargers);

            return res
                .status(200)
                .send(filterChargersMapResponse(chargersWithIcons, chargerMapObject));
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
		Sentry.captureException(error);
        return res.status(500).send(error.message);
    }
}



function modifyDataPublic(dataPublic, filterBy) {
    delete dataPublic.vehiclesType;
    if (filterBy === FilterByEnum.totalPrice || filterBy === FilterByEnum.unitPrice || filterBy === FilterByEnum.energy)
        dataPublic.chargerType = { $ne: Constants.networks.tesla.chargerType };
}

async function callGetAllPublicChargers(publicHost, params, dataPublic, res, clientName, userId, filter, req) {
	modifyDataPublic(dataPublic, filter?.filterBy);
	return getAllPublicChargers( publicHost, params, dataPublic, res, clientName, userId, filter, req);
}

function getCountryCodesAndPartyIds(chargers) {
    const countryCodes = [];
    const partyIds = [];
    for (const { countryCode, partyId } of chargers) {
        countryCodes.push(countryCode);
        partyIds.push(partyId);
    }
    return { countryCodes, partyIds };
}

async function getUserCpoTariffs(foundChargers, fleetId, userId) {
    const fleet = fleetId ? await findFleetById(fleetId) : { createUserId: userId };
    const { countryCodes, partyIds } = getCountryCodesAndPartyIds(foundChargers);
    const fleetOwner = fleet?.createUserId;
    const userTariffs = await TariffsService.mapUserTariffs(fleetOwner, partyIds, countryCodes);
    return { userTariffs , fleetOwner };
}

module.exports = {
	handleChargerRequest,
	handleSupportChargerRequest,
	handleRankingsRequest,
	handleCompareRequest,
	handleMapRequest
};
