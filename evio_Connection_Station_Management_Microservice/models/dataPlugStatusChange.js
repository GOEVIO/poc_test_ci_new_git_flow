const mongoose = require('mongoose');
require("dotenv-safe").load();

const { Schema } = mongoose;

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

const dataPlugStatusChangeModel = new Schema(
    {
        hwId: { type: String },
        plugId: { type: String },
        status: { type: String },
        substatus: { type: String },
        date: { type: Date },
        address: { type: addressModel },
    },
    {
        timestamps: true
    }
);

var DataPlugStatusChangeModel = module.exports = mongoose.model("DataPlugStatusChangeModel", dataPlugStatusChangeModel);


module.exports.createDataPlugStatusChangeModel = function (newDataPlugStatusChange, callback) {
    newDataPlugStatusChange.save(callback);
};