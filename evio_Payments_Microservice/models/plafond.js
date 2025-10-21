const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const addressModel = new Schema(
    {
        street: { type: String },
        number: { type: String },
        floor: { type: String },
        zipCode: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        countryCode: { type: String }
    }
);

const plafondModel = new Schema(
    {
        id: { type: String, index: true },
        active: { type: Boolean, default: true },
        userId: { type: String },
        userIdWillPay: { type: String },
        evId: { type: String },
        ev: {
            brand: { type: String },
            model: { type: String },
            imageContent: { type: String },
            licensePlate: { type: String },
        },
        users: [
            {
                name: { type: String },
                userId: { type: String },
                imageContent: { type: String },
                mobile: { type: String },
                internationalPrefix: { type: String }
            }
        ],
        groups: [
            {
                name: { type: String },
                groupId: { type: String },
                imageContent: { type: String },
                listOfDrivers: [
                    {
                        driverId: { type: String },
                        name: { type: String },
                        mobile: { type: String },
                        internationalPrefix: { type: String },
                        active: { type: Boolean },
                        admin: {
                            type: Boolean,
                            default: false
                        }
                    }
                ]
            }
        ],
        monthlyPlafond: {
            value: { type: Number, default: 0 },
            currency: { type: String, default: "EUR" }
        },
        amount: {
            value: { type: Number, default: 0 },
            currency: { type: String, default: "EUR" }
        },
        spentCurrentMonth: {
            value: { type: Number, default: 0 },
            currency: { type: String, default: "EUR" }
        },
        transactionsList: [
            {
                sessionId: { type: String },
                chargerType: { type: String },
                source: { type: String },
                amount: {

                    value: { type: Number, default: 0 },
                    currency: { type: String, default: "EUR" }
                },
                startDate: { type: Date },
                stopDate: { type: Date },
                charger: {
                    name: { type: String },
                    address: { type: addressModel },
                    hwId: { type: String },
                },
                status: { type: String },
                notes: { type: String },
                transactionId: { type: String },
                paymentId: { type: String }
            }
        ],
        minimumChargingValue: {
            value: { type: Number, default: 2.5 },
            currency: { type: String, default: "EUR" }
        },
        monthlyBalanceAddition: { type: Boolean, default: false },
        includingInternalCharging: { type: Boolean, default: false },
        actionMinimumValue: {
            type: String,
            enum: ['CHARGINGNEXTPLAFOND', 'NOTCHARGING'],
            default: 'NOTCHARGING'
        },
        extraSessionTaken: { type: Boolean, default: false }, 
        pendingTransactionsList: [
            {
                sessionId: { type: String },
                chargerType: { type: String },
                source: { type: String },
                amount: {

                    value: { type: Number, default: 0 },
                    currency: { type: String, default: "EUR" }
                },
                startDate: { type: Date },
                stopDate: { type: Date },
                charger: {
                    name: { type: String },
                    address: { type: addressModel },
                    hwId: { type: String },
                },
                status: { type: String },
                notes: { type: String },
                transactionId: { type: String },
                paymentId: { type: String }
            }
        ],
        clientName: { type: String, default: "EVIO" },
        historyPlafondsValue: [
            {
                dateSaves: { type: Date },
                monthlyPlafond: {
                    value: { type: Number, default: 0 },
                    currency: { type: String, default: "EUR" }
                },
                amount: {
                    value: { type: Number, default: 0 },
                    currency: { type: String, default: "EUR" }
                },
                spentCurrentMonth: {
                    value: { type: Number, default: 0 },
                    currency: { type: String, default: "EUR" }
                },
                month: { type: String },
                year: { type: String }
            }
        ]
    },
    {
        timestamps: true
    }
);

var Plafond = module.exports = mongoose.model('Plafond', plafondModel);

module.exports.createPlafond = function (newPlafond, callback) {
    newPlafond.save(callback);
};

module.exports.updatePlafond = function (query, values, callback) {
    Plafond.findOneAndUpdate(query, values, callback);
};

module.exports.removePlafond = function (query, callback) {
    Plafond.findOneAndRemove(query, callback);
};

module.exports.addTansationsList = function (query, values, callback) {
    Plafond.updateOne(query, values, callback);
};