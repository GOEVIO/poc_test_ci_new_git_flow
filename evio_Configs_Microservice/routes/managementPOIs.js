const express = require('express');
const router = express.Router();
const ManagementPOIs = require('../controllers/managementPOIs');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create new config to managementPOIs
router.post('/api/private/config/managementPOIs', (req, res, next) => {
    var context = "POST /api/private/config/managementPOIs";

    ManagementPOIs.addManagementPOIs(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][ManagementPOIs.addManagementPOIs] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
router.get('/api/private/config/managementPOIs', (req, res, next) => {
    var context = "GET /api/private/config/managementPOIs";

    ManagementPOIs.getManagementPOIs(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][ManagementPOIs.getManagementPOIs] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;