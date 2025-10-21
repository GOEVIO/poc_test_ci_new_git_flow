var Platforms = require('../../../models/platforms');
const axios = require('axios');
var _ = require("underscore");
const Platform = require('../../../models/platforms');
const global = require('../../../global');
const Utils = require('../../../utils');
var versions = require('../versions/platformVersions');
const Session = require('../../../models/sessions')

module.exports = {
    post: function (req, res) {
        return new Promise((resolve, reject) => {

            var sessionId = req.body.sessionId;
            if (!sessionId) {
                reject({ auth: false, code: "server_session_id_required", message: 'Session ID required' });
                return;
            }

            var hwId = req.body.hwId;
            if (!hwId) {
                reject({ auth: false, code: "server_hw_id_required", message: 'Hw ID required' });
                return;
            }

            var evseId = req.body.evseId;
            if (!evseId) {
                reject({ auth: false, code: "server_evse_id_required", message: 'EVSE ID required' });
                return;
            }

            var connectorId = req.body.connectorId;
            if (!connectorId) {
                reject({ auth: false, code: "server_connector_id_required", message: 'Connector ID required' });
                return;
            }

            let query = {
                id: sessionId
            };

            var platformCode = req.body.platformCode;

            let ocpiVersion = req.params.version

            Session.find(query, (err, session) => {

                if (typeof session !== 'undefined' && session !== null && session.length > 0) {

                    var authorization_reference = session[0].authorization_reference;

                    versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                        //get Mobie Details
                        var platformDetails = platform.platformDetails;

                        //Get Mobie Endpoint to 2.2 OCPI versions
                        var platformDetails22 = _.where(platformDetails, { version: ocpiVersion });
                        var platformEndpoints22 = platformDetails22[0].endpoints
                        var platformCommandsEndpointObject = _.where(platformEndpoints22, { identifier: "commands", role: "RECEIVER" });

                        if (platformCommandsEndpointObject === undefined || platformCommandsEndpointObject.length == 0) {
                            reject({ auth: false, code: "server_charger_does_not_allow_remote_commands", message: 'Charger does not allow remote commands' });
                            return;
                        }

                        var platformCommandsEndpoint = platformCommandsEndpointObject[0].url;

                        var platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: ocpiVersion })
                        var mobieToken = platformActiveCredentials[0].token;

                        //Get platform Endpoint of commands SENDER
                        var endpoint = platformCommandsEndpoint + '/UNLOCK_CONNECTOR';
                        var response_url = platform.responseUrlSessionRemoteStart + '/UNLOCK_CONNECTOR/' + authorization_reference;

                        console.log("response_url", response_url);

                        var request = { response_url: response_url, location_id: hwId, evse_uid: evseId, connector_id: connectorId };

                        callPlatformService(endpoint, mobieToken, request).then((response) => {

                            if (response) {

                                if (response.status_code) {

                                    if ((Math.round(response.status_code / 1000)) == 1) {

                                        console.log("CommandResponse received for session " + session._id + ". Result: " + response.data.result);
                                        if (response.data.result == "ACCEPTED") {
                                            updateSession("UNLOCK_CONNECTOR", sessionId);
                                            resolve({ auth: 'true', code: "", message: 'Unlock Connector accepted', sessionId: session._id });
                                            return;
                                        }
                                        else {

                                            reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: response.data.message, sessionId: session._id });
                                            return;
                                        }
                                    }
                                    else {

                                        console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                        reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions. Status_code: " + response.status_code + ": Status_message: " + response.status_message, sessionId: session._id });
                                        return;
                                    }

                                }
                                else {

                                    console.log('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                    reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions. Unable to retrieve status_code", sessionId: session._id });
                                    return;
                                }
                            }
                            else {

                                console.log("Unable to use the client’s API Versions.", response);
                                reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions.", sessionId: session._id });
                            }

                        }).catch((e) => {

                            console.log("Error unlock connector ", e)

                            reject({ auth: false, code: "server_error_unlock_connector_failed", message: 'Error unlock connector. ' + e.message });
                            return;
                        });

                    });

                }
                else {
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

function updateSession(command, sessionId) {
    let query = {
        id: sessionId
    };

    let body = {
        command: command
    };

    Session.findOneAndUpdate(query, body, (err, session) => { });
}


