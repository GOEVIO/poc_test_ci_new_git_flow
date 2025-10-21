
const express = require('express');
const router = express.Router();
var VersionsDetails = require('../../../models/evio_versions_details');
const Utils = require('../../../utils');
const Session = require('../../../models/sessions')
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
const global = require('../../../global');

var task = null;

function initJob(timer) {
    return new Promise((resolve, reject) => {
        console.log(timer);
        task = cron.schedule(timer, () => {
        
            checkSessionStatusTimeout();

        }, {
            scheduled: false
        });

        resolve();
    });
}

router.post('/startJob', (req, res) => {
    var timer = req.body.timer;

    initJob(timer).then(() => {
        task.start();
        console.log("CommandResult Started")
        return res.status(200).send('Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });
});

router.post('/stopJob', (req, res) => {
    task.stop();
    console.log("CommandResult Job Stopped")
    return res.status(200).send('Job Stopped');
});

//If session timeout change status to invalid = 60
const checkSessionStatusTimeout = (() => {


    let query = {
        status: "PENDING"
    };


    Session.find(query, (err, sessions) => {

        if (typeof sessions !== 'undefined' && sessions.length > 0) {
            for (let i = 0; i < sessions.length; i++) {

                let session = sessions[i];
                console.log(new Date().toISOString() + " - Found possible session to change status " + session._id);
                var startDate = session.start_date_time !== undefined && session.start_date_time !== null ? session.start_date_time : new Date(session.createdAt).toISOString();
                var timeout = session.responseTimeout;

                if (timeout === null || timeout === undefined) {
                    // default value for inexisting timeout
                    timeout = 70
                }
                var diffSeconds = Utils.diffDateSeconds(startDate);

                if (diffSeconds > timeout + timeout/2) {
                    console.log("Session " + session._id + " will be updated to INVALID status. Diff timeout: " + diffSeconds + " seconds");
                    updateSession(session._id, global.SessionStatusFailed, "TIMEOUT");
                    addChargerWrongBehavior({ hwId : session.location_id, source : session.source })
                    Utils.updatePreAuthorize(session.transactionId , true)
                }
                else{
                    console.log("Session " + session._id + ". Timeout not exceeded. ");
                }
            }
        }
        else {
            console.log("No sessions in pending status to check timeout");
        }
    });

});

function updateSession(sessionId, status, message) {
    let query = {
        _id: sessionId
    };

    console.log(query)

    let body = {
        status: status,
        displayText: { language: "EN", text: message }
    };
    Session.findOneAndUpdate(query, body, (err, session) => { });
}

function addChargerWrongBehavior(charger) {
    let chargerInfo = {
        hwId : charger.hwId,
        source : charger.source,
        wrongBehaviorStation : true
    }
    Utils.updateChargerInfo(chargerInfo)
}

module.exports = router;