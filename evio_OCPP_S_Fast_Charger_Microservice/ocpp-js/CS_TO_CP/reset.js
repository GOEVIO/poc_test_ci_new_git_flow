const Promise = require('promise');
const global = require('../../global');
const Utils = require('../utils/utils');
const axios = require("axios");
var parser = require('fast-xml-parser');

var host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const context = '[Reset] '
module.exports = {
    handle: function (req, res, next, CentralSystemServer) {

        var hwId = req.body.hwId;
        if (!hwId)
            return res.status(400).send({ auth: false, code: "server_hw_id_required", message: 'Hardware ID required' });

        var resetType = req.body.resetType;
        if (!resetType)
            return res.status(400).send({ auth: false, code: "server_reset_type_required", message: 'Reset Type required' });

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

                        console.log(`${context}Trying ${resetType} reset: ChargerId: ${hwId}; Endpoint: ${charger.data.charger[0].endpoint} `);

                        var data = new Object
                        data.type = resetType;

                        CentralSystemServer.reset(hwId, charger.data.charger[0].endpoint, data).then(function (result) {

                            var remoteStatus = "";
                            
                            if (result) {
                                if (parser.validate(result.envelope) === true) {

                                    try {
                                        var jsonObj = parser.parse(result.envelope, Utils.getParserOptions(), true);
                                        remoteStatus = jsonObj.Envelope.Body.resetResponse.status;
                                        console.log(`${context} Response: ${JSON.stringify(jsonObj)} \n`);
                                    } catch (error) {
                                        console.log("error: ", error)
                                    }
                                }

                                if (remoteStatus === 'Accepted') {

                                    return res.status(200).send({ auth: 'true', code: "", message: 'Reset accepted' });
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: "server_ocpp_reset_not_accepted", message: 'Reset not accepted' });
                                }

                            }
                            else {

                                return res.status(400).send({ auth: false, code: "server_error_connecting_charging_station", message: 'Error connecting charging station' });
                            }
                        }).catch(function (err) {
                            console.log(`${context} Error reseting charger ${hwId} with error: ${err} `)

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