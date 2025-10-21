const express = require('express');
const Sentry = require('@sentry/node');
const router = express.Router();
const NotificationsSettings = require('../controllers/notificationsSettings');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create a new notifications definition
router.post('/api/private/notificationsSettings', (req, res, next) => {
    let context = "POST /api/private/notificationsSettings";
    NotificationsSettings.addNotificationsSettings(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.addNotificationsSettings] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Run first time

router.post('/api/private/setupNotifications/runFirstTime', async (req, res) => {
    const context = "POST /api/private/setupNotifications/runFirstTime";
    try {
        const result = await NotificationsSettings.runFirstTime(req);
        res.status(200).send(result);
    } catch (error) {
        console.error(`[${context}][NotificationsSettings.runFirstTime] Error `, error.message);
        Sentry.captureException(error);
        ErrorHandler.ErrorHandler(error, res);
    }
});

router.post('/api/private/config/energyConsumptionEndOfCharging', (req, res, next) => {
    var context = "POST /api/private/config/energyConsumptionEndOfCharging";
    NotificationsSettings.addEnergyConsumptionEndOfChargingNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.energyConsumptionEndOfCharging] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.post('/api/private/setupNotifications/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/setupNotifications/runFirstTime";
    NotificationsSettings.runFirstTime(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.runFirstTime] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== GET ==========
router.get('/api/private/notificationsSettings', (req, res, next) => {
    let context = "GET /api/private/notificationsSettings";
    NotificationsSettings.getNotificationsSettings(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.getNotificationsSettings] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/checkUserNotificationSettings', (req, res, next) => {
    let context = "GET /api/private/checkUserNotificationSettings";
    NotificationsSettings.checkUserNotificationSettings(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.checkUserNotificationSettings] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== DELETE ==========
router.delete('/api/private/notificationsSettings', (req, res, next) => {
    let context = "DELETE /api/private/notificationsSettings";
    NotificationsSettings.deleteNotificationsSettings(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.deleteNotificationsSettings] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PATCH ===========
router.patch('/api/private/notificationsSettings', (req, res, next) => {
    let context = "PATCH /api/private/notificationsSettings";
    NotificationsSettings.updateNotificationsSettings(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.updateNotificationsSettings] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.patch('/api/private/removeUserChargerNotification', (req, res, next) => {
    var context = "PATCH /api/private/removeUserChargerNotification";
    NotificationsSettings.removeUserChargerNotification(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][NotificationsSettings.removeUserChargerNotification] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

module.exports = router;