const mongoose = require('mongoose');

const { Schema } = mongoose;

const NotificationsDefinitionModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        notificationsPref: [
            {
                clientType: { type: String },
                notifications: [
                    {
                        nameOfNotification: { type: String },
                        actionsList: [
                            {
                                action: { type: String },
                                enabled: { type: Boolean }
                            }
                        ]
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

var NotificationsDefinition = module.exports = mongoose.model('notificationsDefinition', NotificationsDefinitionModel);

module.exports.createNotificationsDefinition = function (newNotificationsDefinition, callback) {
    newNotificationsDefinition.save(callback);
};

module.exports.updateNotificationsDefinition = function (query, values, callback) {
    NotificationsDefinition.findOneAndUpdate(query, values, callback);
};

module.exports.removeNotificationsDefinition = function (query, callback) {
    NotificationsDefinition.findOneAndRemove(query, callback);
};