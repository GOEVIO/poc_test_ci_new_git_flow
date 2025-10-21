const express = require('express');
const router = express.Router();
const Messages = require('../controllers/messages');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
router.post('/api/private/config/messages', (req, res, next) => {
    var context = "POST /api/private/config/messages";

    Messages.addMessages(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Messages.addMessages] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
router.get('/api/private/config/messages/landingPage', async (req, res, next) => {
    var context = "GET /api/private/config/messages/landingPage";

    Messages.getMessagesLandingPage(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Messages.getMessagesLandingPage] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

router.get('/api/private/config/messages', (req, res, next) => {
    var context = "GET /api/private/config/messages";

    Messages.getMessages(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Messages.getMessages] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== DELETE ==========
//Delete (deactivate message)
router.delete('/api/private/config/messages', (req, res, next) => {
    var context = "DELETE /api/private/config/messages";

    Messages.deleteMessages(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Messages.deleteMessages] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;