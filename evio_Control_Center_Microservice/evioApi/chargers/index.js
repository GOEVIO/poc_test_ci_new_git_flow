const express = require('express');
const router = express.Router();
const chargers = require('./chargers')

router.patch('/operatorIdByHwId', (req, res) => {
    chargers.updateOperatorIdByHwId(req,res) 
});

router.patch('/operatorIdByInfrastructure', (req, res) => {
    chargers.updateOperatorIdInfrastructure(req,res) 
});

router.patch('/addNetworks', (req, res) => {
    chargers.addNetworks(req,res) 
});
module.exports = router;
