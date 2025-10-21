const ChargingPointResponse = require('../entities/OperationCenterResponses')

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging CommandAck Response]"));

            try {
                var result = data["commandAck"]["result"][0];
                var command_id = data["commandAck"]["$"]["id"].toString();

                console.log("Command id: " + command_id);
                console.log("Result: " + result);

                resolve({ id: command_id, result: result });

            } catch (error) {
                console.log('[CommandAck] error: ' + error);
            }

        })
    }
}