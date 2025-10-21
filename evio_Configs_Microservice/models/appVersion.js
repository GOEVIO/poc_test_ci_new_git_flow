const mongoose = require('mongoose');

const { Schema } = mongoose;

const AppVersionModel = new Schema(
    {
        id: { type: String, index: true },
        version: { type: String },
        code: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

AppVersionModel.index({ version: 1 });

var AppVersions = module.exports = mongoose.model('appVersions', AppVersionModel);

module.exports.createAppVersion = function (newAppVersion, callback) {
    newAppVersion.save(callback);
};

module.exports.updateAppVersion = function (query, values, callback) {
    AppVersions.findOneAndUpdate(query, values, callback);
};

module.exports.removeAppVersion = function (query, callback) {
    AppVersions.findOneAndRemove(query, callback);
};