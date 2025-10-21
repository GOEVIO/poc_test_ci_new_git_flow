const express = require('express');
const router = express.Router();
const SalesTariff = require('../controllers/salesTariff');
const ErrorHandler = require('../controllers/errorHandler');
require("dotenv-safe").load();

//========== POST ==========
//Create a new sales tariff
router.post('/api/private/salesTariff', (req, res, next) => {
    const context = "POST /api/private/salesTariff";
    SalesTariff.addSalesTariff(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.post('/api/private/salesTariff/runFirstTime', async (req, res, next) => {
    const context = "POST /api/private/salesTariff/runFirstTime";

    SalesTariff.runFirstTime()
        .then((result) => {

            return res.status(200).send("OK");

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== PATCH ==========
//Edit a sales tariff amounts
router.patch('/api/private/salesTariff', (req, res, next) => {
    const context = "PATCH /api/private/salesTariff";
    SalesTariff.updateSalesTariff(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Edit a evio commission
router.patch('/api/private/salesTariff/evioCommission', (req, res, next) => {
    const context = "PATCH /api/private/salesTariff/evioCommission";
    SalesTariff.updateEvioCommission(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== GET ==========
//Get all my sales tariff
router.get('/api/private/salesTariff', (req, res, next) => {
    const context = "GET /api/private/salesTariff";

    const userId = req.headers['userid'];
    const query = {
        createUser: userId
    };

    SalesTariff.getSalesTariff(query)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get sales tariff by tariff id
router.get('/api/private/salesTariff/byId', (req, res, next) => {
    const context = "GET /api/private/salesTariff/byId";

    const query = req.query;

    SalesTariff.getSalesTariffById(query)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get sales tariff by id for charger
router.get('/api/private/salesTariff/byIdForCharger', (req, res, next) => {
    const context = "GET /api/private/salesTariff/byIdForCharger";

    const query = req.body;

    //console.log("query", query);
    SalesTariff.getSalesTariffById(query)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/salesTariff/filter', (req, res, next) => {
    const context = "GET /api/private/salesTariff/filter";

    SalesTariff.getSalesTariffUsingFilter(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/salesTariff/multiTariffById', (req, res, next) => {
    const context = "GET /api/private/salesTariff/multiTariffById";

    const query = req.query;

    SalesTariff.getSalesTariff(query)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PUT ==========

//========== DELETE ==========
//Delte tariff
router.delete('/api/private/salesTariff', (req, res, next) => {
    const context = "DELETE /api/private/salesTariff";

    SalesTariff.deleteSalesTariff(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//Delete all tariffs from user
router.delete('/api/private/salesTariff/byUser', (req, res, next) => {
    const context = "DELETE /api/private/salesTariff/byUser";

    SalesTariff.deleteSalesTariffByUser(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;