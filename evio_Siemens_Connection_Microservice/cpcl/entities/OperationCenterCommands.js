const { create } = require('xmlbuilder2');
var moment = require('moment');

//Faltam ids do usuário
var ServerCommands = {
    reboot: function () {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('SERVER_COMMAND')
            .ele('REBOOT').up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    charge_section_init: function (sessionId, sessionConfig) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('SERVER_COMMAND')
            .ele('CHARGE_SECTION_INIT', { 'cs_init_type': 'new_oc' })
            .ele('Session_ID').txt(sessionId).up()
            .ele('Rfid_uid').txt("RFID").up()
            .ele('Price', { 'pricing_unit': 'EUR per kWh' }).txt(sessionConfig.price_kWh).up()
            .ele('I_TARGET', { 'i_unit': 'mA' }).txt(sessionConfig.session_max_current).up()
            .ele('T_MAX', { 'time_unit': 'Second' }).txt(sessionConfig.session_max_duration).up()
            .ele('E_MAX', { 'e_unit': 'Wh' }).txt(sessionConfig.session_max_energy_Wh).up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    charge_section_end: function (sessionId) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('SERVER_COMMAND')
            .ele('CHARGE_SECTION_END')
            .ele('Session_ID').txt(sessionId).up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    charge_section_update: function (sessionId, sessionConfig) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('SERVER_COMMAND')
            .ele('CHARGE_SECTION_UPDATE')
            .ele('Session_ID').txt(sessionId).up()
            .ele('Rfid_uid').txt("RFID").up()
            .ele('Price', { 'pricing_unit': 'EUR per kWh' }).txt(sessionConfig.price_kWh).up()
            .ele('I_TARGET', { 'i_unit': 'mA' }).txt(sessionConfig.max_charge_current).up()
            .ele('T_MAX', { 'time_unit': 'Second' }).txt(sessionConfig.max_charge_time).up()
            .ele('E_MAX', { 'e_unit': 'Wh' }).txt(sessionConfig.max_energy_Wh).up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    unlock_hatch: function () {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('SERVER_COMMAND')
            .ele('UNLOCK_HATCH').up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    unlock_plug: function () {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('SERVER_COMMAND')
            .ele('UNLOCK_PLUG').up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    reboot: function () {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('SERVER_COMMAND')
            .ele('REBOOT').up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    chargingStationStatus: function (sessionId) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': sessionId
            })
            .ele('STATES')
            .ele('Sn').up()
            .ele('Section_State')
            .ele('ID').up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    getConfiguration: function () {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('PARAMETER')
            .ele('Charging_Point')
            .ele('Section_Info_Interval', { 'time_unit': 'Second' }).up()
            .up()

            .ele('NetComm')
            .ele('Charging_Point')
            .ele('KeepAliveInterval', { 'time_unit': 'Second' }).up()
            .ele('Dhcp').up()
            .ele('Network_Connection').up()
            .up()

            .ele('Operation_Center')
            .ele('OC_Fqdn').up()
            .ele('OC_Port').up()
            .up()

            .up()
            .ele('Timeouts')
            .ele('Timeout_Plug', { 'time_unit': 'Second' }).up()
            .ele('Timeout_Hatch', { 'time_unit': 'Second' }).up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    changeConfiguration: function (configuration) {

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

        for (var config in configuration) {

            if (configuration[config]["Section_Info_Interval"]) {
                Section_Info_Interval = configuration[config]["Section_Info_Interval"];
                Section_Info_Interval_time_unit = configuration[config]["time_unit"];
            }

            if (configuration[config]["KeepAliveInterval"]) {
                KeepAliveInterval = configuration[config]["KeepAliveInterval"];
                KeepAliveInterval_time_unit = configuration[config]["time_unit"];
            }

            if (configuration[config]["Timeout_Plug"]) {
                Timeout_Plug = configuration[config]["Timeout_Plug"];
                Timeout_Plug_time_unit = configuration[config]["time_unit"];
            }

            if (configuration[config]["Timeout_Hatch"]) {
                Timeout_Hatch = configuration[config]["Timeout_Hatch"];
                Timeout_Hatch_time_unit = configuration[config]["time_unit"];
            }

            if (configuration[config]["Dhcp"]) {
                Dhcp = configuration[config]["Dhcp"];
            }

            if (configuration[config]["Network_Connection"]) {
                Network_Connection = configuration[config]["Network_Connection"];
            }

            if (configuration[config]["OC_Fqdn"]) {
                OC_Fqdn = configuration[config]["OC_Fqdn"];
            }

            if (configuration[config]["OC_Port"]) {
                OC_Port = configuration[config]["OC_Port"];
            }

        }

        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': moment().format('YYYY-MM-DDTHH:mm:ss')
            })
            .ele('PARAMETER')
            .ele('Charging_Point')
            .ele('Section_Info_Interval', { 'time_unit': Section_Info_Interval_time_unit })
            .ele('new').txt(Section_Info_Interval).up()
            .up()
            .up()

            .ele('NetComm')
            .ele('Charging_Point')
            .ele('KeepAliveInterval', { 'time_unit': KeepAliveInterval_time_unit })
            .ele('new').txt(KeepAliveInterval).up()
            .up()
            .ele('Dhcp')
            .ele('new').txt(Dhcp).up()
            .up()
            .ele('Network_Connection')
            .ele('new').txt(Network_Connection).up()
            .up()
            .up()
            .ele('Operation_Center')
            .ele('OC_Fqdn')
            .ele('new').txt(OC_Fqdn).up()
            .up()
            .ele('OC_Port')
            .ele('new').txt(OC_Port).up()
            .up()
            .up()
            .up()

            .ele('Timeouts')
            .ele('Timeout_Plug', { 'time_unit': Timeout_Plug_time_unit })
            .ele('new').txt(Timeout_Plug).up()
            .up()
            .ele('Timeout_Hatch', { 'time_unit': Timeout_Hatch_time_unit })
            .ele('new').txt(Timeout_Hatch).up()
            .up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    chargingStationIECPlugStatus: function (sessionId) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': sessionId
            })
            .ele('STATES')
            .ele('Sn').up()
            .ele('IEC_Plug_Present').up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    chargingStationHouseholdPlugStatus: function (sessionId) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': sessionId
            })
            .ele('STATES')
            .ele('Sn').up()
            .ele('Household_Plug_Present').up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    }

}

module.exports = ServerCommands;