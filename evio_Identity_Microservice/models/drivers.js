const mongoose = require('mongoose');

const { Schema } = mongoose;

const driversModel = new Schema(
    {
        id: { type: String, index: true },
        userId: { type: String },
        poolOfDrivers: [
            {
                driverId: { type: String },
                name: { type: String },
                mobile: { type: String },
                internationalPrefix: { type: String },
                active: { type: Boolean }
            }
        ],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

driversModel.index({ userId: 1 });

var Drivers = module.exports = mongoose.model('Drivers', driversModel);

module.exports.createDrivers = function (newDrivers, callback) {
    newDrivers.save(callback);
};

module.exports.updateDrivers = async function (query, values, callback) {
    return Drivers.findOneAndUpdate(query, values, callback);
};

module.exports.removeDrivers = function (query, callback) {
    Drivers.findOneAndRemove(query, callback);
};