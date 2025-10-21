const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const logsOutModel = new Schema(
    {
        path: { type: String },
        reqID: { type: String },
        userId: { type: String },
        hwId: { type: String },
        requestBody: {
            type: Object
        },
        responseBody: {
            type: Object
        },
        httpCode: { type: Number },
        commandResponse: {
            type: Object
        },
        commanResult: {
            type: Object
        },
        authorization_reference: { type: String },
        sessionId: { type: String },
        responseStatus: { type: String },
        requestType: { type: String },
        queryData: { type: String },
        paramsData: { type: String },
        clientType: { type: String },
    },
    {
        timestamps: true
    }
);

var LogsOut = module.exports = mongoose.model('LogsOut', logsOutModel);

module.exports.createLogsOut = function (newLogsOut, callback) {
    newLogsOut.save(callback);
};

module.exports.updateLogsOut = function (query, values, callback) {
    LogsOut.findOneAndUpdate(query, values, callback);
};