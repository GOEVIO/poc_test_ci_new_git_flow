const Promise = require('promise');
const global = require('../../global');
const Utils = require('../utils/utils');
const axios = require("axios");
var parser = require('fast-xml-parser');
const moment = require('moment');

var host = global.charger_microservice_host;
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargingSessionStartServiceProxy = `${host}/api/private/chargingSession/start`;

const updateChargingSession = (ServiceProxy, status, chargingSession) => {


    var body = {
        _id: chargingSession._id,
        status: status
    }

    axios.patch(ServiceProxy, { body })
        .then(function (response) {
            // console.log("Success");
        })
        .catch(function (error) {
            console.log(error);

        });


};

module.exports = {
    handle: function (req, res, next, CentralSystemServer) {
        // return new Promise(function (resolve, reject) {

        var sessionPrice = req.body.sessionPrice;
        if (!sessionPrice)
            return res.status(400).send({ auth: false, code: "server_session_price_required", message: 'Session price required' });

        var evId = req.body.evId;
        if (!evId)
            return res.status(400).send({ auth: false, code: "server_ev_id_required", message: 'EV ID required' });

        var plugId = req.body.plugId;
        if (!plugId)
            return res.status(400).send({ auth: false, code: "server_plug_id_required", message: 'Plug ID required' });

        var idTag = req.body.idTag;
        if (!idTag)
            return res.status(400).send({ auth: false, code: "server_id_tag_required", message: 'IdTag required' });

        var userId = req.headers['userid'];
        var chargerId = req.body.chargerId;
        var hwId = req.body.hwId;
        var context = "[Remote Start Charging]";

        //TODO
        //Check if plugId is valid
        //Check if plugId is available
        var dateNow = moment();
        var body = {
            'hwId': hwId,
            'evId': evId,
            'idTag': idTag,
            'sessionPrice': sessionPrice,
            'command': process.env.StartCommand,
            'chargerType': process.env.OCPPSDeviceType,
            'status': process.env.SessionStatusToStart,
            'userId': userId,
            'plugId': plugId,
            'startDate': dateNow
        }

        /////////////////////////////////////////////////////////////////////////////
        //Check if charger exists on EVIO Network and get data of charger
        var params = {
            hwId: hwId
        };

        Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {


            if (charger) {

                if (!charger.data.charger[0].endpoint)
                    return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });

                // console.log(`${context} charger `, JSON.stringify(charger.data.charger[0]));

                axios.post(chargingSessionStartServiceProxy, body)
                    .then(function (chargingSession) {

                        ///////////////////////////////////////////////////////////////////////////
                        // create client or get already created client by _getClientByEndpoint function
                        Utils.getClient(context, charger.data.charger[0], CentralSystemServer).then((client) => {


                            if (client) {

                                //Remote start charging
                                //data.idTag = int;
                                //data.connectorId = int;
                                //id Tag is the user Id
                                var data = new Object;
                                data.idTag = idTag;
                                data.connectorId = plugId;

                                console.log(`${context} Trying start remote transaction: ChargerId: ${hwId}; PlugId: ${plugId}; userIdTag: ${idTag}; Endpoint: ${charger.data.charger[0].endpoint} `);

                                CentralSystemServer.remoteStartTransaction(hwId, charger.data.charger[0].endpoint, data).then(function (result) {

                                    var remoteStatus = "";
                                    //console.log(result)
                                    if (result) {
                                        if (parser.validate(result.envelope) === true) {

                                            try {
                                                var jsonObj = parser.parse(result.envelope, Utils.getParserOptions(), true);
                                                remoteStatus = jsonObj.Envelope.Body.remoteStartTransactionResponse.status;
                                                console.log(`${context} Response: ${JSON.stringify(jsonObj)} \n`);
                                            } catch (error) {
                                                console.log("error: ", error)
                                            }
                                        }

                                        if (remoteStatus === 'Accepted') {
                                            //updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusRunning, chargingSession.data);
                                            return res.status(200).send({ auth: 'true', code: "", message: 'Remote Start accepted', sessionId: chargingSession.data._id });
                                        }
                                        else {
                                            updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession.data);
                                            return res.status(400).send({ auth: false, code: "server_ocpp_remote_start_not_accepted", message: 'Remote Start not accepted' });
                                        }

                                    }
                                    else {

                                        updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession.data);
                                        return res.status(400).send({ auth: false, code: "server_error_connecting_charging_station", message: 'Error connecting charging station' });
                                    }
                                }).catch(function (err) {
                                    console.log(`${context} Error starting session on charger ${hwId} and connectorId ${plugId} with error: ${err}`)
                                    updateChargingSession(chargingSessionServiceProxy, process.env.SessionStatusFailed, chargingSession.data);
                                    return res.status(400).send({ auth: false, code: "error", message: err.message });
                                });


                            }
                            else {
                                console.log(`${context}Error creating client for : ${charger.data.charger[0].hwId} , ${charger.data.charger[0].endpoint}`);
                                return res.status(400).send({ auth: false, code: "error", message: 'Error' });
                            }
                        });

                    })
                    .catch(function (error, err) {
                        if (!error)
                            console.log(`${context} error - Check error 45641231`);
                        else
                            console.log(`${context} error: , ${JSON.stringify(error)}`);

                        if (error.response)
                            return res.status(400).send({ auth: false, status: false, message: error.response.data.message });
                        else
                            return res.status(400).send({ auth: false, status: false, message: error.message });

                    });
            }
            else {
                return res.status(400).send({ auth: false, status: false, message: `Charger ${hwId} does not exists` });
            }

        });


        // });

    }
}