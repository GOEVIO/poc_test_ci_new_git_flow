require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const ErrorHandler = require("../handlers/errorHandler");
const DataPlugStatusChange = require('../handlers/dataPlugStatusChange');


router.post('/api/private/connectionstation/saveDataPlugStatusChange', (req, res) => {
    let context = "POST /api/private/connectionstation/job/saveDataPlugStatusChange";

    DataPlugStatusChange.saveDataPlugStatusChange(req, res)
        .then((result) => {
            return res.status(200).send(result);
        })
        .catch((error) => {
            console.error(`[${context}][PeriodPayments.forceJobPeriodPayments] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res)
        });

});


module.exports = router;