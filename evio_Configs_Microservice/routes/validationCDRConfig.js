const express = require('express');
const { ValidationCDRConfigSchema } = require('../schemas/validationsCDRSchema')
const router = express.Router();

const validationCDRModel = require('../models/validationCDRConfig');
const {
    upsertConfig,
    getConfig,
} = validationCDRModel;

router.put('/api/private/configs/validation-cdr-config/', async (req, res) => {
    try {
        const validationCDRConfigsParameters = req.body || {};

        const config = ValidationCDRConfigSchema.parse(validationCDRConfigsParameters)
        
        const upsertedConfig = await upsertConfig(config);
        return res.status(200).json({ message: 'Configs successfully saved', data: upsertedConfig });
    } catch (error) {
        console.error(error);
        return res.status(400).json({ error: error.message });
    }
});

router.get('/api/private/configs/validation-cdr-config/', async (req, res) => {
    try {
        const config = await getConfig();
        return res.status(200).json(config);
    } catch (error) {
       console.error(error);
        return res.status(400).json({ error: error.message });
    }
});

module.exports = router;