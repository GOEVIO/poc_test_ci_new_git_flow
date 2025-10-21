const express = require('express');
const router = express.Router();
const {createOrUpdateChargerPreAuthorization, getChargerPreAuthorization} = require('../controllers/charger-preauthorization-values.controller');

router.put('/api/private/configs/charger-preauthorization', createOrUpdateChargerPreAuthorization);

router.get('/api/private/configs/charger-preauthorization/:hwId', getChargerPreAuthorization);

module.exports = router;