const express = require('express');
const router = express.Router({mergeParams:true});
const managementCDRs = require('./getCDRs');

router.get('/:platformCode', (req, res) => {
    managementCDRs.getCDRs(req).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.get('/', (req, res) => {
    managementCDRs.getCDRs(req).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
    });
});

module.exports = router;