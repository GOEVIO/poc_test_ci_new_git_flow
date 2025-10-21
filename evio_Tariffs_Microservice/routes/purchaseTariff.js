const express = require('express');
const router = express.Router();
const PurchaseTariff = require('../controllers/purchaseTariff');
const ErrorHandler = require('../controllers/errorHandler');
require("dotenv-safe").load();

//========== GET ==========
//Get all my purchase tarrifs
router.get('/api/private/purchaseTariff', (req, res, next) => {
    const context = "POST /api/private/purchaseTariff";

    const userId = req.headers['userid'];
    const query = {
        userId: userId
    };

    PurchaseTariff.getPurchaseTariff(query)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//Get purchase tariff by tariff id
router.get('/api/private/purchaseTariff/byId', (req, res, next) => {
    const context = "GET /api/private/purchaseTariff/byId";

    const query = req.query;

    PurchaseTariff.getPurchaseTariffById(query)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== POST ==========
//Run first time
router.post('/api/private/purchaseTariff/runFirstTime', async (req, res, next) => {
    const context = "POST /api/private/purchaseTariff/runFirstTime";

    PurchaseTariff.runFirstTime()
        .then((result) => {

            return res.status(200).send("OK");

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//Create a new purchase tariff
router.post('/api/private/purchaseTariff', (req, res, next) => {
    const context = "POST /api/private/purchaseTariff";

    PurchaseTariff.addPurchaseTariff(req)
        .then((result) => {
            
            return res.status(200).send(result);

        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);
        });

});

//========== PATCH ==========
//Edit a purchase tariff amounts
router.patch('/api/private/purchaseTariff', (req, res, next) => {
    const context = "PATCH /api/private/purchaseTariff";

    PurchaseTariff.updatePurchaseTariff(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//Edit a purchase tariff cost
router.patch('/api/private/purchaseTariff/addCost', (req, res, next) => {
    const context = "PATCH /api/private/purchaseTariff/addCost";

    PurchaseTariff.addPurchaseTariffCost(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== DELETE ==========
//Delte tariff
router.delete('/api/private/purchaseTariff', (req, res, next) => {
    const context = "DELETE /api/private/purchaseTariff";

    PurchaseTariff.deletePurchaseTariffById(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;