const ChargingPointResponse = require('../entities/OperationCenterResponses');
const SessionReport = require('../../models/SessionReport');
const axios = require("axios");
const Utils = require("../entities/Utils");
const OperationCenterCommands = require('../../cpcl/entities/OperationCenterCommands');
var moment = require('moment');

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';

const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargingSessionStatServiceProxy = `${host}/api/private/chargingSession/statistics`;

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] CHARGE_SECTION_REPORT Operation"));

            var sessionId;
            var meter_Abs;
            var meter_Abs_e_unit;
            var meter_current_session;
            var meter_current_session_e_unit;
            var timestamp;

            try {
                var values = data["command"]["CLIENT_COMMAND"]["0"]["CHARGE_SECTION_REPORT"]["0"];

                for (var attribute in values) {
                    if (attribute === 'Session_ID') {
                        sessionId = values[attribute][0];
                        console.log(attribute + ": " + sessionId);
                    }

                    if (attribute === 'Meter_Abs') {
                        meter_Abs = values[attribute][0]["_"];
                        meter_Abs_e_unit = values[attribute][0]["$"]["e_unit"];
                        console.log(attribute + ": " + meter_Abs);
                        console.log("meter_Abs_e_unit: " + meter_Abs_e_unit);
                    }

                    if (attribute === 'Meter_current_Session') {
                        meter_current_session = values[attribute][0]["_"];
                        meter_current_session_e_unit = values[attribute][0]["$"]["e_unit"];
                        console.log(attribute + ": " + meter_current_session);
                        console.log("meter_current_session_e_unit: " + meter_current_session_e_unit);
                    }

                    if (attribute === 'TimeStamp') {
                        //Validate timestamp and format to Date
                        timestamp = values[attribute][0];
                        console.log(attribute + ": " + timestamp);
                    }
                }

                var command_id = data["command"]["$"]["id"].toString();

                params = {
                    _id: sessionId
                };

                axios.get(chargingSessionServiceProxy, { params })
                    .then((response) => {

                        console.log("Recupera sessão1: " + sessionId);

                        if (typeof response.data.chargingSession[0] === 'undefined') {
                            console.log("Could not find session. Values not updated");
                            resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                        }
                        else {

                            var chargingSession = response.data.chargingSession[0];

                            /*console.log("TESTE: ");
                            console.log("T: " + response.data.chargingSession[0].readingPoints.length);

                            Check plug used in the charging session
                            if (chargingSession.readingPoints.length == 0) {
                                console.log("ENTRA");
                                checkPlugUsed(chargingSession.hwId);
                            }*/

                            if (chargingSession.status == process.env.SessionStatusToStart &&
                                Number(meter_current_session) > 0) {
                                console.log("Changed Status to running. WAY2");
                                Utils.updateChargingSessionStatus(chargingSessionServiceProxy,
                                    process.env.SessionStatusRunning, chargingSession);
                            }

                            var timeChargedinSeconds = Utils.getChargingTime(chargingSession);

                            //Calculate estimatedPrice
                            //var estimatedPrice = Utils.getEstimatedPrice(chargingSession);

                            var body = {
                                _id: sessionId,
                                readingPoints: [{
                                    totalPower: Number(meter_current_session),
                                    instantPower: -1,
                                    instantVoltage: -1,
                                    instantAmperage: -1
                                }],
                                timeCharged: timeChargedinSeconds,
                                //estimatedPrice: estimatedPrice,
                                batteryCharged: -1,
                                totalPower: Number(meter_current_session)
                            }

                            console.log(body);

                            axios.patch(chargingSessionStatServiceProxy, { body })
                                .catch((error) => {
                                    console.log(error.response.data);
                                })
                                .finally(() => {
                                    console.log("Atualiza meterValues");
                                    resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                                })

                            /*
                        axios.patch(chargingSessionStatServiceProxy, { body })
                            .then(function (response) {
                                console.log("Atualiza meterValues");
                                if (response) {
                                    console.log("Success1");
                                    resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                                } else {
                                    console.log("Success2");
                                    resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                                }
                            })
                            .catch(function (error) {
                                console.log(error.response.data);
                                resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                            })*/

                        }
                    })
                    .catch(error => {
                        console.log(error);
                        resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                    })
                    .finally(() => {
                        console.log("Entra");
                        resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                    })

            } catch (error) {
                console.log('[CHARGE_SECTION_REPORT] error: ' + error);
                reject(error);
            }

        })
    }
}

const checkPlugUsed = (chargerId) => {

    console.log("CheckPlugUsed: " + chargerId);

    let newId = moment().format('YYYY-MM-DDTHH:mm:ss');
    let plugStatus = OperationCenterCommands.chargingStationIECPlugStatus(newId);

    var charger = {
        hwId: chargerId
    }

    process.send({
        plug: plugStatus,
        charger: charger
    })

};


