const express = require('express');
const router = express.Router({mergeParams:true});
const exchangeTokens = require('./exchangeTokens');
const newOCPIVersion = require('./updateCredentials');
const deteleCredentials = require('./deteleCredentials');

router.get('/', (req, res) => {
    //get.handle(req, res);
});

router.post('/', (req, res) => {
    exchangeTokens.post(req, res);
});

router.put('/', (req, res) => {
    newOCPIVersion.put(req, res);
});

router.delete('/', (req, res) => {
    deteleCredentials.delete(req, res);
});

module.exports = router;