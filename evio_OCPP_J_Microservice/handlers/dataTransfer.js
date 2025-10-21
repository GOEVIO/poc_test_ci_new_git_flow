const Promise = require('promise');
const moment = require('moment');
const global = require('../global');
const Utils = require('../utils');

var host = global.charger_microservice_host;
const chargerServiceProxy = `${host}/api/private/chargers/status`;
const chargerHeartBeatServiceProxy = `${host}/api/private/chargers/heartBeat`;
const trigger = global.triggeredByCP

module.exports = {
    handle: function (data, payload) {
        return new Promise(function (resolve, reject) {
            const context = "[DataTransfer]";

            const hwId = data.chargeBoxIdentity;

            const DataTransferResponse = [global.callResult, data.messageId, { status: global.idDataTransferStatusAccepted, data: '' }];

            const params = {
                hwId: hwId
            };

            Utils.chekIfChargerExists(chargerServiceProxy, params).then((charger) => {
                if (charger) {
                    Utils.saveLog(data.chargeBoxIdentity , payload , DataTransferResponse[2] , true , 'DataTransfer' , 'Heartbeat success' , 0 , trigger)
                    resolve(DataTransferResponse);
                }
                else {
                    console.error(`${context} Error:  Charger ${data.chargeBoxIdentity} does not exists.`);
                    Utils.saveLog(data.chargeBoxIdentity , payload , DataTransferResponse[2] , false , 'DataTransfer' , `Charger ${data.chargeBoxIdentity} does not exist` , 0 , trigger)
                    resolve(DataTransferResponse);
                }
            });
        });

    }
}