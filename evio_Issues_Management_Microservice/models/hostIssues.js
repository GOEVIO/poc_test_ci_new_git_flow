const mongoose = require('mongoose');
require("dotenv-safe").load();
const { Schema } = mongoose;


const hostIssuesModel = new Schema(
    {
        id: { type: String, index: true },
        chargerId: { type: String },
        hwId: { type: String },
        hostId: { type: String },
        issuedUserId: { type: String },
        reasonCode: { type: String },
        reasonText: { type: String },
        chargerType: { type: String },
        status: {
            type: String,
            default: "Open"
        },
        clientName: { type: String, default: "EVIO" },
        emailSent: { type: Boolean, default: false }
    },
    {
        timestamps: true
    }
);

var HostIssues = module.exports = mongoose.model('HostIssues', hostIssuesModel);

module.exports.createHostIssues = function (newHostIssues, callback) {
    newHostIssues.save(callback);
};

module.exports.updateHostIssues = function (query, values, callback) {
    HostIssues.findOneAndUpdate(query, values, callback);
};