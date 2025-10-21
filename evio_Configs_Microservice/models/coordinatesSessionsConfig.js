/**
 * Represents the schema for coordinates session configuration.
 * @property {Number} minSessions - Minimum number of sessions (X).
 * @property {Number} acceptableRadius - Acceptable radius in meters (Z).
 * @property {Number} minPercentage - Minimum percentage of sessions within the radius (Y).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Main schema for coordinates session configuration
const CoordinatesSessionsConfigSchema = new Schema(
    {
        minSessions: { type: Number, required: true },
        acceptableRadius: { type: Number, required: true },
        minPercentage: { type: Number, required: true }
    },
    { timestamps: true }
);

// Model for CoordinatesSessionsConfig
const CoordinatesSessionsConfigModel = mongoose.model(
    'coordinatesSessionsConfigs',
    CoordinatesSessionsConfigSchema
);

/**
 * Validates session configuration data.
 * @param {Object} configData - Configuration data to validate.
 * @throws {Error} If any required field is missing or invalid.
 */
function validateConfigData(configData) {
    if (!configData) {
        throw new Error('Invalid configuration');
    }
    if (
        typeof configData.minSessions !== 'number' ||
        typeof configData.acceptableRadius !== 'number' ||
        typeof configData.minPercentage !== 'number'
    ) {
        throw new Error('Invalid configuration: All fields must be numbers.');
    }
}

/**
 * Upserts the configuration document.
 * If a document exists, it updates it; otherwise, it creates a new one.
 * @async
 * @param {Object} configData - Data for the configuration.
 * @returns {Promise<Object>} The upserted configuration document.
 * @throws {Error} If validation fails.
 */
async function upsertConfig(configData) {
    validateConfigData(configData);
    const upsertedConfig = await CoordinatesSessionsConfigModel.findOneAndUpdate(
        {}, // Match the first document found
        { $set: configData }, // Update or insert the fields
        { upsert: true, new: true } // Create if not exists, and return the updated/created document
    );
    return upsertedConfig;
}


/**
 * Retrieves the current configuration.
 * @async
 * @returns {Promise<Object>} The configuration document.
 * @throws {Error} If no configuration is found.
 */
async function getConfig() {
    const config = await CoordinatesSessionsConfigModel.findOne().lean();
    if (!config) {
        throw new Error('Configuration not found.');
    }
    return config;
}

module.exports = {
    upsertConfig,
    getConfig
};
