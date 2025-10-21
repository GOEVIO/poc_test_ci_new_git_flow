require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const comissionClient = require('../handlers/comissionClient');


//========== POST ==========
router.post('/api/private/comissionClient/runFirstTime', (req, res, next) => {
    comissionClient.createOld(req, res);
});

//========== GET ==========
//Get comissions of use
router.get('/api/private/comissionClient', async (req, res, next) => {
    comissionClient.get(req, res);
});

//========== PATCH ==========
//Edit comission percentage
router.patch('/api/private/comissionClient/edit', async (req, res, next) => {
    comissionClient.patch(req, res);
});

module.exports = router;