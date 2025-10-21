const mongoose = require('mongoose');

const { Schema } = mongoose;

const CountrySchema = new Schema(
    {
        countryName: { type: String, required: true, index: true },
        country: {
            type: String,
            required: true,
            unique: true,
            match: /^[A-Z]{3}$/,
        },
        countryCode: {
            type: String,
            required: true,
            unique: true,
            match: /^[A-Z]{2}$/,
        },
    },
);

var Country = module.exports = mongoose.model('Country', CountrySchema);

module.exports.createCountry = function (newCountry, callback) {
    newCountry.save(callback);
};

module.exports.getCountries = function (query, callback) {
    Country.find(query, callback);
};
