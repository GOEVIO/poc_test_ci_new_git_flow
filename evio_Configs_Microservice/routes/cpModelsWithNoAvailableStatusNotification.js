const express = require('express');
const router = express.Router();
const CpModelsWithNoAvailableStatusNotification = require('../controllers/cpModelsWithNoAvailableStatusNotification');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create a new version compatibility
router.post('/api/private/cpModelsWithNoAvailableStatusNotification', (req, res, next) => {
    const context = "POST /api/private/cpModelsWithNoAvailableStatusNotification";

    CpModelsWithNoAvailableStatusNotification.addCpModelsWithNoAvailableStatusNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][CpModelsWithNoAvailableStatusNotification.addCpModelsWithNoAvailableStatusNotification] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== PATCH ==========
//Enable or disable cp model
router.patch('/api/private/cpModelsWithNoAvailableStatusNotification', (req, res, next) => {
    const context = "PATCH /api/private/cpModelsWithNoAvailableStatusNotification";

    CpModelsWithNoAvailableStatusNotification.updateCpModelsWithNoAvailableStatusNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][CpModelsWithNoAvailableStatusNotification.updateCpModelsWithNoAvailableStatusNotification] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});
//========== PUT ==========

//========== GET ==========
//Get all cp models With No Available Status Notification
router.get('/api/private/cpModelsWithNoAvailableStatusNotification', (req, res, next) => {
    const context = "GET /api/private/cpModelsWithNoAvailableStatusNotification";

    CpModelsWithNoAvailableStatusNotification.getCpModelsWithNoAvailableStatusNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][CpModelsWithNoAvailableStatusNotification.getCpModelsWithNoAvailableStatusNotification] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });


});
//========== DELETE ==========

//========== FUNCTIONS ==========


module.exports = router;