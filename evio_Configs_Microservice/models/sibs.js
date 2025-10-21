const mongoose = require('mongoose');

const { Schema } = mongoose;

const sibsModel = new Schema(
    {
        id: { type: String, index: true },
        filename: { type: String },
        basename: { type: String },
        lastmod: { type: String },
        size: { type: Number },
        type: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var SIBS = module.exports = mongoose.model('sibs', sibsModel);

module.exports.createSibsEntry = function (newSibsEntry, callback) {
    newSibsEntry.save(callback);
};

module.exports.updateSibsEntry = function (query, values, callback) {
    SIBS.findOneAndUpdate(query, values, callback);
};

module.exports.removeSibsEntry = function (query, callback) {
    SIBS.findOneAndRemove(query, callback);
};