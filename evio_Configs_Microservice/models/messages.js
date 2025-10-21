const mongoose = require('mongoose');

const { Schema } = mongoose;

const messagesModel = new Schema(
    {
        id: { type: String, index: true },
        type: { type: String },
        message: { type: String },
        startDateStopMessage: { type: Date },
        endDateStopMessage: { type: Date },
        infoMessage: [
            {
                title: { type: String },
                message: { type: String },
                image: { type: String }
            }
        ],
        active: { type: Boolean, default: false },
        userId: { type: String },
        dateToActivate: { type: Date },
        dateToDeactivate: { type: Date },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

messagesModel.index({ type: 1 });

var Messages = module.exports = mongoose.model('Messages', messagesModel);

module.exports.createMessages = function (newMessages, callback) {
    newMessages.save(callback);
};

module.exports.updateMessages = function (query, values, callback) {
    Messages.findOneAndUpdate(query, values, callback);
};

module.exports.removeMessages = function (query, callback) {
    Messages.findOneAndRemove(query, callback);
};

module.exports.disableAllMessagesStop = function (callback) {
    var query = { type: process.env.TypeStop };
    var newValues = { $set: { active: false } };
    Messages.updateMany(query, newValues, callback);
};