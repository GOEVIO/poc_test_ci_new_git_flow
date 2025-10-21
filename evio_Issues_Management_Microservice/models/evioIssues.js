const mongoose = require('mongoose');
require("dotenv-safe").load();
const { Schema } = mongoose;


const evioIssuesModel = new Schema(
    {
        id: { type: String, index: true },
        chargerId: { type: String },
        hwId: { type: String },
        issuedUserId: { type: String },
        reasonCode: { type: String },
        reasonText: { type: String },
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


var EVIOIssues = module.exports = mongoose.model('EVIOIssues', evioIssuesModel);

module.exports.createEVIOIssues = function (newEVIOIssues, callback) {
    newEVIOIssues.save(callback);
};

module.exports.updateEVIOIssues = function (query, values, callback) {
    EVIOIssues.findOneAndUpdate(query, values, callback);
};