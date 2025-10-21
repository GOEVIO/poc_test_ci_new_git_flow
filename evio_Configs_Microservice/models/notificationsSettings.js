const mongoose = require('mongoose');

const { Schema } = mongoose;

const NotificationsDefinitionModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        notificationsPref: [
            {
                clientType: { type: String },
                global: {
                    translationKey: { type: String },
                    enabled: { type: Boolean }
                },
                notifications: [
                    {
                        type: { type: String },
                        notificationType: { type: String },
                        translationKey: { type: String },
                        enabled: { type: Boolean }
                    }
                ]
            }
        ],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

NotificationsDefinitionModel.index({ userId: 1 });

var NotificationsDefinition = module.exports = mongoose.model('notificationsSettings', NotificationsDefinitionModel);

module.exports.createNotificationsDefinition = function (newNotificationsDefinition, callback) {
    newNotificationsDefinition.save(callback);
};

module.exports.updateNotificationsDefinition = function (query, values, callback) {
    NotificationsDefinition.findOneAndUpdate(query, values, callback);
};

module.exports.updateNotificationsDefinitionAndReturns = function (query, values, options, callback) {
    NotificationsDefinition.findOneAndUpdate(query, values, options, callback);
};

module.exports.removeNotificationsDefinition = function (query, callback) {
    NotificationsDefinition.findOneAndRemove(query, callback);
};