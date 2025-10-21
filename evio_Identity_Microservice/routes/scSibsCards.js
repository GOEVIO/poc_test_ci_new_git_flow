const express = require('express');
const router = express.Router();
const SCSibsCards = require('../controllers/scSibsCards');
const ErrorHandler = require('../controllers/errorHandler');
const { logger } = require('../utils/constants');

//========== POST ==========
//Create entry in db
router.post('/api/private/scSibsCards', (req, res, next) => {
    const context = "POST /api/private/scSibsCards";
    SCSibsCards.addSibsCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][SCSibsCards.addSibsCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PATCH ==========
router.patch('/api/private/scSibsCards/used', (req, res, next) => {
    const context = "PATCH /api/private/scSibsCards/used";
    SCSibsCards.updateInUse(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][ SCSibsCards.updateInUse] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PUT ==========


//========== GET ==========
router.get('/api/private/scSibsCards', (req, res, next) => {
    const context = "GET /api/private/scSibsCards";
    SCSibsCards.getSibsCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][SCSibsCards.getSibsCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/scSibsCards/byCardNumber/:cardNumber', (req, res, next) => {
    const context = "GET /api/private/scSibsCards/byCardNumber/:cardNumber";
    SCSibsCards.getSibsCardsByCardNumber(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][SCSibsCards.getSibsCardsByCardNumber] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});


//========== DELETE ==========

module.exports = router;