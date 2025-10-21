const Redis = require('ioredis');
const Constants = require('../utils/constants');

let redisClient;
const redisConfig = {
    sentinels: [
        { host: Constants.redis.sentinelHost1, port: Constants.redis.sentinelPort },
        { host: Constants.redis.sentinelHost2, port: Constants.redis.sentinelPort },
        { host: Constants.redis.sentinelHost3, port: Constants.redis.sentinelPort },
    ],
    name: Constants.redis.masterName,
};

async function getRedisClient() {
     if(!redisClient) {
        try {
            redisClient = new Redis(redisConfig);

            redisClient.on("error", (error) => {
                console.error("Error in Redis Client", redisConfig, error);
                throw error; 
            });
        } catch (error) {
            console.error('Failed to create Redis client', error);
            throw error; 
        }
    }
    return redisClient;
}

module.exports = {
	getRedisClient,
};