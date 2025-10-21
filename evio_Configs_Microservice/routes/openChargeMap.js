const express = require('express');
const router = express.Router();
const OpenChargeMap = require('../controllers/openChargeMap');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
router.post('/api/private/config/openChargeMap', (req, res, next) => {
    var context = "POST /api/private/config/openChargeMap";
    OpenChargeMap.addOpenChargeMap(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][OpenChargeMap.addOpenChargeMaps] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== GET ==========
router.get('/api/private/config/openChargeMap', (req, res, next) => {
    var context = "GET /api/private/config/openChargeMap";
    OpenChargeMap.getOpenChargeMap(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][OpenChargeMap.getOpenChargeMap] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== DELETE ==========
router.delete('/api/private/config/openChargeMap', (req, res, next) => {
    var context = "DELETE /api/private/config/openChargeMap";
    OpenChargeMap.deleteOpenChargeMap(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][OpenChargeMap.deleteOpenChargeMap] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});


module.exports = router;