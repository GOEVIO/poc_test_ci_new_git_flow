const Constants = {
    environment: process.env.NODE_ENV || 'development',
    redis: {
        sentinelHost1: 'redis-sentinel1',
        sentinelHost2: 'redis-sentinel2',
        sentinelHost3: 'redis-sentinel3',
        sentinelPort: 26379,
        masterName: 'mymaster',
    },
};

module.exports = Constants;
