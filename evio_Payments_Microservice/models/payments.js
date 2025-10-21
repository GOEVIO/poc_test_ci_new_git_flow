const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const priceModel = new Schema({
    excl_vat: { type: Number, default: 0 }, //Price/Cost excluding VAT.
    incl_vat: { type: Number, default: 0 } //Price/Cost including VAT.
});

const costDetailsModel = new Schema(
    {
        activationFee: { type: Number, default: 0 },
        parkingDuringCharging: { type: Number, default: 0 },
        parkingAmount: { type: Number, default: 0 },
        timeCharged: { type: Number, default: 0 },
        totalTime: { type: Number, default: 0 },
        totalPower: { type: Number, default: 0 },
        costDuringCharge: { type: Number, default: 0 },
    }
);

const paymentsModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        userIdToBilling: { type: String },
        sessionId: { type: String },//Only when paymentType was transaction
        listOfSessionsMonthly: [
            {
                sessionId: { type: String },
                chargerType: { type: String }
            }
        ],
        listOfHwIdPeriodic: [
            {
                hwId: { type: String },
                chargerType: { type: String }
            }
        ],
        listOfSessions: [String],
        hwId: { type: String },
        chargerType: { type: String },
        transactionId: { type: String },
        paymentAdyenId: { type: String },//only if card payment method
        paymentType: { type: String, default: process.env.PaymentTypeAD_HOC },//AD_HOC / MONTHLY
        paymentMethodId: { type: String },
        paymentMethod: { type: String },//wallet, card, notPay
        amount: {
            currency: { type: String, default: "EUR" },
            value: { type: Number }
        },
        status: { type: String },
        reason: { type: Object },//when refused
        data: { type: Object },
        dataReceived: { type: Object },
        adyenReference: { type: String },
        reservedAmount: { type: Number },
        invoiceId: { type: String },//DocmentId from invoice 
        invoiceStatus: { type: String },//Status of the invoice
        totalPrice: { type: priceModel },
        costDetails: { type: costDetailsModel },
        amountToCard: {
            currency: { type: String, default: "EUR" },
            value: { type: Number }
        },
        notes: { type: String },
        clientName: { type: String },
        contractId: { type: String },
        cardNumber: { type: String },
        transactionType: { type: String },
        syncToHistory: { type: Boolean, default: false },
        amountToUp : {type: Number},
        amountRefund: {type: Number},
    },
    {
        timestamps: true
    }
);

paymentsModel.index({ userId: 1 });

var Payments = module.exports = mongoose.model('Payments', paymentsModel);

module.exports.createPayments = function (newPayments, callback) {
    newPayments.save(callback);
};

module.exports.updatePayments = function (query, values, callback) {
    Payments.findOneAndUpdate(query, values, { new: true }, callback);
};

module.exports.removePayments = function (query, callback) {
    Payments.findOneAndRemove(query, callback);
};