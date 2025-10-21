const mongoose = require('mongoose');

const { Schema } = mongoose;

const mailNotificationModel = new Schema(
    {
        id: { type: String, index: true },
        smtp_host: { type: String },
        smtp_port: { type: Number },
        mail_auth_user: { type: String },
        mail_auth_pass: { type: String },
        mailList: [{ type: String }],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var mailNotificationConfig = module.exports = mongoose.model('mailNotifications', mailNotificationModel);

module.exports.createMailNotificationConfig = function (newMailNotificationConfig, callback) {
    newMailNotificationConfig.save(callback);
};

module.exports.updateMailNotificationConfig = function (query, values, callback) {
    mailNotificationConfig.findOneAndUpdate(query, values, callback);
};

module.exports.removeMailNotificationConfig = function (query, callback) {
    mailNotificationConfig.findOneAndRemove(query, callback);
}

