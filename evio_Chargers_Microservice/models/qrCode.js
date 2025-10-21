const mongoose = require('mongoose');
var AutoIncrement = require('mongoose-sequence')(mongoose);
require("dotenv-safe").load();

const { Schema } = mongoose;

const qrCodeModel = new Schema(
    {
        qrCodeNumber: { type: Number },
        qrCodeId: { type: String },
        qrCode: {
            hwId: { type: String },
            plugId: { type: String },
            chargerType: { type: String },
            chargingDistance: { type: String },
            geometry: {
                type: { type: String, default: "Point" },
                coordinates: { type: [Number], index: "2dsphere" },
            },
        },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);


qrCodeModel.index({ geometry: "2dsphere" });
qrCodeModel.plugin(AutoIncrement, { id: 'order_seq_qrcode', inc_field: 'qrCodeNumber' });
var QrCode = module.exports = mongoose.model('QrCode', qrCodeModel);

module.exports.createQrCode = function (newQrCode, callback) {
    newQrCode.save(callback);
};

module.exports.updateQrCode = function (query, values, callback) {
    QrCode.findOneAndUpdate(query, values, callback);
};

module.exports.removeQrCode = function (query, callback) {
    QrCode.findOneAndRemove(query, callback);
};