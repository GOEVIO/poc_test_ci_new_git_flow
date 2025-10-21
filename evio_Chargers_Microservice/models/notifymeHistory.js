const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const notifymeHistoryModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        topic: {
            type: String
        },
        listOfUsers: [
            {
                userId: {
                    type: String
                }
            }
        ],
        chargerId: {
            type: String
        },
        hwId: {
            type: String
        },
        plugId: {
            type: String
        },
        active: {
            type: Boolean, default: true
        },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);


var NotifymeHistory = module.exports = mongoose.model('NotifymeHistory', notifymeHistoryModel);

module.exports.createNotifymeHistory = function (newNotifymeHistory, callback) {
    newNotifymeHistory.save(callback);
};

module.exports.updateNotifymeHistory = function (query, values, callback) {
    NotifymeHistory.findOneAndUpdate(query, values, callback);
};