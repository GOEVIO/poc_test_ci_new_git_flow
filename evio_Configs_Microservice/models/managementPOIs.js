const mongoose = require('mongoose');

const { Schema } = mongoose;

const managementPOIsModel = new Schema(
    {
        id: { type: String, index: true },
        daysToUpdate: { type: Number },
        numberOfPois: { type: Number },
        active: { type: Boolean, default: true },
        userId: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var ManagementPOIs = module.exports = mongoose.model('ManagementPOIs', managementPOIsModel);

module.exports.createManagementPOIs = function (newManagementPOIs, callback) {
    newManagementPOIs.save(callback);
};

module.exports.updateManagementPOIs = function (query, values, callback) {
    ManagementPOIs.findOneAndUpdate(query, values, callback);
};

module.exports.removeManagementPOIs = function (query, callback) {
    ManagementPOIs.findOneAndRemove(query, callback);
};

module.exports.disableAllConfigs = function (callback) {
    var query = {};
    var newValues = { $set: { active: false } };
    ManagementPOIs.updateMany(query, newValues, callback);
};