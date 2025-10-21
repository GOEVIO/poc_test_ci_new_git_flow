const express = require('express');
const Sentry = require('@sentry/node');

const router = express.Router();
const History = require("../handlers/historyHandler");
const ErrorHandler = require("../handlers/errorHandler");
const { validateInput } = require('../middlewares/history');
const { getHistoryExternalAPIOnlyInvoiceDetails } = require('../handlers/external-api');

require("dotenv-safe").load();

//========== GET ==========
//Get history
router.get('/', async (req, res, next) => {
    const context = "GET /evioapi/chargingsessions/history";
    try {
        await validateInput(req.query.startDate, req.query.endDate,
            req.query.type, req.query.limitQuery, req.query.pageNumber, req.query.documentNumber);
        const result = await History.getHistoryExternalAPI(req, res)
        return res.status(200).header({ 'Access-Control-Expose-Headers': ['totalOfEntries', 'numberOfPages'], 'totalOfEntries': result.totalOfEntries, 'numberOfPages': result.numberOfPages }).send(result.sessions);

    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);

        return ErrorHandler.ErrorHandler(error, res)
    }
});

router.get('/invoice-data', async (req, res) => {
    const context = "GET /evioapi/chargingsessions/history/invoice-data";
    try {
        await validateInput(req.query.startDate, req.query.endDate,
            req.query.type, req.query.limitQuery, req.query.pageNumber, req.query.documentNumber);
        const result = await getHistoryExternalAPIOnlyInvoiceDetails(req)
        return res.status(200).header({
          'Access-Control-Expose-Headers': ['totalOfEntries', 'numberOfPages', 'totalDocuments'],
          'totalOfEntries': result.totalOfEntries,
          'numberOfPages': result.numberOfPages,
          'totalDocuments': result.totalDocuments.total
        }).send(result.sessions);

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return ErrorHandler.ErrorHandler(error, res)
    }
});

module.exports = router;
