const mongoose = require('mongoose');

const { Schema } = mongoose;

var tariffModel = mongoose.Schema({
    type: { type: String },
    uom: { type: String },
    price: { type: Number }
});

var tariffsModel = mongoose.Schema({
    country: { type: String },
    region: { type: String },
    currency: { type: String },
    partyId: { type: String },
    evseGroup: { type: String },
    tariff: [{ type: tariffModel }],
});

const RoamingPlanModel = new Schema(
    {
        id: { type: String, index: true },
        roamingType: { type: String },
        tariffs: [{ type: tariffsModel }],
    },
    {
        timestamps: true
    }
);


var RoamingPlan = module.exports = mongoose.model('RoamingPlan', RoamingPlanModel);

module.exports.createRoamingPlan = function (newRoamingPlan, callback) {
    newRoamingPlan.save(callback);
};

module.exports.updateRoamingPlan = function (query, values, callback) {
    RoamingPlan.findOneAndUpdate(query, values, callback);
};

module.exports.removeRoamingPlan = function (query, callback) {
    RoamingPlan.findOneAndRemove(query, callback);
};
