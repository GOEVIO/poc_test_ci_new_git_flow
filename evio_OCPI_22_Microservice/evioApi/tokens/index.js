const express = require('express'); 
const router = express.Router();
const tokens = require('./tokens')



router.get('/', (req, res) => {
    tokens.get(req,res)
    .then(result => {

        return res.status(200).send(result);

    })
    .catch((e) => {
        return res.status(400).send(e);
    });
    
});

router.put('/send/multiple', (req, res) => {
    tokens.createMultipleToken(req).then(result => {

        return res.status(200).send(result);

    }).catch((e) => {
        return res.status(400).send(e);
    });
});

module.exports = router;