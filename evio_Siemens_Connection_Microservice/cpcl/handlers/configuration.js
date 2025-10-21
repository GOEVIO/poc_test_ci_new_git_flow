
const Utils = require('../entities/Utils');
const OperationCenterCommands = require('../../cpcl/entities/OperationCenterCommands');

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] Charge Section Configuration"));
            var Section_Info_Interval;
            var Section_Info_Interval_time_unit;
            var KeepAliveInterval;
            var KeepAliveInterval_time_unit;
            var Timeout_Plug;
            var Timeout_Plug_time_unit;
            var Timeout_Hatch;
            var Timeout_Hatch_time_unit;

            var Dhcp;
            var Network_Connection;
            var OC_Fqdn;
            var OC_Port;

            try {
                var values = data["command"]["PARAMETER"]["0"];

                for (var attribute in values) {

                    attribute = values[attribute][0];

                    for (var tag in attribute) {

                        if (tag === 'Section_Info_Interval') {
                            Section_Info_Interval = attribute[tag][0]['current'][0];
                            Section_Info_Interval_time_unit = attribute[tag][0]["$"]["time_unit"];
                        }

                        if (tag === 'Charging_Point') {

                            att = attribute[tag][0];

                            for (var elem in att) {

                                if (elem === 'KeepAliveInterval') {

                                    KeepAliveInterval = att[elem][0]['current'][0];
                                    KeepAliveInterval_time_unit = att[elem][0]["$"]["time_unit"];
                                    //KeepAliveInterval = attribute[tag][0]["KeepAliveInterval"][0]['current'][0];
                                    //KeepAliveInterval_time_unit = attribute[tag][0]["KeepAliveInterval"][0]["$"]["time_unit"];
                                }

                                if (elem === 'Dhcp') {
                                    Dhcp = att[elem][0]['current'][0];
                                    //Dhcp = attribute[tag][0]["Dhcp"][0]['current'][0];
                                }

                                if (elem === 'Network_Connection') {
                                    Network_Connection = att[elem][0]['current'][0];
                                    //Network_Connection = attribute[tag][0]["Network_Connection"][0]['current'][0];
                                }

                            }

                        }

                        if (tag === 'Operation_Center') {

                            att = attribute[tag][0];

                            for (var elem in att) {

                                if (elem === 'OC_Fqdn') {
                                    OC_Fqdn = att[elem][0]['current'][0];
                                    //OC_Fqdn = attribute[tag][0]["OC_Fqdn"][0]['current'][0];
                                }

                                if (elem === 'OC_Port') {
                                    OC_Port = att[elem][0]['current'][0];
                                    //OC_Port = attribute[tag][0]["OC_Port"][0]['current'][0];
                                }

                            }

                        }

                        if (tag === 'Timeout_Plug') {
                            Timeout_Plug = attribute[tag][0]['current'][0];
                            Timeout_Plug_time_unit = attribute[tag][0]["$"]["time_unit"];
                        }

                        if (tag === 'Timeout_Hatch') {
                            Timeout_Hatch = attribute[tag][0]['current'][0];
                            Timeout_Hatch_time_unit = attribute[tag][0]["$"]["time_unit"];
                        }

                    }
                }

                var response = [
                    {
                        'Section_Info_Interval': Section_Info_Interval,
                        'time_unit': Section_Info_Interval_time_unit
                    },
                    {
                        'KeepAliveInterval': KeepAliveInterval,
                        'time_unit': KeepAliveInterval_time_unit
                    },
                    {
                        'Timeout_Plug': Timeout_Plug,
                        'time_unit': Timeout_Plug_time_unit
                    },
                    {
                        'Timeout_Hatch': Timeout_Hatch,
                        'time_unit': Timeout_Hatch_time_unit
                    },
                    {
                        'Dhcp': Dhcp
                    },
                    {
                        'Network_Connection': Network_Connection
                    },
                    {
                        'OC_Fqdn': OC_Fqdn
                    },
                    {
                        'OC_Port': OC_Port
                    }
                ]

                resolve(response);

            } catch (error) {
                console.log('[MESSAGE] error: ' + error);
                resolve(false);
            }

        })
    }
}