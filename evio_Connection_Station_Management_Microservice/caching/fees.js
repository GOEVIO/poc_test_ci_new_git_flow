const { getRedisClient } = require("./cache.js");
const { retrieveFees } = require("evio-library-configs").default;

const feeCacheKeyPrefix = 'fee';
const feesCacheKeyPrefix = 'fees';

async function getFeeFromRedis(redisClient, key) {
    let feeId = await redisClient.get(key);
    let fees = await redisClient.get(`${feeCacheKeyPrefix}:${feeId}`);

    return JSON.parse(fees);
}

async function getFees(charger) {
    const context = 'getFees';

    const defaultCountryCode = "PT";
    const defaultZone = "Portugal";
    const countryCode = charger?.countryCode ?? charger?.address?.countryCode ?? charger?.address?.country ?? defaultCountryCode;
    //TODO: This logic is still missing the calculation of the fee zone.
    const zone = charger?.address?.zone ?? charger?.address?.country ?? (countryCode === defaultCountryCode ? defaultZone : null);

    const buildFeesCache = async(redisClient, feesData) => {
        const feePromises = feesData.map(async (fee) => {
            await redisClient.set(`${feeCacheKeyPrefix}:${fee._id}`, JSON.stringify(fee));
            await redisClient.set(`${feesCacheKeyPrefix}:${fee.countryCode}:${fee.zone}`, fee._id.toString());
        });

        await Promise.all(feePromises);
        console.log('Fees cached successfully');
    };

    const cacheKey = `${feesCacheKeyPrefix}:${countryCode}:${zone}`;

    try {
        const redisClient = await getRedisClient();
        const keys = zone ? [cacheKey] : await redisClient.keys(`${feesCacheKeyPrefix}:${countryCode}:*`);

        const feesPromises = keys.map(key => getFeeFromRedis(redisClient, key));
        const feesList = await Promise.all(feesPromises);
        if (feesList.every(fees => fees === null)) {
            console.log(`[${context}] Fees not found for country=${countryCode} and zone=${zone} for related charger=${charger}, fetching fees manually...`);

            const fees = await retrieveFees();
            console.log(`[${context}] ${fees.length} Fees retrieved successfully`);
            await buildFeesCache(redisClient, fees);

            const parsedFees = fees.find(fees => fees.fees);

            return parsedFees?.fees;
        }
        const parsedFees = feesList.find(fees => fees.fees);

        return parsedFees?.fees;
    } catch (error) {
        console.error(`[Error getFees] ${error.message}`);
        throw error;
    }
}

module.exports = {
    getFees,
};