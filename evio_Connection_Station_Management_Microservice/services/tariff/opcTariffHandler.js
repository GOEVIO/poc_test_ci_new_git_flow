const {
	calculateMobieOpcTariffs,
	calculateRoamingOpcTariffs,
	calculateTeslaPrices,
	calculateEvioPrices,
} = require("./tariffCalculations");
const { isEmptyObject } = require("../../utils/utils");
const Constants = require("../../utils/constants");

 function calculateOpcTariffPrices(tariffData, request, response) {
	let context = "POST /api/private/tariffs/opcTariffsPrices";
	try {
		let data = tariffData;
		data.clientName ??= request.headers["clientname"];

		const platforms = {
			[Constants.networks.mobie.name]: {
				validate: validateMobieFields,
				calculate: calculateMobieOpcTariffs,
				wallet: null,
			},
			[Constants.networks.gireve.name]: {
				validate: validateGireveFields,
				calculate: calculateRoamingOpcTariffs,
			},
			[Constants.networks.hubject.name]: {
				validate: validateGireveFields,
				calculate: calculateRoamingOpcTariffs,
			},
			[Constants.networks.evio.name]: {
				validate: validateEVIOFields,
				calculate: calculateEvioPrices,
			},
			[Constants.networks.tesla.name]: {
				validate: validateTeslaFields,
				calculate: calculateTeslaPrices,
			},
			default: {
				validate: validateEVIOFields,
				calculate: calculateEvioPrices,
			},
		};

		const platform = platforms[data.source] || platforms["default"];
		const isValid = platform.validate(data, response);
		if (!isValid) {
			throw new Error("Invalid or missing parameters");
		}
		try {
			const result = platform.calculate(data, platform.wallet);
			return result;
		} catch (error) {
			console.error(`[${context}] Error `, error);
			throw error;
		}
	} catch (error) {
		console.error(`[${context}] Error `, error);
		throw error;
	}
}

function validateMobieFields(data) {
	const context = "Function validateMobieFields";
	try {
		const requiredParams = [
			{ param: data.sessionStartDate, name: "Session Start Date" },
			{ param: data.sessionStopDate, name: "Session Stop Date" },
			{ param: data.power, name: "Plug power" },
			{ param: data.total_energy, name: "Session total energy" },
			{ param: data.total_charging_time, name: "Session total charging time" },
			{ param: data.total_parking_time, name: "Session total parking time" },
			{ param: data.countryCode, name: "countryCode" },
			{ param: data.source, name: "source" },
			{ param: data.latitude, name: "latitude" },
			{ param: data.longitude, name: "longitude" },
		];

		return validateFields(data, requiredParams, "Function validateGireveFields");
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		throw error;
	}
}

function validateGireveFields(data, response) {
	const context = "Function validateGireveFields";
	try {
		const requiredParams = [
			{ param: data.sessionStartDate, name: "Session Start Date" },
			{ param: data.sessionStopDate, name: "Session Stop Date" },
			{ param: data.power, name: "Plug power" },
			{ param: data.total_energy, name: "Session total energy" },
			{ param: data.total_charging_time, name: "Session total charging time" },
			{ param: data.total_parking_time, name: "Session total parking time" },
			{ param: data.countryCode, name: "countryCode" },
			{ param: data.partyId, name: "partyId" },
			{ param: data.source, name: "source" },
		];

		return validateFields(data, requiredParams, "Function validateGireveFields");
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return { auth: false, code: "", message: error.message };
	}
}

function validateEVIOFields(data) {
	const context = "Function validateEVIOFields";
	try {
		const requiredParams = [
			{ param: data.address, name: "address" },
			{ param: data.tariff, name: "tariff" },
			{ param: data.total_energy, name: "Session total energy" },
			{ param: data.total_charging_time, name: "Session total charging time" },
			{ param: data.source, name: "source" },
		];

		return validateFields(data, requiredParams, "Function validateGireveFields");
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return { auth: false, code: "", message: error.message };
	}
}

function validateTeslaFields(data) {
	const context = "Function validateTeslaFields";
	try {
		const requiredParams = [
			{ param: data.power, name: "Plug power" },
			{ param: data.address, name: "address" },
			{ param: data.total_charging_time, name: "Session total charging time" },
			{ param: data.source, name: "source" },
		];

		return validateFields(data, requiredParams, "Function validateGireveFields");
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return { auth: false, code: "", message: error.message };
	}
}
function validateFields(data, requiredParams, context) {
	try {
		if (isEmptyObject(data)) return false;

		for (const { param, name } of requiredParams) {
			if (param === undefined || param === null) {
				console.log(`server_${name}_required`, `${name} is required`);
				return false;
			}
		}
		return true;
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		throw error;
	}
}
module.exports = {
	calculateOpcTariffPrices,
};
