const { Enums } = require('evio-library-commons').default;
const { z } = require('zod');

const isValidPaginateNumber = (value) => {
    if(!value) return true;
    let number = Number(value); 
    return !isNaN(number) && Number.isInteger(number)
}

const getSessionSchema = z.object({
    startDate: z.string().datetime({ precision: 3 }, {
        message: 'Date is string and must be in the format yyyy-MM-ddTHH:mm:ss.SSS'
    }).optional(), 
    stopDate: z.string().datetime({ precision: 3 }, {
        message: 'Date is string and must be in the format yyyy-MM-ddTHH:mm:ss.SSS'
    }).optional(),
    mobile: z.string().optional(),
    email: z.string().email().optional(),
    invalidateReason: z.nativeEnum(Enums.OcpiSessionSuspendedReason, {
        message: 'Invalid invalidateReason'
    }).array().nonempty().optional(),
    status: z.nativeEnum(Enums.OcpiSessionStatus, {
        message: 'Invalid status'
    }).array().nonempty(),
    pageNumber: z.union([z.string(), z.number()])
        .refine(isValidPaginateNumber, {message: "Invalid number"})
        .optional()
        .default(1),
    limiteQuery: z.union([z.string(), z.number()])
        .refine(isValidPaginateNumber, {message: "Invalid number"})
        .optional()
        .default(10)
})

module.exports = { getSessionSchema };