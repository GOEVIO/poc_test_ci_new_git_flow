const ChargingPointResponse = require('../entities/OperationCenterResponses')
const moment = require('moment');
const Utils = require('../entities/Utils');

var host = 'http://chargers:3002';
//var host = 'http://localhost:3002';

const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerServiceUpdateProxy = `${host}/api/private/chargers`;

module.exports = {
    handle: function (data, cs_info) {
        return new Promise(function (resolve, reject) {

            console.log(JSON.stringify("[Charging Station] KEEPALIVE Operation"));

            var command_id = data["command"]["$"]["id"].toString();

            var params = {
                hwId: cs_info.hwId
            };

            console.log("CS_INFO: "+ cs_info.hwId);

            Utils.checkIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {

                    var chargerId = charger.data.charger[0]._id;

                    var body = {
                        _id: chargerId,
                        heartBeat: new Date().toISOString()
                    }

                    //Update charger info
                    Utils.updateChargerData(chargerServiceUpdateProxy, body).then((result) => {
                        if (result) {
                            resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "OK"));
                        } else {
                            resolve(ChargingPointResponse.commandAckXMLMessage(command_id, "notOK"));
                        }
                    })
                }
            })

        })
    }
}