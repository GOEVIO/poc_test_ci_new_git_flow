const express = require('express');
const router = express.Router({mergeParams:true});
var exchangeTokens = require('./exchangeTokens');
var newOCPIVersion = require('./updateCredentials');
var deteleCredentials = require('./deteleCredentials');

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