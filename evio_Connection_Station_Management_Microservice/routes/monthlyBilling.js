require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const ErrorHandler = require("../handlers/errorHandler");
const MonthlyBilling = require("../routines/monthlyBilling");

//Job Monthly Billing
//Start Job
router.post('/api/private/connectionstation/job/monthlyBilling/startJob', (req, res) => {
    var context = "POST /api/private/connectionstation/job/monthlyBilling/startJob";

    MonthlyBilling.startJobMonthlyBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][MonthlyBilling.startJobMonthlyBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

//Stop Job
router.post('/api/private/connectionstation/job/monthlyBilling/stopJob', (req, res) => {
    var context = "POST /api/private/connectionstation/job/monthlyBilling/stopJob'";

    MonthlyBilling.stopJobMonthlyBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][MonthlyBilling.stopJobMonthlyBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        })

});

//Status of the job
router.post('/api/private/connectionstation/job/monthlyBilling/statusJob', (req, res) => {
    var context = "POST /api/private/connectionstation/job/monthlyBilling/statusJob'";

    MonthlyBilling.statusJobMonthlyBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][MonthlyBilling.statusJobMonthlyBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

//Force run
router.post('/api/private/connectionstation/job/monthlyBilling/forceRun', (req, res) => {
    var context = "POST /api/private/connectionstation/job/monthlyBilling/forceRun";

    MonthlyBilling.forceJobMonthlyBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][MonthlyBilling.forceJobMonthlyBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

module.exports = router;