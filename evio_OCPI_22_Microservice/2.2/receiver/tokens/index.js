const express = require('express');
const router = express.Router({mergeParams:true});
const managementTokens = require('./managementTokens');

router.get('/', (req, res) => {
    managementTokens.getTokensList(req, res);
});

module.exports = router;