const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const senderEmailModel = new Schema(
    {
        id: { type: String, index: true },
        clientName: { type: String },
        email: { type: String },
        password: { type: String },
        host: { type: String },
        port: { type: Number },
        sourceInfo: { type: String },
        fromInfo: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var SenderEmail = module.exports = mongoose.model('senderEmail', senderEmailModel);

module.exports.createSenderEmail = function (newSenderEmail, callback) {
    newSenderEmail.save(callback);
};

module.exports.updateSenderEmail = function (query, values, callback) {
    SenderEmail.findOneAndUpdate(query, values, callback);
};