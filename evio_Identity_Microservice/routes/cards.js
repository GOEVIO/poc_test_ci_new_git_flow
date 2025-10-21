require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const cards = require('../handlers/cards');


//========== POST ==========
router.post('/api/private/cards', (req, res, next) => {
    cards.create(req, res);
});


//========== GET ==========
//Get cards with the cardNumber
//router.get('/api/private/cards', async (req, res, next) => {
//    comissionEVIO.get(req, res);
//});

//========== PATCH ==========
//Uses the card
router.patch('/api/private/cards/activate', async (req, res, next) => {
    cards.use(req, res);
});

router.post('/api/private/cards/runFirstTime', (req, res, next) => {
    cards.runFirstTime();
    
    return res.status(200).send();
});



module.exports = router;