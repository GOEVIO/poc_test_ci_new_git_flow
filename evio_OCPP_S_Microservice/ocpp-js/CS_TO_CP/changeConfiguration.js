const Promise = require('promise');
const global = require('../../global');
const Utils = require('../utils/utils');
const axios = require("axios");
var parser = require('fast-xml-parser');

var host = global.charger_microservice_host;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;

module.exports = {
    handle: function (req, res, next, CentralSystemServer) {

        var userId = req.headers['userid'];
        var chargerId = req.body.chargerId;
        var hwId = req.body.hwId;
        var evId = req.body.evId;
        var plugId = req.body.plugId;
        var context = "[Change Configuration]";


        /////////////////////////////////////////////////////////////////////////////
        //Check if charger exists on EVIO Network and get data of charger
        var params = {
            hwId: hwId
        };

        Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {


            if (charger) {
                if (!charger.data.charger[0].endpoint)
                    return res.status(400).send({ auth: false, code: "server_endpoint_undefined", message: 'Endpoint undefined' });


                ///////////////////////////////////////////////////////////////////////////
                // create client or get already created client by _getClientByEndpoint function
                Utils.getClient(context, charger.data.charger[0], CentralSystemServer).then((client) => {


                    if (client) {

                        var configuration = req.body.configuration;

                        var data = new Object
                        data.key = configuration['key'];
                        data.value = configuration['value'];

                        console.log(`${context} Trying changing configuration: ChargerId: ${hwId}; Endpoint: ${charger.data.charger[0].endpoint} `);

                        CentralSystemServer.changeConfiguration(hwId, charger.data.charger[0].endpoint, data).then(function (result) {

                            var remoteStatus = "";
                            //console.log(result)
                            if (result) {
                                if (parser.validate(result.envelope) === true) {

                                    try {
                                        var jsonObj = parser.parse(result.envelope, Utils.getParserOptions(), true);
                                        remoteStatus = jsonObj.Envelope.Body.changeConfigurationResponse.status;
                                        console.log(`${context} Response: ${JSON.stringify(jsonObj)} \n`);
                                    } catch (error) {
                                        console.log("error: ", error)
                                    }
                                }

                                if (remoteStatus === 'Accepted') {
                                    var body = '';

                                    if (data.key == 'HeartBeatInterval') {
                                        body = {
                                            _id: charger.data.charger[0]._id,
                                            heartBeatInterval: data.value
                                        }
                                        updateChargerData(chargerServiceUpdateProxy, body);
                                    }
                                    else if (data.key == 'MeterValueSampleInterval') {
                                        body = {
                                            _id: charger.data.charger[0]._id,
                                            meterValueSampleInterval: data.value
                                        }
                                        updateChargerData(chargerServiceUpdateProxy, body);
                                    }


                                    return res.status(200).send({ auth: 'true', code: "", message: 'Change Configuration accepted' });
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: "server_ocpp_change_configuration_not_accepted", message: 'Change Configuration not accepted' });
                                }

                            }
                            else {

                                return res.status(400).send({ auth: false, code: "server_error_connecting_charging_station", message: 'Error connecting charging station' });
                            }
                        }).catch(function (err) {
                            console.log(`${context} Error changing configuration on charger ${hwId} and connectorId ${plugId} with error: ${err} `)

                            return res.status(400).send({ auth: false, code: "error", message: err.message });
                        });


                    }
                    else {
                        console.log(`${context} Error creating client for : ${charger.data.charger[0].hwId} , ${charger.data.charger[0].endpoint} `);
                        return res.status(400).send({ auth: false, code: "error", message: 'Error' });
                    }
                });


            }
            else {
                return res.status(400).send({ auth: false, status: false, message: `Charger ${hwId} does not exists` });
            }

        });


    }
}

const updateChargerData = (ServiceProxy, body) => {

    return new Promise((resolve, reject) => {
        axios.patch(ServiceProxy, body)
            .then(function (response) {
                resolve(true);
            })
            .catch(function (error) {
                console.log("error", error);
                reject(false);
            });
    });
};