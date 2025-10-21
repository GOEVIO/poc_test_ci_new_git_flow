require("dotenv-safe").load();
const mongoose = require('mongoose');

const { Schema } = mongoose;

const rangeMetricModel = new Schema({
    min: { type: Number },
    max: { type: Number },
    uom: { type: String }
});

const filterModel = new Schema({
    //plugs
    availableStations: { type: [Number] },
    priceRange: { type: rangeMetricModel },
    powerRange: { type: rangeMetricModel },
    connectorType: { type: [String] },
    //station
    rating: { type: Number },
    parkingType: { type: [String] },
    vehicles: { type: [String] },
    //type of stations
    stations: { type: [String] },
    contractId: { type: String },
    evId: { type: String },
    tariffType: {
        type: String,
        enum: [process.env.TARIFF_TYPE_POWER, process.env.TARIFF_TYPE_TIME],
    },
    filterBy: {
        type: String,
        enum: [process.env.FILTERBYTOTALPRICE, process.env.FILTERBYDISTANCE, process.env.FILTERBYUNITPRICE, process.env.FILTERBYENERGY],
    }

});

var Filters = module.exports = mongoose.model("Filters", filterModel);