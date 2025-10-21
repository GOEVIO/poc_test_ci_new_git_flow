const { create } = require('xmlbuilder2');
var moment = require('moment');

//Faltam ids do usuário
var ChargingPointResponse = {
    commandAckXMLMessage: function (command_id, result) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('commandAck', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'id': command_id
            })
            .ele('result').txt(result).up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    authenticateResult: function (command_id, Rfid_uid, result) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': command_id
            })
            .ele('SERVER_COMMAND')
            .ele('AUTH_RESULT')
            .ele('ID').txt(0).up()
            .ele('Rfid_uid').txt(Rfid_uid).up()
            .ele('result').txt(result).up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    chargeSectionEndResult: function (command_id, session_id, session_price) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': command_id
            })
            .ele('SERVER_COMMAND')
            .ele('CHARGE_SECTION_INFO')
            .ele('Session_ID').txt(session_id).up()
            .ele('Session_Price').txt(session_price).up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    },
    chargeSectionInfoResult: function (command_id, session_id, session_price) {
        const root = create({ version: '1.0', encoding: 'utf-8' })
            .ele('command', {
                'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                'timestamp': moment().format('YYYY-MM-DDTHH:mm:ss'),
                'id': command_id
            })
            .ele('SERVER_COMMAND')
            .ele('CHARGE_SECTION_INFO')
            .ele('Session_ID').txt(session_id).up()
            .ele('Session_Price').txt(session_price).up()
            .up()
            .up()
            .up();
        const xml = root.end({ prettyPrint: true });
        return xml;
    }
}

module.exports = ChargingPointResponse;
