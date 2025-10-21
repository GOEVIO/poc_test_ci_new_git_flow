const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const notificationModel = new Schema({
    hwId: {
        type: String,
        required: true
    },
    text: {
        type: String,
    },
    timestamp: {
        type: String,
    },
    data: {
        type: Object,
    },
    responseData: {
        type: Object,
    },
    success: {
        type: Boolean,
    },
    plugId: {
        type: String,
    },
    trigger: {
        type: String,
    },
    unread: {
        type: Boolean,
        required: true
    },
    type: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

notificationModel.index({ hwId: 1 });

const Notification = module.exports = mongoose.model('Notification', notificationModel);

module.exports.createNotification = function (newNotification, callback) {
    newNotification.save(callback);
}
