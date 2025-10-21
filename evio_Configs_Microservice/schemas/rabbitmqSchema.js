const { z } = require('zod');

const RabbitMqConfigSchema = z.object({
    retryAttempts: z.number(),
    readingSimultaneously: z.number(),
    queueName: z.string().min(1),
    deadLetterExchange: z.string().optional(),
    deadQueue: z.string().optional()
})

module.exports = { RabbitMqConfigSchema };