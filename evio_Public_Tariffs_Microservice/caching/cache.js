const TariffsCEME = require("../models/tariffCEME");
const TariffsTAR = require("../models/tariffTar");
const SchedulesCEME = require("../models/schedulesCEME");
const Redis = require("ioredis");
const Constants = require("../utils/constants");
const Sentry = require("@sentry/node");

const redisConfig = {
    sentinels: [
        { host: Constants.redis.sentinelHost1, port: Constants.redis.sentinelPort },
        { host: Constants.redis.sentinelHost2, port: Constants.redis.sentinelPort },
        { host: Constants.redis.sentinelHost3, port: Constants.redis.sentinelPort },
    ],
    name: Constants.redis.masterName,
};

let client;

async function createRedisClient() {
	if (!client) {
		client = new Redis(redisConfig);
		client.on("error", function (err) {
			console.error(`Error connecting to Redis: `, err);
			throw err;
		});
	}

	return client;
}

async function quitRedisClient() {
	try {
		if (client) {
			await client.quit();
			client = null;
		}
	} catch (error) {
		console.error('Failed to quit Redis client:', error);
	}
}

async function getAll(model) {
	try {
		const items = await model.find({}).lean();
		return items;
	} catch (error) {
		console.error(`Error getAll: ${error}`);
		return null;
	}
}

async function cacheItems(items, prefix, keys) {
	const redisClient = await createRedisClient();
	
	const cachePromises = items.map((item) => {
	  const serializedItem = JSON.stringify(item);
	  
	  const keyPromises = keys.map((key) => {
		const cacheKey = `${prefix}:${item[key]}`;
		return redisClient.set(cacheKey, serializedItem);
	  });
	  
	  return Promise.all(keyPromises);
	});
  
	await Promise.all(cachePromises);
}

async function cacheTariffs() {
	try {
		const tariffCEMEs = await getAll(TariffsCEME);
		const tariffTARs = await getAll(TariffsTAR);
		const scheduleCEMEs = await getAll(SchedulesCEME);

		await cacheItems(tariffCEMEs, 'tariff:CEME', ['_id', 'CEME', 'planName']);
		await cacheItems(tariffTARs, 'tariff:TAR', ['_id']);
		await cacheItems(scheduleCEMEs, 'scheduleCEME', ['_id']);

		console.log('Tariffs cached successfully');
	} catch (error) {
		Sentry.captureException(error);
		console.error(`Error cacheTariffs: ${error}`);
	
	} finally {
		await quitRedisClient();
	}
}

module.exports = {
	cacheTariffs,
};
