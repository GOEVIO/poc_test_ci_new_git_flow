const mongoose = require('mongoose');

const { Schema } = mongoose;

const cpModelsWithNoAvailableStatusNotificationModel = new Schema(
    {
        id: { type: String, index: true },
        chargerModel: { type: String },
        active: { type: Boolean, default: true },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

cpModelsWithNoAvailableStatusNotificationModel.index({ chargerModel: 1 });

var CpModelsWithNoAvailableStatusNotification = module.exports = mongoose.model('CpModelsWithNoAvailableStatusNotification', cpModelsWithNoAvailableStatusNotificationModel);

module.exports.createCpModelsWithNoAvailableStatusNotification = function (newCpModelsWithNoAvailableStatusNotification, callback) {
    newCpModelsWithNoAvailableStatusNotification.save(callback);
};

module.exports.updateCpModelsWithNoAvailableStatusNotification = function (query, values, callback) {
    CpModelsWithNoAvailableStatusNotification.findOneAndUpdate(query, values, callback);
};

module.exports.removeCpModelsWithNoAvailableStatusNotification = function (query, callback) {
    CpModelsWithNoAvailableStatusNotification.findOneAndRemove(query, callback);
};