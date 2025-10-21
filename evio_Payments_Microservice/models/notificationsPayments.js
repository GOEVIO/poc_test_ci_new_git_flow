const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const notificationsPaymentsModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        sessionId: { type: String },
        transactionId: { type: String },
        paymentId: { type: String },
        paymentMethod: { type: String },
        notificatcionSend: { type: Boolean, default: false },
        smsSend: { type: Boolean, default: false },
        emailSend: { type: Boolean, default: false },
        active: { type: Boolean, default: true },
        userBlocked: { type: Boolean, default: false },
        numberAattempts: { type: Number },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

notificationsPaymentsModel.index({ userId: 1 });

var NotificationsPayments = module.exports = mongoose.model('NotificationsPayments', notificationsPaymentsModel);

module.exports.createNotificationsPayments = function (newNotificationsPayments, callback) {
    newNotificationsPayments.save(callback);
};

module.exports.updateNotificationsPayments = function (query, values, callback) {
    NotificationsPayments.findOneAndUpdate(query, values, callback);
};

module.exports.removeNotificationsPayments = function (query, callback) {
    NotificationsPayments.findOneAndRemove(query, callback);
};

