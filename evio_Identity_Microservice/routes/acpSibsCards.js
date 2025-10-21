const express = require('express');
const router = express.Router();
const ACPSibsCards = require('../controllers/acpSibsCards');
const ErrorHandler = require('../controllers/errorHandler');
const { logger } = require('../utils/constants');

//========== POST ==========
//Create entry in db
router.post('/api/private/acpSibsCards', (req, res, next) => {
    const context = "POST /api/private/acpSibsCards";
    ACPSibsCards.addSibsCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][ACPSibsCards.addSibsCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PATCH ==========
router.patch('/api/private/acpSibsCards/used', (req, res, next) => {
    const context = "PATCH /api/private/acpSibsCards/used";
    ACPSibsCards.updateInUse(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][ ACPSibsCards.updateInUse] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PUT ==========


//========== GET ==========
router.get('/api/private/acpSibsCards', (req, res, next) => {
    const context = "GET /api/private/acpSibsCards";
    ACPSibsCards.getSibsCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][ACPSibsCards.getSibsCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/acpSibsCards/byCardNumber/:cardNumber', (req, res, next) => {
    const context = "GET /api/private/acpSibsCards/byCardNumber/:cardNumber";
    ACPSibsCards.getSibsCardsByCardNumber(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][ACPSibsCards.getSibsCardsByCardNumber] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});


//========== DELETE ==========

module.exports = router;