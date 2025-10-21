const express = require('express');
const router = express.Router({mergeParams:true});
const managementToken = require('./managementToken');

router.put('/:platformCode', (req, res) => {
    managementToken.createToken(req).then(result => {
        return res.status(200).send(result);
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.patch('/:platformCode', (req, res) => {
    managementToken.updateToken(req).then(result => {
        return res.status(200).send(result);
    }).catch((e) => {
        return res.status(400).send(e);
    });
});


router.get('/:platformCode', (req, res) => {
    managementToken.getToken(req).then(result => {
        return res.status(200).send(result);
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

module.exports = router;