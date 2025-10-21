const express = require('express');
const router = express.Router({mergeParams:true});
var get = require('./platformDetails');

router.get('/', (req, res) => {
    get.getPlatformDetails(req.query.endpoint , req.query.token).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
    });
});

module.exports = router;