const express = require('express');
const router = express.Router();
const statistics = require('./statistics')

router.get('/mySessions', (req, res) => {
    statistics.mySessions(req, res)
        .then(result => {

            return res.status(200).send(result);

        })
        .catch((e) => {
            return res.status(400).send(e);
        });

});

router.post('/runFirstTime', (req, res) => {
    try {
        statistics.changeDatesToISOString(req, res)
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});


module.exports = router;