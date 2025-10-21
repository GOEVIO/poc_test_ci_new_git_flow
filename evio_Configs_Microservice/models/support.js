const mongoose = require('mongoose');

const { Schema } = mongoose;

const SupportModel = new Schema(
    {
        id: { type: String, index: true },
        supportEmail: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var Support = module.exports = mongoose.model('support', SupportModel);

module.exports.createSupport = function (newSupport, callback) {
    newSupport.save(callback);
};

module.exports.updateSupport = function (query, values, callback) {
    Support.findOneAndUpdate(query, values, callback);
};

module.exports.removeSupport = function (query, callback) {
    Support.findOneAndRemove(query, callback);
};