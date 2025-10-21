const express = require('express');
const router = express.Router();
const MailNotification = require('../controllers/mailNotifications');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
router.post('/api/private/config/mailNotification', (req, res, next) => {
    var context = "POST /api/private/config/mailNotification";

    MailNotification.addMailNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][MailNotification.addMailNotification] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
router.get('/api/private/config/mailNotification', (req, res, next) => {
    var context = "GET /api/private/config/mailNotification";

    MailNotification.getMailNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][MailNotification.getMailNotification] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== DELETE ==========
router.delete('/api/private/config/mailNotification', (req, res, next) => {
    var context = "DELETE /api/private/config/mailNotification";

    MailNotification.deleteMailNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][MailNotification.deleteMailNotification] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});


module.exports = router;