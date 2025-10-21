const Promise = require('promise');
const global = require('../../global');
const Utils = require('../utils/utils');
const axios = require("axios");
var parser = require('fast-xml-parser');
const moment = require('moment');
var host = global.charger_microservice_host;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;

const updateChargingSessionStop = (ServiceProxy, chargingSessionId, status) => {

    return new Promise((resolve, reject) => {
        
        try {

            var dateNow = moment();

            var body = {
                _id: chargingSessionId,
                command: process.env.StopCommand,
                status: status,
                stopDate: dateNow
            }

            axios.patch(ServiceProxy, { body })
                .then(function (response) {
                    resolve(true);
                })
                .catch(function (error) {
                    console.log("[Remore Stop Transaction] Error updating charging session: " + error)
                    resolve(false);
                    //TODO VERY IMPORTANT
                    //IN CASE OF FAILED, WE NEED TO PREVENT FAILS AND MARK TO PROCESS AGAIN LATER
                    //IN THIS SCENARIO, CHARGING SESSION WAS ALREADY STOPED ON OCPP CHARGER BUT NOT ON EVIO STORAGE DATABASE
                });

        } catch (err) {
            console.log("[Remore Stop Transaction] Error updating charging session: " + err)
        }
    })

};

module.exports = {
    handle: function (req, res, next, CentralSystemServer) {
        // return new Promise(function (resolve, reject) {
        try {
            var userId = req.headers['userid'];
            var chargerId = req.body.chargerId;
            var hwId = req.body.hwId;
            var evId = req.body.evId;
            var plugId = req.body.plugId;
            var context = "[OCPP Server - Remote Stop Charging]";

            var sessionId = req.body.sessionId;
            if (!sessionId)
                return res.status(400).send({ auth: false, code: "server_session_id_required", message: 'Charging session ID required' });

            var idTag = req.body.idTag;
            if (!idTag)
                return res.status(400).send({ auth: false, code: "server_id_tag_required", message: 'IdTag required' });

            /////////////////////////////////////////////////////////////////////////////
            //Check if charger exists on EVIO Network and get data of charger
            var params = {
                hwId: hwId
            };

            Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {

                if (charger) {
                    if (!charger.data.charger[0].endpoint)
                        return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });

                    ////////////////////////////////////////////////
                    //Get if is any session running to given session Id
                    params = {
                        status: process.env.SessionStatusRunning,
                        hwId: hwId,
                        plugId: plugId,
                        sessionId: sessionId,
                        idTag: idTag
                    };

                    axios.get(chargingSessionServiceProxy, { params })
                        .then(function (response) {

                            if (typeof response.data.chargingSession[0] === 'undefined')
                                return res.status(400).send({ auth: false, code: "server_invalid_charging_session", message: `Charging Session ${sessionId} not found or is already stoped` });
                            else {

                                var internalSessionId = response.data.chargingSession[0]._id;
                                console.log(`\n${context} Setting session ${sessionId} as ToStop`);
                                updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusToStop).then((chargingSession) => {
                                    
                                    if (chargingSession) {

                                        ///////////////////////////////////////////////////////////////////////////
                                        // create client or get already created client by _getClientByEndpoint function
                                        Utils.getClient(context, charger.data.charger[0], CentralSystemServer).then((client) => {

                                            if (client) {

                                                var data = new Object;
                                                data.transactionId = sessionId;

                                                CentralSystemServer.remoteStopTransaction(hwId, charger.data.charger[0].endpoint, data).then(function (result) {
                                                    var remoteStatus = "";

                                                    if (result) {

                                                        if (parser.validate(result.envelope) === true) {

                                                            try {
                                                                var jsonObj = parser.parse(result.envelope, Utils.getParserOptions(), true);
                                                                remoteStatus = jsonObj.Envelope.Body.remoteStopTransactionResponse.status;
                                                            } catch (error) {
                                                                console.log(`${context} Error parsing remote status object`, error);
                                                            }
                                                        }

                                                        if (remoteStatus === 'Accepted') {
                                                            
                                                            // updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusToStop).catch(function (err) {
                                                            //     console.log(`${context} error stop charging:`, JSON.stringify(err));
                                                            // });
                                                            return res.status(200).send({ auth: 'true', code: "", message: '' });
                                                        }
                                                        else {
                                                            updateChargingSessionStop(chargingSessionServiceProxy, internalSessionId, process.env.SessionStatusRunning);
                                                            console.log(`${context} error stop charging:`, JSON.stringify(result));
                                                            return res.status(400).send({ auth: false, code: "error_ stopping_charging_session", message: `Error stoping charging session ${sessionId}` });
                                                        }

                                                    }
                                                }).catch(function (err) {
                                                    return res.status(400).send({ auth: false, code: "", message: err.message });
                                                });

                                            }
                                            else {
                                                return res.status(400).send({ auth: false, code: "error", message: 'Client does not exist' });
                                            }

                                        });

                                    }
                                    else {
                                        console.log("Aqui3");
                                    }

                                }).catch(function (error) {
                                    console.log(`${context} Error updating charging session tostop status: ${error}`);
                                });

                            }
                        }).catch(function (error) {
                            console.log(`${context} Error getting session status: ${error}`);
                        });

                }

            });
        } catch (err) {
            console.log("[Remote Stop Transaction] Error processing stop transaction: " + err)
        }
    }
}