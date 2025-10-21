var mongoose = require('mongoose');
const { Schema } = mongoose;

const tariffTeslaModel = new Schema(
    {

        uom: { type: String }, // Unit of measurement (s - seconds, min - minutes, h - hours)
        value: { type: Number }, // Value
        active: {
            type: Boolean,
            default: true
        },
        clientName: { type: String, default: "EVIO" },

    },
    {
        timestamps: true
    }
);

var TariffTesla = module.exports = mongoose.model('TariffTesla', tariffTeslaModel);

module.exports.createTariffTesla = function (newTariffTesla, callback) {
    newTariffTesla.save(callback);
};

module.exports.updateTariffTesla = function (query, values, callback) {
    TariffTesla.findOneAndUpdate(query, values, callback);
};

module.exports.removeTariffTesla = function (query, callback) {
    TariffTesla.deleteMany(query, callback);
};

module.exports.markAllAsInactive = function (callback) {
    TariffTesla.updateMany({}, { $set: { active: false } }, callback);
};
