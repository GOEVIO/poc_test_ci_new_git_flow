const Promise = require('promise');
const moment = require('moment');
var Notification = require('../../models/notifications');
const global = require('../../global');
const Utils = require('../utils/utils.js')

var host = global.charger_microservice_host;
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const chargingSessionStatServiceProxy = `${host}/api/private/chargingSession/statistics`;
const context = '[MeterValues] '
module.exports = {
    handle: function (data) {

        return new Promise(function (resolve, reject) {
            var parsed = JSON.parse(JSON.stringify(data), function (k, v) {
                if (k === "$value") {
                    this.value = v;
                } else {
                    return v;
                }
            });

            data.chargeBoxIdentity = JSON.parse(JSON.stringify(data.chargeBoxIdentity), function (k, v) {
                if (k === "$value") {
                    this.value = v;
                } else {
                    return v;
                }
            });

            if (data.chargeBoxIdentity.value)
                data.chargeBoxIdentity = data.chargeBoxIdentity.value;

            var notification = new Notification({
                hwId: data.chargeBoxIdentity,
                text: 'Meter Values Received',
                unread: true,
                type: 'MeterValues',
                timestamp: moment().format(),
                data: parsed
            });


            //////////////////////////////////////////////////////////////////////
            // GET SESSION VALUES
            var instantPower = -1;
            var totalConsumed = -1;

            var meterRegistered = parsed.values.value;
            
            totalConsumed = meterRegistered.value
            
            ///////////////////////////////////////////////////////////////
            //Get Running Session

            var plugId = data.connectorId;
            //var sessionId = data.transactionId;

            var params = {
                plugId: plugId,
                chargerType: global.OCPPS_15_DeviceType,
                // sessionId: sessionId,
                status: process.env.SessionStatusRunning
            };


            Utils.getSession(chargingSessionProxy, params).then((chargingSession) => {
                if (chargingSession) {

                    var meterStart = chargingSession.meterStart;

                    // Charging Time
                    var timeChargedinSeconds = Utils.getChargingTime(chargingSession);

                    //Calculate estimatedPrice
                    var estimatedPrice = Utils.getEstimatedPrice(chargingSession);

                    var totalPowerConsumed = totalConsumed - meterStart;

                    var body = {
                        _id: chargingSession._id,
                        readingPoints: [{
                            totalPower: totalPowerConsumed,
                            instantPower: instantPower,
                            instantVoltage: -1,
                            instantAmperage: -1
                        }],
                        timeCharged: timeChargedinSeconds,
                        estimatedPrice: estimatedPrice,
                        batteryCharged: -1,
                        totalPower: totalPowerConsumed
                    }

                    Utils.updateChargingSessionMeterValues(chargingSessionStatServiceProxy, body);
                }
                else {
                    // In case of supporting rfid card, create charging session and set as running maybe
                    console.log(`${context} Critical error - Charging session not found for given parameters: `, params);
                    resolve({
                        meterValuesResponse: {}
                    });
                }
            });


            Notification.createNotification(notification, (err, result) => {
                if (err) {
                    console.log('[MeterValues] err: ' + err);
                    resolve({
                        meterValuesResponse: {}
                    });
                } else {
                    resolve({
                        meterValuesResponse: {}
                    });
                }
            });

        });
    }
}


// module.exports = {
//     handle: function(data) {

//         return new Promise(function(resolve, reject) {
//             var parsed = JSON.parse(JSON.stringify(data), function(k, v) {
//                 if (k === "$value") {
//                     this.value = v;
//                 } else {
//                     return v;
//                 }
//             });

//             // TODO: should filter by measurenad type
//             // TODO: find how to calculate station measurment
//             // TODO: Get Unit

//             // Store in Collection MeterValues
//             Storage.save('meterValues', parsed, function(err) {
//                 if (err) {
//                     console.log('error: ' + err);
//                     reject(err);
//                 } else {
//                     resolve({
//                         MeterValuesResponse: {}
//                     });
//                 }
//             });
//         });
//     }
// }
