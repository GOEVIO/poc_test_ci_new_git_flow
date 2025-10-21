
const express = require('express');
const router = express.Router();
const Utils = require('../../../utils');
const Session = require('../../../models/sessions')
const global = require('../../../global');
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');

//If session timeout change status to invalid = 60
const checkSessionStatusTimeout = (() => {
    const stageToLog = "[[JOB]CommandResult.checkSessionStatusTimeout OCPI 2.2]";
    const actionToLog = "start";

    const sessionToStartStatuses = [
        Enums.SessionStatusesTextTypes.PENDING_START, 
        Enums.SessionStatusesTextTypes.PENDING,
        Enums.SessionStatusesTextTypes.PENDING_DELAY
    ];
    
    let query = {
        status: { $in: sessionToStartStatuses }
    };

    const baseDataToSaveLog = {
        userId: '',
        hwId: '',
        plugId: '',
        sessionId: '',
        externalSessionId: '',
        stage: stageToLog,
        action: actionToLog,
        status: Enums.SessionFlowLogsStatus.ERROR,
        errorType: Enums.SessionFlowLogsErrorTypes.TIMEOUT_ERROR,
    }

    Session.find(query, (err, sessions) => {

        if (typeof sessions !== 'undefined' && sessions.length > 0) {
            for (let i = 0; i < sessions.length; i++) {

                let session = sessions[i];
                baseDataToSaveLog.sessionId = session._id;
                baseDataToSaveLog.externalSessionId = session?.id || '';
                baseDataToSaveLog.hwId = session.location_id;
                baseDataToSaveLog.userId = session.userId;
                baseDataToSaveLog.plugId = session.connector_id;
                baseDataToSaveLog.payload = session;
                console.log(new Date().toISOString() + " - Found possible session to change status " + session._id);
                const startDate = session.start_date_time !== undefined && session.start_date_time !== null ? session.start_date_time : new Date(session.createdAt).toISOString();
                let timeout = session.responseTimeout;

                if (timeout === null || timeout === undefined) {
                    // default value for inexisting timeout
                    timeout = 70
                }

                const diffSeconds = Utils.diffDateSeconds(startDate);

                if (diffSeconds > 60 * 3) {
                    console.error("Session " + session._id + " will be updated to INVALID status. Diff timeout: " + diffSeconds + " seconds");
                    updateSession(session._id, global.SessionStatusFailed, "TIMEOUT");
                    Utils.updatePreAuthorize(session.transactionId , true);
                    saveSessionLogs({
                        ...baseDataToSaveLog, 
                        errorMessage: "Session timeout exceeded. Status changed to INVALID.",
                    });
                }
                else{
                    console.log("Session " + session._id + ". Timeout not exceeded. ");
                }
            }
        }
        else {
            console.error("No sessions in pending status to check timeout");
        }
    });
});

function updateSession(sessionId, status, message) {
    let query = {
        _id: sessionId
    };

    let body = {
        status: status,
        displayText: { language: "EN", text: message }
    };
    Session.findOneAndUpdate(query, body, (err, session) => { });
}


router.post('/startJob', (req, res) => {
    try {
        checkSessionStatusTimeout();
        return res.status(200).send('Job Started');
    } catch (error) {
        console.error("Error in startJob:", error);
        return res.status(500).send('Internal Server Error');
    }
});

module.exports = router;