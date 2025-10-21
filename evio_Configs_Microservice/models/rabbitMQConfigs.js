const mongoose = require('mongoose');
const { Schema } = mongoose;

const rabbitMQConfigSchema = new Schema(
    {
        retryAttempts: { type: Number, required: true },
        readingSimultaneously: { type: Number, required: true },
        queueName: { type: String, required: true },
        deadLetterExchange: { type: String },
        deadQueue: { type: String }
    },
    { timestamps: true }
);

const rabbitMQConfigModel = mongoose.model(
    'rabbitMQConfigs',
    rabbitMQConfigSchema
);

async function upsertConfig(configData) {
    const upsertedConfig = await rabbitMQConfigModel.findOneAndUpdate(
        { queueName: configData.queueName },
        { $set: {...configData} },
        { upsert: true, new: true }
    );
    return upsertedConfig;
}


async function getConfig(queueName) {
    const config = await rabbitMQConfigModel.findOne({queueName}).lean();
    if (!config) {
        throw new Error('Configuration not found.');
    }
    return config;
}

module.exports = {
    upsertConfig,
    getConfig
};
