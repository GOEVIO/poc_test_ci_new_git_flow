const mongoose = require('mongoose');
const { Schema } = mongoose;

const validationCDRConfigSchema = new Schema(
    {
        minAcceptableToSumOfSubUsageEnergy: { type: Number, required: true },
        minAcceptableToTotalEnergy: { type: Number, required: true },
        maxAcceptableToTotalEnergy: { type: Number, required: true },
        minAcceptableDaysOfDurations: { type: Number, required: true },
        minAcceptablePriceOfSession: { type: Number, required: true },
        maxAcceptablePriceOfSession: { type: Number, required: true },
        minAcceptableCemePrice: { type: Number, required: true },
        maxDaysOfNotExpiredSession: { type: Number, required: true, default: 30 },
        dpcLocations: { type: [String], required: false, default: [] },
    },
    { timestamps: true }
);

const validationCDRConfigModel = mongoose.model(
    'validationCDRConfig',
    validationCDRConfigSchema
);

async function upsertConfig(configData) {
    const upsertedConfig = await validationCDRConfigModel.findOneAndUpdate(
        { },
        { $set: {...configData} },
        { upsert: true, new: true }
    );
    return upsertedConfig;
}


async function getConfig() {
    const config = await validationCDRConfigModel.findOne().lean();
    if (!config) {
        throw new Error('Configuration not found.');
    }
    return config;
}

module.exports = {
    upsertConfig,
    getConfig
};
