const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const requestHistoryModel = new Schema(
    {
        clientType: { type: String },
        clientName: { type: String },
        method: { type: String },
        path: { type: String },
        reqID: { type: String },
        userId: { type: String },
        mobileBrand: { type: String },
        mobileModel: { type: String },
        mobileVersion: { type: String },
        evioAppVersion: { type: String },
        data: { type: Object },
        requestDate: { type: Date },
        responseDate: { type: Date },
        requestHeaders: { type: Object },
        responseBody: { type: String },
        responseCode: { type: String },
        requestUserId: { type: String },
        accountType: { type: String }
    },
    {
        timestamps: true
    }
);

var RequestHistory = module.exports = mongoose.model('RequestHistory', requestHistoryModel);

module.exports.createRequestHistory = function (newRequestHistory, callback) {
    newRequestHistory.save(callback);
};

module.exports.updateRequestHistory = function (query, values, callback) {
    RequestHistory.findOneAndUpdate(query, values, callback);
};
