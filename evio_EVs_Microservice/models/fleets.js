const mongoose = require('mongoose');

const { Schema } = mongoose;

const fleetsModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        name: { type: String },
        imageContent: { type: String },
        listEvs: [
            {
                evId: { type: String }
            }
        ],
        createUserId: { type: String },
        sharedWithOPC: { type: Boolean, default: false },
        shareEVData: { type: Boolean, default: true },
        clientName: { type: String, default: "EVIO" },
        acceptKMs: {type: Boolean, default:false},       // guardar a informação se todos os EV's da frota pode ou não guardar km's
        updateKMs: {type: Boolean, default:false}        // guardar a informação para todos os EV's da frota se o condutor pode ou não alterar os KM's
    },
    {
        timestamps: true
    }
);

fleetsModel.index({ id: 1 });

var Fleets = module.exports = mongoose.model('Fleets', fleetsModel);

module.exports.createFleets = function (newFleet, callback) {
    newFleet.save(callback);
};

module.exports.updateFleets = function (query, values, callback) {
    Fleets.findOneAndUpdate(query, values, callback);
};

module.exports.removeFleets = function (query, callback) {
    Fleets.findOneAndDelete(query, callback);
};