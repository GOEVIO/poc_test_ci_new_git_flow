const ChargingPointResponse = require('../entities/OperationCenterResponses')

//Notifies that the CHARGE_SECTION_INT was approved
module.exports = {
    handle: function (data, sessionConfig) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] SYSTEM_FAULT Operation"));

            var session_ID;
            var meter_current_session;

            try {
                var values = data["command"]["CLIENT_COMMAND"]["0"]["SYSTEM_FAULT"]["0"];

                for (var attribute in values) {

                    //Multiple parameters
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

                    if (attribute === 'Session_ID') {
                        session_ID = values[attribute][0];
                        console.log(attribute + ": " + values[attribute][0]);
                    }

                    if (attribute === 'Meter_Abs') {
                        var meter_Abs = values[attribute][0]["_"];
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

                    //Multiple parameters
                    if (attribute === 'Message') {
                        var message_values = values[attribute][0]
                        for (var message_value in message_values) {
                            if (message_value === 'ID') {
                                console.log(message_value + ": " + message_values[message_value][0]);
                            }
                            if (message_value === 'Parameter') {
                                var messsage_parameters = message_values[message_value][0];
                                for (messsage_parameter in messsage_parameters) {
                                    if (messsage_parameter === 'No') {
                                        console.log(messsage_parameter + ": " + messsage_parameters[messsage_parameter][0]);
                                    }
                                    if (ces_parameter === 'Value') {
                                        console.log(messsage_parameter + ": " + messsage_parameters[messsage_parameter][0]);
                                    }
                                }
                            }
                            if (message_value === 'Text') {
                                console.log(message_value + ": " + message_values[message_value][0]);
                            }
                        }
                    }
                }

                //Expects a reboot

            } catch (error) {
                console.log('[SYSTEM_FAULT] error: ' + error);
            }

        })
    }
}