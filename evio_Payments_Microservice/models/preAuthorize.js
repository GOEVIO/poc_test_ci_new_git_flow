const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const preAuthorizeModel = new Schema(
    {
        reference: { type: String },
        clientName: { type: String },
        amount: {
            currency: { type: String, default: "EUR" },
            value: { type: Number }
        },
        paymentMethodId: { type: String },
        adyenReference: { type: String },
        userId: { type: String },
        authorizeDate: { type: String },
        success: { type: Boolean, default: false },
        active: { type: Boolean, default: false },
    },
    {
        timestamps: true
    }
);

preAuthorizeModel.index({ userId: 1 });

var PreAuthorize = module.exports = mongoose.model('PreAuthorize', preAuthorizeModel);

module.exports.createPreAuthorize = function (newPreAuthorize, callback) {
    newPreAuthorize.save(callback);
};

module.exports.updatePreAuthorize = function (query, values, callback) {
    PreAuthorize.findOneAndUpdate(query, values, { new: true }, callback);
};

module.exports.removePreAuthorize = function (query, callback) {
    PreAuthorize.findOneAndRemove(query, callback);
};