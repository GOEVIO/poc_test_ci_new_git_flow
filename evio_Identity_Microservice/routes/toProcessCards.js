require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const cards = require('../handlers/toProcessCards');

//========== JOBS ==========
if (process.env.NODE_ENV === 'production') {
    cards.startProcessCardsJob()
    //cards.startWhiteListJob()
};

//========== POST ==========
router.post('/api/private/toProcessCards', (req, res, next) => {
    cards.createCards(req, res);
});

router.post('/api/private/toProcessCards/forceProcess', async (req, res, next) => {

    let cardsActivated = await cards.forceProcess();

    return res.status(200).send(cardsActivated);
});

router.post('/api/private/toProcessCards/forceWhiteList', async (req, res, next) => {
    return res.status(503).send();
});

//========== GET ==========
router.get('/api/private/toProcessCards', (req, res, next) => {
    cards.get(req, res);
});

router.get('/api/private/toProcessCards/getFailedOrInvalidCards', (req, res, next) => {
    cards.getFailedOrInvalidCards(req, res);
});

router.get('/api/private/toProcessCards/getFileCards', (req, res, next) => {
    cards.getFileCards(req, res);
});

router.get('/api/private/toProcessCards/getCardNumberCards', (req, res, next) => {
    cards.getCardNumberCards(req, res);
});

module.exports = router;
