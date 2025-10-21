const mongoose = require('mongoose');

const { Schema } = mongoose;

const amountModel = mongoose.Schema(
    {
        currency: { type: String },
        value: { type: Number }
    }
);

const hySibsCardsModel = new Schema(
    {
        id: { type: String, index: true },
        cardNumber: { type: String },
        dec: { type: String },
        decInvert: { type: String },
        inUse: { type: Boolean, default: false },
        mobile: { type: String },
        name: { type: String },
        activationDate: { type: Date },
        amount: { type: amountModel }
    },
    {
        timestamps: true
    }
);

hySibsCardsModel.index({ _id: 1, cardNumber: 1 });

var HYSibsCards = module.exports = mongoose.model('HYSibsCards', hySibsCardsModel);

module.exports.createHYSibsCards = function (newHYSibsCards, callback) {
    newHYSibsCards.save(callback);
};

module.exports.updateHYSibsCards = function (query, values, callback) {
    HYSibsCards.findOneAndUpdate(query, values, callback);
};

module.exports.removeHYSibsCards = function (query, callback) {
    HYSibsCards.findOneAndRemove(query, callback);
};