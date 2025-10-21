const ChargingPointResponse = require('../entities/OperationCenterResponses')

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] AUTHENTICATE Operation"));
            var command_id = data["command"]["$"]["id"].toString();

            var Rfid_uid;

            try {
                var values = data["command"]["CLIENT_COMMAND"]["0"]["AUTHENTICATE"]["0"];

                //Checks if the authenticate request has expired with the CANCEL attribute
                if (values["CANCEL"] == undefined) {
                    for (var attribute in values) {
                        if (attribute === 'Rfid_uid') {
                            Rfid_uid = values[attribute][0];
                            console.log(attribute + ": " + values[attribute][0]);
                        }
                    }
                    //Authentication logic
                    resolve(ChargingPointResponse.authenticateResult(command_id, Rfid_uid, "notOK"));
                } else {
                    for (var attribute in values) {
                        if (attribute === 'Rfid_uid') {
                            Rfid_uid = values[attribute][0];
                            console.log(attribute + ": " + values[attribute][0]);
                        }

                        if (attribute === 'CANCEL') {
                            console.log("Cancel originated from a timeout for the command Charge Section Init");
                        }
                    }
                    resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                }

            } catch (error) {
                console.log('[AUTHENTICATE] error: ' + error);
            }

        })
    }
}