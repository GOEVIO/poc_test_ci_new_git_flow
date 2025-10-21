const express = require('express');
const router = express.Router();
const VersionCompatibility = require('../controllers/versionCompatibility');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create a new version compatibility
router.post('/api/private/versionCompatibility', (req, res, next) => {
    var context = "POST /api/private/versionCompatibility";

    VersionCompatibility.addVersionCompatibility(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][VersionCompatibility.addVersionCompatibility] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
//Create a new version compatibility
router.get('/api/private/versionCompatibility', (req, res, next) => {
    var context = "GET /api/private/versionCompatibility";

    VersionCompatibility.getVersionCompatibility(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][VersionCompatibility.getVersionCompatibility] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;