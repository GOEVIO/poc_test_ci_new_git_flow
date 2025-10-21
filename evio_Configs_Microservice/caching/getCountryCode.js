const { redisConnection } = require("./cache");
const Sentry = require("@sentry/node");
const { retrieveCountryCode } = require("evio-library-configs");

async function getCountryCode(country) {
    try {
        const CACHE_KEY = `countryCodeByCountry:${country}`;

        // Attempt to get the country code from Redis cache
        const cached = await redisConnection.get(CACHE_KEY);

        if (cached) return cached;

        // If not in cache, query the database
        const { countryCode, countryName } = await retrieveCountryCode(country);

        if (countryCode && countryName) {
            // Store in cache without expiration
            await redisConnection.set(CACHE_KEY, JSON.stringify({ countryCode, countryName }));
            return { countryCode, countryName };
        }

        return null; // Return null if the country code is not found
    } catch (error) {
        Sentry.captureException(error);
        console.error("[Error getCountryCode] ", error);
        // Fallback: attempt to retrieve the country code directly from the database if cache fails
        try {
            return await retrieveCountryCode(country);
        } catch (dbError) {
            console.error("[Error retrieving directly from DB] ", dbError);
            return null;
        }
    }
}

module.exports = {
    getCountryCode,
};
