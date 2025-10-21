const ChargingPointResponse = require('../entities/OperationCenterResponses')
const SessionConfig = require('../../models/SessionConfig');
var moment = require('moment');
const axios = require("axios");
const Utils = require("../entities/Utils");
const OperationCenterCommands = require('../../cpcl/entities/OperationCenterCommands');

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';

const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceMultiStatusProxy = `${host}/api/private/chargers/multiStatus`;
const chargingSessionStatServiceProxy = `${host}/api/private/chargingSession/statistics`;

//Notifies that the CHARGE_SECTION_INT was approved
module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] CHARGE_SECTION_END Operation"));

            var sessionId;
            var meter_Abs;
            var meter_current_session;

            try {
                var values = data["command"]["CLIENT_COMMAND"]["0"]["CHARGE_SECTION_END"]["0"];

                for (var attribute in values) {
                    if (attribute === 'Session_ID') {
                        sessionId = values[attribute][0];
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Meter_Abs') {
                        meter_Abs = values[attribute][0]["_"];
                        var meter_Abs_e_unit = values[attribute][0]["$"]["e_unit"];
                        console.log(attribute + ": " + meter_Abs);
                        console.log("meter_Abs_e_unit: " + meter_Abs_e_unit);
                    }

                    if (attribute === 'Meter_current_Session') {
                        meter_current_session = values[attribute][0]["_"];
                        var meter_current_session_e_unit = values[attribute][0]["$"]["e_unit"];
                        console.log(attribute + ": " + meter_current_session);
                        console.log("meter_current_session_e_unit: " + meter_current_session_e_unit);
                    }

                    //End charging session values
                    if (attribute === 'Charge_End_State') {
                        var ces_values = values[attribute][0]
                        for (var ces_value in ces_values) {
                            if (ces_value === 'ID') {
                                console.log(ces_value + ": " + ces_values[ces_value][0]);
                            }
                            if (ces_value === 'Parameter') {
                                var ces_parameters = ces_values[ces_value][0];
                                for (ces_parameter in ces_parameters) {
                                    if (ces_parameter === 'No') {
                                        console.log(ces_parameter + ": " + ces_parameters[ces_parameter][0]);
                                    }
                                    if (ces_parameter === 'Value') {
                                        console.log(ces_parameter + ": " + ces_parameters[ces_parameter][0]);
                                    }
                                }
                            }
                            if (ces_value === 'Text') {
                                console.log(ces_value + ": " + ces_values[ces_value][0]);
                            }
                        }
                    }

                    if (attribute === 'TimeStamp') {
                        //Validate timestamp and format to Date
                        console.log(attribute + ": " + values[attribute][0]);
                    }
                }

                var command_id = data["command"]["$"]["id"].toString();

                params = {
                    _id: sessionId
                };

                axios.get(chargingSessionServiceProxy, { params })
                    .then((response) => {

                        if (typeof response.data.chargingSession[0] === 'undefined') {
                            console.log(`Charging Session ${sessionId} not found`);
                            resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, 0));
                        }
                        else {

                            var chargingSession = response.data.chargingSession[0];
                            console.log("STATUS 30: " + chargingSession.status);

                            //Last Reading Point
                            var timeChargedinSeconds = Utils.getChargingTime(chargingSession);
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

                            axios.patch(chargingSessionStatServiceProxy, { body })
                                .then((response) => {

                                    params = {
                                        _id: sessionId
                                    };

                                    axios.get(chargingSessionServiceProxy, { params })
                                        .then((response) => {

                                            if (typeof response.data.chargingSession[0] === 'undefined') {
                                                console.log(`Charging Session ${sessionId} not found`);
                                                resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, 0));
                                            }
                                            else {

                                                chargingSession = response.data.chargingSession[0];

                                                var sessionStatus;

                                                if (meter_current_session.toString() === "0") {
                                                    if (chargingSession.status == process.env.SessionStatusToStart) {
                                                        console.log("Session: " + sessionId + " failed to start");
                                                        sessionStatus = process.env.SessionStatusFailed;
                                                    } else {
                                                        if (chargingSession.status == process.env.SessionStatusRunning
                                                            || chargingSession.status == process.env.SessionStatusToStop) {
                                                            console.log("Session: " + sessionId + " did not consumed energy");
                                                            sessionStatus = process.env.SessionStatusStopped;
                                                        }
                                                    }
                                                }
                                                else {
                                                    sessionStatus = process.env.SessionStatusStopped;
                                                }

                                                var timeChargedinSeconds = Utils.getChargingTime(chargingSession);
                                                //var price = chargingSession.sessionPrice * meter_current_session;
                                                var price = chargingSession.estimatedPrice;

                                                Utils.updateChargingSessionStop(chargingSessionServiceProxy, sessionId, sessionStatus, meter_Abs, timeChargedinSeconds, price)
                                                    .then((response) => {
                                                        if (response) {

                                                            console.log("Status before change plug: " + sessionStatus);

                                                            if (sessionStatus == process.env.SessionStatusFailed) {

                                                                var body = {
                                                                    hwId: chargingSession.hwId,
                                                                    plugId: chargingSession.plugId,
                                                                    status: process.env.PlugStatusAvailable
                                                                }

                                                                Utils.updateChargerPlugStatusChargeEnd(chargerServiceProxy, chargerServiceMultiStatusProxy, body)
                                                                    .then((response) => {
                                                                        if (response) {
                                                                            console.log("Success");
                                                                            resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, price));
                                                                        } else {
                                                                            console.log("Failed");
                                                                            resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, price));
                                                                        }
                                                                    })

                                                            } else {

                                                                //IEC plug
                                                                if (chargingSession.plugId == "1") {

                                                                    console.log("Plug1");

                                                                    let newId = moment().format('YYYY-MM-DDTHH:mm:ss');
                                                                    let plugStatus = OperationCenterCommands.chargingStationIECPlugStatus(newId);

                                                                    var charger = {
                                                                        hwId: chargingSession.hwId
                                                                    }

                                                                    process.send({
                                                                        plug: plugStatus,
                                                                        charger: charger
                                                                    })

                                                                }

                                                                //Houseplug 
                                                                if (chargingSession.plugId == "2") {

                                                                    console.log("Plug2");

                                                                    let newId = moment().format('YYYY-MM-DDTHH:mm:ss');
                                                                    let plugStatus = OperationCenterCommands.chargingStationHouseholdPlugStatus(newId);

                                                                    var charger = {
                                                                        hwId: chargingSession.hwId
                                                                    }

                                                                    process.send({
                                                                        plug: plugStatus,
                                                                        charger: charger
                                                                    })

                                                                }

                                                                resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, price));

                                                            }

                                                        } else {
                                                            resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, price));
                                                        }
                                                    }).catch(error => {
                                                        console.log(error);
                                                        resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, 0));
                                                    })

                                            }
                                        })

                                })
                                .catch((error) => {
                                    resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, 0));
                                })

                        }
                    }).catch(error => {
                        //If session is not found, then the charging station receives 0 as price
                        resolve(ChargingPointResponse.chargeSectionEndResult(command_id, sessionId, 0));
                    })

            } catch (error) {
                console.log('[CHARGE_SECTION_END] error: ' + error);
            }

        })
    }
}
