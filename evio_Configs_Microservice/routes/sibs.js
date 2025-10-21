const express = require('express'); 
const router = express.Router();
const ErrorHandler = require('../controllers/errorHandler');
const SIBS = require('../controllers/sibs');
var task = null;
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};

//========== GET ==========
//Retrives the lateste sibs files
router.get('/api/private/config/sibs/files', (req, res, next) => {
    var context = "POST /api/private/config/sibs/files";
    SIBS.getDirectoryFiles()
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][ SIBS.getDirectoryFiles] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== POST ==========
//Register the latest card numbers
router.post('/api/private/config/sibs', (req, res, next) => {
    var context = "POST /api/private/config/sibs";
    SIBS.getSIBSFiles()
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][ SIBS.getSIBSFiles] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Create a file to SIBS with the cards
router.post('/api/private/config/sibs/createFile', async (req, res, next) => {
    var context = "POST /api/private/config/sibs/createFile";
    try {

        let cardsInformation = req.body.cards;

        let result = await SIBS.putSIBSCards(cardsInformation)

        return res.status(200).send(result);
    }
    catch (error) {
        console.error(`[${context}][ SIBS.putSIBSCards] Error `, error);
        return res.status(500).send(error.message);
    }
});

console.log("process.env.NODE_ENV", process.env.NODE_ENV)
if (process.env.NODE_ENV === 'production') {
    console.log("production")
    startJob();
};

function initJob() {
    return new Promise((resolve, reject) => {

        console.log("SIBS Documents Job Init");
        var timer = "*/30 * * * *"; // Everyday 30 minutes

        task = cron.schedule(timer, () => {
            console.log('SIBS Documents Job ' + new Date().toISOString());

            SIBS.getSIBSFiles();
        }, {
            scheduled: false
        });

        resolve();

    });
};

function startJob() {
    initJob().then(() => {
        task.start();
        console.log("SIBS Documents Job Started")

    }).catch((e) => {
        console.log("Error starting SIBS Documents Job")
    });
}

router.post('/api/private/config/sibs/startJob', (req, res) => {
    initJob().then(() => {
        task.start();
        console.log("SIBS Documents Job Started")
        return res.status(200).send('SIBS Documents Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/api/private/config/sibs/stopJob', (req, res) => {
    task.stop();
    console.log("SIBS Documents Job Stopped")
    return res.status(200).send('SIBS Documents Job Stopped');
});

router.post('/api/private/config/sibs/statusJob', (req, res) => {
    var status = "Stopped";


    if (task != undefined) {
        status = task.getStatus();
    }

    return res.status(200).send({ "SIBS Documents Job Status": status });
});

module.exports = router;