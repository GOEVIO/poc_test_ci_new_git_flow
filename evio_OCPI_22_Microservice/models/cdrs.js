const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;


const tariffTranslation = new Schema({
    language: { type: String },
    text: { type: String }
});

const priceModel = new Schema({
    excl_vat: { type: Number }, //Price/Cost excluding VAT.
    incl_vat: { type: Number } //Price/Cost including VAT.
});

const priceRoundModel = new Schema({
    round_granularity: { type: String, default: "THOUSANDTH" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String, default: "ROUND_NEAR" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});

const stepRoundModel = new Schema({
    round_granularity: { type: String, default: "UNIT" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String, default: "ROUND_UP" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});


const priceComponent = new Schema({
    type: { type: String }, //ENERGY    FLAT    PARKING_TIME    TIME
    price: { type: Number }, //Price per unit (excl. VAT) for this tariff dimension.
    vat: { type: Number }, //Applicable VAT percentage for this tariff dimension. If omitted, no VAT is applicable. Not providing a VAT is different from 0% VAT, which would be a value of 0.0 here.
    step_size: { type: Number }, //Minimum amount to be billed. This unit will be billed in this step_siz blocks. For example: if type is TIME and step_size has a value of 300, then time will be billed in blocks of 5 minutes. If 6 minutes were used, 10 minutes (2 blocks of step_size) will be billed.
    price_round: priceRoundModel,
    step_round: stepRoundModel
});

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


const tariffElements = new Schema({
    price_components: [priceComponent],
    restrictions: tariffRestrictions
});

const tariffs = new Schema({
    country_code: { type: String, default: "PT" },
    party_id: { type: String },
    id: { type: String, index: true },
    currency: { type: String, default: "EUR" },
    type: { type: String }, //REGULAR OR AD_HOC_PAYMENT
    tariff_alt_text: [tariffTranslation], //This field may be used by the CPO to communicate any relevant discounts.
    min_price: { type: priceModel },
    elements: [tariffElements],
    start_date_time: { type: String },
    end_date_time: { type: String },
    last_updated: { type: String }
},
    {
        timestamps: true
    }
);

const cdrToken = new Schema({
    uid: { type: String },
    type: { type: String },
    contract_id: { type: String }
});

const geoLocation = new Schema({
    latitude: { type: String },
    longitude: { type: String }
});

const cdrLocation = new Schema({
    id: { type: String },
    name: { type: String },
    address: { type: String },
    city: { type: String },
    postal_code: { type: String },
    country: { type: String },
    coordinates: { type: geoLocation },
    evse_uid: { type: String },
    evse_id: { type: String },
    connector_id: { type: String },
    connector_standard: { type: String },
    connector_format: { type: String },
    connector_power_type: { type: String },
    connector_voltage: { type: Number },
    connector_amperage: { type: Number }
});

const cdrDimension = new Schema({
    type: { type: String },
    volume: { type: Number }
});


const chargingPeriods = new Schema({
    start_date_time: { type: String },
    dimensions: [cdrDimension],
    tariff_id: { type: String }
});

const cdrsModel = new Schema({
    source: { type: String },
    country_code: { type: String, default: "PT" },
    party_id: { type: String },
    id: { type: String }, //Provided by MobiE
    start_date_time: { type: String },
    end_date_time: { type: String },
    session_id: { type: String },
    cdr_token: { type: cdrToken },
    auth_method: { type: String }, //Always WHITELIST
    cdr_location: { type: cdrLocation },
    meter_id: { type: String },
    currency: { type: String },
    tariffs: [tariffs],
    charging_periods: [chargingPeriods],
    Status: { type: String }, //Specific to Mobie - COMPLETED
    total_cost: { type: priceModel },
    total_fixed_cost: { type: priceModel },
    total_energy: { type: Number },
    total_energy_cost: { type: priceModel },
    total_time: { type: Number },
    total_time_cost: { type: priceModel },
    total_parking_time: { type: Number },
    total_parking_cost: { type: priceModel },
    remark: { type: String },
    credit: { type: Boolean, default: false },
    credit_reference_id: { type: String },
    mobie_cdr_extension: { type: Object },
    last_updated: { type: String }
},
    {
        timestamps: true
    }
);

cdrsModel.index({ id: 1 });
cdrsModel.index({ session_id: 1 });

var CDRs = module.exports = mongoose.model('cdrs', cdrsModel);


//CDRs.ensureIndexes({ id: 1 }, (err) => {
CDRs.createIndexes({ id: 1 }, (err) => {
    if (err)
        console.error(err);
    else
        console.log('create id index successfully');
});

module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};


module.exports.updateCDR = function (query, values, callback) {
    CDRs.findOneAndUpdate(query, values, callback);

};

