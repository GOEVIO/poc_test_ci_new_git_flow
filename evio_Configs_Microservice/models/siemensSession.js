const mongoose = require('mongoose');

const { Schema } = mongoose;

const SiemensSessionModel = new Schema(
    {
        id: { type: String, index: true },
        session_max_current: { type: Number },
        session_max_duration: { type: Number },
        session_max_energy_Wh: { type: Number },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var SiemensSession = module.exports = mongoose.model('siemensSession', SiemensSessionModel);

module.exports.createSiemensSession = function (newSiemensSession, callback) {
    newSiemensSession.save(callback);
};

module.exports.updateSiemensSession = function (query, values, callback) {
    SiemensSession.findOneAndUpdate(query, values, callback);
};

module.exports.removeSiemensSession = function (query, callback) {
    SiemensSession.findOneAndRemove(query, callback);
};