const mongoose = require('mongoose');

const { Schema } = mongoose;

const scCetelemCardsModel = new Schema(
    {
        id: { type: String, index: true },
        cardNumber: { type: String },
        dec: { type: String },
        decInvert: { type: String },
        inUse: { type: Boolean, default: false },
        hash: { type: String },
        COD_ENT_DST: { type: String },
    },
    {
        timestamps: true
    }
);

scCetelemCardsModel.index({ _id: 1, hash: 1 });

var SCCetelemCards = module.exports = mongoose.model('SCCetelemCards', scCetelemCardsModel);

module.exports.createSCCetelemCards = function (newSCCetelemCards, callback) {
    newSCCetelemCards.save(callback);
};

module.exports.updateSCCetelemCards = function (query, values, callback) {
    SCCetelemCards.findOneAndUpdate(query, values, callback);
};

module.exports.removeSCCetelemCards = function (query, callback) {
    SCCetelemCards.findOneAndRemove(query, callback);
};