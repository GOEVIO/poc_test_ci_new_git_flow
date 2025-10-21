const mongoose = require('mongoose');

const { Schema } = mongoose;

const plugsModel = new Schema(
    {
        id: { type: String, index: true },
        plugId: { type: String },
        connectorType: { type: String },
        power: { type: Number },
        status: { type: String },
        serviceCost: {
            initialCost: { type: String },
            costByTime: [
                {
                    cost: { type: String }
                }
            ],
            costByPower: {
                cost: { type: String }
            }
        }
    }
);

const addressModel = new Schema(
    {
        street: { type: String },
        number: { type: String },
        floor: { type: String },
        zipCode: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        countryCode: { type: String }
    }
);

const chargerModel = new Schema(
    {
        id: { type: String, index: true },
        hwId: { type: String },
        chargerType: { type: String },
        source: { type: String },
        countryCode: { type: String },
        name: { type: String, index: true },
        address: { type: addressModel },
        geometry: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], index: "2dsphere" },
        },
        availability: {
            availabilityType: { type: String, default: "Always" }
        },
        status: { type: String, default: '10' },
        imageContent: [{ type: String }],
        rating: { type: Number, default: 0 },
        dataProviderReference: { type: String, default: "Unknown" },
        plugs: [{ type: plugsModel }],
        network: { type: String },
        operator: { type: String },
        operatorContact: { type: Number },
        operatorEmail: { type: String },
        stationIdentifier: { type: String },
        model: { type: String },
        manufacturer: { type: String }
    }
);

chargerModel.index({ geometry: "2dsphere" });
chargerModel.index({ name: 1 });

var Charger = module.exports = mongoose.model('Charger', chargerModel);

//Charger.ensureIndexes({ name: 1 }, (err) => {
Charger.createIndexes({ name: 1 }, (err) => {
    if (err)
        console.error(err);
    else
        console.log('create name index successfully');
});

module.exports.createCharger = function (newCharger, callback) {
    newCharger.save(callback);
};

module.exports.updateCharger = function (query, values, callback) {
    Charger.findOneAndUpdate(query, values, callback);
};

module.exports.removeCharger = function (query, callback) {
    Charger.findOneAndRemove(query, callback);
};