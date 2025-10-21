const express = require('express');
const router = express.Router({mergeParams:true});
var add_CRD = require('./add_CDR');

router.post('/', (req, res) => {
    add_CRD.post(req, res);
});



module.exports = router;