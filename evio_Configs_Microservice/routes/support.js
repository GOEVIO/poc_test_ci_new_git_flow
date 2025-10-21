const express = require('express');
const router = express.Router();
const Support = require('../controllers/support');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
router.post('/api/private/config/support', (req, res, next) => {
    var context = "POST /api/private/config/support";

    Support.addSupport(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Support.addSupport] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

router.post('/api/private/config/support/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/config/support/runFirstTime";

    Support.runFirstTime(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Support.runFirstTime] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
router.get('/api/private/config/support', (req, res, next) => {
    const context = "GET /api/private/config/support";

    Support.getSupport(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Support.getSupport] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;