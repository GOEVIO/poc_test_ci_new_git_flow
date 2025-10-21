const mobieScheduleTime = require("./schedulesCEME");
const { isEmptyObject, createRestrictionObjects } = require("../utils/utils");
const { PlanNames, TariffTypes }  = require("../utils/enums/enumPlugs");
const { Units } = require("../utils/enums/enumUnits");
const { getRedisClient } = require("./cache.js");
const { getDefaultOPCTariff } = require("./defaultTariff.js");
const { adjustRestrictions } = require("../services/tariff/tariffValidations");
const Sentry = require("@sentry/node");
const Constants = require("../utils/constants");
const DEFAULT_PLAN_NAME = "server_plan_EVIO_ad_hoc";
const SERVER_PLAN_PREFIX = "server_plan_";
const TARIFF_CEME_DEFAULT = {
	country: "PT",
	CEME: "EVIO",
	tariffType: "server_bi_hour",
	cycleType: "server_daily",
	planName: "server_plan_EVIO",
	tariff: [
		{
			type: "energy",
			power: "all",
			uom: "€/kWh",
			tariffType: "server_empty",
			voltageLevel: "BTN",
			price: 0.35,
		},
		{
			type: "energy",
			power: "all",
			uom: "€/kWh",
			tariffType: "server_out_empty",
			voltageLevel: "BTN",
			price: 0.35,
		},
	],
};

async function getTariffs(clientName) {
    const tariffCEME = await getTariffCEME(clientName);
    const tariffTAR = getTariffTAR();
    const TAR_Schedule = mobieScheduleTime.find(
        ({ tariffType, cycleType }) => tariffType === tariffCEME.tariffType && cycleType === tariffCEME.cycleType
    );
    return { tariffCEME, tariffTAR, TAR_Schedule };
}

async function getCEMEandTar(planId, timeZone, source, clientName = "EVIO") {
	try {
		let params = { timeZone };
		params = planId ? 
			{ _id: planId, timeZone } : 
			{ CEME: `EVIO ${source}`, timeZone };

		if (!planId && source === Constants.networks.mobie.name) {
			params = {
				planName: `server_plan_${clientName}`,
				timeZone,
			};
		}

		let { tariffCEME, tariffTAR, TAR_Schedule } = await getPlanScheduleTar(params);

		if (isEmptyObject(tariffCEME) || isEmptyObject(tariffTAR) || isEmptyObject(TAR_Schedule)) {
			return getTariffs(clientName);
		}

		return { tariffCEME, tariffTAR, TAR_Schedule };
	} catch (error) {
		console.error("Error caught:", error);
		Sentry.captureException(error);
		throw error;
	}
}
async function getPlanScheduleTar(query) {
	try {
		let tariffFound = await findTariff(query);
		if (!tariffFound) {
			return {};
		}

		const querySchedules = createQueryObject(tariffFound);
		const queryTar = createQueryObject(tariffFound, { active: true });

		if (query.timeZone) {
			queryTar.timeZone = query.timeZone;
		}

		const schedules = await schedulesCEMEQueryCache(querySchedules);

		const scheduleFound = findSchedule(schedules, tariffFound);

		const tarsFound = await tarFindCache();

		let filteredTar = findTar(tarsFound, queryTar);

		if (!filteredTar) {
			filteredTar = findTar(tarsFound, { ...queryTar, country: "PT", active: true });
		}

		const newTariff = {
			tariffCEME: tariffFound,
			TAR_Schedule: scheduleFound,
			tariffTAR: filteredTar,
		};

		return newTariff;
	} catch (error) {
		console.error("Error in getPlanScheduleTar function:", error);
		throw error;
	}
}

async function findTariff(query) {
	const context = "[Function findTariff]";

	try {
        const { _id, CEME, planName } = query;
		const cacheKey = `tariff:CEME:${_id || CEME || planName}`;
		const redisClient = await getRedisClient();
		let tariffFound = await redisClient.get(cacheKey);
		if (tariffFound) {
			tariffFound = JSON.parse(tariffFound);
		}
		return tariffFound;
	} catch (error) {
		throw new Error(`${context} - Error retrieving or parsing tariff from Redis: ${error.message}`);
	}
}


async function fetchFromRedis(pattern) {
	const context = "Function fetchFromRedis";
	try {
		let redisClient = await getRedisClient();
		const keys = await redisClient.keys(pattern);
		const results = await Promise.all(keys.map((key) => redisClient.get(key)));
		const parsedResults = results ? results.map((result) => JSON.parse(result)) : [];
		return parsedResults;
	} catch (error) {
		console.error(context, "An error occurred:", error);
		throw error;
	}
}
async function getTariffCEME(clientName) {
	try {
		const allTariffs = await fetchFromRedis("tariff:CEME:*");
		const tariffPlans = [`${SERVER_PLAN_PREFIX}${clientName}`, DEFAULT_PLAN_NAME];
		const clientTariffs = allTariffs.filter(({ planName }) => tariffPlans.includes(planName));
		return clientTariffs.length ? clientTariffs[0] : TARIFF_CEME_DEFAULT;
	} catch (error) {
		console.error(`Error while fetching tariffs for client ${clientName}:`, error);
		throw error;
	}
}
async function schedulesCEMEQueryCache() {
	const context = "schedulesCEMEQueryCache function";

	try {
		const result = await fetchFromRedis("scheduleCEME:*");

		return result;
	} catch (error) {
		console.error(`Error in ${context}:`, error);
		throw error;
	}
}

async function tarFindCache() {
	const context = "tarFindCache function";

	try {
		const result = await fetchFromRedis("tariff:TAR:*");

		return result;
	} catch (error) {
		console.error(`Error in ${context}:`, error);
		throw error;
	}
}
async function getTariffCEMEbyPlan(planId, source, clientName = "EVIO") {
	let params;

	if (planId) {
		params = { _id: planId };
	} else {
		params = { CEME: `EVIO ${source}` };
	}

	if (!planId && source === Constants.networks.mobie.name) {
		params = { planName: `server_plan_${clientName}` };
	}

	try {
		const tariffFound = await findTariff(params);
		return tariffFound;
	} catch (error) {
		throw new Error(`Error in getTariffCEMEbyPlan: ${error}`);
	}
}

async function getCEMEEVIO(clientName) {
	const context = "Function getCEMEEVIO";
	let planName = PlanNames[clientName] || PlanNames.default;
	const params = { planName };
	try {
		const result = await getPlanScheduleTar(params);
		return result;
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return {};
	}
}

async function OPCtariffs(query) {
	const context = "GET /api/private/tariffs/OPCtariffs";
	try {
		let foundTariff = await findTariff(query);
		if (!foundTariff) {
			foundTariff = await getDefaultOPCTariff();
		}

		if (foundTariff) {
			return tariffResponseBody(foundTariff);
		}

		return [];
	} catch (error) {
		console.error(`[${context}] Error `, error);
		throw error;
	}
}

function tariffResponseBody(foundTariff) {
	const detailedTariff = {
		flat: [],
		time: [],
		energy: [],
		parking: []
	};
	const costByPower = [];
	const costByTime = [];
	let initialCost = 0;
	
	foundTariff.elements?.forEach((tariffElement) => {
		const restrictions = tariffElement.restrictions;
		adjustRestrictions(restrictions);
		const isEmpty = isEmptyObject(restrictions);
		tariffElement.price_components.forEach((component) => {
			const { type, price, step_size } = component;
			const { source } = foundTariff;
			let priceStep;
			switch (type) {
				case TariffTypes.ENERGY:
					priceStep = getEnergyTariffPriceStep(price, step_size, source);
					costByPower.push(createCostObject(priceStep, Units.KWH));
					break;
				case TariffTypes.TIME:
					priceStep = getTimeTariffPriceStep(price, step_size, source);
					costByTime.push(createCostObject(priceStep, Units.MIN));
					break;
				case TariffTypes.FLAT:
					initialCost = price;
					break;
				case TariffTypes.PARKING_TIME:
					priceStep = getTimeTariffPriceStep(price, step_size, source);
					break;
			}

			if (priceStep) {
				if (!isEmpty) {
					createRestrictionObjects(detailedTariff, type.toLowerCase(), restrictions, priceStep.price, priceStep.step_size, priceStep.uom, foundTariff.currency);
				} else {
					detailedTariff[type.toLowerCase()].push(createDefaultRestriction(priceStep, foundTariff.currency));
				}
			}
		});
	});

	return {
		_id: foundTariff._id,
		tariffId: foundTariff.id,
		initialCost,
		elements: foundTariff.elements,
		currency: foundTariff.currency,
		detailedTariff,
		costByPower: costByPower.length > 0 ? costByPower[0] : { "cost": 0, "uom": "kWh" },
		costByTime: costByTime.length > 0 ? costByTime : [{ "minTime": 0, "cost": 0, "uom": "min" }],
	};
}
function getEnergyTariffPriceStep(price, step_size, source) {
    step_size = step_size / 1000;
    return { price, step_size };
}

function getTimeTariffPriceStep(price, step_size, source) {

    step_size = step_size / 60;

    if (source === Constants.networks.gireve.name) {
        price = price / 60;
    }

    return { price, step_size };
}

function createCostObject({ price, step_size }, uom) {
	return {
		cost: price,
		step_size,
		uom
	};
}

function createDefaultRestriction({ price, step_size, uom }, currency) {
	return {
		restrictionType: 'default',
		values: [
			{
				restrictionValues: {},
				price,
				step: step_size,
				uom,
				currency
			}
		]
	};
}


function getTariffTAR(ceme) {
	// TODO: Review with Tiago if this is still something valid.
	//This is outside our current scope, however.

	var tariffTAR = {
		country: "PT",
		tariffType: "server_bi_hour",
		tariff: [
			{
				uom: "€/kWh",
				tariffType: "server_empty",
				voltageLevel: "BTN",
				price: -0.018,
			},
			{
				uom: "€/kWh",
				tariffType: "server_out_empty",
				voltageLevel: "BTN",
				price: 0.0299,
			},
			{
				uom: "€/kWh",
				tariffType: "server_empty",
				voltageLevel: "BTE",
				price: -0.018,
			},
			{
				uom: "€/kWh",
				tariffType: "server_out_empty",
				voltageLevel: "BTE",
				price: 0.0299,
			},
			{
				uom: "€/kWh",
				tariffType: "server_empty",
				voltageLevel: "MT",
				price: -0.0215,
			},
			{
				uom: "€/kWh",
				tariffType: "server_out_empty",
				voltageLevel: "MT",
				price: 0.0164,
			},
		],
	};

	return tariffTAR;
}

function createQueryObject(tariffFound, additionalProps = {}) {
	return {
		country: tariffFound?.country,
		tariffType: tariffFound?.tariffType,
		cycleType: tariffFound?.cycleType,
		...additionalProps,
	};
}

function findSchedule(schedules, tariffFound) {
	return schedules.find(
		(schedule) =>
			schedule.country === tariffFound.country &&
			schedule.tariffType === tariffFound.tariffType &&
			schedule.cycleType === tariffFound.cycleType
	);
}

function findTar(tarsFound, queryTar) {
	let filteredTar = tarsFound.find(
		(tar) =>
			tar.country === queryTar?.country &&
			tar.tariffType === queryTar?.tariffType &&
			tar.active === queryTar?.active &&
			tar.timeZone === queryTar?.timeZone
	);

	if (!filteredTar) {
		filteredTar = tarsFound.find(
			(tar) => tar.country === "PT" && tar.tariffType === queryTar?.tariffType && tar.active
		);
	}
	return filteredTar;
}
module.exports = {
	getCEMEandTar,
	getTariffCEMEbyPlan,
	getCEMEEVIO,
	OPCtariffs,
};
