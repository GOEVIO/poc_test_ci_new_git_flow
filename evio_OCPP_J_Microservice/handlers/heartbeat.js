const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
var context = "[Heartbeat]"
const Utils = require('../utils');

const host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerHeartBeatServiceProxy = `${host}/api/private/chargers/heartBeat`;
const trigger = global.triggeredByCP

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {

            const heartbeatResponse = [global.callResult, data.messageId, {
                currentTime: new Date().toISOString()
            }];

            const params = {
                hwId: data.chargeBoxIdentity
            };

            Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => { 
                if (charger) {
                    const body = {
                        hwId: charger.hwId
                    }

                    Utils.saveHeartBeat(chargerHeartBeatServiceProxy, body , true);
                    Utils.saveLog(data.chargeBoxIdentity , {} , heartbeatResponse[2] , true , 'Heartbeat' , 'Heartbeat success' , 0 , trigger)
                    resolve(heartbeatResponse);
                }
                else {
                    console.error(`${context} Error:  Charger ${data.chargeBoxIdentity} does not exists.`);
                    Utils.saveLog(data.chargeBoxIdentity , {} , heartbeatResponse[2] , false , 'Heartbeat' , `Charger ${data.chargeBoxIdentity} does not exist` , 0 , trigger)
                    resolve(heartbeatResponse);
                }
            });
        });
    }
}