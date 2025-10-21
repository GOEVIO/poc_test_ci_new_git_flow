const Platforms = require("../models/platforms");
const { getDefaultOPCTariff } = require("../utils");
const Sentry = require('@sentry/node');
const redisConnection = require('evio-redis-connection/dist').default;

async function getAllPlatforms() {
	try {
		const chargers = await Platforms.find({}).lean();
		return chargers;
	} catch (error) {
		console.error(`Error getting platforms: ${error}`);
		return null;
	}
}

async function cachePlatforms() {
	try {
		const platforms = await getAllPlatforms();

		const platformPromises = platforms.map((platform) => {
			const fields = Object.entries(platform);
			let args = [];
			for (let [key, value] of fields) {
				args.push(key, JSON.stringify(value));
			}
			return redisConnection.hset(`platform:${platform.platformCode}`, args);
		});

		await Promise.all(platformPromises);
		console.log('Platforms cached successfully');

		await redisConnection.disconnect();
	} catch (error) {
		Sentry.captureException(error);
		console.error(`Error caching platforms: ${error}`);
		throw error;
	}
}

async function cacheDefaultOPCTariff() {
	try {
		const defaultOPCTariff = await getDefaultOPCTariff();
		await redisConnection.set(`defaultOPCTariff`, JSON.stringify(defaultOPCTariff));

		console.log('Default OPC Tariff cached successfully');
		await redisConnection.disconnect();
	} catch (error) {
		Sentry.captureException(error);
		console.error(`Error caching default OPC Tariff: ${error}`);
		throw error;
	}
}

module.exports = {
	cachePlatforms,
	cacheDefaultOPCTariff,
};