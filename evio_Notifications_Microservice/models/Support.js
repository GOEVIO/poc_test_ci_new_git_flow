const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const supportModel = new Schema(
    {
        id: { type: String, index: true },
        name: { type: String },
        email: { type: String },
        mobile: { type: String },
        subject: { type: String },
        message: { type: String },
        mobileBrand: { type: String },
        mobileModel: { type: String },
        mobileVersion: { type: String },
        evioAppVersion: { type: String },
        clientType: { type: String },
        userId: { type: String },
        status: {
            type: String,
            default: 'Open'
        },
        isToSend: {
            type: Boolean,
            default: true,
        },
        sent: {
            type: Boolean,
            default: false,
        },
        clientName: { type: String, default: "EVIO" },
        imageContent: [{ type: String }],
    },
    {
        timestamps: true
    }
);

supportModel.index({ userId: 1 });

var Support = module.exports = mongoose.model('Support', supportModel);

module.exports.createSupportRequest = function (newSupportRequest, callback) {
    newSupportRequest.save(callback);
};

module.exports.updateSupportRequest = function (query, values, callback) {
    Support.findOneAndUpdate(query, values, callback);
};