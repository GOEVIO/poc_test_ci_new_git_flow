const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const mailNotificationModel = new Schema(
    {
        id: { type: String, index: true },
        hwId: { type: String },
        userId: { type: String },
        sentDate: { type: Date, default: Date.now },
        lastHeartBeat: { type: Date, default: Date.now },
        status: { type: String },
        to: [{ type: String }],
        clientName: { type: String, default: "EVIO" },
    }
);

mailNotificationModel.index({ userId: 1 });

var MailNotification = module.exports = mongoose.model('MailNotification', mailNotificationModel);

module.exports.createMailNotification = function (newMailNotification, callback) {
    newMailNotification.save(callback);
};

module.exports.updateMailNotification = function (query, values, callback) {
    MailNotification.findOneAndUpdate(query, values, callback);
};

module.exports.removeMailNotification = function (query, callback) {
    MailNotification.findOneAndRemove(query, callback);
};