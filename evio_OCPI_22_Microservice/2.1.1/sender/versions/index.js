const express = require('express');
const router = express.Router({mergeParams:true});
var versions = require('./platformVersions');

router.get('/', (req, res) => {
    versions.getPlatformVersions(req.query.endpoint , req.query.token).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/credentials', (req, res) => {
    versions.createEvioCredentials(req).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
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