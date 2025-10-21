const Redis = require('ioredis');
const Constants = require('../utils/constants');

const redisConfig = {
    sentinels: [
        { host: Constants.redis.sentinelHost1, port: Constants.redis.sentinelPort },
        { host: Constants.redis.sentinelHost2, port: Constants.redis.sentinelPort },
        { host: Constants.redis.sentinelHost3, port: Constants.redis.sentinelPort },
    ],
    name: Constants.redis.masterName,
};

const redisClient = new Redis(redisConfig);

redisClient.on('error', (err) => {
    console.error('[Redis Error]', err.message);
    console.error('Redis config:', redisConfig);
});

module.exports = redisClient;
