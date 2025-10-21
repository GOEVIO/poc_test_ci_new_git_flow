const express = require('express');
const router = express.Router({mergeParams:true});
var add_updateTariff = require('./add_updateTariff');

router.put('/', (req, res) => {
    add_updateTariff.put(req, res);
});


router.put('/:tariffId', (req, res) => {
    add_updateTariff.put(req, res);
});

router.put('/:country_code/:party_id/:tariffId', (req, res) => {
    add_updateTariff.put(req, res);
});

module.exports = router;