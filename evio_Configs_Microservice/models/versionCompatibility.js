const mongoose = require('mongoose');

const { Schema } = mongoose;

const VersionCompatibilityModel = new Schema(
    {
        id: { type: String, index: true },
        iOSVersion: { type: String },
        androidVersion: { type: String },
        operationsManagementVersion: { type: String },
        webClientVersion: { type: String },
        backendVersion: { type: String },
        active: { type: Boolean, default: true },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var VersionCompatibility = module.exports = mongoose.model('versionCompatibility', VersionCompatibilityModel);

module.exports.createVersionCompatibility = function (newVersionCompatibility, callback) {
    newVersionCompatibility.save(callback);
};

module.exports.updateVersionCompatibility = function (query, values, callback) {
    VersionCompatibility.findOneAndUpdate(query, values, callback);
};

module.exports.removeVersionCompatibility = function (query, callback) {
    VersionCompatibility.findOneAndRemove(query, callback);
};