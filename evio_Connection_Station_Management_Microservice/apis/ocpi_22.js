const axios = require("axios");

async function getOpcTariffsPrices(data) {
	const context = "Function getOpcTariffsPrices";
	try {
		const serviceProxy = process.env.HostChargingSessionMobie + process.env.PathGetOpcTariffsPrices;
		const result = await axios.post(serviceProxy, data);
		return result.data;
	} catch (error) {
		console.error(`[${context}] Error `, error.response.data);
		throw error;
	}
}

async function getTariffOPC(params) {
	const host = `${process.env.HostChargingSessionMobie}${process.env.PathGetOPCTariffs}`;

	try {
		const { data } = await axios.get(host, { params });

		if (!data) return null;
		if (Array.isArray(data) && data.length > 0) return data;

		return {
			initialCost: -1,
			costByTime: [{ minTime: 0, cost: -1, uom: "" }],
			costByPower: { cost: -1, uom: "" },
		};
	} catch (error) {
		console.error(`[Function getTariffOPC][get][.catch]`, error.response ? error.response.data : error.message);
		throw error;
	}
}

async function getSession(data) {
	var context = "Function chargingSessionFind";
	let host = process.env.HostChargingSessionMobie + process.env.PathGetOCPIChargingSessions;
	try {
		const result = await axios.get(host, { data });
		return result.data;
	} catch (error) {
		console.error(`${context} - ${error.response ? error.response.data : error.message}`);
		throw error;
	}
}

module.exports = {
	getOpcTariffsPrices,
	getTariffOPC,
	getSession,
};
