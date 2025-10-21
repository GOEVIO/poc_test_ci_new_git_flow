const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const plugAvailableModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        chargerId: { type: String },
        hwId: { type: String },
        plugId: { type: String },
        isToSend: {
            type: Boolean,
            default: false
        },
        sent: {
            type: Boolean,
            default: false
        },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

plugAvailableModel.index({ hwId: 1 });

var PlugAvailable = module.exports = mongoose.model('PlugAvailable', plugAvailableModel);

module.exports.createPlugAvailable = function (newPlugAvailable, callback) {
    newPlugAvailable.save(callback);
};

module.exports.updatePlugAvailable = function (query, values, callback) {
    PlugAvailable.findOneAndUpdate(query, values, callback);
};