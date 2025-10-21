const mongoose = require('mongoose');

const { Schema } = mongoose;

const priceRoundModel = new Schema({
    round_granularity: { type: String, default: "THOUSANDTH" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String, default: "ROUND_NEAR" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});

const stepRoundModel = new Schema({
    round_granularity: { type: String, default: "UNIT" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String, default: "ROUND_UP" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});


const priceComponentsModel = new Schema(
    {
        type: { type: String },
        price: { type: Number },
        vat: { type: Number },
        step_size: { type: Number },
        price_round: priceRoundModel,
        step_round: stepRoundModel
    }
);

// This elementModel works either for OCPI 2.1.1 and OCPI 2.2 

const tariffRestrictions = new Schema({
    start_date: { type: String }, //Mobie
    end_date: { type: String }, //Mobie
    start_time: { type: String }, //Mobie
    end_time: { type: String }, //Mobie
    min_kwh: { type: Number }, //Mobie
    max_kwh: { type: Number }, //Mobie
    min_current: { type: Number },
    max_current: { type: Number },
    min_power: { type: Number },
    max_power: { type: Number },
    min_duration: { type: Number }, //Mobie
    max_duration: { type: Number }, //Mobie
    day_of_week: [String], //Mobie
    reservation: { type: String }
});

const elementModel = new Schema(
    {
        price_components: [{ type: priceComponentsModel }],
        restrictions: tariffRestrictions
    }
);

const priceModel = {
    excl_vat: { type: Number },
    incl_vat: { type: Number }
};

const tariffModel = {
    id: { type: String },
    currency: { type: String, default: "EUR" },
    min_price: priceModel,
    max_price: priceModel,
    elements: [{ type: elementModel }],
};

const plugsModel = new Schema(
    {
        id: { type: String, index: true },
        plugId: { type: String },
        uid: { type: String },
        evse_id: { type: String },
        connectorFormat: { type: String },
        connectorType: { type: String },
        connectorPowerType: { type: String },
        termsAndConditions: { type: String },
        tariffId: [String],
        power: { type: Number },
        voltage: { type: Number },
        amperage: { type: Number },
        status: { type: String },
        statusChangeDate: { type: Date },
        statusTime: { type: Number },
        subStatus: { type: String, default: "UNKNOWN" },
        evseGroup: { type: String },
        serviceCost: {
            initialCost: { type: Number },
            costByTime: [
                {
                    minTime: { type: Number },
                    step_size: { type: Number },
                    cost: { type: Number },
                    uom: { type: String }
                }
            ],
            costByPower: {
                cost: { type: Number },
                step_size: { type: Number },
                uom: { type: String }
            },
            elements: [{ type: elementModel }],
            tariffs: [tariffModel],
            currency: { type: String, default: "EUR" },
        },
        capabilities: [String],
        statusSchedule: [Object],
        floorLevel: { type: String },
        physicalReference: { type: String },
        directions: [Object],
        parkingRestrictions: [String],
        images: [Object],
        lastUpdated: { type: String },
        hasRemoteCapabilities: { type: Boolean, default: true },   // this flag will indicate that this plug has or not the abilitie to accept start/stop remote commands
        co2Emissions: { type: String, default: null },    // this is going to be usen by Hubject and gives the total CO2 emited by the energy source, in g/kWh
    },
    {
        timestamps: true
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

const rangesModel = new Schema({
    startTime: { type: String },
    endTime: { type: String }
});

const dayModel = new Schema({
    isSelected: { type: Boolean },
    availabilityDay: { type: String },
    ranges: [
        rangesModel
    ]
});

const availabilityModel = new Schema({
    availabilityType: { type: String },
    monday: { type: dayModel },
    tuesday: { type: dayModel },
    wednesday: { type: dayModel },
    thursday: { type: dayModel },
    friday: { type: dayModel },
    saturday: { type: dayModel },
    sunday: { type: dayModel }
});


const chargerModel = new Schema(
    {
        id: { type: String, index: true },
        hwId: { type: String },
        chargerType: { type: String },
        source: { type: String },
        partyId: { type: String },
        countryCode: { type: String },
        cpoCountryCode: { type: String },
        country: { type: String },
        name: { type: String },
        partyId: { type: String },
        operatorID: { type: String },
        address: { type: addressModel },
        parkingType: { type: String, default: "Street" },
        geometry: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], index: "2dsphere" },
        },
        availability: { type: availabilityModel },
        status: { type: String, default: '10' },
        subStatus: { type: String, default: "UNKNOWN" },
        // operationalStatus: { type: String },//new - APPROVED/WAITINGAPROVAL/REMOVED
        chargingDistance: { type: String, default: "1000" },
        imageContent: [{ type: String }],
        defaultImage: { type: String },
        rating: { type: Number, default: 0 },
        numberOfSessions: { type: Number, default: 0 },
        dataProviderReference: { type: String },
        plugs: [{ type: plugsModel }],
        network: { type: String },
        operator: { type: String },
        stationIdentifier: { type: String },
        model: { type: String },
        manufacturer: { type: String },
        voltageLevel: { type: String, default: "BTN" },
        timeZone: { type: String },
        wrongBehaviorStation: { type: Boolean, default: false },
        lastUpdated: { type: String },
        operationalStatus: { type: String, default: "APPROVED" },
        evseGroup: { type: String },
        publish: { type: Boolean, default: true },
        mobie_access_type: { type: String },
        mobie_cpe: { type: String },
        directions: [Object],
        maxServiceCost: {
            initialCost: { type: Number },
            costByTime: [
                {
                    minTime: { type: Number },
                    step_size: { type: Number },
                    cost: { type: Number },
                    uom: { type: String }
                }
            ],
            costByPower: {
                cost: { type: Number },
                step_size: { type: Number },
                uom: { type: String }
            },
            elements: [{ type: elementModel }],
            currency: { type: String, default: "EUR" },
        },
        originalCoordinates: {
            type: { type: String, default: "Point" },
            coordinates: { type: [Number], default: [0, 0] },
        },
        updatedCoordinates: {
            date: {type: Date},
            source: {
                type: String,
                enum: ['algorithm', 'user', 'evio']
            } 
        }
    },
    {
        timestamps: true
    }
);

chargerModel.index({ name: 1 });
chargerModel.index({ operationalStatus: 1 });
chargerModel.index({ partyId: 1 });
chargerModel.index({ countryCode: 1 });
chargerModel.index({ originalCoordinates: "2dsphere" });

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
module.exports.updateChargerAsync = async function (query, values, callback) {
    return await Charger.updateOne(query, values, callback);

};

module.exports.updateEVSEStatus = async function (query, values, filter, callback) {
    return await Charger.updateOne(query, values, filter, callback);

};

module.exports.removeCharger = function (query, callback) {
    Charger.findOneAndRemove(query, callback);
};