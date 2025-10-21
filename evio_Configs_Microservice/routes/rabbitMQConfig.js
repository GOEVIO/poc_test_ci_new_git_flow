const express = require('express');
const { RabbitMqConfigSchema } = require('../schemas/rabbitmqSchema')
const router = express.Router();

const rabbitModel = require('../models/rabbitMQConfigs');
const {
    upsertConfig,
    getConfig,
} = rabbitModel;

router.put('/api/private/configs/rabbit-config/:queueName', async (req, res) => {
    try {
        const queueName = req.params?.queueName;
        const rabbitConfigsParameters = req.body || {};

        const config = RabbitMqConfigSchema.parse({queueName, ...rabbitConfigsParameters })
        
        const upsertedConfig = await upsertConfig(config);
        return res.status(200).json({ message: 'Configs successfully saved', data: upsertedConfig });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: error.message });
    }
});

router.get('/api/private/configs/rabbit-config/:queueName', async (req, res) => {
    try {
        const config = await getConfig(req.params?.queueName);
        return res.status(200).json(config);
    } catch (error) {
       console.error(error);
        return res.status(400).json({ error: error.message });
    }
});

module.exports = router;