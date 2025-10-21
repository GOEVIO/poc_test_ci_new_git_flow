const { redisConnection } = require("./cache");
const Sentry = require("@sentry/node");
const { retrieveCountryCodeByName } = require("evio-library-configs");

async function getCountryCodeByName(countryName) {
    try {
        const CACHE_KEY = `countryCodeByName:${countryName}`;

        // Attempt to get the country code from Redis cache
        let countryCode = await redisConnection.get(CACHE_KEY);

        if (!countryCode) {
            // If not in cache, query the database
            countryCode = await retrieveCountryCodeByName(countryName);

            if (countryCode) {
                // Store in cache without expiration
                await redisConnection.set(CACHE_KEY, countryCode);
            } else {
                Sentry.captureMessage(`[Warn] countryCode not found for country ${countryName}`);
                return null; // Return null if the country code is not found
            }
        }

        return countryCode; // Return only the country code
    } catch (error) {
        Sentry.captureException(error);
        console.error("[Error getCountryCodeByName] ", error);
        // Fallback: attempt to retrieve the country code directly from the database if cache fails
        try {
            return await retrieveCountryCodeByName(countryName);
        } catch (dbError) {
            console.error("[Debug] Error retrieving directly countryCode from DB", countryName,  dbError);
            Sentry.captureMessage(`[Warn] Error retrieving directly from DB after cache fetch error for ${countryName}`);
            return null;
        }
    }
}

module.exports = {
    getCountryCodeByName,
};
