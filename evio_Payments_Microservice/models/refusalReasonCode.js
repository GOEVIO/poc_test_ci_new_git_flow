const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const refusalReasonCodesModel = new Schema(
    {
        refusalReasonCode: { type: String },
        refusalReason: { type: String },
        description: { type: String },
        key: { type: String },
    }
);

var RefusalReasonCodes = module.exports = mongoose.model('RefusalReasonCodes', refusalReasonCodesModel);

module.exports.createRefusalReasonCodes = function (newRefusalReasonCodes, callback) {
    newRefusalReasonCodes.save(callback);
};

module.exports.updateRefusalReasonCodes = function (query, values, callback) {
    RefusalReasonCodes.findOneAndUpdate(query, values, callback);
};

module.exports.removeRefusalReasonCodes = function (query, callback) {
    RefusalReasonCodes.findOneAndRemove(query, callback);
};