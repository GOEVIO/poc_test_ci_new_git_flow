require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const FileHandler = require("../handlers/fileHandler");
const ErrorHandler = require("../handlers/errorHandler");


router.post('/api/private/controlcenter/fileHandlerNGNIX', async (req, res, next) => {
    var context = "POST /api/private/controlcenter/fileHandlerNGNIX";
    try {

        FileHandler.fileHandler(req, res)
            .then(result => {

                return res.status(200).send(result);

            })
            .catch(error => {

                console.error(`[${context}][History.addHistory] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res)

            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

router.post('/api/private/controlcenter/fileHandlerNGNIX/startJob', (req, res) => {
    return res.status(200).send(FileHandler.startTask())
});

router.post('/api/private/controlcenter/fileHandlerNGNIX/stopJob', (req, res) => {
    return res.status(200).send(FileHandler.stopTask())
});

router.post('/api/private/controlcenter/fileHandlerNGNIX/statusJob', (req, res) => {
    return res.status(200).send(FileHandler.statusTask())
});



module.exports = router;