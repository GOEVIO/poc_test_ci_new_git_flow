const redisConnection = require('evio-redis-connection/dist').default;
const Sentry = require('@sentry/node');


const getKey = userId => `contracts:${userId}`;

module.exports = {
    deleteCachedContractsByUserId: async (userId) => {
        const context = '[deleteCachedContractsByUserId]';
        const cacheKey = getKey(userId);

        try {
            console.log(`${context} Deleting cache for userId=${userId}`, { userId });

            await redisConnection.delete(cacheKey);
        } catch (error) {
            console.log(`${context} Error: ${error.message}`);
            Sentry.captureException(error);
        }
    },

};
