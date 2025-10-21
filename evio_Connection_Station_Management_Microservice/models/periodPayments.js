const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

const paymentPeriodsModel = new Schema({
    timer: { type: String },
    paymentPeriods : { type: [String] }
});

var PeriodPaymentRoutines = module.exports = mongoose.model("PeriodPaymentRoutines", paymentPeriodsModel);
