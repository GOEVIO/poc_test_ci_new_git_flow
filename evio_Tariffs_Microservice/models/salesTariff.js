const { SalesTariffs } = require('evio-library-commons');
var mongoose = require('mongoose');
const { Schema } = mongoose;

const PriceRoundSchema = new Schema({
  round_granularity: { type: String },
  round_rule: { type: String },
}, { _id: false });

const StepRoundSchema = new Schema({
  round_granularity: { type: String },
  round_rule: { type: String },
}, { _id: false });

const PriceComponentSchema = new Schema({
  type: { type: String },
  price: { type: Number},
  vat: { type: Number },
  step_size: { type: Number, default: 1 },
  price_round: { type: PriceRoundSchema },
  step_round: { type: StepRoundSchema },
}, { _id: false });

const RestrictionsSchema = new Schema({
  start_date: { type: String },
  end_date:   { type: String },
  start_time: { type: String },
  end_time:   { type: String },
  min_kwh: { type: Number},
  max_kwh: { type: Number},
  min_current: { type: Number },
  max_current: { type: Number },
  min_power: { type: Number },
  max_power: { type: Number },
  min_duration: { type: Number },
  max_duration: { type: Number },
  day_of_week: [{ type: String }],
  reservation: { type: String },
}, { _id: false });

const TariffElementSchema = new Schema({
  price_components: { type: [PriceComponentSchema]},
  restrictions: { type: RestrictionsSchema  },
}, { _id: false });

const PriceSchema = new Schema({
  excl_vat: { type: Number },
  incl_vat: { type: Number },
}, { _id: false });

const TariffAltTextSchema = new Schema({
  language: { type: String },
  text:     { type: String },
}, { _id: false });

const EnergySourceSchema = new Schema({
  source: { type: String },
  percentage: { type: Number },
}, { _id: false });

const EnvironmentalImpactSchema = new Schema({
  category: { type: String },
  amount:   { type: Number },
}, { _id: false });

const EnergyMixSchema = new Schema({
  is_green_energy: { type: Boolean },
  energy_sources: { type: [EnergySourceSchema] },
  environ_impact: { type: [EnvironmentalImpactSchema] },
  supplier_name: { type: String },
  energy_product_name: { type: String },
}, { _id: false });


const salesTariffModel = new Schema(
    {
        id: {
            type: String,
            index: true
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minLength: [1, 'Name is required']
        },
        tariffType: {
            type: String, //Energy Based, Time Based
            default: "Time Based"
        },
        tariff: {
            activationFee: {
                type: Number,
                default: 0
            },
            bookingAmount: {
                uom: { type: String, default: "min" }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number, default: 0 } // Value
            },
            chargingAmount: {
                uom: { type: String, default: "min" }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number, default: 0 } // Value
            },
            parkingDuringChargingAmount: {
                uom: { type: String, default: "min" }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number, default: 0 } // Value
            },
            parkingAmount: {
                uom: { type: String, default: "min" }, // Unit of measurement (s - seconds, min - minutes, h - hours)
                value: { type: Number, default: 0 } // Value
            },
            evioCommission: {
                minAmount: {
                    uom: { type: String }, // Unit of measurement
                    value: { type: Number } // Value
                },
                transaction: {
                    uom: { type: String }, // Unit of measurement
                    value: { type: Number } // Value
                }
            }
        },
        createUser: {
            type: String
        },
        modifyUser: {
            type: String
        },
        billingType: {
            type: String
        },
        clientName: { type: String, default: "EVIO" },
        status: { type: String },
        country_code: { type: String },
        party_id:     { type: String },
        currency:     { type: String, default: "EUR" },
        type:         { type: String },
        tariff_alt_text: { type: [TariffAltTextSchema]},
        tariff_alt_url:  { type: String },
        min_price: { type: PriceSchema },
        max_price: { type: PriceSchema },
        elements: { type: [TariffElementSchema]},
        energy_mix: { type: EnergyMixSchema},
        start_date_time: { type: String },
        end_date_time:   { type: String },
    },
    {
        timestamps: true
    }
);

salesTariffModel.index({ createUser: 1 });

var SalesTariff = module.exports = mongoose.model('SalesTariff', salesTariffModel);

module.exports.createSalesTariff = function (newSalesTariff, callback) {
    newSalesTariff.save(callback);
};

module.exports.updateSalesTariff = function (query, values, callback) {
    SalesTariff.findOneAndUpdate(query, values, callback);
};

module.exports.removeSalesTariff = function (query, callback) {
    SalesTariff.deleteMany(query, callback);
};

module.exports.findUserActiveTariffByName = async function (createUser, name) {
    return await SalesTariff.findOne({ createUser, name, status: SalesTariffs.Status.Active }).lean();
};

module.exports.findTariffById = async function (_id) {
    return await SalesTariff.findOne({ _id }).lean();
};

module.exports.updateTariffById = async function (_id, values) {
    return await SalesTariff.findOneAndUpdate({ _id }, values, { new: true }).lean();
};

module.exports.removeTariffById = async function (_id) {
    return await SalesTariff.deleteOne({ _id });
};

module.exports.inactivateTariffById = async function (_id) {
    return await SalesTariff.findOneAndUpdate({ _id }, {status: SalesTariffs.Status.Inactive}, { new: true }).lean();
};

module.exports.findUserActiveTariffs = async function (createUser) {
    return await SalesTariff.find({ createUser, status: SalesTariffs.Status.Active }).lean();
};
