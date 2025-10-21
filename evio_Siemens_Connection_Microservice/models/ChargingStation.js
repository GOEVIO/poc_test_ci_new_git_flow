const mongoose = require('mongoose');

const { Schema } = mongoose;

const chargingStationModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        ipAddress: { type: String },
        port: { type: String }
    },
    {
        timestamps: true
    }
);

var ChargingSession = module.exports = mongoose.model('ChargingSession', chargingStationModel);