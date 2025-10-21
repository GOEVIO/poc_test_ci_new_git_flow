const express = require('express');
const router = express.Router({mergeParams:true});
var get = require('./get');

router.get('/', (req, res) => {
    get.handle(req, res);
});

module.exports = router;