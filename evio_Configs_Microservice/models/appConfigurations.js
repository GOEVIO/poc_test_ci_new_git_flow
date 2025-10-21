/**
 * Represents the schema for app configurations.
 * @typedef {Object} AppConfigSchema
 * @property {Object} mapsConfiguration - Configuration for maps.
 * @property {Number} [mapsConfiguration.maxMap=4.5] - Maximum number of maps.
 * @property {Number} [mapsConfiguration.maxRankings=7] - Maximum rankings.
 * @property {Object} marketingAndPromotionNotifications - Configuration for marketing and promotion notifications.
 * @property {Boolean} [marketingAndPromotionNotifications.licenseServiceEnabled=true] - Enable license service notifications.
 * @property {Boolean} [marketingAndPromotionNotifications.licenseProductEnabled=true] - Enable license product notifications.
 * @property {Boolean} [marketingAndPromotionNotifications.licenseMarketingEnabled=true] - Enable license marketing notifications.
 * @property {String} clientName - Name of the client.
 */

const { notificationsGeneralEnum }  = require('../utils/enums/notifications');
const mongoose = require('mongoose');

const { Schema } = mongoose;

const marketingAndPromotionNotificationsDefault = {
    unsubscribedLink: { type: String, default: notificationsGeneralEnum.unsubscribedLinkDefault },
    licenseServiceEnabled: { type: Boolean, default: true },
    licenseProductEnabled: { type: Boolean, default: true },
    licenseMarketingEnabled: { type: Boolean, default: true },
}

const marketingAndPromotionNotificationsSchema = new Schema(marketingAndPromotionNotificationsDefault);

const appConfigSchema = new Schema({
    mapsConfiguration: {
        maxMap: { type: Number, default: 4.5 },
        maxRankings: { type: Number, default: 7 }
    },
    marketingAndPromotionNotifications: {
        type: marketingAndPromotionNotificationsSchema,
        default: marketingAndPromotionNotificationsDefault,
    },
    clientName: { type: String, unique: true, required: true, index: true }
});

const AppConfigurationModel = mongoose.model('AppConfiguration', appConfigSchema);

/**
 * Validates app config data.
 * @param {Object} appConfigData - Data to validate.
 * @throws {Error} If client name is missing.
 */
function validateAppConfigData(appConfigData) {
    if (!appConfigData.clientName) {
        return false;
    }
}

/**
 * Creates a single app configuration.
 * @async
 * @param {Object} appConfigData - Data for the app configuration.
 * @returns {Promise<Object>} Created app configuration document.
 * @throws {Error} If an app configuration with the same client name already exists.
 */
async function createAppConfig(appConfigData) {
    validateAppConfigData(appConfigData);
    const existingConfig = await AppConfigurationModel.findOne({ clientName: appConfigData.clientName });
    if(!validateAppConfigData(appConfigData) || existingConfig) {
        return false;
    }
    return await AppConfigurationModel.create(appConfigData);
}

/**
 * Creates multiple app configurations.
 * @async
 * @param {Array<Object>} appConfigsData - Array of app configuration data.
 * @returns {Promise<Array<Object>>} Created app configuration documents.
 * @throws {Error} If app configurations with the specified client names already exist.
 */
async function createAppConfigs(appConfigsData) {
    for (const appConfigData of appConfigsData) {
        validateAppConfigData(appConfigData);
        validatedConfigs.push(validateAppConfigData(appConfigData));
    }

    if (validatedConfigs.includes(false)) {
        return false;
    }
    const clientNames = appConfigsData
        .map((appConfig) => appConfig.clientName)
        .filter(Boolean)
        .filter((clientName) => typeof clientName === 'string');

    if (await AppConfigurationModel.exists({ clientName: { $in: clientNames } })) {
        throw new Error('App configurations with the specified client names already exist.');
    }
    const insertedDocuments = await AppConfigurationModel.insertMany(appConfigsData);
    return insertedDocuments;
}

/**
 * Retrieves all app configurations.
 * @async
 * @returns {Promise<Array<Object>>} All app configuration documents.
 */
async function getAllAppConfigs() {
    return await AppConfigurationModel.find({});
}

/**
 * Retrieves app configurations with a specific client name.
 * @async
 * @param {String} clientName - Client name to filter by.
 * @param {Object} fields - Fields to include in the query.
 * @returns {Promise<Array<Object>>} App configuration documents matching the client name.
 */
async function getAppConfigsWithClientName(clientName, fields = {}) {
    return await AppConfigurationModel.find({ clientName: clientName }, fields);
}

/**
 * Updates an app configuration by client name.
 * @async
 * @param {String} clientName - Client name to update.
 * @param {Object} updates - Fields to update.
 * @returns {Promise<Object>} Updated app configuration document.
 */
async function updateAppConfigByClientName(clientName, updates) {
    return await AppConfigurationModel.findOneAndUpdate({ clientName: clientName }, updates, { new: true });
}

/**
 * Batch updates app configurations for all documents-
 * @async
 * @param {Object} updates - Fields to update for all clients.
 * @returns {Promise<Number>} Number of modified documents.
 */
async function batchUpdateAppConfigForAllClients(updates) {
    const result = await AppConfigurationModel.updateMany(updates);
    
    return result;
}

module.exports = {
    AppConfigurationModel,
    batchUpdateAppConfigForAllClients,
    createAppConfig,
    createAppConfigs,
    getAllAppConfigs,
    getAppConfigsWithClientName,
    updateAppConfigByClientName
};