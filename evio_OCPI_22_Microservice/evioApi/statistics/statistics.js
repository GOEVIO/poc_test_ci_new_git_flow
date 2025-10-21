const Session = require('../../models/sessions')
const global = require('../../global');

module.exports = {
    mySessions: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "GET /api/private/statistics/mySessions";

            try {
                var params = req.query;
                let evId = typeof params.evId === "string" ? JSON.parse(params.evId) : params.evId
                var query = {
                    status: global.SessionStatusStopped,
                    $and: [
                        { end_date_time: { $gte: params.startDate } },
                        { end_date_time: { $lte: params.endDate } }
                    ],
                    $or: [
                        { userIdWillPay: params.userId },
                        { userId: params.userId },
                        { evId: evId },
                        { evOwner: params.userId }
                    ]
                };

                Session.find(query, (err, chargingSession) => {
                    if (err) {
                        console.error(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            let mySessions = chargingSession.map(session => {
                                var estimatedPrice = 0;
                                if (session.total_cost) {
                                    if (session.total_cost.incl_vat)
                                        estimatedPrice = session.total_cost.incl_vat;
                                }

                                var idTag = "";
                                if (session.cdr_token != undefined)
                                    idTag = session.cdr_token.uid;
                                else
                                    idTag = session.token_uid;

                                return {
                                    "totalPower": session.totalPower,
                                    //TODO Is it total cost with vat or without vat?
                                    "estimatedPrice": estimatedPrice,
                                    "batteryCharged": session.batteryCharged,
                                    "timeCharged": session.timeCharged,
                                    "CO2Saved": session.CO2Saved,
                                    "stoppedByOwner": session.stoppedByOwner,
                                    "counter": 0,
                                    "_id": session._id,
                                    "hwId": session.location_id,
                                    "evId": session.evId,
                                    "evOwner": session.evOwner,
                                    "tarrifId": "-1",
                                    "command": session.command,
                                    "chargerType": session.chargerType,
                                    "status": "40",
                                    "userId": session.userId,
                                    "plugId": session.connector_id,
                                    "idTag": idTag,
                                    "startDate": session.start_date_time,
                                    "stopDate": session.end_date_time,
                                    "readingPoints": session.readingPoints,
                                    "feedBack": session.feedBack,
                                    "chargerOwner": session.chargeOwnerId,
                                    "bookingId": "-1",
                                    "sessionId": session.id,
                                    "cdrId": session.cdrId,
                                    "paymentId": session.paymentId,
                                    "cardNumber": session.cardNumber,
                                    "paymentMethod": session.paymentMethod,
                                    "paymentMethodId": session.paymentMethodId,
                                    "walletAmount": session.walletAmount,
                                    "reservedAmount": session.reservedAmount,
                                    "confirmationAmount": session.confirmationAmount,
                                    "userIdWillPay": session.userIdWillPay,
                                    "adyenReference": session.adyenReference,
                                    "transactionId": session.transactionId,
                                    "tariff": {},
                                    "rating": session.rating,
                                    "totalPrice": {
                                        "excl_vat": session.total_cost.excl_vat,
                                        "incl_vat": session.total_cost.incl_vat,
                                    }
                                }
                            })
                            resolve(mySessions);
                        }
                        else
                            resolve([]);
                    };
                });

            } catch (error) {
                console.error(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    changeDatesToISOString: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "GET /api/private/statistics/runFirstTime";

            try {
                Session.find({}, (err, chargingSessions) => {
                    if (err) {
                        console.error(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {
                        if (chargingSessions.length > 0) {
                            for (let session of chargingSessions) {
                                var query = { _id: session._id };

                                let new_start_date_time = session.start_date_time ? new Date(session.start_date_time).toISOString() : session.start_date_time
                                let new_end_date_time = session.end_date_time ? new Date(session.end_date_time).toISOString() : session.end_date_time

                                var newValues = {
                                    $set:
                                    {
                                        start_date_time: new_start_date_time,
                                        end_date_time: new_end_date_time,
                                    }
                                };

                                Session.updateSession(query, newValues, (err, result) => {
                                    if (err) {
                                        console.error(`ERROR: Dates of session ${session._id} not converted`);
                                    }
                                    else {
                                        console.log(`Dates of session ${session._id} converted successfully`)
                                    };
                                });
                            }
                        } else {
                            console.log(`No charging sessions to convert`)
                        }
                        resolve()
                    };
                });

            } catch (error) {
                console.error(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    }
}