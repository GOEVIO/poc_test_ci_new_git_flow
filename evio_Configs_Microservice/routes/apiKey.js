const express = require('express');
const router = express.Router();
const APIKey = require('../controllers/apiKey');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create new api key
router.post('/api/private/config/saveAPIKey', (req, res, next) => {
    var context = "POST /api/private/config/saveAPIKey";
    APIKey.addAPIKey(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][ APIKey.addAPIKey] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== GET ==========
//Get all apikeys
router.get('/api/private/config/getAPIKey', (req, res, next) => {
    var context = "GET /api/private/config/getAPIKey";
    APIKey.getAPIKey(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][ APIKey.getAPIKey] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

module.exports = router;