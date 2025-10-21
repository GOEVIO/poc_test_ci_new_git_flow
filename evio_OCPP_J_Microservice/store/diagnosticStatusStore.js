const redisClient = require('./redisClient');

const STATUS_PREFIX = 'diagnostic_status:';
const TTL_SECONDS = 60 * 60;

module.exports = {
    setStatus: async (hwId, status) => {
        const key = `${STATUS_PREFIX}${hwId}`
        const value = JSON.stringify({
            status,
            timestamp: new Date().toISOString()
        })

        await redisClient.set(key, value, 'EX', TTL_SECONDS)
    },

    getStatus: async (hwId) => {
        const key = `${STATUS_PREFIX}${hwId}`
        const data = await redisClient.get(key)
        return data ? JSON.parse(data) : null
    },

    clearStatus: async (hwId) => {
        const key = `${STATUS_PREFIX}${hwId}`
        await redisClient.del(key)
    }
}
