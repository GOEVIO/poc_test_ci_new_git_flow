const express = require('express');
const router = express.Router();
const TariffTesla = require('../controllers/tariffTesla');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create a new Tesla tariff
router.post('/api/private/tariffTesla', (req, res, next) => {
    const context = "POST /api/private/tariffTesla";
    
    TariffTesla.addTariffTesla(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//Endpoint to run first time
router.post('/api/private/tariffTesla/runFirstTime', (req, res, next) => {
    const context = "POST /api/private/tariffTesla/runFirstTime";

    return res.status(200).send("OK");

});

//========== PATCH ==========
//Edit Tesla tariff
router.patch('/api/private/tariffTesla', (req, res, next) => {
    const context = "PATCH /api/private/tariffTesla";

    TariffTesla.updateTariffTesla(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
//Get Tesla tariff Active
router.get('/api/private/tariffTesla', (req, res, next) => {
    const context = "GET /api/private/tariffTesla";

    TariffTesla.getTariffTesla(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;