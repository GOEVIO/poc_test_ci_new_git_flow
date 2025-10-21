const Fees = require('../models/fees');
const redisConnection = require('evio-redis-connection').default;

async function getAllFees() {
	try {
		const fees = await Fees.find({}).lean();
		return fees;
	} catch (error) {
		console.error(`Error getting fees: ${error}`);
		return [];
	}
}
async function cacheFees() {
	try {
		const fees = await getAllFees();
		const feePromises = fees.map(async (fee) => {
			await redisConnection.set(`fee:${fee._id}`, JSON.stringify(fee));
			await redisConnection.set(`fees:${fee.countryCode}:${fee.zone}`, fee._id.toString());
		});

		await Promise.all(feePromises);
		console.log('Fees cached successfully');
	} catch (error) {
		console.error(`Error caching fees: ${error}`);
		throw error;
	} finally {
		await redisConnection.disconnect();
	}
}
module.exports = {
    cacheFees,
	redisConnection,
};
