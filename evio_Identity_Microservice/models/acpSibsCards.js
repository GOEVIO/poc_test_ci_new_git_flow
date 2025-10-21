const mongoose = require('mongoose');

const { Schema } = mongoose;

const acpSibsCardsModel = new Schema(
    {
        id: { type: String, index: true },
        cardNumber: { type: String },
        dec: { type: String },
        decInvert: { type: String },
        inUse: { type: Boolean, default: false }
    },
    {
        timestamps: true
    }
);

acpSibsCardsModel.index({ _id: 1, cardNumber: 1 });

var ACPSibsCards = module.exports = mongoose.model('ACPSibsCards', acpSibsCardsModel);

module.exports.createACPSibsCards = function (newACPSibsCards, callback) {
    newACPSibsCards.save(callback);
};

module.exports.updateACPSibsCards = function (query, values, callback) {
    ACPSibsCards.findOneAndUpdate(query, values, callback);
};

module.exports.removeACPSibsCards = function (query, callback) {
    ACPSibsCards.findOneAndRemove(query, callback);
};