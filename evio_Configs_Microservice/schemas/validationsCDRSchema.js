const { z } = require('zod');

const ValidationCDRConfigSchema = z.object({
    minAcceptableToSumOfSubUsageEnergy: z.number(),
    minAcceptableToTotalEnergy: z.number(),
    maxAcceptableToTotalEnergy: z.number(),
    minAcceptableDaysOfDurations: z.number(),
    minAcceptablePriceOfSession: z.number(),
    maxAcceptablePriceOfSession: z.number(),
    minAcceptableCemePrice: z.number(),
    maxDaysOfNotExpiredSession: z.number().default(30),
    dpcLocations: z.array(z.string()).optional().default([]),
})

module.exports = { ValidationCDRConfigSchema };