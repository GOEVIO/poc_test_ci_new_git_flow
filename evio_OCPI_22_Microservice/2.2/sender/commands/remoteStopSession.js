const axios = require('axios');
const _ = require("underscore");
const Session = require('../../../models/sessions')
const global = require('../../../global');
const Utils = require('../../../utils');
const versions = require('../versions/platformVersions');
const { sendSessionToHistoryQueue } = require('../../../functions/sendSessionToHistoryQueue');
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');

module.exports = {
    post: function (req, res) {
        const context = `[remoteStopSession.post] ${req?.method || ''} ${req?.originalUrl || ''}`;
        const stageToLog = '[RemoteStopSession 2.2] - Route [POST /api/private/2.2/ocpi/stop]';
        const actionToLog = 'stop';
        const logUserId = req?.headers['userid'] || '';
        return new Promise((resolve, reject) => {
            const sessionId = req.body.sessionId;
            if (!sessionId) {
                saveSessionLogs({
                    userId: logUserId,
                    hwId: '',
                    plugId: '',
                    stage: stageToLog,
                    action: actionToLog,
                    status: Enums.SessionFlowLogsStatus.ERROR,
                    errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                    errorMessage: 'Charging session ID required',
                })
                reject({ auth: false, code: "server_session_id_required", message: 'Charging session ID required' });
                return;
            }

            let query = {
                id: sessionId,
                status: "ACTIVE"
            };

            Session.find(query, (err, session) => {
                if (typeof session !== 'undefined' && session !== null && session.length > 0) {
                    const hwId = session[0].location_id;
                    const baseDataToSaveLog = {
                        userId: logUserId,
                        hwId,
                        plugId: session[0].connector_id || '',
                        stage: stageToLog,
                        action: actionToLog,
                        status: Enums.SessionFlowLogsStatus.ERROR,
                        payload: req.body,
                        errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                        sessionId: session[0]?._id,
                        externalSessionId: sessionId,
                    }

                    const chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
                    axios.get(chargersEndpoint, {}, {}).then(function (response) {

                        if (typeof response.data !== 'undefined' && response.data !== '') {
                            const charger = response.data;
                            const platformCode = charger.network;
                            const authorization_reference = session[0].authorization_reference;

                            versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                                //get Mobie Details
                                const platformDetails = platform.platformDetails;

                                //Get Mobie Endpoint to 2.2 OCPI versions
                                const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                                const platformEndpoints22 = platformDetails22[0].endpoints
                                const platformCommandsEndpointObject = _.where(platformEndpoints22, { identifier: "commands", role: "RECEIVER" });

                                if (platformCommandsEndpointObject === undefined || platformCommandsEndpointObject.length == 0) {
                                    saveSessionLogs({
                                        ...baseDataToSaveLog,
                                        errorMessage: `Error during check platform commands - Charger does not allow remote commands`,
                                        stage: `[RemoteStopSession 2.2] - check platform commands`
                                    }, true);
                                    reject({ auth: false, code: "server_charger_does_not_allow_remote_commands", message: 'Charger does not allow remote commands' });
                                    return;
                                }

                                const platformCommandsEndpoint = platformCommandsEndpointObject[0].url;

                                const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                                const mobieToken = platformActiveCredentials[0].token;

                                //Get platform Endpoint of commands SENDER
                                const endpoint = platformCommandsEndpoint + '/STOP_SESSION';
                                const response_url = platform.responseUrlSessionRemoteStart + '/STOP_SESSION/' + authorization_reference;

                                const request = { response_url: response_url, session_id: sessionId };
                                if(session[0].userId == '63cacbb5fae75f00130ab592') console.log("-------> request", request)
                                callPlatformService(endpoint, mobieToken, request).then((response) => {
                                    const stageCallPlatformService = `[RemoteStopSession 2.2] - Call Platform Service`;
                                    if (response) {

                                        if (response.status_code) {

                                            if ((Math.round(response.status_code / 1000)) == 1) {
                                                console.log("CommandResponse received for session " + session[0]._id + " OR " + sessionId + ". Result: " + response.data.result);
                                                if (response.data.result == "ACCEPTED") {
                                                    updateSession("STOP_SESSION", sessionId, global.SessionStatusToStop);
                                                    sendSessionToHistoryQueue(session[0]?._id, context)
                                                    saveSessionLogs({
                                                        ...baseDataToSaveLog,
                                                        stage: stageCallPlatformService,
                                                        status: Enums.SessionFlowLogsStatus.SUCCESS
                                                    }, true)
                                                    resolve({ auth: 'true', code: "", message: 'Remote Stop accepted', sessionId: session[0]._id });
                                                    return;
                                                }
                                                else {
                                                    addChargerWrongBehavior(charger)
                                                    saveSessionLogs({
                                                        ...baseDataToSaveLog,
                                                        stage: stageCallPlatformService,
                                                        errorMessage: `Error during call Platform Service device result: ${response.data.result}`,
                                                        errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                    })
                                                    reject({ auth: 'true', code: "server_error_remote_stop_failed", message: response.data.message, sessionId: session._id });
                                                    return;
                                                }
                                            }
                                            else {
                                                addChargerWrongBehavior(charger)
                                                console.error('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                                saveSessionLogs({
                                                    ...baseDataToSaveLog,
                                                    stage: stageCallPlatformService,
                                                    errorMessage: `Error during call Platform Service invalid response.status_code: ${response.status_code}`,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                });
                                                reject({ auth: 'true', code: "server_error_remote_stop_failed", message: "Unable to use the client’s API Versions. Status_code: " + response.status_code + ": Status_message: " + response.status_message, sessionId: session._id });
                                                return;
                                            }
                                        }
                                        else {
                                            addChargerWrongBehavior(charger)
                                            console.error('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                stage: stageCallPlatformService,
                                                errorMessage: `Error during call Platform Service invalid response.status_code: ${response.status_code}`,
                                                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                            })
                                            reject({ auth: 'true', code: "server_error_remote_stop_failed", message: "Unable to use the client’s API Versions. Unable to retrieve status_code", sessionId: session._id });
                                            return;
                                        }
                                    }
                                    else {
                                        addChargerWrongBehavior(charger)
                                        console.error("Unable to use the client’s API Versions.", response);
                                        saveSessionLogs({
                                            ...baseDataToSaveLog,
                                            stage: stageCallPlatformService,
                                            errorMessage: `Error during call Platform Service empty response`,
                                            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                        })
                                        reject({ auth: 'true', code: "server_error_remote_stop_failed", message: "Unable to use the client’s API Versions.", sessionId: session._id });
                                    }
                                }).catch((e) => {
                                    const stageCallPlatformService = `[RemoteStopSession 2.2] - [Catch] Call Platform Service`;
                                    if (e.response) {

                                        if (e.response.data) {

                                            if (e.response.data.status_code) {

                                                if ((Math.round(e.response.data.status_code / 1000)) == 1) {
                                                    if (e?.response?.data?.data?.result == "ACCEPTED") {

                                                        updateSession("STOP_SESSION", sessionId, global.SessionStatusToStop);
                                                        sendSessionToHistoryQueue(session[0]?._id, `Catch - ${context}`)
                                                        saveSessionLogs({
                                                            ...baseDataToSaveLog,
                                                            stage: stageCallPlatformService,
                                                            status: Enums.SessionFlowLogsStatus.SUCCESS
                                                        }, true)
                                                        resolve({ auth: 'true', code: "", message: 'Remote Stop accepted', sessionId: session[0]._id });
                                                        return;
                                                    }
                                                    else {
                                                        addChargerWrongBehavior(charger)
                                                        console.error("[RemoteStopSession] Error: ", e?.response?.data?.data?.message);
                                                        saveSessionLogs({
                                                            ...baseDataToSaveLog,
                                                            errorMessage: `Error during call Platform Service: ${JSON.stringify(e.response.data) || ''}`,
                                                            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
                                                            stage: stageCallPlatformService,
                                                        })
                                                        reject({ auth: 'true', code: "server_error_remote_stop_failed", message: e?.response?.data?.data?.message, sessionId: session._id });
                                                        return;
                                                    }
                                                }
                                                else {
                                                    console.error('Error stoping session.. Unable to use the client’s API Versions.', e.response.data);
                                                    addChargerWrongBehavior(charger)
                                                    saveSessionLogs({
                                                        ...baseDataToSaveLog,
                                                        errorMessage: `Error during call Platform Service: ${JSON.stringify(e.response.data) || ''}`,
                                                        errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR,
                                                        stage: stageCallPlatformService,
                                                    })
                                                    reject({ auth: 'true', code: "server_error_remote_stop_failed", message: e?.response?.data?.data?.message, sessionId: session._id });
                                                    return;
                                                }
                                            }
                                            else {
                                                addChargerWrongBehavior(charger)
                                                console.error('Error stoping session. Unable to use the client’s API Versions. Unable to retrieve status_code', e.response.data);
                                                saveSessionLogs({
                                                    ...baseDataToSaveLog,
                                                    errorMessage: `Error during call Platform Service: ${JSON.stringify(e.response.data) || ''}`,
                                                    stage: stageCallPlatformService,
                                                    errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                                })
                                                reject({ auth: 'true', code: "server_error_remote_stop_failed", message: "Unable to use the client’s API Versions. Status_code: " + e.response.data.status_code + ": Status_message: " + e.response.data.status_message, sessionId: session._id });
                                                return;
                                            }
                                        }
                                        else {
                                            addChargerWrongBehavior(charger)
                                            console.error("Error stoping session ", e.message)
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                errorMessage: `Error during call Platform Service: ${JSON.stringify(e.response.data) || ''}`,
                                                stage: stageCallPlatformService,
                                                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                            })
                                            reject({ auth: false, code: "server_error_remote_stop_failed", message: 'Error stoping session. ' + e.message });
                                            return;
                                        }
                                    }
                                    else {
                                        addChargerWrongBehavior(charger)
                                        console.error("Error stoping session ", e)
                                        saveSessionLogs({
                                            ...baseDataToSaveLog,
                                            errorMessage: `Error during call Platform Service: ${e.message || ''}`,
                                            stage: stageCallPlatformService,
                                            errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                        })
                                        reject({ auth: false, code: "server_error_remote_stop_failed", message: 'Error stoping session. ' + e.message });
                                        return;
                                    }
                                });

                            }).catch((e) => {
                                console.log("Error getting platform versions ", e);
                                saveSessionLogs({
                                    ...baseDataToSaveLog,
                                    errorMessage: `Error getting platform versions: ${e.message || ''}`,
                                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                                    stage: "[RemoteStopSession 2.2] - Find getPlatformVersionsByPlatformCode"
                                });
                                reject({ auth: false, code: "server_error_remote_stop_failed", message: "Error getting platform versions" });
                                return;
                            });
                        }
                        else {
                            saveSessionLogs({ 
                                ...baseDataToSaveLog, 
                                errorMessage: `Charger ${hwId} not found`, 
                                stage: "[RemoteStopSession 2.2] - GET [/api/private/chargers]"
                            });
                            reject({ auth: false, code: "server_charger_id_not_found", message: "Charger Id " + hwId + " not found" });
                            return;
                        }

                    }).catch(function (e) {
                        console.error(e);
                        saveSessionLogs({ 
                            ...baseDataToSaveLog, 
                            errorMessage: `Error during get charger ${hwId} error: ${e.message || ''}`, 
                            errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                            stage: "[RemoteStopSession 2.2] - GET [/api/private/chargers]"
                        });
                        reject({ auth: false, code: "server_charger_id_not_found", message: "Charger Id " + hwId + " not found" });
                        return;
                    });
                }
                else {
                    saveSessionLogs({
                        userId: logUserId,
                        hwId: '',
                        plugId: '',
                        stage: stageToLog,
                        action: actionToLog,
                        status: Enums.SessionFlowLogsStatus.ERROR,
                        errorType: Enums.SessionFlowLogsErrorTypes.VALIDATION_ERROR,
                        errorMessage: 'Session not found for query: ' + JSON.stringify(query),
                        externalSessionId: sessionId
                    })
                    reject({ auth: false, code: "server_session_not_found", message: 'Session not found!' });
                    return;
                }
            });
        });
    }
}

function callPlatformService(endpoint, token, body) {
    console.log(endpoint)
    return new Promise((resolve, reject) => {
        axios.post(endpoint, body, { headers: { 'Authorization': `Token ${token}` } }).then(function (response) {

            if (typeof response.data !== 'undefined') {
                resolve(response.data);
            }
            else
                resolve(false);

        }).catch(function (error) {
            reject(error);
        });
    });
};

function updateSession(command, sessionId, status) {
    let query = {
        id: sessionId,
        status: {$nin: [global.SessionStatusStopped, global.SessionStatusSuspended]}
    };

    let body = {
        command: command,
        status: status
    };

    console.log(query);
    console.log(body);
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


