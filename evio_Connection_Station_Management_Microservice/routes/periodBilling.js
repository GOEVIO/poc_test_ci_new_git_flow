require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const ErrorHandler = require("../handlers/errorHandler");
const PeriodBilling = require("../routines/periodBilling");
const toggle = require('evio-toggle').default;

//Job Period Billing
//Start Job
router.post('/api/private/connectionstation/job/periodBilling/startJob', (req, res) => {
    const context = "POST /api/private/connectionstation/job/periodBilling/startJob";

    PeriodBilling.startJobPeriodBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.startJobPeriodBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

//Stop Job
router.post('/api/private/connectionstation/job/periodBilling/stopJob', (req, res) => {
    const context = "POST /api/private/connectionstation/job/periodBilling/stopJob'";

    PeriodBilling.stopJobPeriodBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.stopJobPeriodBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        })

});

//Status of the job
router.post('/api/private/connectionstation/job/periodBilling/statusJob', (req, res) => {
    const context = "POST /api/private/connectionstation/job/periodBilling/statusJob'";

    PeriodBilling.statusJobPeriodBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.statusJobPeriodBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

//Force run
router.post('/api/private/connectionstation/job/periodBilling/forceRun', (req, res) => {
    const context = "POST /api/private/connectionstation/job/periodBilling/forceRun";

    PeriodBilling.forceJobPeriodBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.forceJobPeriodBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

router.post('/api/private/connectionstation/job/periodBilling/jobPeriodBilling', (req, res) => {
    const context = "POST /api/private/connectionstation/job/periodBilling/jobPeriodBilling";

    PeriodBilling.createJobPeriodBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.createJobPeriodBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});


router.post('/api/private/connectionstation/job/periodBilling/defaultPeriodBilling', (req, res) => {
    const context = "POST /api/private/connectionstation/job/periodBilling/defaultPeriodBilling";

    PeriodBilling.createDefaultPeriodBilling(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.createDefaultPeriodBilling] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});


router.get('/api/private/connectionstation/job/periodBilling/allPeriodBillings', (req, res) => {
    const context = "GET /api/private/connectionstation/job/periodBilling/allPeriodBillings";

    PeriodBilling.getAllPeriodBillings(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.getAllPeriodBillings] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

router.patch('/api/private/connectionstation/job/periodBilling/periodBillings', (req, res) => {
    const context = "PATCH /api/private/connectionstation/job/periodBilling/periodBillings";

    PeriodBilling.updatePeriodBillings(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.updatePeriodBillings] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

router.post('/api/private/connectionstation/reprocessInvoiceAttch', async (req, res) => {
    const context = "POST /api/private/connectionstation/reprocessInvoiceAttch";

    const featureFlagEnabled = await toggle.isEnable('reprocess-attach-of-sessions-6739');
    if(!featureFlagEnabled) {
        console.log(`[${context}][FEATUREFLAG][reprocess-attach-of-sessions-6739]`)
        return res.status(403).send({ code: 'feature_deactivated', message: "Feature deactivated" });
    }

    PeriodBilling.reprocessAttachments(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodBilling.reprocessAttachments] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});

module.exports = router;