const express = require('express');
const router = express.Router({mergeParams:true});
var add_CRD = require('./add_CDR');
const cdrController = require('./controllers/cdrController');

router.post('/', (req, res) => {
    add_CRD.post(req, res);
});

router.get('/:cdrId', cdrController.getCdrById);

module.exports = router;