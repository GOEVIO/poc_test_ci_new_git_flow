const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;



const billingPeriodsModel = new Schema({
    timer: { type: String },
    billingPeriods : { type: [String] }
});

var PeriodBillingRoutines = module.exports = mongoose.model("PeriodBillingRoutines", billingPeriodsModel);