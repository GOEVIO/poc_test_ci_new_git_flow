const express = require('express');
const router = express.Router();
const TimeToValidatePayment = require('../controllers/timeToValidatePayment');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create new config to managementPOIs
router.post('/api/private/config/timeToValidatePayment', (req, res, next) => {
    var context = "POST /api/private/config/timeToValidatePayment";

    TimeToValidatePayment.addTimeToValidatePayment(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][TimeToValidatePayment.addTimeToValidatePayment] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
//Get time to validate payment active
router.get('/api/private/config/timeToValidatePayment', (req, res, next) => {
    var context = "GET /api/private/config/timeToValidatePayment";
   
    TimeToValidatePayment.getTimeToValidatePayment(req)
    .then((result) => {

        return res.status(200).send(result);

    })
    .catch((error) => {

        console.error(`[${context}][TimeToValidatePayment.getTimeToValidatePayment] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);

    });

});

//========== PATCH ==========

module.exports = router;