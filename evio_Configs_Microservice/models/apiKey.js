const mongoose = require('mongoose');

const { Schema } = mongoose;

const APIKeyModel = new Schema(
    {
        id: { type: String, index: true },
        apiKey: { type: String },
        validateDate: { type: Date },
        clientType: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var APIKey = module.exports = mongoose.model('APIKey', APIKeyModel);

module.exports.createAPIKey = function (newAPIKey, callback) {
    newAPIKey.save(callback);
};

module.exports.updateAPIKey = function (query, values, callback) {
    APIKey.findOneAndUpdate(query, values, callback);
};

module.exports.removeAPIKey = function (query, callback) {
    APIKey.findOneAndRemove(query, callback);
};