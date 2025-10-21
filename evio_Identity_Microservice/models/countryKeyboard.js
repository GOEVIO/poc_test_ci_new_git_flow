var mongoose = require('mongoose');
var mongo = require('mongodb');

var countryKeyboardSchema = mongoose.Schema({
    countryCode : { type: String },
    country: { type: String },
    numericKeyboard: { type: Boolean, default: false },
});

var CountryKeyboard = module.exports = mongoose.model('CountryKeyboard', countryKeyboardSchema)

module.exports.createCountryKeyboard = function (newCountryKeyboard, callback) {
    newCountryKeyboard.save(callback);
};

module.exports.updateCountryKeyboard = function (query, values, callback) {
    CountryKeyboard.findOneAndUpdate(query, values, callback);
};

module.exports.removeCountryKeyboard = function (query, callback) {
    CountryKeyboard.findOneAndRemove(query, callback);
};