require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const cemeManagement = require("../handlers/cemeManagement");
const ErrorHandler = require("../handlers/errorHandler");

//////////////////////////////////////////////////////////// 
///////////////   CEME MANAGEMENT MODULE   /////////////////
////////////////////////////////////////////////////////////

router.get('/api/private/controlcenter/ceme/reports', async (req, res, next) => {
    cemeManagement.get(req, res);
});

router.get('/api/private/controlcenter/ceme/reports/month', async (req, res, next) => {
    cemeManagement.getTotal(req, res);
});

router.get('/api/private/controlcenter/ceme/reports/egme/month', async (req, res, next) => {
    cemeManagement.getEGMEMonth(req, res);
});

router.get('/api/private/controlcenter/ceme/reports/aid/month', async (req, res, next) => {
    cemeManagement.getApoioMonth(req, res);
});

router.get('/api/private/controlcenter/ceme/reports/iec/month', async (req, res, next) => {
    cemeManagement.getIECMonth(req, res);
});

router.get('/api/private/controlcenter/ceme/reports/export', async (req, res, next) => {
    cemeManagement.getCEMEExportMonth(req, res);
});


module.exports = router;