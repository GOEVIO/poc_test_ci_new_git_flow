const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const listPaymentMethodModel = new Schema(
    {

        userId: { type: String },
        paymentMethod: [String],
        userType: { type: String },
        clientName: { type: String, default: "EVIO" },

    },
    {

        timestamps: true

    }
);

listPaymentMethodModel.index({ userId: 1 });

var ListPaymentMethod = module.exports = mongoose.model('ListPaymentMethod', listPaymentMethodModel);

module.exports.createListPaymentMethod = function (newListPaymentMethod, callback) {
    newListPaymentMethod.save(callback);
};

module.exports.updateListPaymentMethod = function (query, values, callback) {
    ListPaymentMethod.findOneAndUpdate(query, values, callback);
};

module.exports.removeListPaymentMethod = function (query, callback) {
    ListPaymentMethod.findOneAndRemove(query, callback);
};
