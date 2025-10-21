const express = require('express');
const router = express.Router({mergeParams:true});
const get = require('./platformDetails');

router.get('/', (req, res) => {
    get.getPlatformDetailsByPlatformCode(req, res);
});

module.exports = router;