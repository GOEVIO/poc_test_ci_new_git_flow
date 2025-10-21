const mongoose = require('mongoose');

const { Schema } = mongoose;

const amountModel = mongoose.Schema(
    {
        currency: { type: String },
        value: { type: Number }
    }
);

const scSibsCardsModel = new Schema(
    {
        id: { type: String, index: true },
        cardNumber: { type: String },
        dec: { type: String },
        decInvert: { type: String },
        inUse: { type: Boolean, default: false },
        activationDate: { type: Date },
        amount: { type: amountModel }
    },
    {
        timestamps: true
    }
);

scSibsCardsModel.index({ _id: 1, cardNumber: 1 });

var SCSibsCards = module.exports = mongoose.model('SCSibsCards', scSibsCardsModel);

module.exports.createSCSibsCards = function (newSCSibsCards, callback) {
    newSCSibsCards.save(callback);
};

module.exports.updateSCSibsCards = function (query, values, callback) {
    SCSibsCards.findOneAndUpdate(query, values, callback);
};

module.exports.removeSCSibsCards = function (query, callback) {
    SCSibsCards.findOneAndRemove(query, callback);
};