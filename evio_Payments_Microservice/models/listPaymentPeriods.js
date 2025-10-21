const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const listPaymentPeriodsModel = new Schema(
    {

        userId: { type: String },
        paymentPeriod: [String],
        userType: { type: String },
        clientName: { type: String, default: "EVIO" },

    },
    {

        timestamps: true

    }
);

var ListPaymentPeriods = module.exports = mongoose.model('ListPaymentPeriods', listPaymentPeriodsModel);

module.exports.createListPaymentPeriods = function (newListPaymentPeriods, callback) {
    newListPaymentPeriods.save(callback);
};

module.exports.updateListPaymentPeriods = function (query, values, callback) {
    ListPaymentPeriods.findOneAndUpdate(query, values, callback);
};

module.exports.removeListPaymentPeriods = function (query, callback) {
    ListPaymentPeriods.findOneAndRemove(query, callback);
};