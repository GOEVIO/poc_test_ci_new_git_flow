const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const appVersionsModel = new Schema(
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

var AppVersions = module.exports = mongoose.model('AppVersions', appVersionsModel);

module.exports.createAppVersions = function (newAppVersions, callback) {
    newAppVersions.save(callback);
};


module.exports.updateAppVersions = function (query, values, callback) {
    AppVersions.findOneAndUpdate (query, values, callback);
};