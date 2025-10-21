const mongoose = require('mongoose');

const { Schema } = mongoose;

const chargerType = new Schema(
    {
        id: { type: String, index: true },
        chargerType: { type: String },
        manufacturer: { type: String },
        model: { type: String },
        protocol: { type: String },
        host: { type: String },
        path: { type: String },
        actions: [
            {
                command: { type: String },
                enabled: { type: Boolean }
            }
        ],
        createUser: { type: String },
        modifyUser: { type: String },
        clientName: { type: String, default: "EVIO" },
    },
    {
        timestamps: true
    }
);

var ChargerType = module.exports = mongoose.model('chargerType', chargerType);

module.exports.createChargerType = function (newChargerType, callback) {
    newChargerType.save(callback);
};
