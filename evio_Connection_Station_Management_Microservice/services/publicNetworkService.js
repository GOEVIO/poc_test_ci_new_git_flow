const axios = require("axios");
const Sentry = require("@sentry/node");

async function getDetailsPublicNetWork(query, data) {
	const context = "Function getPublicDetailsPublicNetWork";
	try {
		const host = `${process.env.PublicChargersHost}${process.env.PublicChargerDetailsPublicNetwork}`;
		const params = {
			_id: query._id,
		};

		const headers = {
			userid: data.userid ? data.userid : "",
		};
		const result = await axios.get(host, { headers, params });
		return result.data;
	} catch (error) {
		console.error(`[${context}] Error `, error.response ? error.response.data.message : error);
		Sentry.captureException(error);
		throw error;
	}
}
async function connectChargerType(host, headers, params, dataPublic) {
	const context = `[Function connectChargerType]`;

	try {
		const { data } = await axios.get(host, { params, data: dataPublic, headers });
		return data;
	} catch (error) {
		console.error(`[${context}] Error `, error.response ? error.response.data : error.message);
		throw error;
	}
}
module.exports = {
	getDetailsPublicNetWork,
	connectChargerType,
};
