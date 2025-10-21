const mongoose = require('mongoose');

const { Schema } = mongoose;

const concurrentManufacturerModel = new Schema(
    {
        id: { type: String, index: true },
        manufacturer: { type: String },
        active: { type: Boolean, default: true },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);


var ConcurrentManufacturer = module.exports = mongoose.model('ConcurrentManufacturer', concurrentManufacturerModel);

module.exports.createConcurrentManufacturer = function (newConcurrentManufacturer, callback) {
    newConcurrentManufacturer.save(callback);
};

module.exports.updateConcurrentManufacturer = function (query, values, callback) {
    ConcurrentManufacturer.findOneAndUpdate(query, values, callback);
};

module.exports.removeConcurrentManufacturer = function (query, callback) {
    ConcurrentManufacturer.findOneAndDelete(query, callback);
};