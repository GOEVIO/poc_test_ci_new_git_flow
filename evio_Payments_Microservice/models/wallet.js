const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const walletModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        amount: {
            value: { type: Number, default: 0 },
            currency: { type: String, default: "EUR" }
        },
        transactionsList: [
            {
                transactionId: { type: String },
                transactionType: { type: String },
                status: { type: String },
                notes: { type: String }
            }
        ],
        creditAmount: { type: Number, default: 0 },
        autoRecharger: { type: Boolean, default: false },
        clientName: { type: String, default: "EVIO" },
        isBalanceClearanceRequired: { type: Boolean, default: false },
        clearanceDate: { type: Date, default: null },
        clearedAmount: { 
            value: { type: Number, default: 0 },
            currency: { type: String, default: "EUR" }
        },
    },
    {
        timestamps: true
    }
);

walletModel.index({ userId: 1 });

var Wallet = module.exports = mongoose.model('Wallet', walletModel);

module.exports.createWallet = function (newWallet, callback) {
    newWallet.save(callback);
};

module.exports.updateWallet = function (query, values, callback) {
    Wallet.findOneAndUpdate(query, values, callback);
};

module.exports.removeWallet = function (query, callback) {
    Wallet.findOneAndRemove(query, callback);
};

module.exports.addTansationsList = function (query, values, callback) {

    Wallet.updateOne(query, values, callback);
};

module.exports.findWallet = function (query) {
    return Wallet.findOne(query).exec();
};

module.exports.updateWalletOne = function (query, updateOperation) {
    return Wallet.updateOne(query, updateOperation).exec();
};

module.exports.aggregate = function (quer, values, callback) {
    Wallet.aggregate()
};