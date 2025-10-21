const express = require('express');
const router = express.Router({mergeParams:true});
const versions = require('./platformVersions');

router.get('/', (req, res) => {
    versions.getPlatformVersionsByPlatformCode(req.query.platformCode).then(result => {
        return res.status(200).send(result);
    });
});

router.put('/', (req, res) => {
    versions.updateEvioEndpoint(req).then(result => {
        return res.status(200).send(result);
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.put('/credentials', (req, res) => {
    versions.updateEvioCredentials(req).then(result => {
        return res.status(200).send(result);
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.put('/delete', (req, res) => {
    versions.deleteEvioCredentials(req).then(result => {
        return res.status(200).send(result);
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

module.exports = router;