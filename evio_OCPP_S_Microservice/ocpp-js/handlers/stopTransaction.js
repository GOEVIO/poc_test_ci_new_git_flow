const Promise = require('promise');
const moment = require('moment');
const Utils = require('../utils/utils.js');
const global = require('../../global');

var host = global.charger_microservice_host;
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const context = '[Stop Transaction] '
module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {
            try {

                //Get running charging Session

                var idTag = data.idTag;
                var sessionId = data.transactionId;

                /////////////////////////////////////////////////////////////////////////////
                //Get charging session
                var params = {
                    idTag: idTag,
                    sessionId: sessionId
                };

                Utils.getSession(chargingSessionProxy, params).then((session) => {
                    if (session) {

                        if (session.status == process.env.SessionStatusRunning) {
                            console.log(`${context}  Charging session ${session.sessionId} was stopped with RFID card, or UVE detached the plug manually, or reset function was called`);
                        }

                        var meterStop = data.meterStop;
                        var meterStart = session.meterStart;
                        var totalPowerConsumed = meterStop - meterStart;

                        var timeChargedinSeconds = Utils.getChargingTime(session);

                        //////////////////////////////////////////
                        //Accept stop transaction
                        response = {
                            stopTransactionResponse: {
                                idTagInfo: {
                                    status: global.idTagStatusAccepted
                                }
                            }
                        }

                        resolve(response);


                        //Update charging session Stoped
                        Utils.updateChargingSession2(chargingSessionProxy, process.env.SessionStatusStopped, session._id, data.meterStop, totalPowerConsumed, timeChargedinSeconds);

                        //TODO 
                        //Catch if fails - CRITICAL IF FAILS. EV is not charging and ind our DB is charging

                    } else {

                        // In case of supporting rfid card, get charging session running and check rfid tag
                        console.log(`${context} Charging session not found for given parameters: `, params);
                        response = {
                            stopTransactionResponse: {
                                idTagInfo: {
                                    status: global.idTagStatusInvalid
                                }
                            }
                        }

                        resolve(response);
                    }
                });

            } catch (err) {
                console.log("[Stop Transaction] Unxpected error: " + err)
            }
        });
    }
}
