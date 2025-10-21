const express = require('express');
const router = express.Router();
const tariffs = require('./tariffs')

router.post('/', (req, res) => {
    tariffs.add(req,res) 
});

router.get('/', (req, res) => {
    tariffs.get(req,res) 
});

module.exports = router;
