const mongoose = require('mongoose');

const { Schema } = mongoose;

var tariffModel = mongoose.Schema(
    {
        uom: { type: String },
        tariffType: { type: String },
        voltageLevel: { type: String },
        price: { type: Number }
    }
);

const tariffTARModel = new Schema(
    {
        id: { type: String, index: true },
        country: { type: String, default: "PT" },
        timeZone: { type: String },
        tariffType: { type: String },
        tariff: [{ type: tariffModel }],
        active: { type: Boolean, default: false },
        dateToActivate: { type: Date }
    },
    {
        timestamps: true
    }
);


var TariffTAR = module.exports = mongoose.model('TariffTAR', tariffTARModel);

module.exports.createTariffTAR = function (newTariffTAR, callback) {
    newTariffTAR.save(callback);
};

module.exports.updateTariffTAR = function (query, values, callback) {
    TariffTAR.findOneAndUpdate(query, values, callback);
};

module.exports.removeTariffTAR = function (query, callback) {
    TariffTAR.findOneAndRemove(query, callback);
};