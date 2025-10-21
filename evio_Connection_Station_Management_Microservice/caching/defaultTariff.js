const { getRedisClient } = require("./cache.js");
const Sentry = require("@sentry/node");
const { retrieveDefaultOPCTariff } = require("evio-library-ocpi");

async function getDefaultOPCTariff() {
    try {
        const CACHE_KEY = `defaultOPCTariff`;

        const redisClient = await getRedisClient();
        const defaultTariff = await redisClient.get(CACHE_KEY);

        if(!defaultTariff) {
            console.info(`[getDefaultOPCTariff] Default OPC Tariff not found in cache`);

            const fetchedData = await retrieveDefaultOPCTariff();
            if(fetchedData) {
                await redisClient.set(CACHE_KEY, JSON.stringify(fetchedData));
                console.info(`[getDefaultOPCTariff] Default OPC Tariff fetched and saved in cache`);
                return fetchedData;
            } else {
                console.error(`[getDefaultOPCTariff] Default OPC Tariff not found in database fetchedData=${fetchedData}`);
                return null;
            }
        }

        return defaultTariff;
    } catch (error) {
        Sentry.captureException(error);
        console.error("[Error getDefaultOPCTariff] " + error.message);
        return null;
    }
}

module.exports = {
    getDefaultOPCTariff,
};