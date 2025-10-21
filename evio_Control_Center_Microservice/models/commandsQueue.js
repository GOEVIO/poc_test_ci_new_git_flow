const mongoose = require('mongoose');

const { Schema } = mongoose;

const integrationStatusModel = new Schema(
    {
        status: { type: String },
        response : { type: String },
        errorCode: { type: String },
        errorDescription: { type: String },
        failedCount : { type: Number , default : 0 },

    }
);
const commandsQueueModel = new Schema(
    {
        command: { type: String },
        hwId: { type: String },
        plugId: { type: String },
        result: { type: String },
        message: { type: String },
        response_url: { type: String },
        network: { type: String },
        country_code : { type: String },
        party_id : { type: String },
        operatorId : { type: String },
        platformId : { type: String },
        integrationStatus : { type: integrationStatusModel },
        endpoint : { type: String },
        data : { type: Object },
        token : { type: String },
        requestType : { type: String },
        httpStatus : { type: Number },
    },
    {
        timestamps: true
    }
);

var CommandsQueue = module.exports = mongoose.model('CommandsQueue', commandsQueueModel);

module.exports.create = function (commandsQueue) {
    return commandsQueue.save();
};

module.exports.CommandsQueue = function (query, values, callback) {
    CommandsQueue.findOneAndUpdate(query, values, callback);
};

module.exports.CommandsQueue = function (query, callback) {
    CommandsQueue.findOneAndRemove(query, callback);
};