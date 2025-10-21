const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const userPaymentConfigurationsModel = new Schema(
    {
        userId: { type: String },
        paymentMethodId: { type: String },
        recurringProcessingModel: { type: String },
        tester: { type: Boolean },
        sendEmail: { type: Boolean },
        testResponseCode: { type: String },
    },
    {
        timestamps: true
    }
);

userPaymentConfigurationsModel.index({ userId: 1 });

var UserPaymentConfigurations = module.exports = mongoose.model('UserPaymentConfigurations', userPaymentConfigurationsModel);

module.exports.createUserPaymentConfigurations = function (newUserPaymentConfigurations, callback) {
    newUserPaymentConfigurations.save(callback);
};

module.exports.updateUserPaymentConfigurations = function (query, values, callback) {
    UserPaymentConfigurations.findOneAndUpdate(query, values, callback);
};

module.exports.removeUserPaymentConfigurations = function (query, callback) {
    UserPaymentConfigurations.findOneAndRemove(query, callback);
};
