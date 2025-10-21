require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const ErrorHandler = require("../handlers/errorHandler");
const PeriodPayments = require("../routines/periodPayments");

//Job Period Payments
//Start Job
router.post('/api/private/connectionstation/job/periodPayments/startJob', (req, res) => {
    var context = "POST /api/private/connectionstation/job/periodPayments/startJob";

    PeriodPayments.startJobPeriodPayments(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodPayments.startJobPeriodPayments] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

//Stop Job
router.post('/api/private/connectionstation/job/periodPayments/stopJob', (req, res) => {
    var context = "POST /api/private/connectionstation/job/periodPayments/stopJob'";

    PeriodPayments.stopJobPeriodPayments(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodPayments.stopJobPeriodPayments] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        })

});

//Status of the job
router.post('/api/private/connectionstation/job/periodPayments/statusJob', (req, res) => {
    var context = "POST /api/private/connectionstation/job/periodPayments/statusJob'";

    PeriodPayments.statusJobPeriodPayments(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodPayments.statusJobPeriodPayments] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

//Force run
router.post('/api/private/connectionstation/job/periodPayments/forceRun', (req, res) => {
    var context = "POST /api/private/connectionstation/job/periodPayments/forceRun";

    PeriodPayments.forceJobPeriodPayments(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodPayments.forceJobPeriodPayments] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

router.post('/api/private/connectionstation/job/periodPayments/jobPeriodPayment', (req, res) => {
    var context = "POST /api/private/connectionstation/job/periodPayments/jobPeriodPayment";

    PeriodPayments.createJobPeriodPayment(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][ PeriodPayments.createJobPeriodPayment] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});


module.exports = router;