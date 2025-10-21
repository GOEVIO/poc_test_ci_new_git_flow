const express = require('express');
const router = express.Router({mergeParams:true});
const add_updateTariff = require('./add_updateTariff');
const deleteTariff = require('./deleteTariff');

router.put('/', (req, res) => {
    add_updateTariff.put(req, res);
});

router.put('/:tariffId', (req, res) => {
    add_updateTariff.put(req, res);
});

router.put('/:country_code/:party_id/:tariffId', (req, res) => {
    add_updateTariff.put(req, res);
});

router.delete('/:country_code/:party_id/:tariff_id', (req, res) => {
    deleteTariff.delete(req, res);
});

module.exports = router;