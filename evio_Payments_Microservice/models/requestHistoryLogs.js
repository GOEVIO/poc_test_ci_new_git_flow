const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const requestHistoryLogsModel = new Schema(
    {
        userId: { type: String },
        reqID: { type: String },
        path: { type: String },
        clientType: { type: String },
        requestType: { type: String },
        queryData: { type: Object },
        paramsData: { type: Object },
        bodyData: { type: Object },
        responseStatus: { type: String },
        responseBody: { type: Object },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
)

var RequestHistoryLogs = module.exports = mongoose.model('RequestHistoryLogs', requestHistoryLogsModel);

module.exports.createRequestHistoryLogs = function (newRequestHistoryLogs, callback) {
    newRequestHistoryLogs.save(callback);
};

module.exports.updateRequestHistoryLogs = function (query, values, callback) {
    RequestHistoryLogs.findOneAndUpdate(query, values, callback);
};

module.exports.removeRequestHistoryLogs = function (query, callback) {
    RequestHistoryLogs.findOneAndRemove(query, callback);
};