const axios = require('axios');
const _ = require("underscore");
const Platform = require('../../../models/platforms');
const global = require('../../../global');
const Utils = require('../../../utils');
const versions = require('../versions/platformVersions');
const Session = require('../../../models/sessions')

module.exports = {
    post: function (req, res) {
        return new Promise((resolve, reject) => {

            let userId = req.headers['userid']

            const hwId = req.body.hwId;
            if (!hwId) {
                reject({ auth: false, code: "server_hw_id_required", message: 'Hw ID required' });
                return;
            }

            const plugId = req.body.plugId;
            if (!plugId) {
                reject({ auth: false, code: "server_connector_id_required", message: 'Connector ID required' });
                return;
            }

            let query = {
                location_id: hwId,
                connector_id : plugId,
                status : global.SessionStatusRunning
            };

            const platformCode = global.mobiePlatformCode;

            Session.findOne(query, (err, session) => {
                if (session) {
                    if (session.userId === userId) {
                        const chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
                        axios.get(chargersEndpoint, {}, {}).then(async function (response) {

                            if (typeof response.data !== 'undefined' && response.data !== '') {

                                const charger = response.data;
                                const plugs = charger.plugs;

                                const plug = _.where(plugs, { plugId: plugId });
                                if (typeof plug !== 'undefined' && plug.length > 0) {
                                    const evse_uid = plug[0].uid;

                                    const authorization_reference = session.authorization_reference;

                                    versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                                        //get Mobie Details
                                        const platformDetails = platform.platformDetails;

                                        //Get Mobie Endpoint to 2.2 OCPI versions
                                        const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                                        const platformEndpoints22 = platformDetails22[0].endpoints
                                        const platformCommandsEndpointObject = _.where(platformEndpoints22, { identifier: "commands", role: "RECEIVER" });

                                        if (platformCommandsEndpointObject === undefined || platformCommandsEndpointObject.length == 0) {
                                            reject({ auth: false, code: "server_charger_does_not_allow_remote_commands", message: 'Charger does not allow remote commands' });
                                            return;
                                        }

                                        const platformCommandsEndpoint = platformCommandsEndpointObject[0].url;

                                        const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                                        const mobieToken = platformActiveCredentials[0].token;

                                        //Get platform Endpoint of commands SENDER
                                        const endpoint = platformCommandsEndpoint + '/UNLOCK_CONNECTOR';
                                        const response_url = platform.responseUrlSessionRemoteStart + '/UNLOCK_CONNECTOR/' + authorization_reference;

                                        console.log("response_url", response_url);

                                        const request = { response_url: response_url, location_id: hwId, evse_uid: evse_uid, connector_id: plugId };

                                        callPlatformService(endpoint, mobieToken, request).then((response) => {

                                            if (response) {

                                                if (response.status_code) {

                                                    if ((Math.round(response.status_code / 1000)) == 1) {

                                                        console.log("CommandResponse received for session " + session._id + ". Result: " + response.data.result);
                                                        if (response.data.result == "ACCEPTED") {
                                                            updateSession("UNLOCK_CONNECTOR", session._id);
                                                            resolve({ auth: 'true', code: "", message: 'Unlock Connector accepted', sessionId: session._id });
                                                            return;
                                                        }
                                                        else {
                                                            reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: response.data.message, sessionId: session._id });
                                                            return;
                                                        }
                                                    }
                                                    else {
                                                        console.error('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                                        reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions. Status_code: " + response.status_code + ": Status_message: " + response.status_message, sessionId: session._id });
                                                        return;
                                                    }
                                                }
                                                else {
                                                    console.error('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                                    reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions. Unable to retrieve status_code", sessionId: session._id });
                                                    return;
                                                }
                                            }
                                            else {
                                                console.error("Unable to use the client’s API Versions.", JSON.stringify(response));
                                                reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions.", sessionId: session._id });
                                            }

                                        }).catch((e) => {
                                            console.error("Error unlock connector ", JSON.stringify(e?.response.data))
                                            reject({ auth: false, code: "server_error_unlock_connector_failed", message: 'Error unlock connector. ' + e.message });
                                            return;
                                        });

                                    });
                                } else {
                                    reject({ auth: false, code : "server_plug_id_not_found",  message:"Plug Id " + plugId + " not found"})
                                    return;
                                }
                            } else {
                                reject({ auth: false, code : "server_charger_id_not_found",  message: "Charger Id " + hwId + " not found"})
                                return;
                            }
                        })
                    } else {
                        reject({ auth: false, code: "server_session_not_found", message: 'Session not found!' });
                        return;  
                    }
                } else {
                    const chargersEndpoint = global.publicNetworkChargersProxy + "/" + hwId;
                    axios.get(chargersEndpoint, {}, {}).then(async function (response) {

                        if (typeof response.data !== 'undefined' && response.data !== '') {

                            const charger = response.data;
                            const plugs = charger.plugs;

                            const plug = _.where(plugs, { plugId: plugId });
                            if (typeof plug !== 'undefined' && plug.length > 0) {
                                const evse_uid = plug[0].uid;

                                const authorization_reference = Utils.generateToken(24);

                                versions.getPlatformVersionsByPlatformCode(platformCode).then(platform => {

                                    //get Mobie Details
                                    const platformDetails = platform.platformDetails;

                                    //Get Mobie Endpoint to 2.2 OCPI versions
                                    const platformDetails22 = _.where(platformDetails, { version: "2.2" });
                                    const platformEndpoints22 = platformDetails22[0].endpoints
                                    
                                    const platformCommandsEndpointObject = _.where(platformEndpoints22, { identifier: "commands", role: "RECEIVER" });
                                    if (platformCommandsEndpointObject === undefined || platformCommandsEndpointObject.length == 0) {
                                        reject({ auth: false, code: "server_charger_does_not_allow_remote_commands", message: 'Charger does not allow remote commands' });
                                        return;
                                    }

                                    const platformCommandsEndpoint = platformCommandsEndpointObject[0].url;

                                    const platformActiveCredentials = _.where(platform.platformActiveCredentialsToken, { version: "2.2" })
                                    const mobieToken = platformActiveCredentials[0].token;

                                    //Get platform Endpoint of commands SENDER
                                    const endpoint = platformCommandsEndpoint + '/UNLOCK_CONNECTOR';
                                    const response_url = platform.responseUrlSessionRemoteStart + '/UNLOCK_CONNECTOR/' + authorization_reference;

                                    console.log("response_url", response_url);

                                    const request = { response_url: response_url, location_id: hwId, evse_uid: evse_uid, connector_id: plugId };

                                    callPlatformService(endpoint, mobieToken, request).then((response) => {
                                        if (response) {
                                            if (response.status_code) {
                                                if ((Math.round(response.status_code / 1000)) == 1) {
                                                    console.log("CommandResponse received for session " + ". Result: " + response.data.result);
                                                    if (response.data.result == "ACCEPTED") {
                                                        // updateSession("UNLOCK_CONNECTOR", session._id);
                                                        resolve({ auth: 'true', code: "", message: 'Unlock Connector accepted'});
                                                        return;
                                                    }
                                                    else {
                                                        reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: response.data.message[0].text});
                                                        return;
                                                    }
                                                }
                                                else {
                                                    console.error('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                                    reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions. Status_code: " + response.status_code + ": Status_message: " + response.status_message});
                                                    return;
                                                }
                                            }
                                            else {
                                                console.error('Unable to use the client’s API Versions. Unable to retrieve status_code', response);
                                                reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions. Unable to retrieve status_code"});
                                                return;
                                            }
                                        }
                                        else {
                                            console.error("Unable to use the client’s API Versions.", response);
                                            reject({ auth: 'true', code: "server_error_unlock_connector_failed", message: "Unable to use the client’s API Versions."});
                                        }
                                    }).catch((e) => {
                                        console.error("Error unlock connector ", e)
                                        reject({ auth: false, code: "server_error_unlock_connector_failed", message: 'Error unlock connector. ' + e.message });
                                        return;
                                    });
                                });
                            } else {
                                reject({ auth: false, code : "server_plug_id_not_found",  message:"Plug Id " + plugId + " not found"})
                                return;
                            }
                        } else {
                            reject({ auth: false, code : "server_charger_id_not_found",  message: "Charger Id " + hwId + " not found"})
                            return;
                        }
                    })
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

function updateSession(command, sessionId) {
    let query = {
        _id: sessionId
    };

    let body = {
        command: command
    };

    Session.findOneAndUpdate(query, body, (err, session) => { });
}


