const ChargingPointResponse = require('../entities/OperationCenterResponses')

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';

const chargingSessionServiceProxy = `${host}/api/private/chargingSession`;

module.exports = {
    handle: function (data, sessionConfig) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] CHARGE_SECTION_INFO Operation"));
            var meter_current_session;
            var sessionId;

            try {
                var values = data["command"]["CLIENT_COMMAND"]["0"]["CHARGE_SECTION_INFO"]["0"];

                for (var attribute in values) {
                    if (attribute === 'Session_ID') {
                        sessionId = values[attribute][0];
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Meter_current_Session') {
                        meter_current_session = values[attribute][0]["_"];
                        var meter_current_session_e_unit = values[attribute][0]["$"]["e_unit"];
                        console.log(attribute + ": " + meter_current_session);
                        console.log("meter_current_session_e_unit: " + meter_current_session_e_unit);
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
                            resolve(ChargingPointResponse.chargeSectionInfoResult(command_id, sessionId, 0));
                        }
                        else {
                            var chargingSession = response.data.chargingSession[0];

                            var price = chargingSession.estimatedPrice;
                            console.log("Price: " + price);

                            resolve(ChargingPointResponse.chargeSectionInfoResult(command_id, sessionId, price));
                        }
                    })

                resolve(ChargingPointResponse.chargeSectionInfoResult(command_id, sessionId, 0));

            } catch (error) {
                console.log('[CHARGE_SECTION_INFO] error: ' + error);
            }

        })
    }
}