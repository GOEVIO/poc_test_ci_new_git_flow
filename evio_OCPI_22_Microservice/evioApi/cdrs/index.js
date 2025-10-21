const express = require('express');
const router = express.Router();
const cdrs = require('./cdrs')

router.post('/runFirstTime', (req, res) => {
    const context = "POST /api/private/cdrs/runFirstTime"
    try {
        cdrs.fixTotalTime(req, res)
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }

});
router.post('/agregate', async (req, res) => {
    const context = "POST /api/private/cdrs/agregate"
    try {
        let foundCDRs = await cdrs.getCDRAgregate(req, res)
        console.log(foundCDRs)
        return res.status(200).send(foundCDRs);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }

});

router.post('/find', async (req, res) => {
    const context = "POST /api/private/cdrs/find"
    try {
        let foundCDRs = await cdrs.getCDRFind(req, res)
        return res.status(200).send(foundCDRs);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }

});

module.exports = router;