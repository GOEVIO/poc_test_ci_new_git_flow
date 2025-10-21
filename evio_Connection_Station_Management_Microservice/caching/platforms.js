const { getRedisClient } = require('./cache.js');

async function findOnePlatform(query) {
    try {
        const { platformCode } = query;
        const key = `platform:${platformCode}`;

        const redisClient = await getRedisClient();
        const foundPlatform = await redisClient.hgetall(key);

        return foundPlatform;
    } catch (error) {
        console.error("[Error findOnePlatform] " + error.message);
        return null;
    }
}

module.exports = {
    findOnePlatform
};