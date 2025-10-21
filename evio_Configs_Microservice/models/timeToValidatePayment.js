const mongoose = require('mongoose');

const { Schema } = mongoose;

const timeToValidatePaymentModel = new Schema(
    {
        id: { type: String, index: true },
        timeToReserve: { type: String }, //in minutes
        timeToConfirmation: { type: String }, //in minutes
        active: { type: Boolean, default: true },
        userId: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var TimeToValidatePayment = module.exports = mongoose.model('TimeToValidatePayment', timeToValidatePaymentModel);

module.exports.createTimeToValidatePayment = function (newTimeToValidatePayment, callback) {
    newTimeToValidatePayment.save(callback);
};

module.exports.updateTimeToValidatePayment = function (query, values, callback) {
    TimeToValidatePayment.findOneAndUpdate(query, values, callback);
};

module.exports.removeTimeToValidatePayment = function (query, callback) {
    TimeToValidatePayment.findOneAndRemove(query, callback);
};