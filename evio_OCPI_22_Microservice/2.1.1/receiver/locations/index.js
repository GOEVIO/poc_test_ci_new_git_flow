const express = require('express');
const router = express.Router({mergeParams:true});
var add_updateLocation = require('./add_updateLocation');
var updatePlugsStatus = require('./updatePlugStatus');


router.put('/', (req, res) => {
    add_updateLocation.put(req, res);
});

router.put('/:country_code/:party_id/:locationId', (req, res) => {
    add_updateLocation.put(req, res);
});

router.patch('/:country_code/:party_id/:locationId/:evse_uid', (req, res) => {
    updatePlugsStatus.patch(req, res);
});


module.exports = router;