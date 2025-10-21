const mongoose = require('mongoose');

const { Schema } = mongoose;

const PortugalPostalCodeModel = new Schema(
    {
        id: { type: String, index: true },
        districtCode: { type: Number },
        postalCodes: [{ type: String }],
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var PortugalPostalCodes = module.exports = mongoose.model('portugalPostalCode', PortugalPostalCodeModel);

module.exports.createPostalCode = function (newPortugalPostalCode, callback) {
    newPortugalPostalCode.save(callback);
};

module.exports.updatePostalCode = function (query, values, callback) {
    PortugalPostalCodes.findOneAndUpdate(query, values, callback);
};

module.exports.removePostalCode = function (query, callback) {
    PortugalPostalCodes.findOneAndRemove(query, callback);
};