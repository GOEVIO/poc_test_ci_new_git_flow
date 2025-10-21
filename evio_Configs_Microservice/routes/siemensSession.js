const express = require('express');
const router = express.Router();
const SiemensSession = require('../controllers/siemensSession');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
router.post('/api/private/config/siemensSession', (req, res, next) => {
    var context = "POST /api/private/config/siemensSession";

    SiemensSession.addSiemensSession(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][SiemensSession.addSiemensSession] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
router.get('/api/private/config/siemensSession', (req, res, next) => {
    var context = "GET /api/private/config/siemensSession";

    SiemensSession.getSiemensSession(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][SiemensSession.getSiemensSession] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== DELETE ==========
router.delete('/api/private/config/siemensSession', (req, res, next) => {
    var context = "DELETE /api/private/config/siemensSession";

    SiemensSession.deleteSiemensSession(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][SiemensSession.deleteSiemensSession] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});


module.exports = router;