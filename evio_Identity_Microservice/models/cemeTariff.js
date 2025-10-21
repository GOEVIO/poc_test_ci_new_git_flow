const mongoose = require('mongoose');

const { Schema } = mongoose;

var cardsModel = mongoose.Schema({
    name: { type: String },
    idTag: { type: String },
    active: { type: Boolean, default: true },
    imageCard: { type: String },
    fontCardBlack: { type: Boolean },
    licensePlate: { type: String },
    expirationDate: { type: String }
});

const cemeTariffModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        name: { type: String },
        CEME: { type: String },
        cards: [
            {
                type: cardsModel
            }
        ],
        active: { type: Boolean, default: true },
        default: { type: Boolean, default: false },
        imageCEME: { type: String },
        tariff: {
            planId: { type: String },
            power: { type: String }
        },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

cemeTariffModel.index({ userId: 1 });

var CEMETariff = module.exports = mongoose.model('CEMETariff', cemeTariffModel);

module.exports.createCEMETariff = function (newCEMETariff, callback) {
    newCEMETariff.save(callback);
};

module.exports.updateCEMETariff = function (query, values, callback) {
    CEMETariff.findOneAndUpdate(query, values, callback);
};

module.exports.removeCEMETariff = function (query, callback) {
    CEMETariff.findOneAndRemove(query, callback);
};

module.exports.markAllAsNotDefault = function (userId, callback) {
    var query = { userId: userId };
    var newvalues = { $set: { default: false } };
    CEMETariff.updateMany(query, newvalues, callback);
};

module.exports.markAsDefaultCEMETariff = function (CEMETariffId, userId, callback) {
    var query = {
        _id: CEMETariffId,
        userId: userId
    };
    var newvalues = { $set: { default: true } };
    CEMETariff.updateOne(query, newvalues, callback);
};