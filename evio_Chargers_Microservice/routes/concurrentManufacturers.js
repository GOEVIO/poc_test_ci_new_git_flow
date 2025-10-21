const ConcurrentManufacturer = require('../models/concurrentManufacturers');
require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const ErrorHandler = require('../controllers/errorHandler');
//========== POST ==========
//Create a new Operator
router.post('/api/private/chargers/concurrentManufacturers', async (req, res, next) => {
    let context = "POST /api/private/concurrentManufacturers";
    try {
        const newConcurrentManufacturer = new ConcurrentManufacturer(req.body);
        let response = await newConcurrentManufacturer.save()
        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Update Operators
router.patch('/api/private/chargers/concurrentManufacturers', async (req, res, next) => {
    let context = "PATCH /api/private/concurrentManufacturers";
    try {
        let concurrentId = req.query.concurrentId
        let updateObj = JSON.stringify(req.body)
        // console.log(concurrentId)
        // console.log(req.body)
        let response = await ConcurrentManufacturer.findOneAndUpdate({_id : concurrentId} , {$set : req.body})
        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

module.exports = router;
