const express = require('express');
const router = express.Router();
const Fees = require('../controllers/fees');
const ErrorHandler = require('../controllers/errorHandler');
const { cacheFees } = require('../caching/cache')

//========== POST ==========
router.post('/api/private/config/fees', (req, res, next) => {
    var context = "POST /api/private/config/fees";

    Fees.addFees(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Fees.addFees] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
router.get('/api/private/config/fees', (req, res, next) => {
    var context = "GET /api/private/config/fees";

    Fees.getFees(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Fees.getFees] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

router.get('/api/private/config/fees/list', (req, res, next) => {
    var context = "POST /api/private/config/fees/list";
    let chargers = req?.body?.chargers
    Fees.getFeesList(chargers)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Fees.getFeesList] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//Run first time to add fees
router.post('/api/private/config/fees/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/config/fees/runFirstTime";
    try {

        Fees.addJsonFees()
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/config/fees/cache', async (req, res) => {
    try {
      await cacheFees();
      return res.status(200).send('Added successfully');
    } catch (error) {
      console.error(error);
      return res.status(500).send(`Something went wrong ${error}`);
    }
  });

module.exports = router;