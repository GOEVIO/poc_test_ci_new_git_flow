const mongoose = require('mongoose');
require("dotenv-safe").load();
var AutoIncrement = require('mongoose-sequence')(mongoose);

const { Schema } = mongoose;

const amountModel = mongoose.Schema(
    {
        currency: { type: String },
        value: { type: Number }
    }
);

const cardModel = new Schema(
    {
        cardNumber: { type: String },
        dec: { type: String },
        decInvert: { type: String },
        inUse: { type: Boolean, default: false },
        activationDate: { type: Date },
        amount: { type: amountModel }
    },
    {
        timestamps: true
    }
);



var card = module.exports = mongoose.model('card', cardModel);