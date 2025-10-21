const express = require('express');
const router = express.Router();
const HYSibsCards = require('../controllers/hySibsCards');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create entry in db
router.post('/api/private/hySibsCards', (req, res, next) => {
    const context = "POST /api/private/hySibsCards";
    HYSibsCards.addSibsCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][HYSibsCards.addSibsCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PATCH ==========
router.patch('/api/private/hySibsCards/used', (req, res, next) => {
    const context = "PATCH /api/private/hySibsCards/used";
    HYSibsCards.updateInUse(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][ HYSibsCards.updateInUse] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PUT ==========


//========== GET ==========
router.get('/api/private/hySibsCards', (req, res, next) => {
    const context = "GET /api/private/hySibsCards";
    HYSibsCards.getSibsCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][HYSibsCards.getSibsCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/hySibsCards/byCardNumber/:cardNumber', (req, res, next) => {
    const context = "GET /api/private/hySibsCards/byCardNumber/:cardNumber";
    HYSibsCards.getSibsCardsByCardNumber(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][HYSibsCards.getSibsCardsByCardNumber] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});


//========== DELETE ==========

module.exports = router;