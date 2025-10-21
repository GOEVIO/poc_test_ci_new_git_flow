const redisConnection = require('evio-redis-connection/dist').default;
const Sentry = require("@sentry/node");


const ConnectorService = {
    /**
     * Retrieves cached plug status based on locationId and evse_uid.
     * 
     * @param {string} locationId - hwId | Charger Identifier.
     * @param {string} evse_uid - plugId | EVSE identifier.
     * @returns {object|null} - The cached plug status data, or null if not found.
     */
    getCachedPlugStatus: async function(locationId, evse_uid) {
        const context = 'ConnectorService.getCachedPlugStatus function';
        const cacheKey = `plugStatus:${locationId}:${evse_uid}`;

        try {
            console.log(`[${context}] Trying to get cached plug status with key=${cacheKey}`);

            const cacheValue = await redisConnection.get(cacheKey);
            if (cacheValue) {
                const plugStatusData = JSON.parse(cacheValue);
                console.log(`[${context}] Successfully retrieved cached data for key=${cacheKey}`);
                return plugStatusData;
            }

            console.log(`[${context}] No cached data found for key=${cacheKey}`);
            return null; 
        } catch (error) {
            console.log(`[${context}] Error retrieving cache for key=${cacheKey}:`, error.message);
            Sentry.captureException(error);
            return null; 
        }
    },

    /**
     * Creates the plug status in the cache.
     * 
     * @param {string} locationId - hwId | Charger Identifier.
     * @param {string} evse_uid - plugId | EVSE identifier.
     * @param {object} data - The plug status data to store in the cache | body.
     */
    createCachePlugStatus: async function(locationId, evse_uid, data) {
        const context = 'ConnectorService.createCachePlugStatus function';
        const cacheKey = `plugStatus:${locationId}:${evse_uid}`;

        try {
            console.log(`[${context}] Caching plug status with key=${cacheKey}`);
            await redisConnection.set(cacheKey, JSON.stringify(data));
            console.log(`[${context}] Successfully cached plug status for key=${cacheKey}`);
        } catch (error) {
            console.log(`[${context}] Error caching plug status for key=${cacheKey}:`, error.message);
            Sentry.captureException(error);
        }
    },
};

module.exports = ConnectorService;