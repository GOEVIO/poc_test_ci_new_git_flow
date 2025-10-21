var Platforms = require('../../../models/platforms');
const axios = require('axios');
var _ = require("underscore");
const Session = require('../../../models/sessions')
const global = require('../../../global');
const Utils = require('../../../utils');
var versions = require('../versions/platformVersions');
const { sendSessionToHistoryQueue } = require('../../../functions/sendSessionToHistoryQueue');
const { Enums } = require('evio-library-commons').default;
const { saveSessionLogs } = require('../../../functions/save-session-logs');

module.exports = {
    post: function (req, res) {
        const context = `2.1.1 [remoteStopSession.post] ${req?.method || ''} ${req?.originalUrl || ''}`;
        const stageToLog = '[RemoteStopSession 2.1.1] - Route [POST /api/private/2.1.1/ocpi/stop]';
        const actionToLog = 'stop';
        const logUserId = req?.headers['userid'] || '';

        return new Promise((resolve, reject) => {
            var sessionId = req.body.sessionId;
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

            //console.log(sessionId);


            let query = {
                id: sessionId,
                status: "ACTIVE"
            };

            let ocpiVersion = req?.params?.version ?? '2.1.1';

            
            Session.find(query, (err, session) => {
                // console.log("session to stop" , session)
                if (typeof session !== 'undefined' && session !== null && session.length > 0) {

                    const hwId = session[0].location_id
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
                        externalSessionId: sessionId
                    }


                    if (session[0].chargerType == process.env.HubjectCharger) {
                        // for Hubject chargers
                        Utils.sendStopHubject(session[0]).then(function (response) {
                            if (response.status) {
                              //  updateSession("STOP_SESSION", sessionId, global.SessionStatusToStop)
                              // for testing
                                console.log("STOPPED_SESSION", sessionId, global.SessionStatusToStop);
                                updateSession("STOP_SESSION", sessionId, global.SessionStatusToStop)
                                sendSessionToHistoryQueue(session[0]?._id, `${context} - Hubject`)
                                saveSessionLogs({
                                    ...baseDataToSaveLog,
                                    stage: `[RemoteStopSession 2.1.1][Hubject Network] - Remote Stop accepted`,
                                    status: Enums.SessionFlowLogsStatus.SUCCESS
                                })
                                return resolve({ auth: 'true', code: "", message: 'Remote Stop accepted', sessionId: session[0]._id })

                            } else {
                                saveSessionLogs({
                                    ...baseDataToSaveLog,
                                    errorMessage: `CommandResponse stop failed response.status ${response?.status || ''}`,
                                    stage: `[RemoteStopSession 2.1.1][Hubject Network] - sendStopHubject`,
                                    errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                                })
                                return reject({ auth: 'false', code: "server_error_remote_stop_failed", message: "CommandResponse stop failed!", sessionId: session[0]._id });
                            }

                        }).catch(function (e) {
                            console.log("[sendStopHubject] Error -", e);
                            saveSessionLogs({
                                ...baseDataToSaveLog,
                                errorMessage: `Error during sendStopHubject error ${e.message || ''}`,
                                stage: `[RemoteStopSession 2.1.1][Hubject Network] - sendStopHubject `,
                                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                            })
                            return reject({ auth: false, code: "send_Stop_Hubject_fail", message: "Charger Id " + hwId + " not found" });
                        });
                    } else {

                        // for Gireve chargers

                        var chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
                        axios.get(chargersEndpoint, {}, {}).then(function (response) {

                            if (typeof response.data !== 'undefined' && response.data !== '') {

                                var charger = response.data;
                                var platformCode = charger.network;
                                var authorization_reference = session[0].authorization_reference;

                                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                                    //get Mobie Details
                                    var platformDetails = platform.platformDetails;

                                    //Get Mobie Endpoint to 2.2 OCPI versions
                                    var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
                                    var platformEndpoints22 = platformDetails22[0].endpoints
                                    var platformCommandsEndpointObject = _.where(platformEndpoints22, { identifier: "commands" });

                                    if (platformCommandsEndpointObject === undefined || platformCommandsEndpointObject.length == 0) {
                                        saveSessionLogs({
                                            ...baseDataToSaveLog,
                                            errorMessage: `Error during check platform commands - Charger does not allow remote commands`,
                                            stage: `[RemoteStopSession 2.1.1] - check platform commands`
                                        }, true)
                                        reject({ auth: false, code: "server_charger_does_not_allow_remote_commands", message: 'Charger does not allow remote commands' });
                                        return;
                                    }

                                    var platformCommandsEndpoint = platformCommandsEndpointObject[0].url;

                                    var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                                    var platformToken = platformActiveCredentials[0].token;

                                    //Get platform Endpoint of commands SENDER
                                    var endpoint = platformCommandsEndpoint + '/STOP_SESSION';
                                    var response_url = platform.responseUrlSessionRemoteStart + '/STOP_SESSION/' + authorization_reference;

                                    console.log("response_url", response_url);

                                    var request = { response_url: response_url, session_id: sessionId, authorization_id: authorization_reference };
                                    
                                    callPlatformService(endpoint, platformToken, request).then((response) => {
                                        const stageCallPlatformService = `[RemoteStopSession 2.1.1] - Call Platform Service`;
                                        if (response) {

                                            if (response.status_code) {

                                                if ((Math.round(response.status_code / 1000)) == 1) {

                                                    console.log("CommandResponse received for session " + session[0]._id + " OR " + sessionId + ". Result: " + response.data.result);
                                                    if (response.data.result == "ACCEPTED") {
                                                        updateSession("STOP_SESSION", sessionId, global.SessionStatusToStop);
                                                        sendSessionToHistoryQueue(session[0]?._id, `${context}`)
                                                        saveSessionLogs({
                                                            ...baseDataToSaveLog,
                                                            stage: stageCallPlatformService,
                                                            status: Enums.SessionFlowLogsStatus.SUCCESS
                                                        })
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
                                                        reject({ auth: 'true', code: "server_error_remote_stop_failed", message: "CommandResponse stop failed!", sessionId: session._id });
                                                        return;
                                                    }
                                                }
                                                else {
                                                    addChargerWrongBehavior(charger)
                                                    console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
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
                                                console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
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
                                            console.log("Unable to use the client’s API Versions.", response);
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                stage: stageCallPlatformService,
                                                errorMessage: `Error during call Platform Service empty response`,
                                                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                            })
                                            reject({ auth: 'true', code: "server_error_remote_stop_failed", message: "Unable to use the client’s API Versions.", sessionId: session._id });
                                        }

                                    }).catch((e) => {
                                        const stageCallPlatformService = `[RemoteStopSession 2.1.1] - [Catch] Call Platform Service`;
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
                                                            })
                                                            resolve({ auth: 'true', code: "", message: 'Remote Stop accepted', sessionId: session[0]._id });
                                                            return;
                                                        }
                                                        else {
                                                            addChargerWrongBehavior(charger)
                                                            console.log("[RemoteStopSession] Error: ", e?.response?.data?.data?.message);
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
                                                        console.log('Error stoping session.. Unable to use the client’s API Versions.', e.response.data);
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
                                                    console.log('Error stoping session. Unable to use the client’s API Versions. Unable to retrieve status_code', e.response.data);
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
                                                console.log("Error stoping session ", e.message)
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
                                            console.log("Error stoping session ", e)
                                            saveSessionLogs({
                                                ...baseDataToSaveLog,
                                                errorMessage: `Error during call Platform Service: ${e.message || ''}`,
                                                stage: stageCallPlatformService,
                                                errorType: Enums.SessionFlowLogsErrorTypes.DEVICE_COMMUNICATION_ERROR
                                            })
                                            reject({ auth: false, code: "server_error_remote_stop_failed", message: 'Error stoping session. ' + e.message });
                                            return;
                                        }

                                        //TODO Handler failed como noutros sitios

                                        // console.log("Error stoping session ", e)

                                        // reject({ auth: false, code: "error_stoping_session", message: 'Error stoping session. ' + e?.response?.data?.data?.message });
                                        // return;


                                    });

                                }).catch((e) => {
                                    console.log("Error getting platform versions ", e);
                                    saveSessionLogs({
                                        ...baseDataToSaveLog,
                                        errorMessage: `Error getting platform versions: ${e.message || ''}`,
                                        errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                                        stage: "[RemoteStopSession 2.1.1] - Find getPlatformVersionsByPlatformCode"
                                    });
                                    reject({ auth: false, code: "server_error_remote_stop_failed", message: "Error getting platform versions" });
                                    return;
                                });
                            }
                            else {
                                saveSessionLogs({ 
                                    ...baseDataToSaveLog, 
                                    errorMessage: `Charger ${hwId} not found`, 
                                    stage: "[RemoteStopSession 2.1.1] - GET [/api/private/chargers]"
                                });
                                reject({ auth: false, code: "server_charger_id_not_found", message: "Charger Id " + hwId + " not found" });
                                return;
                            }

                        }).catch(function (e) {
                            console.log(e);
                            saveSessionLogs({ 
                                ...baseDataToSaveLog, 
                                errorMessage: `Error during get charger ${hwId} error: ${e.message || ''}`, 
                                errorType: Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR,
                                stage: "[RemoteStopSession 2.1.1] - GET [/api/private/chargers]"
                            });
                            reject({ auth: false, code: "server_charger_id_not_found", message: "Charger Id " + hwId + " not found" });
                            return;
                        });
                    }
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
        console.log(endpoint, body, { headers: { 'Authorization': `Token ${token}` } });
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

    // let body = {
    //     command: command,
    //     status: status,
    //     end_date_time: new Date().toISOString()
    // };

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
        hwId: charger.hwId,
        source: charger.source,
        wrongBehaviorStation: true
    }
    Utils.updateChargerInfo(chargerInfo)
}


