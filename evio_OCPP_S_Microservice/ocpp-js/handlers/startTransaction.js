const Promise = require('promise');
const moment = require('moment');
const global = require('../../global');
const Utils = require('../utils/utils.js')

var host = global.charger_microservice_host;
const chargingSessionProxy = `${host}/api/private/chargingSession`;
const idTagProxy = `${host}/api/private/contracts/idTag`;

module.exports = {
    handle: function (data) {
        return new Promise(function (resolve, reject) {
            var context = "[StartTransaction] ";
            
            var idTag = data.idTag;

            /////////////////////////////////////////////////////////////////////////////
            //Get sessionId for given idTag - Get also userId, idTag and sessionId
            var params = {
                idTag: idTag,
                status: process.env.SessionStatusToStart
            };

            Utils.getSession(chargingSessionProxy, params).then((session) => {
                if (session) {

                    var userId = session.userId;
                    var sessionId = session.sessionId;
                    var internalSessionId = session._id;


                    /////////////////////////////////////////////////////////////////////////////
                    //Accept startTransaction
                    response = {
                        startTransactionResponse: {
                            transactionId: sessionId,
                            idTagInfo: {
                                status: global.idTagStatusAccepted
                            }
                        }
                    }
                    resolve(response);

                    //Update charging session to running
                    Utils.updateChargingSession(chargingSessionProxy, process.env.SessionStatusRunning, internalSessionId, data.meterStart, 0);

                    //TODO 
                    //Catch if fails - CRITICAL IF FAILS. EV is charging and ind our DB is not charging

                } else {

                    // In case of supporting rfid card, create charging session and set as running maybe
                    console.log(`${context} Charging session not found for given parameters: `, params);
                    response = {
                        startTransactionResponse: {
                            transactionId: sessionId,
                            idTagInfo: {
                                status: global.idTagStatusInvalid
                            }
                        }
                    }
                    resolve(response);
                }
            });
        });
    }
}


// module.exports = {
//     handle: function (data) {
//         return new Promise(function (resolve, reject) {
//             var context = "[StartTransaction] ";
//             console.log(data);
//             var idTag = data.idTag;

//             /////////////////////////////////////////////////////////////////////////////
//             //Get sessionId for given idTag - Get also userId, idTag and sessionId
//             var params = {
//                 idTag: idTag,
//                 status: process.env.SessionStatusToStart
//             };

//             Utils.getSessionForGivenIdTag(chargingSessionProxy, params).then((session) => {
//                 if (session) {

//                     var userId = session.userId;
//                     var sessionId = session.sessionId;

//                     var params = {
//                         userId: userId,
//                         idTag: idTag
//                     };

//                     /////////////////////////////////////////////////////////////////////////////
//                     //Check if tagId is valid
//                     Utils.checkIdTagValidity(idTagProxy, params).then((contract) => {
//                         if (contract) {

//                             /////////////////////////////////////////////////////////////////////////////
//                             //Accept startTransaction
//                             response = {
//                                 startTransactionResponse: {
//                                     transactionId: sessionId,
//                                     idTagInfo: {
//                                         status: global.idTagStatusAccepted
//                                     }
//                                 }
//                             }
//                             resolve(response);
//                         }
//                         else {
//                             console.log(`${context} Invalid id tag: `, params);
//                             response = {
//                                 startTransactionResponse: {
//                                     transactionId: sessionId,
//                                     idTagInfo: {
//                                         status: global.idTagStatusInvalid
//                                     }
//                                 }
//                             }
//                             resolve(response);
//                         }

//                     });

//                 } else {
//                     console.log(`${context} Charging session not found for given parameters: `, params);
//                     response = {
//                         startTransactionResponse: {
//                             transactionId: sessionId,
//                             idTagInfo: {
//                                 status: global.idTagStatusInvalid
//                             }
//                         }
//                     }
//                     resolve(response);
//                 }
//             });
//         });
//     }
// }