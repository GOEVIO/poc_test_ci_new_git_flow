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
const sessionsQueueModel = new Schema(
    {
        session: { type: Object },
        chargersSession: { type: Object },
        requestBody: { type: Object },
        command: { type: String },
        network: { type: String },
        country_code : { type: String },
        party_id : { type: String },
        operatorId : { type: String },
        sessionId : { type: String },
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

var SessionsQueue = module.exports = mongoose.model('SessionsQueue', sessionsQueueModel);

module.exports.create = function (newSessionsQueue) {
    return newSessionsQueue.save();
};

module.exports.SessionsQueue = function (query, values, callback) {
    SessionsQueue.findOneAndUpdate(query, values, callback);
};

module.exports.SessionsQueue = function (query, callback) {
    SessionsQueue.findOneAndRemove(query, callback);
};