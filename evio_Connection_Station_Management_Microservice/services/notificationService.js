const axios = require("axios");
const Constants = require('../utils/constants');

async function verifyNotifymeHistory(query) {
	const context = "Function verifyNotifymeHistory";
	let data = query;
	let host = Constants.services.notificationsHost + Constants.services.PathNotifymeHistory;
	try {
		const result = await axios.get(host, { data });
		return result.data;
	} catch (error) {
		console.error(`${context} - ${error.response ? error.response.data : error.message}`);
		throw error;
	}
}
module.exports = {
	verifyNotifymeHistory
};
