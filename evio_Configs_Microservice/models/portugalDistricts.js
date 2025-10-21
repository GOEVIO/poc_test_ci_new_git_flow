const mongoose = require('mongoose');

const { Schema } = mongoose;

const PortugalDistrictsModel = new Schema(
    {
        id: { type: String, index: true },
        code: { type: Number },
        name: { type: String },
        zone: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var PortugalDistricts = module.exports = mongoose.model('portugalDistrict', PortugalDistrictsModel);

module.exports.createDistrict = function (newPortugalDistrict, callback) {
    newPortugalDistrict.save(callback);
};

module.exports.updateDistrict = function (query, values, callback) {
    PortugalDistricts.findOneAndUpdate(query, values, callback);
};

module.exports.removeDistrict = function (query, callback) {
    PortugalDistricts.findOneAndRemove(query, callback);
};