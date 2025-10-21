var mongoose = require('mongoose');
const { Schema } = mongoose;

const purchaseTariffModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        name: {
            type: String
        },
        description: {
            type: String
        },
        tariffType: {
            type: String,
            default: 'Energy Based'  //Energy Based only
        },
        userId: {
            type: String
        },
        weekSchedule: [
            {
                weekDay: { type: String },
                scheduleTime: [
                    {
                        value: { type: Number, default: 0 }, // Value
                        startTime: { type: String },
                        stopTime: { type: String }
                    }
                ]
            }
        ],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var PurchaseTariff = module.exports = mongoose.model('PurchaseTariff', purchaseTariffModel);

module.exports.createPurchaseTariff = function (newPurchaseTariff, callback) {
    newPurchaseTariff.save(callback);
};

module.exports.updatePurchaseTariff = function (query, values, options, callback) {
    PurchaseTariff.findOneAndUpdate(query, values, options, callback);
};

module.exports.removePurchaseTariff = function (query, callback) {
    PurchaseTariff.deleteOne(query, callback);
};
