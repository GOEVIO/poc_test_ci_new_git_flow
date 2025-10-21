const mongoose = require('mongoose');

require("dotenv-safe").load();


const { Schema } = mongoose;

const tariffTranslation = new Schema({
    _id: false,
    language: { type: String },
    text: { type: String }
});

const priceModel = new Schema({
    _id: false,
    excl_vat: { type: Number }, //Price/Cost excluding VAT.
    incl_vat: { type: Number } //Price/Cost including VAT.
});

const priceRoundModel = new Schema({
    _id: false,
    round_granularity: { type: String , default: "THOUSANDTH" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String , default: "ROUND_NEAR" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});

const stepRoundModel = new Schema({
    _id: false,
    round_granularity: { type: String , default: "UNIT" }, // Can take values “UNIT”, “TENTH”, “HUNDREDTH” or “THOUSANDTH”
    round_rule: { type: String , default: "ROUND_UP" } // Can take values “ROUND_UP”, “ROUND_DOWN” or “ROUND_NEAR”
});

const priceComponent = new Schema({
    _id: false,
    type: { type: String }, //ENERGY    FLAT    PARKING_TIME    TIME
    price: { type: Number }, //Price per unit (excl. VAT) for this tariff dimension.
    vat: { type: Number }, //Applicable VAT percentage for this tariff dimension. If omitted, no VAT is applicable. Not providing a VAT is different from 0% VAT, which would be a value of 0.0 here.
    step_size: { type: Number }, //Minimum amount to be billed. This unit will be billed in this step_siz blocks. For example: if type is TIME and step_size has a value of 300, then time will be billed in blocks of 5 minutes. If 6 minutes were used, 10 minutes (2 blocks of step_size) will be billed.
    price_round : priceRoundModel,
    step_round : stepRoundModel
});

const tariffRestrictions = new Schema({
    _id: false,
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
    day_of_week: {type : [String] , default: undefined}, //Mobie
    reservation: { type: String }
});


const tariffElements = new Schema({
    _id: false,
    price_components: [priceComponent],
    restrictions: tariffRestrictions
});

const attributionsModel = new Schema({
    _id: false,
    hwId: { type: String }, 
    plugId: { type: String },
});

const tariffsModel = new Schema({
    country_code: { type: String, default: "PT" },
    party_id: { type: String },
    source : { type: String },
    id: { type: String, index: true },
    currency: { type: String, default: "EUR" },
    name : { type: String },
    type: { type: String }, //REGULAR OR AD_HOC_PAYMENT
    tariff_alt_text: [tariffTranslation], //This field may be used by the CPO to communicate any relevant discounts.
    min_price: { type: priceModel },
    elements: [tariffElements],
    start_date_time: { type: String },
    end_date_time: { type: String },
    last_updated: { type: String },
    exact_price_component : { type: Boolean },
    status : { type: String , default: "PROCESSING"},
    ownerId : { type: String },
    activationDate: { type: String },
    attributions : {type : [attributionsModel], default : []}
},
    {
        timestamps: true
    }
);

tariffsModel.index({ id: 1 });

var Tariffs = module.exports = mongoose.model('Tariff', tariffsModel);

module.exports.create = function (newObject, callback) {
    newObject.save(callback);
};


module.exports.updateTariff = function (query, values, callback) {
    Tariffs.findOneAndUpdate(query, values, callback);
    
};

module.exports.removeTariff = function (query, callback) {
    Tariffs.findOneAndRemove(query, callback);
};
