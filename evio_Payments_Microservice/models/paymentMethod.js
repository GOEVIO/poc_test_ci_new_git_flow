const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const paymentMethodModel = new Schema(
    {
        userId: { type: String },
        paymentMethodId: { type: String },
        defaultPaymentMethod: { type: Boolean, default: false },
        paymentMethodType: { type: String },
        cardBrand: { type: String },
        creditCard: { type: Boolean, default: false },
        inUse: { type: Boolean },
        status: { type: String, default: process.env.PaymentMethodStatusApproved },
        clientName: { type: String, default: "EVIO" },
        threeDSAuthenticated : { type: Boolean , default: false },
        needsThreeDSAuthentication : { type: Boolean , default: false},
        details : { type: Object },
        paymentData : { type: Object },
    },
    {
        timestamps: true
    }
);

paymentMethodModel.index({ userId: 1 });

var PaymentMethod = module.exports = mongoose.model('PaymentMethod', paymentMethodModel);

module.exports.createPaymentMethod = function (newPaymentMethod, callback) {
    newPaymentMethod.save(callback);
};

module.exports.updatePaymentMethod = function (query, values, callback) {
    PaymentMethod.findOneAndUpdate(query, values, callback);
};

module.exports.removePaymentMethod = function (query, callback) {
    PaymentMethod.findOneAndRemove(query, callback);
};

module.exports.markAsDefaultPaymentMethod = function (paymentMethodId, callback) {
    var query = { paymentMethodId: paymentMethodId };
    var newvalues = { $set: { defaultPaymentMethod: true } };
    PaymentMethod.updateOne(query, newvalues, callback);
};

module.exports.markAllDefaultPaymentMethodFalse = function (userId, callback) {
    var query = { userId: userId };
    var newvalues = { $set: { defaultPaymentMethod: false } };
    PaymentMethod.updateMany(query, newvalues, callback);
};