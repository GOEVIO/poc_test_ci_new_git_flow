const ChargingPointResponse = require('../entities/OperationCenterResponses')

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';
const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;

const Utils = require('../entities/Utils');
const OperationCenterCommands = require('../../cpcl/entities/OperationCenterCommands');

var moment = require('moment');

//Notifies that the CHARGE_SECTION_INT was approved
module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            const OperationCenter = require('../../cpcl/entities/OperationCenter')(8091);

            console.log(JSON.stringify("[Charging Station] CHARGE_SECTION_START Operation"));

            var id;
            var meter_Abs;

            try {
                var command_id = data["command"]["$"]["id"].toString();
                var values = data["command"]["CLIENT_COMMAND"]["0"]["CHARGE_SECTION_START"]["0"];

                for (var attribute in values) {
                    if (attribute === 'Session_ID') {
                        id = values[attribute][0];
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Meter_Abs') {
                        var meter_Abs = values[attribute][0]["_"];
                        var e_unit = values[attribute][0]["$"]["e_unit"];
                        console.log(attribute + ": " + meter_Abs);
                        console.log("e_unit: " + e_unit);
                    }

                    if (attribute === 'TimeStamp') {
                        //Validate timestamp and format to Date
                        console.log(attribute + ": " + values[attribute][0]);
                    }
                }

                var body = {
                    _id: id,
                    meterStart: Number(meter_Abs)
                }

                Utils.updateStartChargingSessionData(chargingSessionServiceProxy, body);

                //resolve({ id: id, meter_Abs: meter_Abs });

                var params = {
                    _id: id
                }

                Utils.getChargingSessionData(chargingSessionServiceProxy, params)
                    .then(session => {
                        if (session) {

                            var charger = {
                                hwId: session.hwId
                            }
                            statusId = session._id + ":1";

                            if (OperationCenter != undefined) {
                                let context = "getChargingStationStatus";
                                console.log(charger.hwId);
                                OperationCenter.getClientConnection(context, charger)
                                    .then((client) => {
                                        if (client !== null) {
                                            const status = OperationCenterCommands.chargingStationStatus(statusId);
                                            OperationCenter.startTransaction(status, client);

                                            resolve({ id: id, meter_Abs: meter_Abs });
                                        }
                                    })
                            }

                        }
                    })

            } catch (error) {
                console.log('[CHARGE_SECTION_START] error: ' + error);
                reject(error);
            }

        })
    }
}
