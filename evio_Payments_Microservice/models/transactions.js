const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const transactionsModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        transactionType: { type: String },// Type of transaction credit/debit/refund/addCard
        status: { type: String },
        provider: { type: String },//If credit providers are MBWay, MBRef/PSNet, MBRef, PSNet or Card  if debit providers are wallet or Card
        amount: {
            currency: { type: String, default: "EUR" },
            value: { type: Number }
        },
        sessionId: { type: String },
        paymentId: { type: String },
        data: { type: Object },
        dataReceived: { type: Object },
        adyenReference: { type: String },
        listOfSessionsMonthly: [
            {
                sessionId: { type: String },
                chargerType: { type: String }
            }
        ],
        listOfSessions: [String],
        notes: { type: String },
        invoiceId: { type: String },
        clientName: { type: String, default: "EVIO" },
        contractId: { type: String },
        chargerType:{ type: String },
        paymentsResponseData :{ type: Object },
        paymentDetailsResponseData :{ type: Object },
        // action : { type: Object },
        // additionalData : { type: Object },
        // threeDS2ResponseData : { type: Object },
        // threeDS2Result : { type: Object },
        // fraudResult : { type: Object },
        // order : { type: Object },
        // paymentMethod : { type: Object },
        // threeDSPaymentData : { type: String },
        // resultCode : { type: String },
        // refusalReason : { type: String },
        // refusalReasonCode : { type: String },
        // donationToken : { type: String },
        // pspReference : { type: String },
        addBalanceToWallet : { type: Boolean, default: false },
        paymentMethodId: { type: String },
        dataRecieved: { type: Object },
        amountToUp: { type: Number },
        amountRefund: {type: Number},
    },
    {
        timestamps: true
    }
);


transactionsModel.index({ sessionId: 1 }, { background: true });

var Transactions = module.exports = mongoose.model('Transactions', transactionsModel);

module.exports.createTransactions = function (newTransactions, callback) {
    newTransactions.save(callback);
};

module.exports.updateTransactions = function (query, values, callback) {
    Transactions.findOneAndUpdate(query, values, { new: true }, callback);
};

module.exports.removeTransactions = function (query, callback) {
    Transactions.findOneAndRemove(query, callback);
};
