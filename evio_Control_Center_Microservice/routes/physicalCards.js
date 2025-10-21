require("dotenv-safe").load(); 
const express = require('express');
const router = express.Router();
const physicalCards = require("../handlers/physicalCards");

//////////////////////////////////////////////////////////// 
///////////////   CARDS MANAGEMENT MODULE   /////////////////
////////////////////////////////////////////////////////////

router.get('/api/private/controlcenter/physicalCard/get', async (req, res, next) => {
    physicalCards.get(req, res);
});

router.post('/api/private/controlcenter/physicalCard/postToThirdParty', async (req, res, next) => {
    physicalCards.post(req, res);
});

router.put('/api/private/controlcenter/physicalCard/cancelCards', async (req, res, next) => {
    physicalCards.cancel(req, res);
});

router.put('/api/private/controlcenter/physicalCard/changeCard', async (req, res, next) => {
    physicalCards.changeCard(req, res);
});

module.exports = router;