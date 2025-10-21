const ChargingPointResponse = require('../entities/OperationCenterResponses')

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] MESSAGE Operation"));

            try {
                var values = data["command"]["CLIENT_COMMAND"]["0"]["MESSAGE"]["0"];

                for (var attribute in values) {
                    if (attribute === 'ID') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }
                    //multiple parameters
                    if (attribute === 'Parameter') {
                        var message_parameters = values[attribute][0];
                        for (message_parameter in message_parameters) {
                            if (message_parameter === 'No') {
                                console.log(message_parameter + ": " + message_parameters[message_parameter][0]);
                            }
                            if (message_parameter === 'Value') {
                                console.log(message_parameter + ": " + message_parameters[message_parameter][0]);
                            }
                        }
                    }
                    if (attribute === 'Text') {
                        console.log(attribute + ": " + values[attribute][0]);
                    }
                }

                var command_id = data["command"]["$"]["id"].toString();
                resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));

            } catch (error) {
                console.log('[MESSAGE] error: ' + error);
            }

        })
    }
}