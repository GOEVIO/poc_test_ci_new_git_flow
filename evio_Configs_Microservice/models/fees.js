const mongoose = require('mongoose');

const { Schema } = mongoose;

const FeesModel = new Schema(
    {
        id: { type: String, index: true },
        countryCode: { type: String },
        zone: { type: String },
        fees: { type: Object },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

FeesModel.index({ countryCode: 1 });
FeesModel.index({ zone: 1 });

var Fees = module.exports = mongoose.model('fees', FeesModel);

module.exports.createFees = function (newFees, callback) {
    newFees.save(callback);
};

module.exports.updateFees = function (query, values, callback) {
    Fees.findOneAndUpdate(query, values, callback);
};

module.exports.removeFees = function (query, callback) {
    Fees.findOneAndRemove(query, callback);
};