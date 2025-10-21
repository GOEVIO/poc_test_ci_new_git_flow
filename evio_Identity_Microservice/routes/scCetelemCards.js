const express = require('express');
const router = express.Router();
const SCCetelemCards = require('../controllers/scCetelemCards');
const ErrorHandler = require('../controllers/errorHandler');
const { logger } = require('../utils/constants');

//========== POST ==========
//Create entry in db
router.post('/api/private/scCetelemCards', (req, res, next) => {
    const context = "POST /api/private/scCetelemCards";
    SCCetelemCards.addCetelemCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][SCCetelemCards.addCetelemCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PATCH ==========
router.patch('/api/private/scCetelemCards/used', (req, res, next) => {
    const context = "PATCH /api/private/scCetelemCards/used";
    SCCetelemCards.updateInUse(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][ SCCetelemCards.updateInUse] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PUT ==========


//========== GET ==========
router.get('/api/private/scCetelemCards', (req, res, next) => {
    const context = "GET /api/private/scCetelemCards";
    SCCetelemCards.getCetelemCards(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][SCCetelemCards.getCetelemCards] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/scCetelemCards/ByHash/:hash', (req, res, next) => {
    const context = "GET /api/private/scCetelemCards/ByHash/:hash";
    SCCetelemCards.getCetelemCardsByHash(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][SCCetelemCards.getCetelemCardsByHash] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});


//========== DELETE ==========

module.exports = router;