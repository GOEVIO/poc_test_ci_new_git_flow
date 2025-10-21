const Joi = require('joi');

// Create validator closure funtion
const validator = (schema) => async (payload) => {
    try {
        return schema.validateAsync(payload , {abortEarly : true , stripUnknown: true })
    } catch (error) {
        throw error
    }
} 

// ================================== SCHEMAS ==================================

// Validation schema create 
const createSchema = Joi.object({
    reference : Joi.string().required(),
    clientName : Joi.string().required(),
    amount : Joi.object({
        currency : Joi.string().required(),
        value : Joi.number().strict().required(),
    }).required(),
    paymentMethodId : Joi.string().required(),
    adyenReference : Joi.string().required(),
    userId : Joi.string().required(),
    success : Joi.boolean().strict().required(),
    active : Joi.boolean().strict().required(),
    authorizeDate : Joi.string().strict().required(),
})

// Validation schema get 
const getSchema = Joi.object({
    _id : Joi.string(),
    paymentMethodId : Joi.string(),
    adyenReference : Joi.string(),
    userId : Joi.string(),
})

// Validation schema patch
const patchSchema = Joi.object({
    _id : Joi.string(),
    reference : Joi.string(),
    amount : Joi.object({
        currency : Joi.string(),
        value : Joi.number().strict(),
    }),
    adyenReference : Joi.string(),
    success : Joi.boolean(),
    active : Joi.boolean(),
    authorizeDate : Joi.string().strict(),
})


module.exports = {
    validateCreate: validator(createSchema),
    validateGet : validator(getSchema),
    validateEdit: validator(patchSchema),
}