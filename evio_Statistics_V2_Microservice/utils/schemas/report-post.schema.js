const Joi = require('joi');

const bodySchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  language: Joi.string().required(),
  email: Joi.string().email().required(),
  type: Joi.string().valid('apt').required(),
  filter: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
    groupBy: Joi.string().valid('apt', 'charger').required(),
  }).required(),
});

module.exports = bodySchema;
