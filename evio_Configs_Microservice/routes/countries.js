const express = require('express');
const router = express.Router();
const Country = require('../controllers/countries');
const ErrorHandler = require('../controllers/errorHandler');
const { getCountryCode } = require('../caching/getCountryCode');
const { validateCountry } = require('../middlewares/validateCountry');
const { getCountryCodeByName } = require("../caching/getCountryCodeByName");
const { getRedisClient } = require("../caching/cache");

//========== POST ==========
//Create new country
router.post('/api/private/countries', validateCountry, async (req, res) => {
    const context = "POST /api/private/countries";

    try {
        const result = await Country.addCountry(req);
        const redisClient = await getRedisClient();

        for (const item of result) {
            const { country, countryName, countryCode } = item;

            if (countryName && countryCode) {
                const keyByName = `countryCodeByName:${countryName}`;

                try {
                    await redisClient.set(keyByName, countryCode);
                    console.log(`[${context}] Redis set: ${keyByName} → ${countryCode}`);
                } catch (err) {
                    console.error(`[${context}] Failed to cache ${keyByName} → ${countryCode}`, err);
                }

                if (country) {
                    const keyByCountry = `countryCodeByCountry:${country}`;
                    const value = JSON.stringify({ countryCode, countryName });

                    try {
                        await redisClient.set(keyByCountry, value);
                        console.log(`[${context}] Redis set: ${keyByCountry} → ${value}`);
                    } catch (err) {
                        console.error(`[${context}] Failed to cache ${keyByCountry}`, err);
                    }
                }
            }
        }

        return res.status(200).send(result);
    } catch (error) {
        console.error(`[${context}][ Country.addCountry] Error: ${error.message}`);
        ErrorHandler.ErrorHandler(error, res);
    }
});


//========== GET ==========
//Get all countries
router.get('/api/private/getAllCountries', (req, res, next) => {
    var context = "GET /api/private/getAllCountries";
    Country.getCountries(req)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][ Country.getCountries] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);
        });
});

//Get by country_code
router.get('/api/private/country-code/:country', async (req, res) => {
    const country = req.params.country;

    try {
        const result = await getCountryCode(country);

        if (result) return res.send(result);

        return res.status(404).send({ error: "Country code not found" });
    } catch (error) {
        console.error("Error in /country-code endpoint:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
});

router.get('/api/private/country-code-by-name/:countryName', async (req, res) => {
    const countryName = req.params.countryName;
    try {
        const result = await getCountryCodeByName(countryName);

        if (result) return res.send(result);

        return res.status(404).send({ error: "Country code not found" });

    } catch (error) {
        console.error("Error in /country-code-by-name endpoint:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
});

module.exports = router;
