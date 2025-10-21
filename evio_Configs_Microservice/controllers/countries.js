const Country = require('../models/countries');

module.exports = {
    addCountry: function (req) {
        let context = "Function addCountry";

        return new Promise((resolve, reject) => {
            const body = req.body;

            if (Array.isArray(body)) {
                Country.insertMany(body, { ordered: false }, (err, result) => {
                    if (err) {
                        console.log(`[${context}][insertMany] Error `, err.message);
                        resolve(result || []);
                    } else {
                        resolve(result);
                    }
                });
            } else {
                const countryToSave = new Country(body);

                countryToSave.save((err, result) => {
                    if (err) {
                        console.log(`[${context}][save] Error `, err.message);
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            }
        });
    },

    getCountries: function (req) {
        let context = "Function getCountries";
        return new Promise((resolve, reject) => {
            const query = req.body.query || {};

            Country.getCountries(query, (err, result) => {
                if (err) {
                    console.log(`[${context}][getCountries] Error `, err.message);
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
};
