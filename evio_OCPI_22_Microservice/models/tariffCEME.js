const mongoose = require('mongoose');

const { Schema } = mongoose;

var tariffModel = mongoose.Schema({
    power: { type: String },
    uom: { type: String },
    tariffType: { type: String },
    voltageLevel: { type: String },
    price: { type: Number },
    type: { type: String }//Only in roaming tariff (ENUM: flat, energy, time)
});

var tariffsHistoryModel = mongoose.Schema({
    startDate: { type: String },
    stopDate: { type: String },
    tariff: [{ type: tariffModel }],
});


const tariffCEMEModel = new Schema(
    {
        id: { type: String, index: true },
        country: { type: String },
        CEME: { type: String },
        tariffType: { type: String },
        cycleType: { type: String },
        planName: { type: String },
        tariff: [{ type: tariffModel }],
        tariffEGME: { type: Number },
        visivel: { type: Boolean },
        tariffsHistory: [{ type: tariffsHistoryModel }],

    },
    {
        timestamps: true
    }
);

tariffCEMEModel.index({ CEME: 1, planName: 1 });

var TariffCEME = module.exports = mongoose.model('TariffCEME', tariffCEMEModel);

module.exports.createTariffCEME = function (newTariffCEME, callback) {
    newTariffCEME.save(callback);
};

module.exports.updateTariffCEME = function (query, values, callback) {
    TariffCEME.findOneAndUpdate(query, values, callback);
};

module.exports.removeTariffCEME = function (query, callback) {
    TariffCEME.findOneAndRemove(query, callback);
};