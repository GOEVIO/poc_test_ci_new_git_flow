const express = require('express');
const router = express.Router();

const appConfigOperations = require('../models/appConfigurations');
const { validateUpdates } = require('../middlewares/appConfigurations');
const {
    AppConfigurationModel,
    createAppConfig,
    createAppConfigs,
    getAllAppConfigs,
    getAppConfigsWithClientName,
    updateAppConfigByClientName,
    batchUpdateAppConfigForAllClients,
} = appConfigOperations;

router.post('/api/private/configs/apps', async (req, res) => {
    try {
        const appConfigData = req.body;
        const newConfig = await createAppConfig(appConfigData);
        
        if (!newConfig) {
            return res.status(400).send({
                auth: false,
                code: 'config_not_created',
                message: 'Failed to create app configuration',
            });
        }

        res.status(201).json({
            config: newConfig,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            auth: false,
            code: 'error_single_config_creation',
            message: 'Error creating single app configuration',
        });
    }
});

router.post('/api/private/configs/apps/bulk', async (req, res) => {
    try {
        const configsData = req.body.configs;
        const newConfigs = await createAppConfigs(configsData);
        if(!newConfigs) {
            return res.status(400).send({
                auth: false,
                code: 'configs_not_created',
                message: 'Failed to create app configurations',
            });
        }
        res.status(201).send({
            configs: newConfigs,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            auth: false,
            code: 'error_creating_configs',
            message: 'Error creating app configurations',
        });
    }
});

router.get('/api/private/configs/apps', async (req, res) => {
    try {
        const configs = await getAllAppConfigs();
        res.status(200).json({
            configs: configs,
        });
    } catch (error) {
        return res.status(500).send({
            auth: false,
            code: 'error_fetching_configs',
            message: 'Error fetching app configurations',
        });
    }
});

router.get('/api/private/configs/apps/client/:clientName', async (req, res) => {
    try {
        const { clientName } = req.params;
        const configs = await getAppConfigsWithClientName(clientName);

        if (!configs || configs.length === 0) {
            return res.status(400).send({
                auth: false,
                code: 'configs_not_found',
                message: 'App configurations not found',
            });
        }
        res.status(200).send({
            configs: configs,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            auth: false,
            code: 'error_fetching_configs_by_client',
            message: 'Error fetching app configurations by client',
        });
    }
});

router.patch('/api/private/configs/apps/client/:clientName', async (req, res) => {
    try {
        const updates = req.body;
        const result = validateUpdates(updates);
        if (result?.invalid) {
            return res.status(result.statusCode).send({
                auth: false,
                code: result.code,
                message: result.message
            });
        };
        const updatedConfig = await updateAppConfigByClientName(req.params.clientName, updates);
        if (!updatedConfig) {
            return res.status(400).send({
                auth: false,
                code: 'config_not_found',
                message: 'App configuration not found',
            });
        }
        res.status(200).json({
            config: updatedConfig,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            auth: false,
            code: 'error_fetching_config_by_client',
            message: 'Error fetching app configuration by client',
        });
    }
});

router.patch('/api/private/configs/apps/bulk', async (req, res) => {
    try {
        const updates = req.body.updates;
        
        const result = validateUpdates(updates);
        
        if (result?.invalid) {
            return res.status(result.statusCode).send({
                auth: false,
                code: result.code,
                message: result.message
            });
        }
        
        const updatedConfigs = await batchUpdateAppConfigForAllClients(updates);
        res.status(200).send({
            totalClientsModified: updatedConfigs.nModified,
            totalClients: updatedConfigs.n
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send({
            auth: false,
            code: 'error_batch_updating_configs',
            message: 'Error performing batch update on app configurations'
        });
    }
});




module.exports = router;