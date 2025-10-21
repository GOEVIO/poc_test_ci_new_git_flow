require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const comissionEVIO = require('../handlers/comissionEVIO');


//========== POST ==========
router.post('/api/private/comissionEVIO', (req, res, next) => {
    comissionEVIO.create(req, res);
});

//========== GET ==========
//Get comissions of use
router.get('/api/private/comissionEVIO', async (req, res, next) => {
    comissionEVIO.get(req, res);
});

//========== PATCH ==========
//Edit comission percentage
router.patch('/api/private/comissionEVIO/edit', async (req, res, next) => {
    comissionEVIO.patch(req, res);
});

router.patch('/api/private/comissionEVIO/addSpecialClients', async (req, res, next) => {
    comissionEVIO.patchSpecialClientsAdd(req, res);
});

router.patch('/api/private/comissionEVIO/removeSpecialClients', async (req, res, next) => {
    comissionEVIO.patchSpecialClientsRemove(req, res);
});

module.exports = router;