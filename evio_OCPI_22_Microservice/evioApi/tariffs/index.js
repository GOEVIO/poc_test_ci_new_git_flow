const express = require('express');
const router = express.Router();
const tariffs = require('./tariffs')
const Utils = require('../../utils')
const Sentry = require("@sentry/node");


router.get('/OPCtariffs', (req, res) => {
    tariffs.OPCtariffs(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            Sentry.captureException(e);
            return res.status(400).send(e);
        });

});

router.get('/linkWithEVSE', (req, res) => {
    tariffs.linkWithEVSE(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            Sentry.captureException(e);
            return res.status(400).send(e);
        });

});

router.post('/opcTariffsPrices', (req, res) => {
    tariffs.opcTariffsPrices(req, res)
        .then(result => {

            res.status(200).send(result);
            Utils.logsOut(req, res, result)
            return res

        })
        .catch((e) => {
            Sentry.captureException(e);
            res.status(400).send(e);
            Utils.logsOut(req, res, e)
            return res
        });

});

router.post('/chargerTariffs', (req, res) => {
    tariffs.chargerTariffs(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            Sentry.captureException(e);
            return res.status(400).send(e);
        });

});

router.post('/detailedTariffs', (req, res) => {
    tariffs.detailedTariffs(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            Sentry.captureException(e);
            return res.status(400).send(e);
        });

});

router.post('/priceSimulation', (req, res) => {
    tariffs.priceSimulation(req)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            Sentry.captureException(e);
            return res.status(400).send(e);
        });

});

router.post('/defaultOpcTariffs', (req, res) => {
    tariffs.createDefaultOpcTariffs(req)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            Sentry.captureException(e);
            return res.status(400).send(e);
        });

});

module.exports = router;