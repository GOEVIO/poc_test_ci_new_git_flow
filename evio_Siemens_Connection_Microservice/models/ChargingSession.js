const mongoose = require('mongoose');

const { Schema } = mongoose;

const chargingSessionModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        chargingStation: { type: String },
        active: { type: Boolean },
        chargingReports: {
            type: Array,
            default: []
        }
    },
    {
        timestamps: true
    }
);

var ChargingStation = module.exports = mongoose.model('ChargingStation', chargingSessionModel);