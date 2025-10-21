const express = require('express');
const router = express.Router({mergeParams:true});
var managementTokens = require('./managementTokens');

router.get('/', (req, res) => {
    managementTokens.getTokensList(req, res);
});


router.post('/:token_uid/authorize', (req, res) => {
    managementTokens.realTimeAuthorization(req, res);
});


module.exports = router;