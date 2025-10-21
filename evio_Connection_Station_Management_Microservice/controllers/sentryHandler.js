
const SamplerValidation = require('../models/samplerValidation');
const Sentry = require("@sentry/node");
const { ProfilingIntegration } = require("@sentry/profiling-node");
module.exports = {
    samplingRateValidation: async function (samplingContext) {
        const context = "Function samplingRateValidation";
        try {
            let allValidations = await getAllValidations()
            
            let rating = await getRating(allValidations , samplingContext)
            return rating ?? await getDefaultRate()
        } catch(error) {
            console.error(`[${context}][find] Error `, error.message);
            return await getDefaultRate()
        }
        
    },
    sentryInit : async function(app) {
        const context = "Function sentryInit";
        try {
            const allValidations = await getAllValidations()
            const defaultRate = await getDefaultRate()
            Sentry.init({
                dsn: process.env.sentryDsnKey,
                integrations: [
                    // enable HTTP calls tracing
                    new Sentry.Integrations.Http({ tracing: true }),
                    // enable Express.js middleware tracing
                    new Sentry.Integrations.Express({ app }),
                    new ProfilingIntegration(),
                ],
                environment : process.env.NODE_ENV,
                // Performance Monitoring
                // tracesSampleRate: 0.2, // Capture 100% of the transactions, reduce in production!
                // // Set sampling rate for profiling - this is relative to tracesSampleRate
                // profilesSampleRate: 0.2, // Capture 100% of the transactions, reduce in production!
                tracesSampler: (samplingContext) => {
                    const rating = getRating(allValidations , samplingContext)
                    return rating ?? defaultRate
                }
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
        }
    }
};


async function querySamplerValidation(query) {
    const context = "Function querySamplerValidation";
    try  {
        return await SamplerValidation.find(query).lean()
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}

async function getAllValidations() {
    const context = "Function getAllValidations";
    try {
        return await querySamplerValidation({})
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}


function getRating(allValidations , samplingContext) {
    const context = "Function getRating";
    try {
        for (let validationObj of allValidations) {
            if (validationObj.validationType === process.env.sentryNameValidation) {
                const transactionName = samplingContext?.transactionContext?.name
                let foundValidation = validationObj.validations.find(validation => filterValidation(transactionName , validation))
                return foundValidation?.rate
            }
        }
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        return 0.1
    } 
}

function filterValidation(element , validation) {
    const context = "Function filterValidation";
    try {
        if (validation.type === process.env.sentryEqualsValidation) {
            return element === validation.value
        } else if (validation.type === process.env.sentryIncludesValidation) {
            return element?.includes(validation.value)
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        return null
    }
}

async function getDefaultRate() {
    const context = "Function getDefaultRate";
    try {
        const firstSampler = await queryFirstSamplerValidation({}) 
        return firstSampler?.defaultRate ?? 0.1
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        return 0.1
    }
}

async function queryFirstSamplerValidation(query) {
    const context = "Function queryFirstSamplerValidation";
    try  {
        return await SamplerValidation.findOne(query).lean()
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}