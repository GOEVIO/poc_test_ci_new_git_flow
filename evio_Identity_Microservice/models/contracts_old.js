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

const contractsModel = new Schema(
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
        }
    },
    {
        timestamps: true
    }
);

var Contracts = module.exports = mongoose.model('Contracts', contractsModel);

module.exports.createContract = function (newContract, callback) {
    newContract.save(callback);
};

module.exports.updateContract = function (query, values, callback) {
    Contracts.findOneAndUpdate(query, values, callback);
};

module.exports.removeContracts = function (query, callback) {
    Contracts.findOneAndRemove(query, callback);
};

module.exports.markAllAsNotDefault = function (userId, callback) {
    var query = { userId: userId };
    var newvalues = { $set: { default: false } };
    Contracts.updateMany(query, newvalues, callback);
};

module.exports.markAsDefaultContract = function (contractId, userId, callback) {
    var query = {
        _id: contractId,
        userId: userId
    };
    var newvalues = { $set: { default: true } };
    Contracts.updateOne(query, newvalues, callback);
};