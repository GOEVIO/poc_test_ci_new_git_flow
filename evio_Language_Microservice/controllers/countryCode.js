const express = require('express');
const router = express.Router();
var Language = require('../models/language');
const CountryLanguage = require('@ladjs/country-language')

router.get('/api/private/language/countryCode', (req, res, next) => {
    var context = "GET /api/private/language/countryCode";
    try {

        if (!req.query.countryCode) {
            return res.status(400).send("countryCode is needed");
        }

        let countryCode = req.query.countryCode

        let countryExists = CountryLanguage.countryCodeExists(countryCode);

        if (!countryExists)
            return res.status(200).send("");

        let languages = CountryLanguage.getCountry(countryCode, function (err, country) {
            if (err) {
                throw err
            } else {
                let laguages = []

                country.languages.forEach(language => {
                    laguages.push(language.iso639_1)
                });
                
                return laguages
            }
        });

        Language.findOne({ languageCode: languages }, (err, language) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (language) {
                    return res.status(200).send(languages);
                }
                else {
                    return res.status(200).send("");
                }
            }

        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

module.exports = router;