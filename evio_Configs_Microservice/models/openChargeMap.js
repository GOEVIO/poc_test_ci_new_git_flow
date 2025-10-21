const mongoose = require('mongoose');

const { Schema } = mongoose;

const OpenChargeMapModel = new Schema(
    {
        id: { type: String, index: true },
        hostOCM: { type: String, default: process.env.HostOpenChargeMap },
        listCountryCodes: [{ type: String, default: 'PT' }],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var OpenChargeMap = module.exports = mongoose.model('OpenChargeMap', OpenChargeMapModel);

module.exports.createOpenChargeMap = function (newOpenChargeMap, callback) {
    newOpenChargeMap.save(callback);
};

module.exports.updateOpenChargeMap = function (query, values, callback) {
    OpenChargeMap.findOneAndUpdate(query, values, callback);
};

module.exports.removeOpenChargeMap = function (query, callback) {
    OpenChargeMap.findOneAndRemove(query, callback);
};