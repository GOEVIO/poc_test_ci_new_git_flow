var VersionsDetails = require('../../../models/evio_versions_details');
const Utils = require('../../../utils');
const UtilsFirebase = require('../../../utils_firebase')
const Session = require('../../../models/sessions')
const global = require('../../../global');
const { sendSessionToHistoryQueue } = require('../../../functions/sendSessionToHistoryQueue');
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');

module.exports = {
    startSession: function (req, res) {

        //Get Token, sent previously to partner
        var token = req.headers.authorization.split(' ')[1];

        //Validate if sent data is valid JSON to process
        var data = req.body;

        if (Utils.isEmptyObject(data))
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        console.log(data);

        var sessionId = data.id;
        if (!sessionId)
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));


        try {

            let query = {
                id: sessionId
            };

            Session.updateSession(query, { $set: data }, (err, doc) => {
                if (doc != null) {
                    console.log("Updated Session " + sessionId);
                    return res.status(200).send(Utils.response(null, 1000, "Updated Session " + sessionId + ""));
                } else {
                    const new_session = new Session(data);
                    Session.create(new_session, (err, result) => {
                        if (result) {
                            return res.status(200).send(Utils.response(null, 1000, "Created Session " + sessionId + ""));
                        } else {
                            console.log("Session not created ", err);
                            return res.status(200).send(Utils.response(null, 2000, "Generic client error "));
                        }
                    })
                }
            });

        }
        catch (e) {
            console.log("[handlerCommandResult.startSession] Generic client error. ", e);
            return res.status(200).send(Utils.response(null, 2000, "Generic client error"));
        }



    },
    commandResultStartSession: function (req, res) {
        const stageToLog = "[HandlerCommandResult.commandResultStartSession OCPI 2.1.1]";
        const actionToLog = "start";
        var data = req.body;

        if (Utils.isEmptyObject(data)){
            saveSessionLogs({
                userId: '',
                hwId: '',
                plugId: '',
                stage: stageToLog,
                action: actionToLog,
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                errorMessage: 'Empty request body - Invalid or missing parameters',
            })
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
        }
        var authorization_reference = req.params.authorization_reference;
        if (!authorization_reference) {
            saveSessionLogs({
                userId: '',
                hwId: '',
                plugId: '',
                stage: stageToLog,
                action: actionToLog,
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.AUTHENTICATION_ERROR,
                errorMessage: 'Not Found authorization_reference - Invalid URL',
            })
            return res.status(200).send(Utils.response(null, 2000, "Invalid URL"));
        }

        console.log("CommandResult received " + authorization_reference);
        console.log(data);

        var result = data.result;
        var message = "";
        if (data.message) {
            if (data.message.length > 0 )
                if (data.message[0].text)
                    message = data.message[0].text;
        }


        let query = {
            authorization_reference: authorization_reference
        };

        Session.find(query, (err, session) => {
            console.log(session);

            if (typeof session !== 'undefined' && session !== null && session.length > 0) {
                const baseDataToSaveLog = {
                    userId: session[0].userId,
                    hwId: session[0].location_id,
                    plugId: session[0].connector_id,
                    sessionId: session[0]._id,
                    externalSessionId: session[0]?.id || '',
                    stage: stageToLog,
                    action: actionToLog,
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    payload: req.body,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                }

                if (result == "ACCEPTED") {

                    /*
                        OCPI documentation actually doesn't imply that a session is or will be active if the result 
                        of commandResult is ACCEPTED, so, we won't update the session status for now.
                    */

                    console.log("Session Remote Start Command Result " + authorization_reference + " ACTIVE ");
                    updateSessionCommandStart(authorization_reference, message, result, "");
                    saveSessionLogs({
                        ...baseDataToSaveLog,
                        status: Enums.SessionFlowLogsStatus.SUCCESS
                    }, true)

                    // UtilsFirebase.startFirebaseNotification(session);

                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }
                else {
                    console.log("Session Remote Start Command Result " + authorization_reference + " INVALID ");

                    //Experiencia 08/04/2021
                    if (session[0].status == "PENDING") {
                        updateSession(authorization_reference, "INVALID", message, result, "");
                    }
                    Utils.updatePreAuthorize(session[0]?.transactionId , true);
                    baseDataToSaveLog.errorType = result == "TIMEOUT" ? Enums.SessionFlowLogsErrorTypes.TIMEOUT_ERROR : Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR;
                    saveSessionLogs({
                        ...baseDataToSaveLog,
                        errorMessage: `Session Remote Start Command Result ${authorization_reference} INVALID - message: ${message} - result: ${result}`
                    })

                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }
            }
            else {
                saveSessionLogs({
                    userId: '',
                    hwId: '',
                    plugId: '',
                    stage: stageToLog,
                    action: actionToLog,
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                    externalSessionId: authorization_reference,
                    errorMessage: `Not found session - Invalid or missing parameters: ${authorization_reference} - message: ${message}`,
                })
                return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

            }
        });


    },
    commandResultStopSession: function (req, res) {
        const context = '2.1.1 commandResultStopSession'
        const stageToLog = "[HandlerCommandResult.commandResultStartSession OCPI 2.1.1]";
        const actionToLog = "stop";
        var data = req.body;

        if (Utils.isEmptyObject(data)){
            saveSessionLogs({
                userId: '',
                hwId: '',
                plugId: '',
                stage: stageToLog,
                action: actionToLog,
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                errorMessage: 'Empty request body - Invalid or missing parameters',
            })
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));
        }
        var authorization_reference = req.params.authorization_reference;
        if (!authorization_reference) {
            saveSessionLogs({
                userId: '',
                hwId: '',
                plugId: '',
                stage: stageToLog,
                action: actionToLog,
                status: Enums.SessionFlowLogsStatus.ERROR,
                errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                errorMessage: 'Not Found authorization_reference - Invalid URL',
                payload: req.body,
            })
            return res.status(200).send(Utils.response(null, 2000, "Invalid URL"));
        }

        console.log("CommandResult received " + authorization_reference);

        var result = data.result;
        var message = "";
        if (data.message) {
            if (data.message.length > 0 )
                if (data.message[0].text)
                    message = data.message[0].text;
        }


        let query = {
            authorization_reference: authorization_reference
        };

        Session.find(query, (err, session) => {

            if (typeof session !== 'undefined' && session !== null && session.length > 0) {
                const baseDataToSaveLog = {
                    userId: session[0].userId,
                    hwId: session[0].location_id,
                    plugId: session[0].connector_id,
                    sessionId: session[0]._id,
                    externalSessionId: session[0]?.id || '',
                    stage: stageToLog,
                    action: actionToLog,
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    payload: req.body,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                }
                if (result == "ACCEPTED") {
                    console.log("Session Remote Stop Command Result " + authorization_reference + " ACCEPTED ");
                    updateSession(authorization_reference, "COMPLETED", message, "", result);
                    sendSessionToHistoryQueue(session?._id, context)
                    UtilsFirebase.stopFirebaseNotification(session);
                    saveSessionLogs({
                        ...baseDataToSaveLog,
                        status: Enums.SessionFlowLogsStatus.SUCCESS
                    }, true)

                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }
                else {
                    saveSessionLogs({ 
                        ...baseDataToSaveLog, 
                        errorMessage: "Command result " + result + ". Nothing to do in authorization_reference " + authorization_reference + " - message: " + message
                    })

                    console.log("Command result " + result + ". Nothing to do in authorization_reference " + authorization_reference);
                    return res.status(200).send(Utils.response(null, 1000, "Success"));
                }
            }
            else {
                saveSessionLogs({
                    userId: '',
                    hwId: '',
                    plugId: '',
                    stage: stageToLog,
                    action: actionToLog,
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                    externalSessionId: authorization_reference,
                    errorMessage: `Not found session - Invalid or missing parameters: ${authorization_reference} - message: ${message}`,
                    payload: req.body,
                })
                return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

            }
        });


    },
    commandResultUnlockConnector: function (req, res) {

        var data = req.body;
        console.log(data);

        var authorization_reference = req.params.authorization_reference;
        if (!authorization_reference) {
            return res.status(200).send(Utils.response(null, 2000, "Invalid URL"));
        }

        console.log("CommandResult received " + authorization_reference);

        var result = data.result;
        var message = data.message;

        let query = {
            authorization_reference: authorization_reference
        };

        return res.status(200).send(Utils.response(null, 1000, "Success"));

    }
}


function updateSession(authorization_reference, status, message, commandResultStart, commandResultStop) {
    let query = {
        authorization_reference: authorization_reference,
        status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]}
    };

    //console.log(query);

    let body = {
        status: status,
        displayText: { language: "EN", text: message },
        commandResultStart: commandResultStart,
        commandResultStop: commandResultStop,
        end_date_time: new Date().toISOString()
    };
    //console.log(body);
    Session.findOneAndUpdate(query, body, {new: true} , (err, session) => {
        if (err) {
            console.log("updateSession in stop transaction function error: ", err);
        }
        else {
            if (session) {
                Utils.updateSessionStopMeterValuesRoaming(session);
            }
        }
    });
}

function updateSessionCommandStart(authorization_reference, message, commandResultStart, commandResultStop) {
    let query = {
        authorization_reference: authorization_reference,
        status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]}
    };

    //console.log(query);

    let body = {
        // status: status,
        displayText: { language: "EN", text: message },
        commandResultStart: commandResultStart,
        commandResultStop: commandResultStop,
        end_date_time: new Date().toISOString()
    };
    //console.log(body);
    Session.findOneAndUpdate(query, body,{new: true} , (err, session) => {
        if (err) {
            console.log("updateSession in stop transaction function error: ", err);
        }
        else {
            if (session) {
                Utils.updateSessionStopMeterValuesRoaming(session);
            }
        }
    });
}
