require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const ErrorHandler = require("../handlers/errorHandler");
const Report = require("../handlers/report");

router.get('/api/private/ocpi/reports', async (req, res, next) => {
    var context = "GET /api/private/ocpi/reports";
    try {
        Report.getReports(req, res);

        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

router.get('/api/private/ocpi/reports/totalCdrs', async (req, res, next) => {
    var context = "GET /api/private/ocpi/reports";
    try {
        let totals = await Report.getResportTotalCdrs(req, res);

        return res.status(200).send(totals);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

router.get('/api/private/ocpi/reports/startJob', (req, res) => {
    var context = "GET /api/private/ocpi/reports/startJob";
    try {
        Report.startJob(req, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

router.get('/api/private/ocpi/reports/stopJob', (req, res) => {
    var context = "GET /api/private/ocpi/reports/stopJob";
    try {
        Report.stopJob(req, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

router.get('/api/private/ocpi/reports/statusJob', (req, res) => {
    var context = "GET /api/private/ocpi/reports/statusJob";
    try {
        Report.statusJob(req, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

module.exports = router;