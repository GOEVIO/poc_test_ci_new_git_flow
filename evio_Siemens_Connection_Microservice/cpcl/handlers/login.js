const ChargingPointResponse = require('../entities/OperationCenterResponses')
const Utils = require('../entities/Utils');

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';

const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;

module.exports = {
    handle: function (oc, data, cs_info) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] Login Operation"));
            var sn = null;

            try {
                var values = data["command"]["CLIENT_COMMAND"]["0"]["LOGIN"]["0"];
                for (var attribute in values) {
                    if (attribute === 'Sn') {
                        console.log(attribute + ": " + values[attribute][0]);
                        sn = values[attribute][0];
                    }

                    if (attribute === 'CPCL_Version') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Hardware_Version') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Name') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Software_Version_A') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Software_Version_B') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'param_MD5') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'CP_PWD') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }
                }

                var command_id = data["command"]["$"]["id"].toString();

                var params = {
                    hwId: sn.toString()
                }

                Utils.checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                    if (charger) {

                        var chargerId = charger.data.charger[0]._id;

                        var body;
                        if (charger.data.charger[0].plugs.length == 0) {

                            //Plug type 2
                            var plug1 = {
                                status: "10",
                                plugId: "1",
                                active: true,
                                connectorType: "TYPE 2"
                            }

                            var plug2 = {
                                status: "10",
                                plugId: "2",
                                active: true,
                                connectorType: "SCHUKO EU"
                            }

                            //Plug setup
                            var plugs = [plug1, plug2];

                            body = {
                                _id: chargerId,
                                endpoint: cs_info.endpoint,
                                model: 'CP700A',
                                chargerType: process.env.ChargerType,
                                heartBeat: new Date().toISOString(),
                                plugs: plugs
                            }
                        }
                        else {
                            body = {
                                _id: chargerId,
                                endpoint: cs_info.endpoint,
                                model: 'CP700A',
                                chargerType: process.env.ChargerType,
                                heartBeat: new Date().toISOString()
                            }
                        }

                        //Update charger info
                        Utils.updateChargerData(chargerServiceUpdateProxy, body).then((result) => {
                            if (result) {
                                var login = {
                                    sn: sn.toString(),
                                    operation: 'LOGIN',
                                    command: ChargingPointResponse.commandAckXMLMessage(command_id, "OK")
                                }
                                resolve(login);
                            } else {
                                var login = {
                                    sn: sn.toString(),
                                    operation: 'LOGIN',
                                    command: ChargingPointResponse.commandAckXMLMessage(command_id, "notOK")
                                }
                                resolve(login);
                            }
                        })

                    }

                })

            } catch (error) {
                console.log('[LOGIN] error: ' + error);
            }

        })
    }
}