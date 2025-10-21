const redisConnection = require('evio-redis-connection/dist').default;
const Sentry = require('@sentry/node');
//Models
const PaymentMethod = require('../models/paymentMethod');

const getKey = (userId) => `paymentMethods:${userId}`;

module.exports = {
    createCachePaymentMethodByUser,
    getCachePaymentMethodByUser,
    deleteCachedPaymentMethodsByUserId,
    getDefaultPaymentMethod,
    paymentMethodFind,
};

async function createCachePaymentMethodByUser(userId, paymentMethodData) {
    const context = '[createCachePaymentMethodByUser]';
    try {
        console.log(`${context} Creating cache for user ${userId}`);

        const cacheKey = getKey(userId);
        const value = JSON.stringify(paymentMethodData);

        await redisConnection.set(cacheKey, value);
    } catch (error) {
        console.log(`${context} Error: ${error.message}`);
        Sentry.captureException(error);
    }
}

async function getCachePaymentMethodByUser(userId) {
    const context = '[getCachePaymentMethodByUser]';
    const cacheKey = getKey(userId);
    let result;

    try {
        console.log(`${context} Getting payment methods from cache to user ${userId}`);
        const cacheValue = await redisConnection.get(cacheKey);

        if (cacheValue) {
            result = JSON.parse(cacheValue);
            console.log(`${context} Returning ${result.length} cached payment methods for userId=${userId}`, { userId });
        }

        return result;
    } catch (error) {
        console.log(`${context} Error: ${error.message}`);
        Sentry.captureException(error);

        return result;
    }
}

async function deleteCachedPaymentMethodsByUserId(userId) {
    const context = '[deleteCachedPaymentMethodsByUserId]';
    const cacheKey = getKey(userId);

    try {
        console.log(`${context} Deleting cache for userId=${userId}`, { userId });

        await redisConnection.delete(cacheKey);
    } catch (error) {
        console.log(`${context} Error: ${error.message}`);
        Sentry.captureException(error);
    }
}

async function getDefaultPaymentMethod(userId) {
    const context = '[getDefaultPaymentMethod]';
    console.log(`${context} Start - userId: ${userId}`);

    let paymentMethodsData = await getCachePaymentMethodByUser(userId);
    console.log(`${context} Retrieved from cache:`, JSON.stringify(paymentMethodsData));

    if (paymentMethodsData?.length == 1) {
        console.log(`${context} One payment method found in cache.`);
        return paymentMethodsData[0];
    }

    let defaultPaymentMethod;

    if (!paymentMethodsData || paymentMethodsData.length == 0) {
        console.log(`${context} No payment methods in cache. Fetching from database...`);
        paymentMethodsData = await paymentMethodFind(userId);
        console.log(`${context} Retrieved from PaymentMethod collection:`, JSON.stringify(paymentMethodsData));

        if (paymentMethodsData.length == 0) {
            console.warn(`${context} No payment methods found for user ${userId}.`);
            Sentry.captureMessage(new Error(`User ${userId} without any payment method`));
            return null;
        }

        if (paymentMethodsData.length > 0) {
            console.log(`${context} Creating cache for user.`);
            createCachePaymentMethodByUser(userId, defaultPaymentMethod);
        }

        if (paymentMethodsData.length > 1) {
            defaultPaymentMethod = paymentMethodsData.find(
                (paymentMethod) => paymentMethod.defaultPaymentMethod == true
            );
            if (defaultPaymentMethod) {
                console.log(`${context} Default payment method found in DB.`);
                return defaultPaymentMethod;
            }
        }

        console.log(`${context} Returning first payment method from DB as default.`);
        return paymentMethodsData[0];
    }

    defaultPaymentMethod = paymentMethodsData.find(
        (paymentMethod) => paymentMethod.defaultPaymentMethod == true
    );
    if (defaultPaymentMethod) {
        console.log(`${context} Default payment method found in cache.`);
        return defaultPaymentMethod;
    }

    console.log(`${context} No default marked. Returning first method from cache.`);
    return paymentMethodsData[0];
}

async function paymentMethodFind(userId) {
    const context = 'Function paymentMethodFind';
    return PaymentMethod.find({ userId });
}