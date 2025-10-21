const express = require('express');
const router = express.Router();
const CountryKeyboard = require('../models/countryKeyboard');
//const cemeTariff = require('../models/cemeTariff');
require("dotenv-safe").load();
const { logger } = require('../utils/constants');

//========== POST ==========
//Endpoint to create a new CEME Tariff
router.post('/api/private/countryKeyboard', async (req, res, next) => {
    const context = "POST /api/private/countryKeyboard";
    try {

        const { countryCode , country , numericKeyboard} = req.body

        if (!countryCode) {
            return res.status(400).send({ code: 'server_countryCode_required', message: "countryCode required" });
        }
        if (!country) {
            return res.status(400).send({ code: 'server_country_required', message: "country required" });
        }
        if (typeof numericKeyboard !== "boolean") {
            return res.status(400).send({ code: 'server_numericKeyboard_required', message: "numericKeyboard required" });
        }
       
        const createdCountryKeyboard = await createCountryKeyboard(countryCode , country , numericKeyboard)
        return res.status(200).send(createdCountryKeyboard);

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.post('/api/private/countryKeyboard/list', async (req, res, next) => {
    const context = "POST /api/private/countryKeyboard/list";
    try {

        const { entries } = req.body

        if (!entries) {
            return res.status(400).send({ code: 'server_entries_required', message: "entries required" });
        }
        let createdCountryKeyboard = []
        for (let entry of entries) {

            if (!entry.countryCode || !entry.country || typeof entry.numericKeyboard !== "boolean") {
                continue
            }
         
            const created = await createCountryKeyboard(entry.countryCode , entry.country , entry.numericKeyboard)
            if (created) {
                createdCountryKeyboard.push(created)
            }
        }
        return res.status(200).send(createdCountryKeyboard);

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//========== GET ==========
//Endpoint to get all CEME Tariff of given user
router.get('/api/private/countryKeyboard', async (req, res, next) => {
    const context = "GET /api/private/countryKeyboard";
    try {
        const found = await CountryKeyboard.find({} , {numericKeyboard : 1 , countryCode : 1 , country : 1 , _id : 0}).lean()
        return res.status(200).send(found);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/countryKeyboard/byId', async (req, res, next) => {
    const context = "GET /api/private/countryKeyboard/byId";
    try {
        const { countryCodeKeyboardId } = req.query
       
        if (!countryCodeKeyboardId) {
            return res.status(400).send({ code: 'server_id_required', message: "id required" });
        }

        const found = await CountryKeyboard.findOne({_id : countryCodeKeyboardId} , {numericKeyboard : 1 , countryCode : 1 , country : 1 , _id : 0}).lean()
        return res.status(200).send(found);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Endpoint to edit a CEME Tariff
router.patch('/api/private/countryKeyboard', async (req, res, next) => {
    const context = "PATCH /api/private/countryKeyboard";
    try {
        const { countryCodeKeyboardId , numericKeyboard} = req.body
       
        if (!countryCodeKeyboardId) {
            return res.status(400).send({ code: 'server_id_required', message: "id required" });
        }

        if (typeof numericKeyboard !== "boolean") {
            return res.status(400).send({ code: 'server_numericKeyboard_required', message: "numericKeyboard required" });
        }
        const found = await CountryKeyboard.findOneAndUpdate({_id : countryCodeKeyboardId} , {$set : { numericKeyboard}} ,{ fields : {numericKeyboard : 1 , countryCode : 1 , country : 1 , _id : 0} , new : true }).lean()
        return res.status(200).send(found);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========

//========== DELETE ==========
//Endpoint to remove a CEME Tariff
router.delete('/api/private/countryKeyboard', async (req, res, next) => {
    const context = "PATCH /api/private/countryKeyboard";
    try {
        const { countryCodeKeyboardId } = req.query
       
        if (!countryCodeKeyboardId) {
            return res.status(400).send({ code: 'server_id_required', message: "id required" });
        }
        const found = await CountryKeyboard.deleteOne({_id : countryCodeKeyboardId})
        return res.status(200).send(found);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


async function createCountryKeyboard(countryCode , country , numericKeyboard) {
    const context = "Function createCountryKeyboard";
    try {
        const found = await CountryKeyboard.findOne({ $or : [{countryCode} , {country}]})
        if (!found) {
            const create = new CountryKeyboard({ countryCode , country , numericKeyboard})
            const result = await create.save()
            return {
                numericKeyboard : result.numericKeyboard,
                countryCode : result.countryCode,
                country : result.country,
            }
        } else {
            return null
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null
    }
}

module.exports = router;
