const express = require('express');
const router = express.Router();

const coordinatesConfig = require('../models/coordinatesSessionsConfig');
const {
    upsertConfig,
    getConfig,
} = coordinatesConfig;

router.put('/api/private/configs/coordinates-config', async (req, res) => {
    try {
        const upsertedConfig = await upsertConfig(req.body);
        res.status(200).json({ message: 'Configuração salva com sucesso.', data: upsertedConfig });
    } catch (error) {
        console.error(error);
        res.status(400).json({ error: error.message });
    }
});

router.get('/api/private/configs/coordinates-config', async (req, res) => {
   try {
        const config = await getConfig();
        res.status(200).json(config);
    } catch (error) {
       console.error(error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;