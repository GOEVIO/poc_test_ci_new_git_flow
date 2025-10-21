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

const chargingScheduleModel = new Schema(
    {
        id: { type: String, index: true },
        hwId: { type: String },
        plugId: { type: String },
        evId: { type: String },
        userId: { type: String },
        idTag: { type: String },
        tariffId: { type: String },
        chargerType: { type: String },
        fees: { type: Object },
        address: { type: addressModel },
        scheduleStartDate: {
            type: Date
        },
        scheduleStopDate: {
            type: Date
        },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var ChargingSchedule = module.exports = mongoose.model('ChargingSchedule', chargingScheduleModel);

module.exports.createChargingSchedule = function (newChargingSchedule, callback) {
    newChargingSchedule.save(callback);
};

module.exports.updateChargingSchedule = function (query, values, callback) {

    ChargingSchedule.findOneAndUpdate(query, values, callback);
};

module.exports.removeChargingSchedule = function (query, callback) {
    ChargingSchedule.deleteMany(query, callback);
};