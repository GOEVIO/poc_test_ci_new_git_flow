require("dotenv-safe").load();
const axios = require('axios');
const Sentry = require('@sentry/node');
const global = require('../../global');
const Session = require('../../models/sessions')
const Tariff = require('../../models/tariffs')
const Utils = require('../../utils')
const CDR = require('../../models/cdrs')
const moment = require('moment');
var _ = require("underscore");
const vatService = require('../../services/vat')
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const { getCode, getName } = require('country-list');
const Constants = require('../../utils/constants');
const { sendSessionToHistoryQueue } = require('../../functions/sendSessionToHistoryQueue')
const toggle = require('evio-toggle').default;
const { Enums } = require('evio-library-commons').default;
const { CdrsService } = require("evio-library-ocpi");

module.exports = {
    myActiveSessions: function (req, res) {
        return new Promise((resolve, reject) => {

            const context = "GET /api/private/chargingSession/myActiveSessions";

            try {
                var userId = req.headers['userid'];
                var params = {
                    $or: [
                        { userId: userId },
                        { evOwner: userId }
                    ],
                    status: global.SessionStatusRunning,
                    unlockResult: { $ne: true }
                };
                Session.find(params, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err.message);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            getEvs(chargingSession)
                                .then((result) => {
                                    resolve(result);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][getEvs][.catch] Error `, error);
                                    reject(error.message);
                                });
                        }
                        else
                            resolve([]);
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    addPaymentId: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "PUT /api/private/chargingSession/addPaymentId"

            try {
                let body = req.body

                var query = { id: body.sessionId };

                if (body.sessionId.match(/^[0-9a-fA-F]{24}$/)) {
                    // Yes, it's a valid ObjectId, proceed with `findById` call.
                    query = { _id: body.sessionId };
                }

                // var query = {
                //     $or: [
                //         { id: body.sessionId },
                //         { _id: body.sessionId }
                //     ]
                // };

                let paymentStatus;
                let paymentSubStatus;
                if (body.paymentMethod === process.env.PaymentMethodNotPay) {
                    paymentStatus = process.env.ChargingSessionPaymentStatusNotApplied;
                    paymentSubStatus = "NA";
                }
                else {
                    if ([process.env.PaymentStatusPaidOut, process.env.PaymentStatusRefund].includes(body.status)) {
                        paymentStatus = process.env.ChargingSessionPaymentStatusPaid;
                        paymentSubStatus = 'PAID AND CLOSED';
                    } else {
                        paymentStatus = process.env.ChargingSessionPaymentStatusUnpaid;
                        paymentSubStatus = 'PAYMENT FAILED FOR ANY REASON';
                    };
                };

                chargingSessionFindOne(query)
                    .then(async (chargingSessionFound) => {
                        if (chargingSessionFound) {
                            const newSession = { $set: {paymentId: body._id , paymentStatus, paymentSubStatus} };
                            Session.updateSession(query, newSession, async (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateChargingSession] Error`, err);
                                    reject(err);
                                }
                                else {
                                    if (result) {
                                        sendSessionToHistoryQueue(result._id, context)
                                        resolve({ auth: true, code: 'server_paymentId_updated', message: "PaymentId updated successfully" });
                                    } else {
                                        reject({ auth: true, code: 'server_paymentId_not_updated', message: "PaymentId updated unsuccessfully" });
                                    };
                                };
                            });
                        } else {
                            reject({ auth: true, code: 'server_session_not_found', message: "No charging session was found with that sessionId" });
                        }
                    })
                    .catch((error) => {
                        console.log(`[${context}] Error `, error);
                        reject(error.message);
                    });


            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };


        })
    },
    cancelPaymentFailedSessions: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "PUT /api/private/chargingSession/cancelPaymentFaildSessions"

            try {
                let body = req.body

                var query = {
                    _id: body._id,
                };
                chargingSessionFindOne(query)
                    .then((chargingSessionFound) => {
                        if (chargingSessionFound) {
                            chargingSessionFound.paymentStatus = body.paymentStatus;
                            Session.updateSession(query, chargingSessionFound, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateChargingSession] Error`, err);
                                    reject(err);
                                }
                                else {
                                    if (result) {
                                        resolve({ auth: true, code: 'server_paymentId_updated', message: "PaymentId updated successfully" });
                                    } else {
                                        reject({ auth: true, code: 'server_paymentId_not_updated', message: "PaymentId updated unsuccessfully" });
                                    };
                                };
                            });
                        } else {
                            reject({ auth: true, code: 'server_session_not_found', message: "No charging session was found with that sessionId" });
                        }
                    })
                    .catch((error) => {
                        console.log(`[${context}] Error `, error);
                        reject(error.message);
                    });


            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        })
    },
    emptySessions: function (req, res) {
        return new Promise((resolve, reject) => {
            const context = "GET /api/private/chargingSession/emptySessions";

            try {
                var userId = req.headers['userid'];
                
                /*
                var query = {
                    userId: userId,
                    status: global.SessionStatusStopped,
                    cdrId: { $ne: "" },
                    paymentType: "AD_HOC",
                    paymentId: ""
                };
                */
                /*var query = {
                    //userId: userId,
                    status: global.SessionStatusStopped,
                    $and: [
                        { cdrId: { $ne: "-1" } },
                        { cdrId: { $ne: "NA" } }
                    ],
                    $or: [
                        {
                            paymentType: "AD_HOC",
                            $or: [
                                { paymentId: { "$exists": false } },
                                {
                                    $and: [
                                        { paymentId: { "$exists": true, $ne: "" } },
                                        { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                                    ]
                                }
                            ]
                        },
                        {
                            paymentType: "MONTHLY",
                            paymentMethod: "plafond",
                            $or: [
                                { paymentId: { "$exists": false } },
                                {
                                    $and: [
                                        { paymentId: { "$exists": true, $ne: "" } },
                                        { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                                    ]
                                }
                            ]
                        }
                    ]/*,
                    $or: [
                        { paymentId: "" },
                        { paymentId: null }
                    ],
                    $or: [
                        { paymentId: { "$exists": false } },
                        {
                            $and: [
                                { paymentId: { "$exists": true, $ne: "" } },
                                { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                            ]
                        }
                    ]*/
                //};

                var query = {
                    //userId: userId,
                    status: global.SessionStatusStopped,
                    $and: [
                        { cdrId: { $ne: "-1" } },
                        { cdrId: { $ne: "NA" } }
                    ],
                    $or: [
                        {
                            paymentType: "AD_HOC",
                            $and: [
                                {
                                    paymentMethod: { $ne: "Unknown" }
                                },
                                {
                                    paymentMethod: { $ne: "unknown" }
                                },
                                {
                                    paymentMethod: { $ne: "UNKNOWN" }
                                }
                            ],
                            $or: [
                                { paymentId: { "$exists": false } },
                                {
                                    $and: [
                                        { paymentId: { "$exists": true, $ne: "" } },
                                        { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid }
                                    ]
                                }
                            ]
                        },
                        {
                            paymentType: "AD_HOC",
                            $and: [
                                {
                                    paymentMethod: { $ne: "Unknown" }
                                },
                                {
                                    paymentMethod: { $ne: "unknown" }
                                },
                                {
                                    paymentMethod: { $ne: "UNKNOWN" }
                                }
                            ],
                            $or: [
                                { syncToPlafond: false },
                                { syncToPlafond: { "$exists": false } }
                            ],
                            plafondId: { "$exists": true, $nin: [ "-1", null ] }
                        },
                        {
                            $or: [
                                { syncToPlafond: false },
                                { syncToPlafond: { "$exists": false } }
                            ],
                            plafondId: { "$exists": true, $nin: [ "-1", null ] }
                        }
                    ]
                };

                const options =  {
                    limit: req.query.limit ? Number(req.query.limit) : Number(process.env.LimitEmptySessions),
                    sort: {createdAt: -1}
                };

                //console.log(`${context} query`, query)
                Session.find(query, {}, options, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {

                        console.log("chargingSession.length", chargingSession.length)
                        if (chargingSession.length > 0) {
                            let mySessions = chargingSession.map(session => {

                                console.log("session", session.clientName)
                                var estimatedPrice = 0;
                                if (session.total_cost) {
                                    if (session.total_cost.incl_vat)
                                        estimatedPrice = session.total_cost.incl_vat;
                                }

                                let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID

                                var idTag = "";
                                if (session.cdr_token != undefined)
                                    idTag = session.cdr_token.uid;
                                else
                                    idTag = session.token_uid;

                                return {
                                    "totalPower": session.totalPower,
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
                                    "status": status,
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
                                    "paymentMethod": session.paymentMethod,
                                    "paymentMethodId": session.paymentMethodId,
                                    "walletAmount": session.walletAmount,
                                    "reservedAmount": session.reservedAmount,
                                    "confirmationAmount": session.confirmationAmount,
                                    "userIdWillPay": session.userIdWillPay,
                                    "adyenReference": session.adyenReference,
                                    "transactionId": session.transactionId,
                                    "serviceCost": {},
                                    "rating": session.rating,
                                    "clientName": session.clientName,
                                    "plafondId": session.plafondId,
                                    "syncToPlafond": session.syncToPlafond
                                }
                            })
                            resolve(mySessions);

                        } else {
                            resolve([]);
                        }
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        })
    },
    getsessionById: function (req, res) {
        return new Promise(async (resolve, reject) => {
            const context = "GET /api/private/chargingSession/byId";

            try {

                let chargingSession = await Session.findOne(req.query)

                if (chargingSession) {


                    let session = chargingSession

                    var estimatedPrice = 0;
                    if (session.total_cost) {
                        if (session.total_cost.incl_vat)
                            estimatedPrice = session.total_cost.incl_vat;
                    }

                    let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID
                    var idTag = "";
                    if (session.cdr_token != undefined)
                        idTag = session.cdr_token.uid;
                    else
                        idTag = session.token_uid;

                    let mySessions = {
                        "totalPower": session.totalPower,
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
                        "status": status,
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
                        "paymentMethod": session.paymentMethod,
                        "paymentMethodId": session.paymentMethodId,
                        "walletAmount": session.walletAmount,
                        "reservedAmount": session.reservedAmount,
                        "confirmationAmount": session.confirmationAmount,
                        "userIdWillPay": session.userIdWillPay,
                        "adyenReference": session.adyenReference,
                        "transactionId": session.transactionId,
                        "serviceCost": {},
                        "rating": session.rating,
                        "clientName": session.clientName,
                        "plafondId": session.plafondId,
                        "syncToPlafond": session.syncToPlafond
                    }

                    resolve(mySessions);

                } else {
                    resolve(chargingSession);
                }



            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        })
    },
    findChargingSessions: function (req, res) {
        return new Promise((resolve, reject) => {
            // This endpoint was created to fetch data from charging sessions to public network notifyme logic

            var context = "GET /api/private/chargingSession/findChargingSessions";

            try {
                var query = req.body
                Session.find(query, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            resolve(chargingSession);
                        }
                        else
                            resolve([]);
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    chargingSessionById: function (req, res) {
        return new Promise((resolve, reject) => {
            // This endpoint was created to fetch a chargingSession by Id

            var context = "GET /api/private/chargingSession/chargingSessionById";

            try {
                if (!req.query._id) {
                    reject({ auth: false, code: 'server_chargingSession_id_required', message: "Charging Session id is required" });
                }
                var query = req.query
                // I'm using session.find and not session.findOne because I'm using the mapingSessionToEVIO function wich requires an array of sessions
                Session.find(query, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            mapingSessionToEVIO(chargingSession)
                                .then((result) => {

                                    let chargingSession = [];
                                    chargingSession.push(result[0]);
                                    //console.log("chargingSession", chargingSession);
                                    resolve({ chargingSession: chargingSession });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][getEvs][.catch] Error `, error);
                                    reject(error.message);
                                });
                        }
                        else
                            reject({ auth: true, code: 'server_request_not_found', message: "Request not found" });
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    sessionInfo: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "GET /api/private/chargingSession/sessionInfo";
            try {
                var userId = req.headers['userid'];
                if (!req.query._id) {
                    reject({ auth: false, code: 'server_chargingSession_id_required', message: "Charging Session id is required" });
                }
                else {
                    //console.log("userId", userId);
                    var query = {
                        _id: req.query._id,
                        // userId: userId
                    };
                    chargingSessionFindOne(query)
                        .then(async (chargingSessionFound) => {
                            if (chargingSessionFound) {
                                chargingSessionFound = JSON.parse(JSON.stringify(chargingSessionFound));
                                var queryCharger = {
                                    hwId: chargingSessionFound.location_id
                                };

                                let evInSession;
                                if (chargingSessionFound.evId && chargingSessionFound.evId !== '-1' && chargingSessionFound.paymentMethod === process.env.PaymentMethodPlafond) {
                                    evInSession = await getPlafond(chargingSessionFound.evId)
                                };

                                let idTag = "";
                                if (chargingSessionFound.cdr_token != undefined)
                                    idTag = chargingSessionFound.cdr_token.uid;
                                else
                                    idTag = chargingSessionFound.token_uid;

                                let chargersEndpoint = global.publicNetworkChargersProxy + "/" + chargingSessionFound.location_id
                                let chargerFound = await axios.get(chargersEndpoint, { queryCharger })
                                let chargerFoundFinal = JSON.parse(JSON.stringify(chargerFound.data));

                                let plug = chargerFoundFinal.plugs.filter(plug => {
                                    //console.log("plug.plugId", plug.plugId)
                                    //console.log("chargingSessionFound.plugId", chargingSessionFound.connector_id)
                                    return plug.plugId === chargingSessionFound.connector_id
                                });

                                chargerFoundFinal.plugs = plug;

                                //console.log("chargerFoundFinal", chargerFoundFinal);

                                if ((chargingSessionFound.bookingId === undefined) || (chargingSessionFound.bookingId === "")) {
                                    var bookingFound = {};
                                    if ((idTag === undefined) || (idTag === "")) {
                                        var contract = {}
                                        let sessionFound = [chargingSessionFound]
                                        let mappedChargingSession = await mapingSessionToEVIO(sessionFound)
                                            .then((result) => {

                                                return result[0]
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getEvs][.catch] Error `, error);
                                                reject(error.message);
                                            });
                                        let tariffs = await sessionSummaryTariffs(chargingSessionFound);
                                        let sessionSummary = await createSessionSummary(chargerFoundFinal, mappedChargingSession, bookingFound, contract, tariffs, evInSession);
                                        resolve(sessionSummary);
                                    }
                                    else {
                                        var queryContract = {
                                            networks: {
                                                $elemMatch: {
                                                    $or: [
                                                        {
                                                            name: "EVIO",
                                                            tokens: {
                                                                $elemMatch: {
                                                                    $or: [
                                                                        { idTagDec: idTag },
                                                                        { idTagHexa: idTag },
                                                                        { idTagHexaInv: idTag }
                                                                    ]
                                                                }
                                                            }
                                                        },
                                                        {
                                                            name: "MobiE",
                                                            tokens: {
                                                                $elemMatch: {
                                                                    $or: [
                                                                        { idTagDec: idTag },
                                                                        { idTagHexa: idTag },
                                                                        { idTagHexaInv: idTag }
                                                                    ]
                                                                }
                                                            }
                                                        },
                                                        {
                                                            name: "Gireve",
                                                            tokens: {
                                                                $elemMatch: {
                                                                    $or: [
                                                                        { idTagDec: idTag },
                                                                        { idTagHexa: idTag },
                                                                        { idTagHexaInv: idTag }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    ]

                                                }
                                            }
                                        };
                                        let contract = await getcontract(queryContract);
                                        let sessionFound = [chargingSessionFound]
                                        let mappedChargingSession = await mapingSessionToEVIO(sessionFound)
                                            .then((result) => {

                                                return result[0]
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getEvs][.catch] Error `, error);
                                                reject(error.message);
                                            });
                                        let tariffs = await sessionSummaryTariffs(chargingSessionFound);
                                        let sessionSummary = await createSessionSummary(chargerFoundFinal, mappedChargingSession, bookingFound, contract, tariffs, evInSession);
                                        resolve(sessionSummary);
                                    };
                                }
                                else {
                                    var queryBooking = {
                                        _id: chargingSessionFound.bookingId
                                    };
                                    let bookingFound = await getBooking(queryBooking);
                                    if ((idTag === undefined) || (idTag === "")) {
                                        var contract = {}
                                        let sessionFound = [chargingSessionFound]
                                        let mappedChargingSession = await mapingSessionToEVIO(sessionFound)
                                            .then((result) => {

                                                return result[0]
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getEvs][.catch] Error `, error);
                                                reject(error.message);
                                            });
                                        let tariffs = await sessionSummaryTariffs(chargingSessionFound);
                                        let sessionSummary = await createSessionSummary(chargerFoundFinal, mappedChargingSession, bookingFound, contract, tariffs, evInSession);
                                        resolve(sessionSummary);
                                    }
                                    else {
                                        var queryContract = {
                                            networks: {
                                                $elemMatch: {
                                                    $or: [
                                                        {
                                                            name: "EVIO",
                                                            tokens: {
                                                                $elemMatch: {
                                                                    $or: [
                                                                        { idTagDec: idTag },
                                                                        { idTagHexa: idTag },
                                                                        { idTagHexaInv: idTag }
                                                                    ]
                                                                }
                                                            }
                                                        },
                                                        {
                                                            name: "MobiE",
                                                            tokens: {
                                                                $elemMatch: {
                                                                    $or: [
                                                                        { idTagDec: idTag },
                                                                        { idTagHexa: idTag },
                                                                        { idTagHexaInv: idTag }
                                                                    ]
                                                                }
                                                            }
                                                        },
                                                        {
                                                            name: "Gireve",
                                                            tokens: {
                                                                $elemMatch: {
                                                                    $or: [
                                                                        { idTagDec: idTag },
                                                                        { idTagHexa: idTag },
                                                                        { idTagHexaInv: idTag }
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    ]

                                                }
                                            }
                                        };
                                        let contract = await getcontract(queryContract);
                                        let sessionFound = [chargingSessionFound]
                                        let mappedChargingSession = await mapingSessionToEVIO(sessionFound)
                                            .then((result) => {

                                                return result[0]
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getEvs][.catch] Error `, error);
                                                reject(error.message);
                                            });
                                        let tariffs = await sessionSummaryTariffs(chargingSessionFound);
                                        let sessionSummary = await createSessionSummary(chargerFoundFinal, mappedChargingSession, bookingFound, contract, tariffs, evInSession);
                                        resolve(sessionSummary);
                                    };
                                };

                            }
                            else {
                                reject({ auth: true, code: 'server_chargingSesion_not_found', message: "Charging session not found for given parameters" });
                            };
                        })
                        .catch((error) => {
                            console.log(`[${context}] Error `, error);
                            reject(error.message);
                        });
                };
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    sessionRating: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "PUT /api/private/chargingSession/sessionRating";
            try {
                var session = req.body;
                //console.log("session", session);
                var query = {
                    _id: session._id
                };
                var sum = 0;
                Promise.all(
                    session.feedBack.map(feedBack => {
                        return new Promise((resolve) => {
                            sum += feedBack.value;
                            resolve(true);
                        });
                    })
                ).then(() => {
                    session.rating = (sum / session.feedBack.length);

                    var newSession = { $set: session };
                    Session.updateSession(query, newSession, (err, result) => {
                        if (err) {
                            console.log(`[${context}][updateChargingSession] Error`, err);
                            reject(err);
                        }
                        else {
                            if (result) {
                                sendSessionToHistoryQueue(result?._id, context);
                                var host = global.publicNetworkUpdateChargerRatingProxy

                                var data = {
                                    hwId: result.location_id,
                                    rating: session.rating
                                };
                                axios.patch(host, data)
                                    .then((value) => {
                                        resolve(value.data);
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][Axis patch ${host}] Error `, error.message);
                                        reject(error.response.data);
                                    });
                            }
                            else {
                                reject({ auth: false, code: 'server_rating_not_updated', message: "Rating updated unsuccessfully" });
                            };
                        };
                    });
                });
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        })
    },
    sessionsByEV: function (req, res) {
        return new Promise((resolve, reject) => {

            var context = "GET /api/private/chargingSession/sessionsByEV";

            try {

                let evId = req.params.evId;
                let query = {
                    evId: evId
                };
                Session.find(query, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err.message);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            mapingSessionToEVIO(chargingSession)
                                .then((result) => {
                                    resolve(result);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][getEvs][.catch] Error `, error);
                                    reject(error.message);
                                });
                        }
                        else
                            resolve([]);
                    };
                });


            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    addEVOwnerToSession: function (req, res) {
        return new Promise((resolve, reject) => {

            var context = "POST /api/private/chargingSession/runFirstTime";

            try {

                let query = {
                    evId: { $ne: '-1' }
                };

                Session.find(query, (err, sessions) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err.message);
                        reject(err);
                    }
                    else {
                        if (sessions.length > 0) {
                            sessions.map(session => {
                                getEVAllByEvId(session.evId)
                                    .then(ev => {

                                        let newValues = {
                                            $set: {
                                                evOwner: ev.userId,
                                                invoiceType: ev.invoiceType,
                                                invoiceCommunication: ev.invoiceCommunication
                                            }
                                        };

                                        Session.updateSession({ _id: session._id }, newValues, (err, result) => {
                                            if (err) {
                                                console.log("Error", err.message);
                                                resolve();
                                            }
                                            else {
                                                console.log("Session Updated");
                                                resolve();
                                            };
                                        });

                                    });
                            })

                        }
                        else
                            resolve([]);
                    }
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        })
    },
    numberOfSessions: function (req, res) {
        return new Promise((resolve, reject) => {

            var context = "GET /api/private/chargingSession/numberOfSessions";

            try {

                let userId = req.params.userId;
                let query = {
                    userId: userId,
                    status: 'COMPLETED'
                };

                Session.count(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err.message);
                    }
                    else {

                        resolve({ numberOfSessions: result });

                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    sessionsKPIs: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "GET /api/private/chargingSession/sessionsKPIs";

            try {

                let pipeline = [
                    {
                        "$match": {
                            "status": "COMPLETED"
                        }
                    },
                    {
                        "$group": {
                            "_id": {},
                            "SUM(totalPower)": {
                                "$sum": "$totalPower"
                            },
                            "SUM(timeCharged)": {
                                "$sum": "$timeCharged"
                            },
                            "COUNT(status)": {
                                "$sum": 1
                            }
                        }
                    },
                    {
                        "$project": {
                            "timeCharged": "$SUM(timeCharged)",
                            "totalPower": "$SUM(totalPower)",
                            "numberOfSession": "$COUNT(status)",
                            "_id": 0
                        }
                    }
                ];

                let sessions = await Session.aggregate(pipeline);
                let response = {
                    totalPower: sessions[0].totalPower,
                    timeCharged: sessions[0].timeCharged,
                    totalNumberOfSessions: sessions[0].numberOfSession
                };

                return res.status(200).send(response);

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    getMonthlyBilling: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "GET /api/private/chargingSession/monthlyBilling";
            console.log("req.body", req.body);

            let received = req.body;
            let userId = received.userId;
            let startDate = received.startDate;
            let endDate = received.endDate;
            //let month = received.month;
            delete received.startDate;
            delete received.endDate;
            delete received.userId;
            //let year = new Date().getFullYear();

            startDate = `${startDate}T00:00`;
            endDate = `${endDate}T23:59`;

            let queryCreated = {
                $and: [
                    { status: global.SessionStatusStopped },
                    { paymentType: "MONTHLY" },
                    { minimumBillingConditions: true },
                    { end_date_time: { $gte: startDate } },
                    { end_date_time: { $lte: endDate } },
                    { cdrId: { "$exists": true, "$ne": "" } },
                    { cdrId: { "$exists": true, "$ne": "NA" } },
                    { cdrId: { "$exists": true, "$ne": "-1" } },
                    {
                        $or: [
                            { userId: userId },
                            { userIdWillPay: userId }
                        ]
                    },
                    {
                        $or: [
                            { paymentId: "" },
                            { paymentId: null }
                        ]
                    }
                ]
            };

            let query = Object.assign(received, queryCreated);

            Session.find(query, async (err, chargingSession) => {
                if (err) {
                    console.log(`[${context}][find] Error `, err);
                    reject(null);
                }
                else {
                    if (chargingSession.length > 0) {
                        let responseBody = await buildSessionsInvoice(chargingSession)
                        resolve(responseBody)
                    }
                    else {
                        resolve(null);
                    }
                };
            });
        })
    },
    paymentStatusMonthlyBilling: function (req, res) {
        return new Promise((resolve, reject) => {
            let context = "PUT /api/private/chargingSession/paymentStatusMonthlyBilling";

            let { sessionId, status, transactionId, paymentId } = req.body

            let paymentStatus;
            if (status === "20") {
                paymentStatus = process.env.ChargingSessionPaymentStatusPaidWaitingEVIO
            } else if (status === "40") {
                paymentStatus = process.env.ChargingSessionPaymentStatusPaid
            } else {
                paymentStatus = process.env.ChargingSessionPaymentStatusUnpaid
            }

            let newValues = {
                paymentStatus,
                transactionId,
                paymentId
            }

            let query = {
                _id: sessionId
            }

            Session.updateMany(query, newValues, async (err, result) => {
                if (err) {
                    console.log(`[${context}][updateChargingSession] Error`, err);
                    reject(false);
                }
                else {
                    if (result) {
                        if (result.nModified == result.n) {
                            if (Array.isArray(sessionId) && sessionId.length > 0) {
                                sessionId.forEach((id) =>  sendSessionToHistoryQueue(id, `${context} - updateMany`))
                            }
                            resolve(true);
                        }
                        resolve(false)
                    } else {
                        reject(false);
                    };
                };
            });


        })
    },
    invoiceStatusMonthlyBilling: function (req, res) {
        return new Promise((resolve, reject) => {
            let context = "PUT /api/private/chargingSession/invoiceStatusMonthlyBilling";

            let { sessionId, invoiceStatus, invoiceId } = req.body

            let newValues = {
                invoiceStatus,
                invoiceId,
            }

            let query = {
                _id: sessionId
            }

            Session.updateMany(query, newValues, async (err, result) => {
                if (err) {
                    console.log(`[${context}][updateChargingSession] Error`, err);
                    reject(false);
                }
                else {
                    if (result) {
                        if (result.nModified == result.n) {
                            if (Array.isArray(sessionId) && sessionId.length > 0) {
                                sessionId.forEach((id) =>  sendSessionToHistoryQueue(id, `${context} - updateMany`))
                            }
                            resolve(true);
                        }
                        resolve(false)
                    } else {
                        reject(false);
                    };
                };
            });


        })
    },
    updateCemeByUser: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "POST /api/private/chargingSession/runFirstTime";

            try {

                let userId = req.body.userId;
                let newCeme = await getCemeByUser(userId);

                //console.log("newCeme", newCeme);
                let query = {
                    $or: [
                        { userIdWillPay: userId },
                        { userId: userId }
                    ]
                };


                let tariffCEME = {
                    tariffCEME: newCeme
                };

                Session.updateMany({ userIdWillPay: userId }, { $set: tariffCEME }, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    }
                    else {
                        // console.log("result", result);
                        if (result.n === result.nModified) {
                            resolve(`${result.nModified} sessions were updated`);
                        }
                        else {
                            resolve("Not Updated")
                        }
                    }
                })

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        })
    },
    updateNewCalc: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "POST /api/private/chargingSession/runFirstTime";

            try {

                let userId = req.body.userId;
                var query = {
                    userIdWillPay: userId,
                    end_date_time: { $gte: "2021-05-01T00:00:00.000Z" },
                    $and: [
                        { cdrId: { "$exists": true, "$ne": "" } },
                        { cdrId: { "$exists": true, "$ne": "NA" } },
                        { cdrId: { "$exists": true, "$ne": "-1" } }
                    ]
                };

                Session.find(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    }
                    else {
                        //console.log("result", result.length);
                        if (result.length > 0) {
                            Promise.all(
                                result.map(session => {
                                    return new Promise((resolve, reject) => {

                                        let cemePrice_excl_vat = Number((session.kwh * session.tariffCEME.tariff[0].price).toFixed(2));
                                        let cemePrice_incl_vat = Number((cemePrice_excl_vat + (cemePrice_excl_vat * session.fees.IVA)).toFixed(2));

                                        let opcPrice_excl_vat;
                                        let iecPrice_excl_vat;
                                        let tarPrice_excl_vat;

                                        //console.log("session.finalPrices.opcPrice", session.finalPrices.opcPrice);
                                        //console.log("session.finalPrices.iecPrice", session.finalPrices.iecPrice);
                                        //console.log("session.finalPrices.tarPrice", session.finalPrices.tarPrice);

                                        //Verify if opcPrice exist
                                        if (session.finalPrices.opcPrice)
                                            opcPrice_excl_vat = session.finalPrices.opcPrice.excl_vat;
                                        else
                                            opcPrice_excl_vat = 0;

                                        //Verify if iecPrice exist
                                        if (session.finalPrices.iecPrice)
                                            iecPrice_excl_vat = session.finalPrices.iecPrice.excl_vat;
                                        else
                                            iecPrice_excl_vat = 0;

                                        //Verify if tarPrice exist
                                        if (session.finalPrices.tarPrice)
                                            tarPrice_excl_vat = session.finalPrices.tarPrice.excl_vat;
                                        else
                                            tarPrice_excl_vat = 0;

                                        let total_cost_excl_vat = Number((opcPrice_excl_vat + iecPrice_excl_vat + tarPrice_excl_vat + cemePrice_excl_vat + 0.30).toFixed(2));
                                        let total_cost_incl_vat = Number((total_cost_excl_vat + (total_cost_excl_vat * session.fees.IVA)).toFixed(2));

                                        let cemePrice = {
                                            excl_vat: cemePrice_excl_vat,
                                            incl_vat: cemePrice_incl_vat
                                        };

                                        let total_cost = {
                                            excl_vat: total_cost_excl_vat,
                                            incl_vat: total_cost_incl_vat
                                        }

                                        session.finalPrices.cemePrice = cemePrice;
                                        session.finalPrices.totalPrice = total_cost;
                                        session.total_cost = total_cost;

                                        Session.updateSession({ _id: session._id }, { $set: session }, (err, result) => {
                                            if (err) {
                                                console.log(`[${context}] Error `, err.message);
                                                reject(err);
                                            }
                                            else {
                                                if (result) {
                                                    resolve(true);
                                                }
                                                else {
                                                    resolve(false);
                                                }
                                            }
                                        });
                                    })
                                })
                            ).then((response) => {

                                let numberOfSessions = response.filter(session => { return session === true });
                                resolve(`${numberOfSessions.length} sessions were updated`);

                            }).catch((error) => {
                                console.log(`[${context}] Error `, error.message);
                                reject(error);
                            })
                        }
                        else {
                            resolve("No sessions Found");
                        }

                    }
                });


            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        })
    },
    fixAdHocB2Bsessions: function (req, res) {
        return new Promise(async (resolve, reject) => {
            var context = "POST /api/private/chargingSession/fixAdHocB2Bsessions";

            try {
                var query = {
                    "paymentType": "AD_HOC",
                    "paymentMethod": "transfer",
                    "paymentStatus": "UNPAID"
                };

                Session.find(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    }
                    else {
                        //console.log("result", result.length);
                        if (result.length > 0) {
                            Promise.all(
                                result.map(session => {
                                    return new Promise((resolve, reject) => {

                                        let newValues = {
                                            $set: {
                                                paymentType: "MONTHLY",
                                                paymentId: "",
                                                transactionId: "",
                                                paymentSubStatus: ""
                                            }
                                        };

                                        Session.updateSession({ _id: session._id }, newValues, (err, result) => {
                                            if (err) {
                                                console.log(`[${context}] Error `, err.message);
                                                reject(err);
                                            }
                                            else {
                                                if (result) {
                                                    resolve(true);
                                                }
                                                else {
                                                    resolve(false);
                                                }
                                            }
                                        });
                                    })
                                })
                            ).then((response) => {

                                let numberOfSessions = response.filter(session => { return session === true });
                                resolve(`${numberOfSessions.length} sessions were updated`);

                            }).catch((error) => {
                                console.log(`[${context}] Error `, error.message);
                                reject(error);
                            })
                        }
                        else {
                            resolve("No sessions Found");
                        }

                    }
                });


            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };
        })

    },
    fixMissingTotalCost: function (req, res) {
        return new Promise(async (resolve, reject) => {
            var context = "POST /api/private/chargingSession/fixMissingTotalCost";

            try {
                var query = {
                    "$or": [
                        {
                            "total_cost": { "$exists": true },
                            "total_cost.incl_vat": { "$exists": false }
                        },
                        {
                            "total_cost": { "$exists": false }
                        }
                    ],
                    "status": { "$ne": "INVALID" }
                }

                Session.find(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    } else {
                        // console.log("result", result.length);
                        if (result.length > 0) {
                            Promise.all(
                                result.map(session => {
                                    return new Promise(async (resolve, reject) => {

                                        let totalCost = { excl_vat: 0, incl_vat: 0 }
                                        if (session.finalPrices !== null && session.finalPrices !== undefined) {
                                            totalCost = session.finalPrices.totalPrice

                                        } else {
                                            //Obter inicio de sessão de carregamento à sessão de carregamento

                                            if (
                                                (session.fees !== null && session.fees !== undefined) &&
                                                (session.tariffOPC !== null && session.tariffOPC !== undefined) &&
                                                (session.tariffCEME !== null && session.tariffCEME !== undefined)
                                            ) {
                                                var startDate = session.start_date_time
                                                var dateNow = moment();
                                                if ('end_date_time' in session) {
                                                    dateNow = moment.utc(session.end_date_time);
                                                }

                                                var VAT_Price = session?.fees?.VAT ?? await vatService.getVATwithViesVAT(session); //Iva


                                                //console.log("startDate:", startDate)
                                                //console.log("dateNow:", dateNow)

                                                //Calcular tempo total de carregamento
                                                var timeChargedinSeconds = Utils.getChargingTime(startDate, dateNow);

                                                //Obter energia total consumida ao payload do request
                                                var totalPowerConsumed_Kw = session.kwh >= 0 ? session.kwh : 0
                                                var totalPowerConsumed_W = 0;

                                                if (session.kwh >= 0) {
                                                    totalPowerConsumed_Kw = session.kwh;
                                                    totalPowerConsumed_W = totalPowerConsumed_Kw * 1000;
                                                }

                                                //Calcular estimativa de custo
                                                var estimatedPrice_excl_Vat = -1;
                                                var estimatedPrice_incl_Vat = -1;
                                                var priceComponents = session.tariffOPC.elements;

                                                let offset = Utils.getChargerOffset(session.timeZone, session.country_code, null, null)

                                                priceComponents = priceComponents ? Utils.createTariffElementsAccordingToRestriction(priceComponents, startDate, dateNow.utc().format()) : priceComponents

                                                let [flat, energy, time, parking] = Utils.opcTariffsPrices(null, priceComponents, startDate, dateNow.utc().format(), offset, session.plugPower, session.plugVoltage, totalPowerConsumed_Kw, timeChargedinSeconds / 3600, 0, session.source)

                                                let [
                                                    OCP_PRICE_FLAT,
                                                    OCP_PRICE_ENERGY,
                                                    OCP_PRICE_TIME,
                                                    OCP_PRICE_PARKING_TIME
                                                ] = [flat.price, energy.price, time.price, parking.price]

                                                let OPC_Price = OCP_PRICE_FLAT + OCP_PRICE_ENERGY + OCP_PRICE_TIME + OCP_PRICE_PARKING_TIME

                                                let opc = { flat, energy, time, parking, price: OPC_Price }

                                                // ======================= CEME and TAR ======================= //

                                                //We get local iso dates because of TAR schedules
                                                let localSessionStartDate = moment.utc(startDate).add(offset, 'minutes').format()
                                                let localSessionStopDate = moment.utc(dateNow.utc().format()).add(offset, 'minutes').format()

                                                let { ceme, tar } = Utils.calculateCemeAndTar(session.schedulesCEME, session.tariffCEME, session.tariffTAR, timeChargedinSeconds / 3600, totalPowerConsumed_Kw, localSessionStartDate, localSessionStopDate, session.voltageLevel)

                                                // ======================= FEES ======================= //

                                                let iec = { price: session.fees.IEC * totalPowerConsumed_Kw }

                                                let opcPrice = { excl_vat: this.round(opc.price), incl_vat: this.round(opc.price + (VAT_Price * opc.price)) }

                                                let Ad_Hoc_activationFee = Utils.getOcpiActivationFee(new Date(dateNow), session)
                                                // let Ad_Hoc_activationFee = 0
                                                // if (session.paymentType == "AD_HOC" && session.paymentMethod == "card") {
                                                //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Card);
                                                // } else if (session.paymentType == "AD_HOC" && session.paymentMethod == "wallet") {
                                                //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                                                // } else {
                                                //     Ad_Hoc_activationFee = Number(process.env.AD_HOC_Activation_Fee_Wallet);
                                                // }

                                                let mobiEGrant = session.discount ? session.discount : Number(process.env.MobiE_Grant)

                                                let CEME_Price_TOTAL = ceme.price + Ad_Hoc_activationFee + mobiEGrant;
                                                let CEME_PRICE_inc_vat = CEME_Price_TOTAL + (VAT_Price * CEME_Price_TOTAL);
                                                let cemePrice = { excl_vat: this.round(CEME_Price_TOTAL), incl_vat: this.round(CEME_PRICE_inc_vat) }

                                                let tarPrice = { excl_vat: this.round(tar.price), incl_vat: this.round(tar.price + (VAT_Price * tar.price)) }


                                                let iecPrice = { excl_vat: this.round(iec.price), incl_vat: this.round(iec.price + (VAT_Price * iec.price)) }

                                                // //Calculate OPC Prices
                                                // var OPC_Price_FLAT = 0;
                                                // var OPC_Price_TIME = 0;
                                                // var OPC_Price_POWER = 0;
                                                // priceComponents.map(function (item) {

                                                //     if (item.price_components[0].type == 'FLAT') {
                                                //         OPC_Price_FLAT = item.price_components[0].price;
                                                //     }
                                                //     else if (item.price_components[0].type == 'TIME') {
                                                //         OPC_Price_TIME = item.price_components[0].price;
                                                //     }
                                                //     else if (item.price_components[0].type == 'ENERGY') {
                                                //         OPC_Price_POWER = item.price_components[0].price;
                                                //     }
                                                // });

                                                // //Sometimes charging station sent negative values in kw attribute.
                                                // var aux_totalPowerConsumed_Kw = 0;
                                                // if (totalPowerConsumed_Kw >= 0)
                                                //     aux_totalPowerConsumed_Kw = totalPowerConsumed_Kw;

                                                // var OPC_Price = OPC_Price_FLAT + ((timeChargedinSeconds / 60) * OPC_Price_TIME) + (aux_totalPowerConsumed_Kw * OPC_Price_POWER);


                                                // var CEME_Price_POWER = session.tariffCEME.tariff[0].price;
                                                // var CEME_Price = CEME_Price_POWER * aux_totalPowerConsumed_Kw;

                                                // var IEC_Price = session.fees.IEC * aux_totalPowerConsumed_Kw;

                                                // var voltageLevel = "BTN";

                                                // if (session.voltageLevel !== undefined && session.voltageLevel !== null) {
                                                //     voltageLevel = session.voltageLevel;
                                                // }

                                                // //TAR FEE
                                                // var scheduleTime = Utils.getCemeScheduleTime();


                                                // var time = dateNow.format('HH:mm');

                                                // var tariffType = "server_empty";
                                                // var TAR_Schedule = _.where(scheduleTime, { tariffType: session.tariffCEME.tariffType, cycleType: session.tariffCEME.cycleType }); //Taxa TAR
                                                // if (time >= '00:00' && time <= '08:00') {
                                                //     tariffType = TAR_Schedule[0].schedules[0].tariffType;
                                                // }
                                                // if (time > '08:00' && time <= '22:00') {
                                                //     tariffType = TAR_Schedule[0].schedules[1].tariffType;
                                                // }
                                                // if (time > '22:00' && time <= '24:00') {
                                                //     tariffType = TAR_Schedule[0].schedules[2].tariffType;
                                                // }

                                                // //TODO
                                                // //No futuro devemos melhorar isto para somar os valores corretos em função do horário de carregamento (vazio, fora vazio, ponta, cheias, etc. Ver exemplos da Mobie nos CDRs)
                                                // var TAR_Tariffs = Utils.getTariffTAR("").tariff;
                                                // var TAR_Tariff = _.where(TAR_Tariffs, { voltageLevel: voltageLevel, tariffType: tariffType }); //Taxa TAR

                                                // var TAR_Price = TAR_Tariff[0].price * aux_totalPowerConsumed_Kw;

                                                //VAT

                                                //Final PRICES
                                                estimatedPrice_excl_Vat = opcPrice.excl_vat + cemePrice.excl_vat + tarPrice.excl_vat + iecPrice.excl_vat;
                                                estimatedPrice_incl_Vat = opcPrice.incl_vat + cemePrice.incl_vat + tarPrice.incl_vat + iecPrice.incl_vat;

                                                totalCost = { excl_vat: estimatedPrice_excl_Vat, incl_vat: estimatedPrice_incl_Vat }

                                            }
                                        }
                                        var newValues = {
                                            total_cost: totalCost,
                                        };


                                        Session.updateSession({ _id: session._id }, newValues, (err, result) => {
                                            if (err) {
                                                console.log(`[${context}] Error `, err.message);
                                                reject(err);
                                            }
                                            else {
                                                if (result) {
                                                    resolve(true);
                                                }
                                                else {
                                                    resolve(false);
                                                }
                                            }
                                        });
                                    })
                                })
                            ).then((response) => {

                                let numberOfSessions = response.filter(session => { return session === true });
                                resolve(`${numberOfSessions.length} sessions were updated`);

                            }).catch((error) => {
                                console.log(`[${context}] Error `, error.message);
                                reject(error);
                            })
                        }
                        else {
                            resolve("No sessions Found");
                        }

                    }
                });


            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };
        })

    },
    toHistory: function (req, res) {
        const context = "GET /api/private/chargingSession/toHistory";
        return new Promise(async (resolve, reject) => {

            try {

                var query = {
                    $or: [
                        {
                            $and: [
                                { "status": "COMPLETED" },
                                {
                                    $and: [
                                        { cdrId: { "$exists": true, "$ne": "" } },
                                        { cdrId: { "$exists": true, "$ne": "NA" } },
                                        //{ cdrId: { "$exists": true, "$ne": "-1" } }
                                    ]
                                },
                                {
                                    $or: [
                                        { "sessionSync": false },
                                        { "sessionSync": { "$exists": false } }
                                    ]
                                }
                            ]
                        },
                        {
                            $and: [
                                { "status": global.SessionStatusExpired },
                                {
                                    $or: [
                                        { "sessionSync": false },
                                        { "sessionSync": { "$exists": false } }
                                    ]
                                }
                            ]
                        }
                    ]

                }

                Session.find(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}][Session.find] Error `, err.message);
                        reject(err);
                    } else {
                        if (result.length > 0) {
                            mapingSessionToHistoryEVIO(result)
                                .then(result => {
                                    resolve(result);
                                })
                                .catch(error => {
                                    console.log(`[${context}][mapingSessionToHistoryEVIO] Error `, error.message);
                                    reject(error);
                                });

                        } else {
                            resolve(result);
                        }
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    },
    updatedToHistory: function (req, res) {
        const context = "GET /api/private/chargingSession/updatedToHistory";
        return new Promise(async (resolve, reject) => {

            try {

                /*
                const today = new Date()
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)
                today.toDateString()
                yesterday.toDateString()

                let todayYear = today.getFullYear();
                let yesterdayYear = yesterday.getFullYear();
                let todayDay;
                let todayMonth;
                let yesterdayMonth;
                let yesterdayDay;

                if (today.getDate() < 10) {
                    todayDay = "0" + today.getDate();
                } else {
                    todayDay = today.getDate();
                };

                if (yesterday.getDate() < 10) {
                    yesterdayDay = "0" + yesterday.getDate();
                } else {
                    yesterdayDay = yesterday.getDate();
                };

                if ((today.getMonth() + 1) < 10) {
                    todayMonth = "0" + (today.getMonth() + 1)
                } else {
                    todayMonth = today.getMonth() + 1
                };

                if ((yesterday.getMonth() + 1) < 10) {
                    yesterdayMonth = "0" + (yesterday.getMonth() + 1)
                } else {
                    yesterdayMonth = yesterday.getMonth() + 1
                };

                let startDate = new Date(`${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}T00:00:00.000Z`);
                let endDate = new Date(`${todayYear}-${todayMonth}-${todayDay}T00:00:00.000Z`);
                */

                let received = req.query;
                console.log(req.query);

                var query = {
                    "status": "COMPLETED",
                    "sessionSync": true,
                    $and: [
                        { updatedAt: { $gte: received.startDate } },
                        { updatedAt: { $lt: received.endDate } }
                    ]
                }

                Session.find(query, (err, result) => {
                    if (err) {
                        console.error(`[${context}][Session.find] Error `, err.message);
                        Sentry.captureException(err);

                        reject(err);
                    } else {
                        //console.log("result", result);
                        if (result.length > 0) {
                            //mapingSessionToEVIO(result)
                            mapingSessionToHistoryEVIO(result)
                                .then(result => {
                                    resolve(result);
                                })
                                .catch(error => {
                                    console.log(`[${context}][mapingSessionToEVIO] Error `, error.message);
                                    reject(error);
                                });

                        } else {
                            resolve(result);
                        }
                    }
                });

            } catch (error) {
                Sentry.captureException(error);
                console.error(`[${context}] Error `, error.message);

                reject(error);
            }

        });
    },
    updateSessionSync: function (req, res) {
        var context = "PATCH /api/private/chargingSession/updateSessionSync";
        return new Promise(async (resolve, reject) => {

            try {

                let query = {
                    _id: req.params.id
                };

                Session.updateSession(query, { $set: { sessionSync: true } }, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    } else {

                        resolve(result);

                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    },
    addToHistory: function (req, res) {
        var context = "POST /api/private/chargingSession/runFirstTime";
        return new Promise(async (resolve, reject) => {

            try {

                var query = {
                    "status": "COMPLETED",
                    $and: [
                        { cdrId: { "$exists": true, "$ne": "" } },
                        { cdrId: { "$exists": true, "$ne": "NA" } },
                        //{ cdrId: { "$exists": true, "$ne": "-1" } }
                    ]

                }
                Session.updateSession(query, { $set: { sessionSync: false } }, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    } else {

                        resolve(result);

                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    },
    addMinimumBillingConditions: function (req, res) {
        var context = "POST /api/private/chargingSession/runFirstTime";
        return new Promise(async (resolve, reject) => {

            try {
                Session.find({ status: global.SessionStatusStopped }, async (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    } else {
                        if (result.length > 0) {
                            for (sessionI of result) {
                                await updateSessionWithMinimumBilling(sessionI)
                            }
                            resolve("OK")
                        }
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    },
    addAddressToSessions: function (req, res) {
        var context = "POST /api/private/chargingSession/runFirstTime";
        return new Promise(async (resolve, reject) => {

            try {
                Session.find({}, async (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    } else {
                        if (result.length > 0) {
                            for (sessionI of result) {
                                let chargerResult = await Utils.getCharger(sessionI.location_id, sessionI.connector_id);
                                if (chargerResult) {
                                    await Session.updateOne({ _id: sessionI._id }, { $set: { address: chargerResult.charger.address } })
                                }
                            }
                        }
                        resolve("OK")
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    },
    addCpoCountryCodeToSessions: function (req, res) {
        var context = "POST /api/private/chargingSession/runFirstTime";
        return new Promise(async (resolve, reject) => {

            try {
                Session.find({}, async (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    } else {
                        if (result.length > 0) {
                            for (sessionI of result) {
                                let chargerResult = await Utils.getCharger(sessionI.location_id, sessionI.connector_id);
                                if (chargerResult) {
                                    let cpoCountryCode = ""
                                    if (chargerResult.charger.cpoCountryCode !== null && chargerResult.charger.cpoCountryCode !== undefined) {
                                        cpoCountryCode = chargerResult.charger.cpoCountryCode
                                    } else {
                                        cpoCountryCode = chargerResult.charger.countryCode
                                    }
                                    await Session.updateOne({ _id: sessionI._id }, { $set: { cpoCountryCode: cpoCountryCode } })
                                }
                            }
                        }
                        resolve("OK")
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    },
    updateCO2Saved: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "POST /api/private/chargingSession/runFirstTime";

            try {
                let query = {
                    status: "COMPLETED"
                }

                Session.find(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    }
                    if (result.length > 0) {
                        Promise.all(
                            result.map(session => {
                                return new Promise((resolve, reject) => {
                                    let CO2Saved = parseFloat((Number(process.env.CarbonIntensity) * session.kwh).toFixed(2));
                                    if (CO2emitted < 0)
                                        CO2emitted = 0
                                    Session.updateSession({ _id: session._id }, { $set: { CO2Saved: CO2Saved } }, (err, result) => {
                                        if (err) {
                                            console.log(`[${context}] Error `, err.message);
                                            reject(err);
                                        } else {
                                            resolve(true)
                                        }
                                    })
                                });
                            })
                        ).then(() => {
                            resolve("ok");
                        }).catch((error) => {
                            console.log(`[${context}] Error `, error.message);
                            reject(error);
                        })

                    } else {
                        resolve("ok");
                    }
                })
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        })
    },
    changeMobiEWrongSessionId: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "POST /api/private/chargingSession/runFirstTime";

            try {
                let received = req.body
                let query = {
                    status: "COMPLETED",
                    id: { $exists: true },
                    $where: "this.id.length > 23",
                    source: process.env.MobiePlatformCode,
                    $and: [
                        { start_date_time: { $gte: received.startDate } },
                        { start_date_time: { $lt: received.endDate } }
                    ],
                }

                Session.find(query, async (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    }
                    if (result.length > 0) {
                        resolve(await changerSessionId(result))
                    } else {
                        resolve("ok");
                    }
                })
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };
        })
    },
    activeSessionsByEV: function (req, res) {
        return new Promise((resolve, reject) => {

            var context = "GET /api/private/chargingSession/activeSessionsByEV";

            try {
                const sessionToStartStatuses = [
                    Enums.SessionStatusesTextTypes.PENDING_START, 
                    Enums.SessionStatusesTextTypes.PENDING, 
                    Enums.SessionStatusesTextTypes.ACTIVE, 
                    Enums.SessionStatusesTextTypes.PENDING_DELAY,
                    Enums.SessionStatusesTextTypes.PENDING_STOP
                ];

                let evId = req.params.evId;
                let query = {
                    evId: evId,
                    $or: [
                        { status: {$in: sessionToStartStatuses} }
                    ]
                };
                Session.find(query, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err.message);
                    }
                    else {
                        resolve(chargingSession);
                    };
                });


            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    getSessionOCPIById: function (req, res) {
        return new Promise((resolve, reject) => {

            var context = "GET /api/private/chargingSession/getSessionOCPIById";
            try {

                let query = {
                    $or: [
                        {
                            _id: req.params.id
                        },
                        {
                            id: req.params.id
                        }
                    ]
                };

                Session.find(query, (err, result) => {
                    if (err) {
                        console.log(`[${context}][Session.find] Error `, err.message);
                        reject(err);
                    } else {
                        if (result.length > 0) {
                            mapingSessionToEVIO(result)
                                .then(result => {
                                    resolve(result);
                                })
                                .catch(error => {
                                    console.log(`[${context}][mapingSessionToEVIO] Error `, error.message);
                                    reject(error);
                                });

                        } else {
                            resolve(result);
                        }
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    updateSessionsFinalPrices: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "PATCH /api/private/chargingSession/sessionFinalPrices";

            try {
                let received = req.body
                let query = {
                    status: global.SessionStatusStopped,
                    $and: [
                        { cdrId: { "$exists": true, "$ne": "" } },
                        { cdrId: { "$exists": true, "$ne": "NA" } },
                        { cdrId: { "$exists": true, "$ne": "-1" } }
                    ]
                }
                let fields = { id: 1 }
                Session.find(query, fields).lean()
                    .then(async (result) => {
                        if (result.length > 0) {
                            resolve(await processOnlyCdrSessions(result))
                        } else {
                            resolve("ok");
                        }
                    })
                    .catch(err => {
                        console.log(`[${context}] Error `, err.message);
                        reject(err);
                    })

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };
        })
    },
    getBillingPeriodSessions: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "GET /api/private/chargingSession/billingPeriodSessions";

            try {
                let { userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time } = req.query
                invoiceWithoutPayment = invoiceWithoutPayment === "true"
                var params = {
                    $and: [
                        { clientName: process.env.WhiteLabelSC, chargerType: { $in: Constants.chargers.type.ChargerTypeGoCharge } },
                        { paymentStatus: invoiceWithoutPayment ? process.env.ChargingSessionPaymentStatusUnpaid : process.env.ChargingSessionPaymentStatusPaid },
                        {
                            $or: [
                                { invoiceStatus: false },
                                { invoiceStatus: { "$exists": false } },
                            ]
                        },
                        { status: global.SessionStatusStopped },
                        { cdrId: { "$exists": true, "$ne": "" } },
                        { cdrId: { "$exists": true, "$ne": "NA" } },
                        { cdrId: { "$exists": true, "$ne": "-1" } },
                        // { paymentId: { "$exists": invoiceWithoutPayment ? false : true, $ne: "" } },
                        invoiceWithoutPayment ? {
                            $or: [
                                { paymentId: { "$exists": false } },
                                { paymentId: { "$exists": true, $eq: null } },
                            ]
                        } : {
                            $and: [
                                { paymentId: { "$exists": true, $ne: null } },
                                { paymentId: { "$exists": true, $ne: "" } },
                            ]
                        },
                        //{ userIdWillPay: userId },
                        { userIdToBilling: userId },
                        { minimumBillingConditions: true },
                        start_date_time ? { end_date_time: { $gte: start_date_time } } : {},
                        end_date_time ? { end_date_time: { $lte: end_date_time } } : {},
                    ]
                };


                if (billingPeriod === process.env.BillingPeriodMonthly && !end_date_time) {
                    let end_date_time = getLastDateOfPreviousMonth()
                    params["$and"].push({ end_date_time: { $lte: end_date_time } })
                }

                console.log(JSON.stringify(params, null, 2))

                Session.find(params).sort({ start_date_time: 1 }).lean()
                    .then(async (result) => {
                        if (result.length > 0) {
                            resolve(await billingPeriodInvoice(result))
                        } else {
                            resolve(null);
                        }
                    })
                    .catch(err => {
                        console.log(`[${context}] Error `, err.message);
                        reject(err.message);
                    })

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error.message);
            };
        })
    },

    /**
     * Responsible for return country codes that have sessions to be billed in the billing period
     * @param req
     * @returns {Promise<void>}
     */
    getCountryCodesToBillingPeriodSessionsV2: async (req) => {
        const context = "GET /api/private/chargingSession/getCountryCodesToBillingPeriodSessionsV2";

        try {
            let { userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time } = req.query;
            invoiceWithoutPayment = invoiceWithoutPayment === "true"

            const filter = {
                $and: [
                    { clientName: process.env.WhiteLabelSC, chargerType: { $in: Constants.chargers.type.ChargerTypeGoCharge } },
                    { paymentStatus: invoiceWithoutPayment ? process.env.ChargingSessionPaymentStatusUnpaid : process.env.ChargingSessionPaymentStatusPaid },
                    {
                        $or: [
                            { invoiceStatus: false },
                            { invoiceStatus: { "$exists": false } },
                        ]
                    },
                    { status: global.SessionStatusStopped},
                    { cdrId: { "$exists": true, "$ne": "" } },
                    { cdrId: { "$exists": true, "$ne": "NA" } },
                    { cdrId: { "$exists": true, "$ne": "-1" } },
                    invoiceWithoutPayment ? {
                        $or: [
                            { paymentId: { "$exists": false } },
                            { paymentId: { "$exists": true, $eq: null } },
                        ]
                    } : {
                        $and: [
                            { paymentId: { "$exists": true, $ne: null } },
                            { paymentId: { "$exists": true, $ne: "" } },
                        ]
                    },
                    { userIdToBilling: userId },
                    { minimumBillingConditions: true },
                    start_date_time ? { end_date_time: { $gte: start_date_time } } : {},
                    end_date_time ? { end_date_time: { $lte: end_date_time } } : {},
                    (billingPeriod === Constants.billingPeriods.MONTHLY && !end_date_time) ? { end_date_time: { $lte: getLastDateOfPreviousMonth() } } : {},
                ]
            };

            const sessions = await Session.find(filter, { country_code: 1, fees: 1 }).lean();
            const fetchedCountryCodes = sessions.map(session => session?.fees?.countryCode ?? session?.country_code);
            return [...new Set(fetchedCountryCodes)];
        } catch (error) {
            Sentry.captureException(error);
            console.log(`${context} Error `, error.message);

            throw error;
        }

    },
    getBillingPeriodSessionsV2: function (req, res) {
        const context = "GET /api/private/chargingSession/getCountryCodesToBillingPeriodSessionsV2";

        return new Promise(async (resolve, reject) => {

            try {
                let { userId, billingPeriod, invoiceWithoutPayment, start_date_time, end_date_time, countryCode } = req.query
                invoiceWithoutPayment = invoiceWithoutPayment === "true"
                var params = {
                    $and: [
                        
                        { clientName: process.env.WhiteLabelSC, chargerType: { $in: Constants.chargers.type.ChargerTypeGoCharge } },
                        { paymentStatus: invoiceWithoutPayment ? process.env.ChargingSessionPaymentStatusUnpaid : process.env.ChargingSessionPaymentStatusPaid },
                        {
                            $or: [
                                { invoiceStatus: false },
                                { invoiceStatus: { "$exists": false } },
                            ]
                        },
                        { status: global.SessionStatusStopped },
                        { cdrId: { "$exists": true, "$ne": "" } },
                        { cdrId: { "$exists": true, "$ne": "NA" } },
                        { cdrId: { "$exists": true, "$ne": "-1" } },
                        // { paymentId: { "$exists": invoiceWithoutPayment ? false : true, $ne: "" } },
                        invoiceWithoutPayment ? {
                            $or: [
                                { paymentId: { "$exists": false } },
                                { paymentId: { "$exists": true, $eq: null } },
                            ]
                        } : {
                            $and: [
                                { paymentId: { "$exists": true, $ne: null } },
                                { paymentId: { "$exists": true, $ne: "" } },
                            ]
                        },
                        //{ userIdWillPay: userId },
                        { userIdToBilling: userId },
                        { minimumBillingConditions: true },
                        countryCode ? { $or: [{ country_code: countryCode, "fees.countryCode": { $exists: false } }, { "fees.countryCode": countryCode }] } : {},
                        start_date_time ? { end_date_time: { $gte: start_date_time } } : {},
                        end_date_time ? { end_date_time: { $lte: end_date_time } } : {},
                    ]
                };


                if (billingPeriod === process.env.BillingPeriodMonthly && !end_date_time) {
                    let end_date_time = getLastDateOfPreviousMonth()
                    params["$and"].push({ end_date_time: { $lte: end_date_time } })
                }

                console.log(JSON.stringify(params, null, 2))

                Session.find(params).sort({ start_date_time: 1 }).lean()
                    .then(async (result) => {
                        if (result.length > 0) {
                            resolve(result)
                        } else {
                            resolve(null);
                        }
                    })
                    .catch(err => {
                        console.log(`[${context}] Error `, err.message);
                        reject(err.message);
                    })

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error.message);
            };
        })
    },
    getBillingSessions: function (req, res) {
        const context = "GET /api/private/chargingSession/getBillingSessions";
        return new Promise( (resolve, reject) => {
            try {
                let { invoiceId } = req.query
                
                var params = { invoiceId };
    
                Session.find(params).sort({ start_date_time: 1 }).lean()
                    .then(async (result) => {
                        if (result.length > 0) {
                            resolve(await billingPeriodInvoice(result))
                        }  
                        resolve(null);   
                    })
                    .catch(err => {
                        console.log(`[${context}] Error `, err.message);
                        reject(err.message);
                    })
    
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error.message);
            };
        })
    },
    getbillingPeriodSessionsGetBillingInformation: function (req, res) {
        return new Promise(async (resolve, reject) => {

            var context = "POST /api/private/chargingSession/billingPeriodSessionsGetBillingInformation";
            const filterByInvoiceStatus = req.body.filterByInvoiceStatus ?? true
            const goChargeFilter = req.body.goChargeFilter ?? false
            try {
                var params = {
                    $and: [
                        { status: global.SessionStatusStopped },
                        { cdrId: { "$exists": true, "$ne": "" } },
                        { cdrId: { "$exists": true, "$ne": "NA" } },
                        { cdrId: { "$exists": true, "$ne": "-1" } },
                        { minimumBillingConditions: true },
                        { id: { $in: req.body.id } }
                    ]
                };

                if (goChargeFilter) {
                    params.$and.push({ clientName: process.env.WhiteLabelSC, chargerType: { $in: Constants.chargers.type.ChargerTypeGoCharge } });
                }
                if (filterByInvoiceStatus) {
                    params.$and.push({
                        $or: [
                            { invoiceStatus: false },
                            { invoiceStatus: { "$exists": false } },
                        ]
                    });
                }

                Session.find(params).sort({ start_date_time: 1 }).lean()
                    .then(async (result) => {
                        if (result.length > 0) {
                            resolve(await billingPeriodInvoice(result))
                        } else {
                            resolve(null);
                        }
                    })
                    .catch(err => {
                        console.log(`[${context}] Error `, err.message);
                        reject(err.message);
                    })

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error.message);
            };
        })
    },
    sessionsToPaymentPeriodic: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "GET /api/private/chargingSession/sessionsToPaymentPeriodic";
            try {

                let query = req.body;

                Session.find(query, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err);
                    } else {

                        if (chargingSession.length > 0) {

                            let mySessions = chargingSession.map(session => {

                                var estimatedPrice = 0;

                                if (session.total_cost) {
                                    if (session.total_cost.incl_vat)
                                        estimatedPrice = session.total_cost.incl_vat;
                                }

                                let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID

                                var idTag = "";
                                if (session.cdr_token != undefined)
                                    idTag = session.cdr_token.uid;
                                else
                                    idTag = session.token_uid;

                                return {
                                    "totalPower": session.totalPower,
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
                                    "status": status,
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
                                    "paymentMethod": session.paymentMethod,
                                    "paymentMethodId": session.paymentMethodId,
                                    "walletAmount": session.walletAmount,
                                    "reservedAmount": session.reservedAmount,
                                    "confirmationAmount": session.confirmationAmount,
                                    "userIdWillPay": session.userIdWillPay,
                                    "adyenReference": session.adyenReference,
                                    "transactionId": session.transactionId,
                                    "serviceCost": {},
                                    "rating": session.rating,
                                    "plafondId": session.plafondId,
                                }
                            })

                            resolve(mySessions);

                        } else {

                            resolve([]);

                        };

                    };
                });

            } catch (error) {

                console.log(`[${context}] Error `, error);
                reject(error.message);

            };
        })
    },
    allActiveSessions: function (req, res) {
        return new Promise((resolve, reject) => {

            var context = "GET /api/private/chargingSession/allActiveSessions";

            try {
                var params = {
                    status: global.SessionStatusRunning,
                    unlockResult: { $ne: true }
                };

                Session.find(params, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err.message);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            getEvs(chargingSession)
                                .then((result) => {
                                    resolve(result);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][getEvs][.catch] Error `, error);
                                    reject(error.message);
                                });
                        }
                        else
                            resolve([]);
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    getFees: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "Function getFees";

            let session = req.params.session;

            Session.findOne({ _id: session }, { _id: 1, fees: 1, tariffCEME: 1, finalPrices: 1, chargerType: 1, tariffOPC: 1, kwh: 1, timeCharged: 1 }, (err, result) => {
                if (err) {
                    console.log(`[${context}] Error `, err);
                    reject(err.message);
                };

                resolve(result);

            });

        })
    },
    updateEndOfEnergyDate: function (req, res) {
        const context = "PATCH /api/private/chargingSession/endOfEnergyDate";
        return new Promise(async (resolve, reject) => {

            try {
                let { _id, endOfEnergyDate } = req.body
                let foundSession = await Session.findOneAndUpdate({ _id }, { endOfEnergyDate }, { new: true })
                if (foundSession) {
                    resolve(foundSession);
                } else {
                    resolve({})
                }
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        });
    },
    newRunFirstTime: function (req, res) {
        const context = "POST /api/private/chargingSession/newRunFirstTime";
        return new Promise(async (resolve, reject) => {

            try {
                //addClientName();
                //addUserIdToBilling();
                //updateAddressModel();
                updateCO2SavedMinumum();
                resolve("OK")
            } catch (error) {

                console.log(`[${context}] Error `, error.message);
                reject(error);

            };
        });
    },
    updateSyncPlafond: (req, res) => {
        let context = "PUT /api/private/chargingSession/updateSyncPlafond"
        return new Promise((resolve, reject) => {
            try {
                let body = req.body

                let query = { id: body.sessionId };
                if (body.sessionId.match(/^[0-9a-fA-F]{24}$/)) {
                    // Yes, it's a valid ObjectId, proceed with `findById` call.
                    query = { _id: body.sessionId };
                }

                let newSession = { $set: { syncToPlafond: true } };
                Session.updateSession(query, newSession, (err, result) => {
                    if (err) {
                        console.log(`[${context}][updateChargingSession] Error`, err);
                        reject(err);
                    }
                    else {
                        if (result) {
                            resolve({ auth: true, code: 'server_syncPlafond_updated', message: "SyncPlafond updated successfully" });
                        } else {
                            reject({ auth: true, code: 'server_syncPlafond_not_updated', message: "SyncPlafond updated unsuccessfully" });
                        };
                    };
                });
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        });
    },
    chargersUsage: (req, res) => {
        let context = "POST /api/private/chargingSession/chargersUsage"
        return new Promise(async (resolve, reject) => {
            try {
                let { startDate, endDate, source } = req.body
                if (!startDate || !endDate || !source) {
                    reject("startDate, endDate and source must be provided")
                    return
                } else {
                    chargersSessionsReport(source, startDate, endDate)
                    resolve("OK")
                    return
                }
            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };
        });
    },
    findChargingSessionPost: (req, res) => {
        let context = "POST /api/private/chargingSession/find"
        return new Promise((resolve, reject) => {
            try {
                var query = req.body
                Session.find(query, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err);
                        reject(err);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            resolve(chargingSession);
                        }
                        else
                            resolve([]);
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    getSessionAgregate: function (req, res) {
        return new Promise((resolve, reject) => {
            var context = "POST /api/private/chargingSession/agregate";

            try {

                let agregate = req.body

                Session.aggregate(agregate, async (err, sessions) => {
                    if (err) {
                        console.log(`[${context}] Error Sessions not found`, err.message);
                        reject(err);
                    } else {
                        resolve(sessions)
                    }

                });


            } catch (error) {
                console.log(`[${context}] Error `, error);
                reject(error.message);
            };

        })
    },
    notPaid: function (req, res) {
        return new Promise((resolve, reject) => {
            const context = "GET /api/private/chargingSession/notPaid";
            try {

                const { userId } = req.query
                const params = {
                    $and: [
                        { paymentType: "AD_HOC" },
                        { paymentStatus: process.env.ChargingSessionPaymentStatusUnpaid },
                        {
                            userIdWillPay: userId
                        },
                        {
                            $or: [
                                {
                                    status: global.SessionStatusStopped
                                },
                                {
                                    status: global.SessionStatusRunning
                                },
                                {
                                    status: global.SessionStatusToStop
                                },
                            ]
                        }
                    ]
                };

                Session.find(params, (err, chargingSession) => {
                    if (err) {
                        console.log(`[${context}][find] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (chargingSession.length > 0) {
                            mapingSessionToEVIO(chargingSession)
                                .then((result) => {
                                    resolve(result);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][.catch] Error `, error);
                                    reject(error.message);
                                });
                        }
                        else
                            return res.status(200).send([]);
                    };
                });

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            };

        })
    },
    updateEvAndUsersInfo: function (req, res) {
        return new Promise(async (resolve, reject) => {
            var context = "PATCH /api/private/chargingSession/updateEvAndUsersInfo";
            try {
                const { start_date_time, end_date_time } = req.body
                const query = {
                    $and: [
                        { status: { "$ne": global.SessionStatusFailed } },
                        { status: { "$ne": global.SessionStatusExpired } },
                        {
                            $or: [
                                { evId: { "$exists": true, "$ne": "-1" } },
                                {
                                    $and: [
                                        { userId: { "$exists": true, "$ne": "-1" } },
                                        { userIdWillPay: { "$exists": true, "$ne": "-1" } },
                                    ]
                                }
                            ]
                        },
                        start_date_time ? { end_date_time: { $gte: start_date_time } } : {},
                        end_date_time ? { end_date_time: { $lte: end_date_time } } : {}

                    ]
                };
                const sessionsToUpdate = await Session.find(query).lean()
                for (const session of sessionsToUpdate) {
                    let newValues = {
                        $set: {}
                    }
                    if (session.userId && session.userIdWillPay && session.userId.toUpperCase() !== "UNKNOWN" && session.userIdWillPay.toUpperCase() !== "UNKNOWN") {
                        let { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } = await Utils.getAllUserInfo(session.userId, session.userIdWillPay, session.userIdToBilling)
                        newValues["$set"].userIdInfo = userIdInfo
                        newValues["$set"].userIdWillPayInfo = userIdWillPayInfo
                        newValues["$set"].userIdToBillingInfo = userIdToBillingInfo
                    }
                    if (session.evId != "-1") {
                        let { ev, fleet } = await Utils.getEVAllByEvId(session.evId);
                        newValues["$set"].evDetails = ev
                        newValues["$set"].fleetDetails = fleet
                    }
                    await Session.findOneAndUpdate({ _id: session._id }, newValues)
                    await Utils.sleep(1000)
                }
                resolve(sessionsToUpdate)
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        })
    },
    forceValidatePayments: function (req, res) {
        return new Promise(async (resolve, reject) => {
            var context = "PATCH /api/private/chargingSession/forceValidatePayments";
            try {
                const { sessionIds } = req.body
                const sessionsToUpdate = await Session.find({ _id: { $in: sessionIds } }).lean()
                for (const session of sessionsToUpdate) {
                    await Utils.forceValidatePayment(session);
                    await Utils.sleep(2000)
                }
                resolve(sessionsToUpdate)
            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            };

        })
    },
    updateCardNumber: function (req, res) {
        return new Promise(async (resolve, reject) => {
            const context = "POST /api/private/chargingSession/updateCardNumber";

            try {
                const sessionsToUpdate = await Session.find({
                    $and: [
                        { status: { $in: ["COMPLETED", "EXPIRED"] } },
                        { cardNumber: { $exists: false } }
                    ]
                });

                let arrayIdTags = [];

                if (sessionsToUpdate) {
                    arrayIdTags = sessionsToUpdate.map(session => {
                        return {
                            userId: session.userId,
                            idTag: session.token_uid || session.cdr_token?.uid,
                            networkType: session.source,
                            evId: session.evId
                        }
                    });
                } else {
                    console.log('sessionsToUpdate is undefined or null.');
                }

                const host = process.env.HostUser + process.env.PathGetContractsIdTag;

                const response = await axios({
                    method: 'get',
                    url: host,
                    data: {
                        arrayIdTags: arrayIdTags
                    },
                    headers: {
                        'Content-Type': 'application/json'
                    },
                });

                const contracts = response.data.contract;

                let updatedSessions = [];

                for (const session of sessionsToUpdate) {
                    const matchingContract = contracts.find(contract =>
                        findIdTagContract(
                            session.userId,
                            session.token_uid || session.cdr_token?.uid,
                            session.source,
                            session.evId,
                            contract
                        )
                    );

                    if (matchingContract && matchingContract.cardNumber) {
                        await Session.findOneAndUpdate(
                            { _id: session._id },
                            { $set: { cardNumber: matchingContract.cardNumber } },
                            { new: true }
                        );
                        updatedSessions.push(session);
                    }

                    await sleep(200);

                }

                if (updatedSessions.length > 0) {
                    console.log('Success: Sessions were updated.', updatedSessions);
                } else {
                    console.log('Error: No sessions were updated.');
                }

            } catch (error) {
                console.log(`[${context}] Error `, error.message);
                return reject(error);
            };
        })
    }
}

function findIdTagContract(userId, idTag, networkType, evId, contract) {
    return (
        (contract.userId === userId &&
            contract.networks.find(network =>
                network.network === networkType &&
                network.tokens.find(token =>
                    token.idTagDec === idTag ||
                    token.idTagHexa === idTag ||
                    token.idTagHexaInv === idTag
                )
            )) ||
        (contract.evId === evId &&
            contract.networks.find(network =>
                network.network === networkType &&
                network.tokens.find(token =>
                    token.idTagDec === idTag ||
                    token.idTagHexa === idTag ||
                    token.idTagHexaInv === idTag
                )
            ))
    );
}

async function groupSessionsByCharger(source, start_date_time, end_date_time) {
    try {
        let pipeline = [
            {
                "$match": {
                    "$and": [
                        { "status": "COMPLETED" },
                        { "source": source },
                        { "end_date_time": { $gte: start_date_time } },
                        { "end_date_time": { $lte: end_date_time } }
                    ]
                }
            },
            {
                "$group": {
                    "_id": "$location_id",
                    "count": {
                        "$sum": 1
                    }
                }
            },
            {
                "$sort": {
                    "count": -1
                }
            }
        ];

        return await Session.aggregate(pipeline);

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return []
    }
}

cron.schedule('30 23 1 * *', () => {
    console.log("Running monthly routine to generate MobiE report of chargers usage")
    let endDate = getLastDateOfPreviousMonth()
    let startDate = getFirstDateOfMonth(endDate)
    chargersSessionsReport(process.env.MobiePlatformCode, startDate, endDate)
});

async function processOnlyCdrSessions(chargingSessions) {
    const context = "Function processOnlyCdrSessions"
    let response = { processedSessions: 0, updatedSessions: 0, failedSessions: 0 }
    try {
        for (let session of chargingSessions) {
            response.processedSessions++
            let host = global.ocpiHost + `/api/private/billing/processOnlyCDR/${session.id}`
            let updated = await processCdrValues(host)
            if (updated) {
                response.updatedSessions++
                console.log(`Updated session with id ${session.id}`)
            } else {
                response.failedSessions++
                console.log(`Failed to update session with id ${session.id}`)
            }
        }
        return response
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return response
    }

}

async function processCdrValues(host) {
    const context = "Function processCdrValues";
    try {
        let resp = await axios.post(host, {})
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return null
    }
}

async function changerSessionId(sessions) {
    const context = "Function changerSessionId"
    try {
        let singularSessions = []
        for (let sessionI of sessions) {
            let splitedId = sessionI.id.split("-")
            let sessionId = splitedId.length > Number(process.env.idSessionElementsLength) ? splitedId.slice(0, splitedId.length - 1).join("-") : sessionI.id
            let wrongIdSessions = await Session.find({ id: { $regex: sessionId } })
            if (wrongIdSessions && wrongIdSessions.length == 1) {
                await updateWrongSessionCDRS(wrongIdSessions[0], sessionId)
                singularSessions.push(...wrongIdSessions)
            }
        }
        return singularSessions
    } catch (error) {
        console.log(`[${context}] Error : ${error.message}`);
        return []
    }
}

async function updateWrongSessionCDRS(wrongSession, sessionId) {
    const context = "Function updateWrongSessionCDRS"
    return new Promise(async (resolve, reject) => {
        try {
            CDR.updateCDR({ session_id: wrongSession.id }, { $set: { session_id: sessionId } }, (err, result) => {
                if (err) {
                    console.log(`[${context}][findOneAndDelete]  Error `, err.message);
                    reject(err);
                } else {
                    Session.updateSession({ _id: wrongSession._id }, { $set: { id: sessionId } }, (err, result) => {
                        if (err) {
                            console.log(`[${context}][updateSession]  Error `, err.message);
                            reject(err);
                        } else {
                            resolve()
                        }
                    });
                };
            })
        } catch (error) {
            console.log(`[${context}] Error : ${error.message}`);
            reject(error.message)
        }
    })
}
async function buildSessionsInvoice(chargingSessions) {
    let context = "buildSessionsInvoice function"
    try {

        let total_exc_vat = 0
        let total_inc_vat = 0
        let others = 0
        let othersMobie = 0
        let othersInternational = 0;
        let totalChargingTime = 0
        let totalSessions = 0
        let totalEnergy = 0
        let attachLines = []
        let invoiceLines = []
        let paymentId = ""
        let userId = ""
        let mobieNetwork = 0
        let internationalNetwork = 0
        let othersVatValue = 0
        let mobieVatValue = 0
        let internationalVatValue = 0
        let addresses = []
        let operators = []

        let sessionIds = []

        for (let sessionI of chargingSessions) {
            userId = sessionI.userIdWillPay
            let invoiceObj = await getSessionInvoice(sessionI)

            if (!Utils.isEmptyObject(invoiceObj)) {
                total_exc_vat += invoiceObj.attach.chargingSessions.footer.total_exc_vat
                total_inc_vat += invoiceObj.attach.chargingSessions.footer.total_inc_vat
                others += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                othersVatValue += invoiceObj.attach.overview.lines.evio_services.vat
                totalChargingTime += sessionI.timeCharged
                totalSessions += 1
                totalEnergy += sessionI.kwh
                attachLines.push(invoiceObj.attach.chargingSessions.lines[0])
                addresses.push(invoiceObj.attach.chargingSessions.summaryAddress[0])
                operators.push(invoiceObj.attach.chargingSessions.summaryOperator[0])
                invoiceLines.push(invoiceObj.invoice.lines)
                sessionIds.push({
                    sessionId: sessionI._id,
                    chargerType: sessionI.chargerType
                })
                if (sessionI.chargerType === process.env.chargerTypeMobie) {
                    othersMobie += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                    mobieNetwork += invoiceObj.attach.chargingSessions.footer.total_exc_vat
                    mobieVatValue += invoiceObj.attach.overview.lines.mobie_network.vat
                } else if (
                    sessionI.chargerType === process.env.chargerTypeGireve ||
                    sessionI.chargerType === Enums.ChargerTypes.Hubject
                ) {
                    othersInternational += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                    internationalNetwork += invoiceObj.attach.chargingSessions.footer.total_exc_vat
                    internationalVatValue += invoiceObj.attach.overview.lines.other_networks.vat
                } else {
                    othersMobie += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                    mobieNetwork += invoiceObj.attach.chargingSessions.footer.total_exc_vat
                    mobieVatValue += invoiceObj.attach.overview.lines.mobie_network.vat
                }
            }

        }

        let body = {
            invoice: {
                paymentId,
                header: {
                    userId
                },
                lines: invoiceLines
            },
            attach: {
                overview: {
                    footer: {
                        total_exc_vat,
                        total_inc_vat
                    },
                    lines:
                    {
                        evio_services: { total_exc_vat: Utils.round(others), vat: Utils.round(othersVatValue) },
                        evio_network: { total_exc_vat: 0, vat: 0 },
                        mobie_network: { total_exc_vat: Utils.round(mobieNetwork - othersMobie), vat: Utils.round(mobieVatValue) },
                        other_networks: { total_exc_vat: Utils.round(internationalNetwork - othersInternational), vat: Utils.round(internationalVatValue) }
                    }

                },
                chargingSessions: {
                    header: {
                        sessions: totalSessions,
                        totalTime: new Date(totalChargingTime * 1000).toISOString().substr(11, 8),
                        totalEnergy: totalEnergy + " KWh"
                    },
                    lines: attachLines,
                    summaryAddress: addresses,
                    summaryOperator: operators,
                    footer: {
                        total_exc_vat,
                        total_inc_vat
                    }
                }
            }
        }

        return { body, sessionIds }

    } catch (error) {
        console.log(`[${context}] Error : ${error.message}`);
        return null
    }
}

function getSessionInvoice(sessionI) {
    var context = "getSessionInvoice function"
    return new Promise((resolve, reject) => {
        var sessionId = sessionI.id;

        var query = { session_id: sessionId }
        //get CDRID
        CDR.findOne(query, (err, cdr) => {
            if (err) {
                console.log(`[${context}] Error CDR of session id ${sessionId} not found`, err.message);
                reject({});
            }

            if (cdr) {
                if (cdr.source === process.env.MobiePlatformCode) {
                    processInvoice(sessionI, cdr)
                        .then((result) => {

                            resolve(result);

                        })
                        .catch(err => {
                            console.log(`[${context}] Error processing billing`, err.message);
                            resolve({});
                        });
                } else if (cdr.source === process.env.GirevePlatformCode || cdr.source === Enums.ChargerNetworks.Hubject) {
                    processInvoiceRoaming(sessionI, cdr)
                        .then((result) => {

                            resolve(result);

                        })
                        .catch(err => {
                            console.log(`[${context}] Error processing billing`, err.message);
                            resolve({});
                        });
                } else {
                    processInvoice(sessionI, cdr)
                        .then((result) => {

                            resolve(result);

                        })
                        .catch(err => {
                            console.log(`[${context}] Error processing billing`, err.message);
                            resolve({});
                        });
                }

            }
            else {
                console.log(`[${context}] Error CDR of session id ${sessionId} not found`);
                reject({});
            }


        });
    });

}

function processInvoiceRoaming(chargingSession, cdr) {
    return new Promise(async (resolve, reject) => {


        try {
            let totalPowerConsumed_Kw = cdr.total_energy;
            let total_parking_time = (typeof cdr.total_parking_time !== "undefined" && cdr.total_parking_time !== null) ? cdr.total_parking_time : 0
            let totalTimeConsumed_h = cdr.total_time - total_parking_time
            ////////////////////////////////////////////////
            //OPC Cost
            //Calculate OPC Prices

            // Timezone info to get offset of charger
            let timeZone = chargingSession.timeZone
            let countryCode = chargingSession.country_code
            let offset = Utils.getChargerOffset(timeZone, countryCode)

            // Arbitrary power and voltage values
            let plugVoltage = cdr.cdr_location.connector_voltage
            let plugAmperage = cdr.cdr_location.connector_amperage
            let plugPower = (plugVoltage * plugAmperage) / 1000;

            // Charging periods and chargin opc tariffs
            let charging_periods = cdr.charging_periods
            let priceComponents = chargingSession.tariffOPC.elements;

            if (cdr.tariffs !== null && cdr.tariffs !== undefined && cdr.tariffs.length > 0) {
                priceComponents = Utils.transformTariffElements(cdr.tariffs[0].elements)
                priceComponents = Utils.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
            } else if (priceComponents !== null && priceComponents !== undefined) {
                priceComponents = Utils.createTariffElementsAccordingToRestriction(priceComponents, cdr.start_date_time, cdr.end_date_time)
            }

            /*
                This function calculates the final prices for each dimension. If eventually there's a wrong price, the testTariffs file should be used to test new changes
                and add more use cases if necessary.

                Update - > This function also returns a key of information about each dimension. That info contains the amount consumed in each charging period and
                            other details about the tariff and its restrictions

            */
            let [flat, energy, time, parking] = Utils.opcTariffsPrices(null, priceComponents, cdr.start_date_time, cdr.end_date_time, offset, plugPower, plugVoltage, totalPowerConsumed_Kw, totalTimeConsumed_h, total_parking_time, chargingSession.source)

            ////////////////////////////////////////////////
            //Total Prices

            var invoiceLines = await Utils.getInvoiceLinesRoaming(cdr, chargingSession.userIdToBilling, chargingSession, flat, energy, time, parking);
            console.log("invoiceLines", invoiceLines)
            const total_exc_vat = chargingSession?.finalPrices?.totalPrice?.excl_vat ?? 0
            const total_inc_vat = chargingSession?.finalPrices?.totalPrice?.incl_vat ?? 0
            // total_inc_vat = total_exc_vat + (total_exc_vat * VAT_Price);
            var totalPrice = { excl_vat: total_exc_vat, incl_vat: total_inc_vat };

            if (totalPrice?.incl_vat < 0) {
                totalPrice.excl_vat = 0
                totalPrice.incl_vat = 0
                total_exc_vat = 0
                total_inc_vat = 0
            }

            let sessionInvoiceBody = await Utils.drawSingle_Ad_HocInvoiceRoaming(cdr, chargingSession.userIdToBilling, chargingSession, chargingSession.paymentId, invoiceLines, totalPrice, flat, energy, time, parking);

            console.log(`processInvoiceRoaming id : ${chargingSession.id} - source : ${cdr.source} - Enums.ChargerNetworks.Hubject : ${Enums.ChargerNetworks.Hubject}`)
            if (cdr.source === Enums.ChargerNetworks.Hubject) {
                sessionInvoiceBody = CdrsService.buildInvoice(chargingSession)
                console.log(`Hubject sessionInvoiceBody : ${JSON.stringify(sessionInvoiceBody)}`)
            }

            resolve(sessionInvoiceBody)

        }
        catch (err) {
            console.log("processInvoiceRoaming - err", err)
            reject(err);
        }

    });
}

function processInvoice(chargingSession, cdr) {
    return new Promise(async (resolve, reject) => {


        try {
            var invoiceLines = await Utils.getInvoiceLines(cdr, chargingSession.userIdToBilling, chargingSession);
            const total_exc_vat = chargingSession?.finalPrices?.totalPrice?.excl_vat ?? 0
            const total_inc_vat = chargingSession?.finalPrices?.totalPrice?.incl_vat ?? 0
            // var totalPrice = { excl_vat: Utils.round(total_exc_vat), incl_vat: Utils.round(total_exc_vat + (total_exc_vat * VAT_Price)) };
            var totalPrice = { excl_vat: total_exc_vat, incl_vat: total_inc_vat };

            if (totalPrice?.incl_vat < 0) {
                totalPrice.excl_vat = 0
                totalPrice.incl_vat = 0
                total_exc_vat = 0
                total_inc_vat = 0
            }

            let sessionInvoiceBody = await Utils.drawSingle_Ad_HocInvoice(cdr, chargingSession.userIdToBilling, chargingSession, chargingSession.paymentId, invoiceLines, totalPrice);

            resolve(sessionInvoiceBody)

        }
        catch (err) {
            console.log("processInvoice - err", err)
            reject(err);
        }

    });
};

function getEvs(chargingSession) {
    var context = "Function getEvs";
    return new Promise((resolve, reject) => {
        try {
            var myActiveSessions = [];
            const getEV = (session) => {
                return new Promise(async (resolve, reject) => {
                    session = JSON.parse(JSON.stringify(session));
                    if (session.evId == -1) {
                        var evId = {};
                    }
                    else {
                        var data = {
                            _id: session.evId
                        };
                        var evId = await getEvMySession(data)
                    };

                    var chargersEndpoint = global.publicNetworkChargersProxy
                    let params = {
                        hwId: session.location_id,
                    }
                    await axios.get(chargersEndpoint, { params })
                        .then(async result => {
                            if (result.data.length > 0) {
                                let serviceCost;
                                let tariffId;
                                let publicNetworkCharger = result.data.find(charger => charger.source === session.source)
                                // if (publicNetworkCharger) {
                                //     const plugs = publicNetworkCharger.plugs
                                //     let plug = plugs.find(plug => plug.plugId === session.connector_id)
                                //     if (plug && plug.tariffId.length > 0) {
                                //         let query = {
                                //             id: plug.tariffId[0]
                                //         }

                                //         await Tariff.findOne(query, (err, foundTariff) => {
                                //             if (err) {
                                //                 console.log(`[${context}][find] Error `, err);
                                //                 tariffId = '-1'
                                //                 serviceCost = {}
                                //             }
                                //             else {
                                //                 if (foundTariff) {
                                //                     tariffId = plug.tariffId[0]
                                //                     serviceCost = Utils.tariffResponseBody(foundTariff)
                                //                 } else {
                                //                     tariffId = '-1'
                                //                     serviceCost = {}
                                //                 }

                                //             };
                                //         });
                                //     } else {
                                //         tariffId = '-1'
                                //         serviceCost = {}
                                //     }
                                // } else {
                                //     tariffId = '-1'
                                //     serviceCost = {}
                                // }


                                var estimatedPrice = 0;
                                if (session.total_cost) {
                                    if (session.total_cost.incl_vat)
                                        estimatedPrice = session.total_cost.incl_vat;
                                }

                                let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID

                                var idTag = "";
                                if (session.cdr_token != undefined)
                                    idTag = session.cdr_token.uid;
                                else
                                    idTag = session.token_uid;

                                let activeSession = {
                                    "totalPower": session.totalPower,
                                    "estimatedPrice": estimatedPrice,
                                    "batteryCharged": session.batteryCharged,
                                    "timeCharged": session.timeCharged,
                                    "CO2Saved": session.CO2Saved,
                                    "stoppedByOwner": session.stoppedByOwner,
                                    "counter": 0,
                                    "_id": session._id,
                                    "hwId": session.location_id,
                                    "evId": evId,
                                    "evOwner": session.evOwner,
                                    // "tarrifId": tariffId,
                                    "command": session.command,
                                    "chargerType": session.chargerType,
                                    "status": status,
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
                                    "address": !Utils.isEmptyObject(publicNetworkCharger) ? publicNetworkCharger.address : {},
                                    // "serviceCost": serviceCost ? serviceCost : {},
                                    "rating": session.rating,
                                    "totalPrice": session.total_cost,
                                    "tariffCEME": session.tariffCEME,
                                    "tariffOPC": session.tariffOPC,
                                    "clientName": session.clientName,
                                    "tariffId": !Utils.isEmptyObject(session.tariffOPC) ? session.tariffOPC.id : undefined,
                                    "serviceCost": !Utils.isEmptyObject(session.tariffOPC) ? Utils.tariffResponseBody(session.tariffOPC) : undefined,
                                    "planId": !Utils.isEmptyObject(session.tariffCEME) ? session.tariffCEME._id : undefined,
                                    "source": session.source,
                                    "voltageLevel": session.voltageLevel,
                                    "countryCode": session.country_code,
                                    "latitude": !Utils.isEmptyObject(publicNetworkCharger) ? (!Utils.isEmptyObject(publicNetworkCharger.geometry) ? publicNetworkCharger.geometry.coordinates[1] : undefined) : undefined,
                                    "longitude": !Utils.isEmptyObject(publicNetworkCharger) ? (!Utils.isEmptyObject(publicNetworkCharger.geometry) ? publicNetworkCharger.geometry.coordinates[0] : undefined) : undefined,
                                    "plafondId": session.plafondId,
                                    "acceptKMs": session.acceptKMs ? session.acceptKMs : false,
                                    "updateKMs": session.updateKMs ? session.updateKMs : false,
                                    "cardNumber": session.cardNumber,
                                    "authType": session.cdr_token ? session.cdr_token.type : "",
                                    "documentNumber": session.documentNumber,
                                    "invoiceId": session.invoiceId,
                                }
                                if (session.evKms) activeSession.evKms = session.evKms
                                myActiveSessions.push(activeSession);
                                resolve(true);
                            } else
                                resolve(false);

                        })
                        .catch(error => {
                            console.log(`[${context}][getEv] Error `, error);
                            reject(error);
                        })
                });
            };
            Promise.all(
                chargingSession.map(session => getEV(session))
            ).then((result) => {
                resolve(myActiveSessions);
            }).catch((error) => {
                console.log(`[${context}][chargingSession.map] Error `, error);
                reject(error);
            });

        } catch (error) {
            console.log(`[${context}] Error `, error);
            reject(error);
        };
    });
};

function chargingSessionFindOne(query) {
    var context = "Funciton chargingSessionFindOne";
    return new Promise((resolve, reject) => {
        Session.findOne(query, (err, chargingSessionFound) => {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(chargingSessionFound);
            };
        });
    });
};

function createSessionSummary(chargerFound, chargingSessionFound, bookingFound, contract, tariffs, evInSession) {
    const context = "Function createSessionSummary";
    return new Promise((resolve) => {

        let sessionSummary
        if (evInSession) {
            sessionSummary = {
                charger: chargerFound,
                booking: bookingFound,
                chargingSession: chargingSessionFound,
                contract: contract,
                parking: {},
                chargingSessionTariffs: tariffs,
                plafond: evInSession
            }
        } else {
            sessionSummary = {
                charger: chargerFound,
                booking: bookingFound,
                chargingSession: chargingSessionFound,
                contract: contract,
                parking: {},
                chargingSessionTariffs: tariffs
            }
        }

        resolve(sessionSummary);
    });
};

function getcontract(data) {
    var context = "Function getcontract";
    return new Promise((resolve, reject) => {
        var host = process.env.HostUser + process.env.PathGetContractByIdTag;
        axios.get(host, { data })
            .then((value) => {
                var contractFound = value.data;
                resolve(contractFound);
            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                reject(error.response.data);
            });
    });
};

function getBooking(params) {
    var context = "Function getBooking";
    return new Promise((resolve, reject) => {
        var host = process.env.HostBooking + process.env.PathGetBookingById;
        axios.get(host, { params })
            .then((value) => {
                var bookingFound = value.data;
                resolve(bookingFound);
            })
            .catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                //reject(error.response.data);
                resolve({});
            });
    });
};

function mapingSessionToEVIO(chargingSession) {
    var context = "Function mapingSessionToEVIO";
    return new Promise((resolve, reject) => {
        try {

            let sessions = [];

            Promise.all(
                chargingSession.map(session => {
                    return new Promise(async (resolve, reject) => {

                        let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID

                        var estimatedPrice = 0;
                        var finalPrice = 0;
                        let totalPrice = session.total_cost
                        if (session.finalPrices !== undefined) {
                            if (session.finalPrices.totalPrice !== undefined) {
                                totalPrice = session.finalPrices.totalPrice
                                if (session.finalPrices.totalPrice.incl_vat) {
                                    estimatedPrice = session.finalPrices.totalPrice.incl_vat;
                                    finalPrice = session.finalPrices.totalPrice.incl_vat;
                                } else {
                                    if (session.total_cost) {
                                        if (session.total_cost.incl_vat) {
                                            estimatedPrice = session.total_cost.incl_vat;
                                            finalPrice = session.total_cost.incl_vat;
                                        }
                                    }
                                }
                            } else {
                                if (session.total_cost) {
                                    if (session.total_cost.incl_vat) {
                                        estimatedPrice = session.total_cost.incl_vat;
                                        finalPrice = session.total_cost.incl_vat;
                                    }
                                }
                            }
                        } else {
                            if (session.total_cost) {
                                if (session.total_cost.incl_vat) {
                                    estimatedPrice = session.total_cost.incl_vat;
                                    finalPrice = session.total_cost.incl_vat;
                                }
                            }
                        }

                        var idTag = "";
                        if (session.cdr_token != undefined)
                            idTag = session.cdr_token.uid;
                        else
                            idTag = session.token_uid;

                        let cdrData;
                        if (session.cdrId && session.cdrId !== "-1") {
                            cdrData = await CDR.findOne({ id: session.cdrId });
                        }

                        var statusCode = "server_error_remote_start_failed";
                        if (session.commandResultStart) {
                            statusCode = "server_error_remote_start_" + session.commandResultStart;
                        }
                        //FIXME For expired sessions, I'me sending values of 0 to time and price. These sessions shouldn't be queried in the first place ...
                        let activeSession = {
                            "totalPower": session.totalPower,
                            "estimatedPrice": session.status === global.SessionStatusExpired ? 0 : estimatedPrice,
                            "finalPrice": session.status === global.SessionStatusExpired ? 0 : finalPrice,
                            "batteryCharged": session.batteryCharged,
                            "timeCharged": session.status === global.SessionStatusExpired ? 0 : session.timeCharged,
                            "CO2Saved": session.CO2Saved,
                            "stoppedByOwner": session.stoppedByOwner,
                            "counter": 0,
                            "_id": session._id,
                            "hwId": session.location_id,
                            "evId": session.evId,
                            "evOwner": session.evOwner,
                            "tarrifId": session.tariffId,
                            "command": session.command,
                            "chargerType": session.chargerType,
                            "status": status,
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
                            "address": session.address,
                            "rating": session.rating,
                            "statusCode": statusCode,
                            "totalPrice": session.status === global.SessionStatusExpired ? { excl_vat: 0, incl_vat: 0 } : totalPrice,
                            "paymentStatus": session.paymentStatus,
                            "invoiceId": session.invoiceId,
                            "invoiceStatus": session.invoiceStatus,
                            "plafondId": session.plafondId,
                            "acceptKMs": session.acceptKMs ? session.acceptKMs : false,
                            "updateKMs": session.updateKMs ? session.updateKMs : false,
                            "cardNumber": session.cardNumber,
                            "authType": session.cdr_token ? session.cdr_token.type : "",
                            "cdr": cdrData || {},
                            "message": session?.message || '',
                            "errorType": session?.errorType || '',
                        }
                        if (session.evKms) activeSession.evKms = session.evKms
                        let invoiceId = session.invoiceId
                        let hasInvoice = false
                        if (invoiceId !== null && invoiceId !== undefined) {
                            let invoice = await Utils.getInvoiceDocument(invoiceId)
                            if (invoice) {
                                if (invoice.status == process.env.InvoiceStatusCompleted && session.userIdWillPay === session.userId) {
                                    hasInvoice = true
                                }

                                if (session?.invoiceLines) {
                                    activeSession.invoiceLines = session.invoiceLines;
                                }
                            }
                        }

                        activeSession.hasInvoice = hasInvoice
                        sessions.push(activeSession);
                        resolve(true)
                    });
                })
            ).then((result) => {
                resolve(sessions);
            }).catch((error) => {
                Sentry.captureException(error);
                console.log(`[${context}] Error `, error);

                reject(error);
            });


        } catch (error) {
            Sentry.captureException(error);
            console.log(`[${context}] Error `, error);

            reject(error);
        }
    });
}

function mapingSessionToHistoryEVIO(chargingSession) {
    var context = "Function mapingSessionToHistoryEVIO";
    return new Promise((resolve, reject) => {
        try {

            let sessions = [];

            Promise.all(
                chargingSession.map(session => {
                    return new Promise(async (resolve, reject) => {

                        let status = Enums.SessionStatusesNumberTypes[session.status] || Enums.SessionStatusesNumberTypes.INVALID


                        var estimatedPrice = 0;
                        var finalPrice = 0;
                        if (session.total_cost) {
                            if (session.total_cost.incl_vat) {
                                estimatedPrice = session.total_cost.incl_vat;
                                finalPrice = session.total_cost.incl_vat;
                            }
                        }

                        var idTag = "";
                        if (session.cdr_token != undefined)
                            idTag = session.cdr_token.uid;
                        else
                            idTag = session.token_uid;

                        var statusCode = "server_error_remote_start_failed";
                        if (session.commandResultStart) {
                            statusCode = "server_error_remote_start_" + session.commandResultStart;
                        };

                        let tariffsDetails = await sessionSummaryTariffsHitory(session);
                        let tariffsDetailsRoaming;
                        if (session.chargerType !== process.env.chargerTypeMobie) {
                            if (session.finalPrices)
                                tariffsDetailsRoaming = await getTariffsDetailsRoaming(session)
                        };
                        //FIXME For expired sessions, I'me sending values of 0 to time and price. These sessions shouldn't be queried in the first place ...
                        let activeSession = {
                            "totalPower": session.totalPower,
                            "estimatedPrice": session.status === global.SessionStatusExpired ? 0 : estimatedPrice,
                            "finalPrice": session.status === global.SessionStatusExpired ? 0 : finalPrice,
                            "batteryCharged": session.batteryCharged,
                            "timeCharged": session.status === global.SessionStatusExpired ? 0 : session.timeCharged,
                            "CO2Saved": session.CO2Saved,
                            "stoppedByOwner": session.stoppedByOwner,
                            "counter": 0,
                            "_id": session._id,
                            "hwId": session.location_id,
                            "evId": session.evId,
                            "evOwner": session.evOwner,
                            "tarrifId": session.tariffId,
                            "command": session.command,
                            "chargerType": session.chargerType,
                            "status": status,
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
                            "paymentMethod": session.paymentMethod,
                            "paymentMethodId": session.paymentMethodId,
                            "walletAmount": session.walletAmount,
                            "reservedAmount": session.reservedAmount,
                            "confirmationAmount": session.confirmationAmount,
                            "userIdWillPay": session.userIdWillPay,
                            "adyenReference": session.adyenReference,
                            "transactionId": session.transactionId,
                            "address": session.address,
                            "rating": session.rating,
                            "statusCode": statusCode,
                            "totalPrice": session.status === global.SessionStatusExpired ? { excl_vat: 0, incl_vat: 0 } : session.total_cost,
                            "paymentStatus": session.paymentStatus,
                            "tariffsDetails": tariffsDetails,
                            "fees": session.fees,
                            "tariffCEME": session.tariffCEME,
                            "tariffOPC": session.tariffOPC,
                            "finalPrices": session.finalPrices,
                            "tariffsDetailsRoaming": tariffsDetailsRoaming,
                            "clientName": session.clientName,
                            "plafondId": session.plafondId,
                            "acceptKMs": session.acceptKMs ? session.acceptKMs : false,
                            "updateKMs": session.updateKMs ? session.updateKMs : false,
                            "cardNumber": session.cardNumber,
                            "authType": session.cdr_token ? session.cdr_token.type : ""
                        };

                        if (session.evKms) activeSession.evKms = session.evKms

                        if (session.kwh) {
                            activeSession.kwh = session.kwh;
                        }

                        if (session?.invoiceLines) {
                            activeSession.invoiceLines = session.invoiceLines;
                        }

                        sessions.push(activeSession);
                        resolve(true)
                    });
                })
            ).then((result) => {
                resolve(sessions);
            }).catch((error) => {
                Sentry.captureException(error);
                console.error(`[${context}] Error `, error);

                reject(error);
            });


        } catch (error) {
            Sentry.captureException(error);
            console.error(`[${context}] Error `, error);

            reject(error);
        }
    });
}

function getEVByEvId(evId) {
    var context = "Function getEVByEvId";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostEvs + process.env.PathGetEVByEVId;
        let params = { _id: evId };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data.userId);
                }
                else {
                    resolve('-1');
                };
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve('-1');
            });
    });
};

function getEVAllByEvId(evId) {
    var context = "Function getEVAllByEvId";
    return new Promise(async (resolve, reject) => {
        let host = process.env.HostEvs + process.env.PathGetEVByEVId;
        let params = { _id: evId };

        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve('-1');
                };
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve('-1');
            });
    });
};


function sessionSummaryTariffs(chargingSessionFound) {
    var context = "Function sessionSummaryTariffs";
    return new Promise(async (resolve, reject) => {

        let opc = {};
        if (chargingSessionFound.finalPrices !== undefined) {
            if (chargingSessionFound.finalPrices.opcPrice !== undefined) {
                opc.total = chargingSessionFound.finalPrices.opcPrice.excl_vat;

                if (chargingSessionFound.finalPrices.opcPriceDetail !== undefined) {
                    opc.activation = chargingSessionFound.finalPrices.opcPriceDetail.flatPrice.excl_vat;
                    opc.time = chargingSessionFound.finalPrices.opcPriceDetail.timePrice.excl_vat;
                    opc.energy = chargingSessionFound.finalPrices.opcPriceDetail.powerPrice.excl_vat;

                    //Gireve sessions have parkingTime
                    if (chargingSessionFound.finalPrices.opcPriceDetail.parkingTimePrice !== undefined) {
                        opc.parking = chargingSessionFound.finalPrices.opcPriceDetail.parkingTimePrice.excl_vat;
                    }
                }
                else {
                    opc.activation = null;
                    opc.time = null;
                    opc.energy = null;
                    opc.parking = null;
                }

            }
        }

        let ceme = {};
        if (chargingSessionFound.finalPrices !== undefined) {
            if (chargingSessionFound.finalPrices.cemePrice !== undefined) {
                if (chargingSessionFound.source === process.env.GirevePlatformCode || chargingSessionFound.source === process.env.HubjectPlatformCode) {
                    let CEME_PERCENTAGE = chargingSessionFound.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
                    // new % CEME Tariff types
                    let CEME_START_PERCENTAGE = chargingSessionFound.tariffCEME.tariff.find(tariff => tariff.type === "start_percentage")
                    let CEME_ENERGY_PERCENTAGE = chargingSessionFound.tariffCEME.tariff.find(tariff => tariff.type === "energy_percentage")
                    let CEME_TIME_PERCENTAGE = chargingSessionFound.tariffCEME.tariff.find(tariff => tariff.type === "time_percentage")

                    let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0
                    let evioPercentageStart = CEME_START_PERCENTAGE ? CEME_START_PERCENTAGE.price : 0
                    let evioPercentageEnergy = CEME_ENERGY_PERCENTAGE ? CEME_ENERGY_PERCENTAGE.price : 0
                    let evioPercentageTime = CEME_TIME_PERCENTAGE ? CEME_TIME_PERCENTAGE.price : 0

                    let opcDetail = chargingSessionFound.finalPrices.opcPriceDetail
                    let cemeDetail = chargingSessionFound.finalPrices.cemePriceDetail
                    let activationFee = chargingSessionFound.finalPrices.totalPrice.excl_vat <= 0 ? 0 :
                        chargingSessionFound.source === process.env.GirevePlatformCode ? Number(process.env.GireveCommission) :
                            Number(process.env.HubjectCommission)

                    ceme.time = Utils.round(Utils.round(opcDetail.timePrice.excl_vat) + Utils.round(cemeDetail.timePrice.excl_vat) + Utils.round((opcDetail.timePrice.excl_vat) * evioPercentage) + Utils.round(opcDetail.timePrice.excl_vat * evioPercentageTime))
                    ceme.energy = Utils.round(Utils.round(opcDetail.powerPrice.excl_vat) + Utils.round(cemeDetail.powerPrice.excl_vat) + Utils.round((opcDetail.powerPrice.excl_vat) * evioPercentage) + Utils.round(opcDetail.powerPrice.excl_vat * evioPercentageEnergy))
                    ceme.activation = Utils.round(Utils.round(opcDetail.flatPrice.excl_vat) + Utils.round(cemeDetail.flatPrice.excl_vat) + Utils.round((opcDetail.flatPrice.excl_vat) * evioPercentage) + Utils.round(activationFee) + Utils.round(opcDetail.flatPrice.excl_vat * evioPercentageStart))
                    ceme.total = chargingSessionFound.finalPrices.totalPrice.excl_vat;

                } else {
                    ceme.total = chargingSessionFound.finalPrices.cemePrice.excl_vat;

                    if (chargingSessionFound.finalPrices.cemePriceDetail !== undefined) {
                        ceme.activation = chargingSessionFound.finalPrices.cemePriceDetail.flatPrice.excl_vat;
                        ceme.time = chargingSessionFound.finalPrices.cemePriceDetail.timePrice.excl_vat;
                        ceme.energy = chargingSessionFound.finalPrices.cemePriceDetail.powerPrice.excl_vat;
                    }
                    else {
                        ceme.activation = null;
                        ceme.time = null;
                        ceme.energy = null;
                    }
                }
            }
        }

        let fees = {};
        if (chargingSessionFound.finalPrices !== undefined) {

            fees.total = null;

            if (chargingSessionFound.finalPrices.tarPrice !== undefined) {
                fees.tar = chargingSessionFound.finalPrices.tarPrice.excl_vat;
                fees.total += chargingSessionFound.finalPrices.tarPrice.excl_vat;
            }
            else {
                fees.tar = null;
            }

            if (chargingSessionFound.finalPrices.iecPrice !== undefined) {
                fees.iec = chargingSessionFound.finalPrices.iecPrice.excl_vat;
                fees.total += chargingSessionFound.finalPrices.iecPrice.excl_vat;
            }
            else {
                fees.iec = null;
            }

            if (chargingSessionFound.finalPrices.vatPrice !== undefined) {
                fees.iva = chargingSessionFound.finalPrices.vatPrice.value;
                fees.total += chargingSessionFound.finalPrices.vatPrice.value;
            }
            else {
                fees.iva = null;
            }

            if (fees.total !== null) {
                fees.total = Utils.round(fees.total)
            }

        }

        let sessionTariffs = {
            opc: opc,
            ceme: ceme,
            fees: fees
        };

        //FIXME For expired sessions, I'me sending values of 0 to time and price. These sessions shouldn't be queried in the first place ...
        if (chargingSessionFound.status === global.SessionStatusExpired) {
            sessionTariffs = {
                opc: {},
                ceme: {},
                fees: {}
            };
        }

        resolve(sessionTariffs);
    });
};

function sessionSummaryTariffsHitory(chargingSessionFound) {
    var context = "Function sessionSummaryTariffsHitory";
    return new Promise(async (resolve, reject) => {
        let minimumBillingConditions = chargingSessionFound.minimumBillingConditions

        let opc = {};
        if (chargingSessionFound.finalPrices !== undefined) {
            if (chargingSessionFound.finalPrices.opcPrice !== undefined) {
                opc.total = chargingSessionFound.finalPrices.opcPrice.excl_vat;

                if (chargingSessionFound.finalPrices.opcPriceDetail !== undefined) {

                    if (chargingSessionFound.finalPrices.opcPriceDetail.flatPrice != undefined)
                        opc.activation = chargingSessionFound.finalPrices.opcPriceDetail.flatPrice.excl_vat;
                    else
                        opc.activation = 0;

                    if (chargingSessionFound.finalPrices.opcPriceDetail.timePrice != undefined)
                        opc.time = chargingSessionFound.finalPrices.opcPriceDetail.timePrice.excl_vat;
                    else
                        opc.time = 0;

                    if (chargingSessionFound.finalPrices.opcPriceDetail.powerPrice != undefined)
                        opc.energy = chargingSessionFound.finalPrices.opcPriceDetail.powerPrice.excl_vat;
                    else
                        opc.energy = 0

                    //Gireve sessions have parkingTime
                    if (chargingSessionFound.finalPrices.opcPriceDetail.parkingTimePrice !== undefined) {
                        opc.parking = chargingSessionFound.finalPrices.opcPriceDetail.parkingTimePrice.excl_vat;
                    }
                }
                else {
                    opc.activation = null;
                    opc.time = null;
                    opc.energy = null;
                    opc.parking = null;
                }

            }
        }

        let ceme = {};
        if (chargingSessionFound.finalPrices !== undefined) {
            if (chargingSessionFound.finalPrices.cemePrice !== undefined) {
                if (chargingSessionFound.source === process.env.GirevePlatformCode) {
                    let CEME_PERCENTAGE = chargingSessionFound.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
                    let evioPercentage = minimumBillingConditions ? (CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0) : 0

                    let opcDetail = chargingSessionFound.finalPrices.opcPriceDetail
                    let cemeDetail = chargingSessionFound.finalPrices.cemePriceDetail

                    if (opcDetail.flatPrice === undefined) {
                        opcDetail.flatPrice = {
                            excl_vat: 0
                        };
                    }
                    if (opcDetail.timePrice === undefined) {
                        opcDetail.timePrice = {
                            excl_vat: 0
                        };
                    }
                    if (opcDetail.powerPrice === undefined) {
                        opcDetail.powerPrice = {
                            excl_vat: 0
                        };
                    }
                    if (cemeDetail.timePrice === undefined) {
                        cemeDetail.timePrice = {
                            excl_vat: 0
                        };
                    }
                    if (cemeDetail.powerPrice === undefined) {
                        cemeDetail.powerPrice = {
                            excl_vat: 0
                        };
                    }
                    if (cemeDetail.flatPrice === undefined) {
                        cemeDetail.flatPrice = {
                            excl_vat: 0
                        };
                    }

                    let gireveActivationFee = minimumBillingConditions ? Number(process.env.GireveCommission) : 0

                    ceme.time = Utils.round(Utils.round(opcDetail.timePrice.excl_vat) + Utils.round(cemeDetail.timePrice.excl_vat) + Utils.round((opcDetail.timePrice.excl_vat) * evioPercentage))
                    ceme.energy = Utils.round(Utils.round(opcDetail.powerPrice.excl_vat) + Utils.round(cemeDetail.powerPrice.excl_vat) + Utils.round((opcDetail.powerPrice.excl_vat) * evioPercentage))
                    ceme.activation = Utils.round(Utils.round(opcDetail.flatPrice.excl_vat) + Utils.round(cemeDetail.flatPrice.excl_vat) + Utils.round((opcDetail.flatPrice.excl_vat) * evioPercentage) + Utils.round(gireveActivationFee))
                    ceme.total = chargingSessionFound.finalPrices.totalPrice.excl_vat;

                } else {
                    ceme.total = chargingSessionFound.finalPrices.cemePrice.excl_vat;

                    if (chargingSessionFound.finalPrices.cemePriceDetail !== undefined) {
                        if (chargingSessionFound.finalPrices.cemePriceDetail.flatPrice === undefined) {
                            chargingSessionFound.finalPrices.cemePriceDetail.flatPrice = {
                                excl_vat: 0
                            };
                        }

                        if (chargingSessionFound.finalPrices.cemePriceDetail.timePrice === undefined) {
                            chargingSessionFound.finalPrices.cemePriceDetail.timePrice = {
                                excl_vat: 0
                            };
                        }

                        if (chargingSessionFound.finalPrices.cemePriceDetail.powerPrice === undefined) {
                            chargingSessionFound.finalPrices.cemePriceDetail.powerPrice = {
                                excl_vat: 0
                            };
                        }
                        ceme.activation = chargingSessionFound.finalPrices.cemePriceDetail.flatPrice.excl_vat;
                        ceme.time = chargingSessionFound.finalPrices.cemePriceDetail.timePrice.excl_vat;
                        ceme.energy = chargingSessionFound.finalPrices.cemePriceDetail.powerPrice.excl_vat;
                    }
                    else {
                        ceme.activation = null;
                        ceme.time = null;
                        ceme.energy = null;
                    }
                }
            }
        }

        let fees = {};
        if (chargingSessionFound.finalPrices !== undefined) {

            fees.total = null;

            if (chargingSessionFound.finalPrices.tarPrice !== undefined) {
                fees.tar = chargingSessionFound.finalPrices.tarPrice.excl_vat;
                fees.total += chargingSessionFound.finalPrices.tarPrice.excl_vat;
            }
            else {
                fees.tar = null;
            }

            if (chargingSessionFound.finalPrices.iecPrice !== undefined) {
                fees.iec = chargingSessionFound.finalPrices.iecPrice.excl_vat;
                fees.total += chargingSessionFound.finalPrices.iecPrice.excl_vat;
            }
            else {
                fees.iec = null;
            }

            if (chargingSessionFound.finalPrices.vatPrice !== undefined) {
                fees.iva = chargingSessionFound.finalPrices.vatPrice.value;
                fees.total += chargingSessionFound.finalPrices.vatPrice.value;
            }
            else {
                fees.iva = null;
            }

            if (fees.total !== null) {
                fees.total = Utils.round(fees.total)
            }

        }

        let sessionTariffs = {
            opc: opc,
            ceme: ceme,
            fees: fees
        };

        //FIXME For expired sessions, I'me sending values of 0 to time and price. These sessions shouldn't be queried in the first place ...
        if (chargingSessionFound.status === global.SessionStatusExpired) {
            sessionTariffs = {
                opc: {},
                ceme: {},
                fees: {}
            };
        }

        resolve(sessionTariffs);
    });
};

function getEvMySession(data) {
    var context = "Function getEvMySession";
    return new Promise(async (resolve, reject) => {
        var host = process.env.HostEvs + process.env.PathGetEvs;

        axios.get(host, { data })
            .then((result) => {
                if (result.data) {
                    resolve(result.data);
                }
                else {
                    resolve({});
                };
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve({});
            });
    });
};

function getCemeByUser(userId) {
    var context = "Function getCemeByUser";
    return new Promise((resolve, reject) => {
        try {

            let host = `${process.env.HostUser}${process.env.PathGetContractByUser}/${userId}`;

            axios.get(host)
                .then(response => {
                    //console.log(response.data[0].tariffInfo.plan);
                    resolve(response.data[0].tariffInfo.plan);
                })
                .catch(error => {
                    console.log(`[${context}] Error `, error);
                    reject(error);
                });

        } catch (error) {

            console.log(`[${context}] Error `, error);
            reject(error);

        };
    });
};

function updateSessionWithMinimumBilling(sessionI) {
    var context = "Function updateSessionWithMinimumBilling";
    return new Promise(async (resolve, reject) => {
        var query = { session_id: sessionI.id }
        //get CDRID
        CDR.findOne(query, (err, cdr) => {
            if (err) {
                console.log(`[${context}] Error CDR of session id ${sessionI.id} not found`, err.message);
            }
            if (cdr) {
                var timeChargedinSeconds = Utils.getChargingTime(moment(cdr.start_date_time), moment(cdr.end_date_time));
                let minimumBillingConditions = true
                if (cdr.source === process.env.MobiePlatformCode) {

                    minimumBillingConditions = Utils.hasMinimumBillingConditionsMobiE(cdr)

                } else if (cdr.source === process.env.GirevePlatformCode) {
                    if (
                        // (timeChargedinSeconds <= Number(process.env.MinimumChargingTimeToBilling)) ||
                        (cdr.total_energy * 1000 <= Number(process.env.MinimumEnergyToBillingGireve))
                    ) {
                        minimumBillingConditions = false
                    }

                } else {

                    minimumBillingConditions = Utils.hasMinimumBillingConditionsMobiE(cdr)

                }

                let newValues = {
                    $set: {
                        minimumBillingConditions: minimumBillingConditions
                    }
                };

                Session.updateSession({ _id: sessionI._id }, newValues, (err, result) => {
                    if (err) {
                        console.log("Error", err.message);
                        resolve()
                    }
                    else {
                        console.log(`Session ${sessionI.id} updated minumumBillingConditions to ${minimumBillingConditions}`);
                        resolve()
                    };
                });

            }
            else {
                console.log(`[${context}] Error CDR of session id ${sessionI.id} not found`);
                resolve()
            }


        });
    });
};

async function billingPeriodInvoice(chargingSessions) {
    let context = "billingPeriodInvoice function"
    try {

        let total_exc_vat = 0
        let total_inc_vat = 0
        // let others = 0
        // let othersMobie = 0
        // let othersInternational = 0;
        let invoiceLines = []
        let userId = ""
        let mobieNetwork = 0
        let internationalNetwork = 0
        let othersVatValue = 0
        let mobieVatValue = 0
        let internationalVatValue = 0


        let addressesMobiE = []
        let operatorsMobiE = []
        let addressesInternational = []
        let operatorsInternational = []

        let unitPricesSummaryMobiE = {}

        let sessionIds = []
        let paymentIdList = []

        // MobiE total Values
        let mobieTotalChargingTime = 0
        let mobieTotalEnergy = 0
        let mobieTotalSessions = 0
        let mobie_total_exc_vat = 0
        let mobie_total_inc_vat = 0

        // Gireve total values
        let gireveTotalChargingTime = 0
        let gireveTotalEnergy = 0
        let gireveTotalSessions = 0
        let gireve_total_exc_vat = 0
        let gireve_total_inc_vat = 0


        //Attach Lines Object
        let attachLinesObj = {
            "mobie": [],
            "international": []
        }


        for (let sessionI of chargingSessions) {
            userId = sessionI.userIdToBilling
            let invoiceObj = await getSessionInvoice(sessionI)

            if (!Utils.isEmptyObject(invoiceObj)) {
                // let invoiceLine = joinInvoiceLines(invoiceObj.invoice.lines)
                let sessionVat = sessionI.finalPrices.vatPrice.vat
                let session_total_inc_vat = invoiceObj.attach.chargingSessions.footer.total_inc_vat
                let session_total_exc_vat = session_total_inc_vat / (1 + sessionVat)
                // invoiceLine.forEach(line => {
                //     session_total_exc_vat += line.quantity * line.unitPrice;
                //     session_total_inc_vat += line.quantity * line.unitPrice * (1 + line.vat);
                // });
                let session_total_vat = session_total_inc_vat - session_total_exc_vat
                // invoiceLines.push(invoiceLine)


                total_exc_vat += session_total_exc_vat
                total_inc_vat += session_total_inc_vat
                // others += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                // othersVatValue += invoiceObj.attach.overview.lines.evio_services.vat
                // addresses.push(invoiceObj.attach.chargingSessions.summaryAddress[0])
                // operators.push(invoiceObj.attach.chargingSessions.summaryOperator[0])
                if (sessionI.paymentId) {
                    paymentIdList.push(invoiceObj.invoice.paymentId)
                }
                sessionIds.push({
                    sessionId: sessionI._id,
                    chargerType: sessionI.chargerType
                })
                if (sessionI.chargerType === process.env.chargerTypeMobie) {
                    // othersMobie += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                    let invoiceLine = buildSingleInvoiceLine(global.Item_MobieServices, "Serviços rede MOBI.E", session_total_exc_vat, sessionVat)
                    invoiceLines.push([invoiceLine])

                    mobieNetwork += session_total_exc_vat
                    mobieVatValue += session_total_vat

                    mobieTotalChargingTime += sessionI.timeCharged
                    mobieTotalEnergy += sessionI.kwh
                    mobieTotalSessions += 1

                    mobie_total_exc_vat += session_total_exc_vat
                    mobie_total_inc_vat += session_total_inc_vat

                    let equalAdressesIndex = addressesMobiE.findIndex(obj => obj.hwId === sessionI.location_id)
                    if (equalAdressesIndex < 0) {
                        addressesMobiE.push(invoiceObj.attach.chargingSessions.summaryAddress[0])
                    }

                    let equalOperatorsIndex = operatorsMobiE.findIndex(obj => obj.partyId === sessionI.party_id)
                    if (equalOperatorsIndex < 0) {
                        operatorsMobiE.push(invoiceObj.attach.chargingSessions.summaryOperator[0])
                    }

                    unitPricesSummaryMobiE = invoiceObj.attach.chargingSessions.unitPricesSummary

                    attachLinesObj["mobie"].push(invoiceObj.attach.chargingSessions.lines[0])

                } else if (
                    sessionI.chargerType === process.env.chargerTypeGireve ||
                    sessionI.chargerType === Enums.ChargerTypes.Hubject
                ) {
                    // othersInternational += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                    let invoiceLine = buildSingleInvoiceLine(global.Item_OtherNetworks, "Serviços em outras redes", session_total_exc_vat, sessionVat)
                    invoiceLines.push([invoiceLine])

                    internationalNetwork += session_total_exc_vat
                    internationalVatValue += session_total_vat

                    gireveTotalChargingTime += sessionI.timeCharged
                    gireveTotalEnergy += sessionI.kwh
                    gireveTotalSessions += 1

                    gireve_total_exc_vat += session_total_exc_vat
                    gireve_total_inc_vat += session_total_inc_vat

                    let equalAdressesIndex = addressesInternational.findIndex(obj => obj.hwId === sessionI.location_id)
                    if (equalAdressesIndex < 0) {
                        addressesInternational.push(invoiceObj.attach.chargingSessions.summaryAddress[0])
                    }

                    let equalOperatorsIndex = operatorsInternational.findIndex(obj => obj.partyId === sessionI.party_id)
                    if (equalOperatorsIndex < 0) {
                        operatorsInternational.push(invoiceObj.attach.chargingSessions.summaryOperator[0])
                    }

                    attachLinesObj["international"].push(invoiceObj.attach.chargingSessions.lines[0])

                } else {
                    // othersMobie += invoiceObj.attach.overview.lines.evio_services.total_exc_vat
                    let invoiceLine = buildSingleInvoiceLine(global.Item_MobieServices, "Serviços rede MOBI.E", session_total_exc_vat, sessionVat)
                    invoiceLines.push([invoiceLine])

                    mobieNetwork += session_total_exc_vat
                    mobieVatValue += session_total_vat

                    mobieTotalChargingTime += sessionI.timeCharged
                    mobieTotalEnergy += sessionI.kwh
                    mobieTotalSessions += 1

                    mobie_total_exc_vat += session_total_exc_vat
                    mobie_total_inc_vat += session_total_inc_vat

                    let equalAdressesIndex = addressesMobiE.findIndex(obj => obj.hwId === sessionI.location_id)
                    if (equalAdressesIndex < 0) {
                        addressesMobiE.push(invoiceObj.attach.chargingSessions.summaryAddress[0])
                    }

                    let equalOperatorsIndex = operatorsMobiE.findIndex(obj => obj.partyId === sessionI.party_id)
                    if (equalOperatorsIndex < 0) {
                        operatorsMobiE.push(invoiceObj.attach.chargingSessions.summaryOperator[0])
                    }
                    unitPricesSummaryMobiE = invoiceObj.attach.chargingSessions.unitPricesSummary

                    attachLinesObj["mobie"].push(invoiceObj.attach.chargingSessions.lines[0])

                }
            }

        }

        let mobieTotalValues = {
            sessions: mobieTotalSessions,
            totalTime: new Date(mobieTotalChargingTime * 1000).toISOString().substr(11, 8),
            totalEnergy: Utils.round(mobieTotalEnergy) + " kWh"
        }

        let gireveTotalValues = {
            sessions: gireveTotalSessions,
            totalTime: new Date(gireveTotalChargingTime * 1000).toISOString().substr(11, 8),
            totalEnergy: Utils.round(gireveTotalEnergy) + " kWh"
        }

        let body = {
            invoice: {
                paymentIdList,
                header: {
                    userId
                },
                lines: invoiceLines
            },
            attach: {
                overview: {
                    footer: {
                        total_exc_vat: total_exc_vat,
                        total_inc_vat: total_inc_vat
                    },
                    lines:
                    {
                        // evio_services: { total_exc_vat: Utils.round(others), vat: Utils.round(othersVatValue) },
                        evio_services: { total_exc_vat: 0, vat: 0 },
                        evio_network: { total_exc_vat: 0, vat: 0 },
                        // mobie_network: { total_exc_vat: Utils.round(mobieNetwork - othersMobie), vat: Utils.round(mobieVatValue) },
                        mobie_network: { total_exc_vat: mobieNetwork, vat: mobieVatValue },
                        // other_networks: { total_exc_vat: Utils.round(internationalNetwork - othersInternational), vat: Utils.round(internationalVatValue) }
                        other_networks: { total_exc_vat: internationalNetwork, vat: internationalVatValue },
                        hyundai_network: { total_exc_vat: 0, vat: 0 },
                        goCharge_network: { total_exc_vat: 0, vat: 0 },
                        klc_network: { total_exc_vat: 0, vat: 0 },
                        kinto_network: { total_exc_vat: 0, vat: 0 },
                    }

                },
                chargingSessions: {
                    header: {
                        mobie: mobieTotalValues,
                        international: gireveTotalValues
                    },
                    lines: [
                        { network: "mobie", values: attachLinesObj.mobie.sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime)) },
                        { network: "international", values: attachLinesObj.international.sort((a, b) => moment(a.startDateTime) - moment(b.startDateTime)) },
                    ],
                    summaryAddress: {
                        "mobie": addressesMobiE,
                        "international": addressesInternational,
                    },
                    summaryOperator: {
                        "mobie": operatorsMobiE,
                        "international": operatorsInternational,
                    },
                    unitPricesSummary: {
                        "mobie": unitPricesSummaryMobiE
                    },
                    footer: {
                        mobie: {
                            total_exc_vat: mobie_total_exc_vat,
                            total_inc_vat: mobie_total_inc_vat,
                        },
                        international: {
                            total_exc_vat: gireve_total_exc_vat,
                            total_inc_vat: gireve_total_inc_vat,
                        },
                    }
                }
            }
        }

        return { body, sessionIds }
        // return body

    } catch (error) {
        console.log(`[${context}] Error : ${error.message}`);
        return null
    }
}

function getLastDateOfPreviousMonth() {
    let context = "getLastDateOfPreviousMonth function"
    try {
        let currentIsoDate = new Date().toISOString()
        let currentIsoDateObj = new Date(currentIsoDate)
        currentIsoDateObj.setDate(0)
        currentIsoDateObj.setHours(23, 59, 59, 999)
        return currentIsoDateObj.toISOString()
    } catch (error) {
        return new Date().toISOString()
    }
}

function joinInvoiceLines(invoiceLines) {
    let context = "joinInvoiceLines function"
    let newAggregationInvoiceLines = []
    try {
        for (let line of invoiceLines) {
            if (line.uom === "UN" && !line.description.includes('OPC')) {
                newAggregationInvoiceLines.push(line)
            } else {
                if (line.description.includes('OPC')) {
                    updateOrCreateInvoiceLine(newAggregationInvoiceLines, line, global.Item_OPC, "Tarifas de utilização dos OPC", "UN")
                } else if (line.description.includes('Energia consumida')) {
                    updateOrCreateInvoiceLine(newAggregationInvoiceLines, line, global.Item_Energy, "Energia consumida", "KWh")
                } else if (line.description.includes('Tarifas Acesso às Redes')) {
                    updateOrCreateInvoiceLine(newAggregationInvoiceLines, line, global.Item_TAR, "Tarifas Acesso às Redes", "UN")
                } else if (line.description.includes('IEC')) {
                    updateOrCreateInvoiceLine(newAggregationInvoiceLines, line, global.Item_IEC, "IEC – Imposto Especial sobre o Consumo", "KWh")
                }
            }

        }
        return newAggregationInvoiceLines
    } catch (error) {
        console.log(`[${context}] Error : ${error.message}`);
        return []
    }
}

function updateOrCreateInvoiceLine(newAggregationInvoiceLines, line, code, description, newUnit) {
    let context = "updateOrCreateInvoiceLine function"
    try {
        let equalLineIndex = newAggregationInvoiceLines.findIndex(obj => (
            (obj.code == code
                && obj.discount == line.discount
                && obj.uom === "UN") || (
                obj.code == code
                && obj.discount == line.discount
                && obj.unitPrice == line.unitPrice
                && obj.uom !== "UN"
            )
        ))
        // let unitPrice = Utils.round(line.quantity * line.unitPrice)
        let unitPrice = line.quantity * line.unitPrice
        if (equalLineIndex > -1) {
            if (newUnit === "UN") {
                newAggregationInvoiceLines[equalLineIndex].unitPrice += unitPrice
            } else {
                newAggregationInvoiceLines[equalLineIndex].quantity += line.quantity
            }
        } else {
            line.code = code
            line.description = description
            line.uom = newUnit
            if (newUnit === "UN") {
                line.unitPrice = unitPrice
                line.quantity = 1
            }
            newAggregationInvoiceLines.push(line);
        }
    } catch (error) {
        console.log(`[${context}] Error : ${error.message}`);
    }
}

function buildSingleInvoiceLine(code, description, unitPrice, vat) {
    let context = "buildSingleInvoiceLine function"
    try {
        let singleInvoiceLine = {
            "code": code, "description": description, "unitPrice": unitPrice, "uom": "UN", "quantity": 1, "vat": vat, "discount": 0, "total": 0
        }
        if (vat == 0) {
            singleInvoiceLine.taxExemptionReasonCode = Constants.TAX_EXEMPTION_REASON_CODE_M40
        }
        return singleInvoiceLine

    } catch (error) {
        console.log(`[${context}] Error : ${error.message}`);
    }
}

function getTariffsDetailsRoaming(chargingSession) {
    var context = "Function getTariffsDetailsRoaming";
    return new Promise(async (resolve, reject) => {

        try {

            let CEME_PERCENTAGE = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "percentage")
            let evioPercentage = CEME_PERCENTAGE ? CEME_PERCENTAGE.price : 0

            let opcDetail;
            let cemeDetail;
            if (chargingSession.finalPrices) {

                opcDetail = chargingSession.finalPrices.opcPriceDetail;
                cemeDetail = chargingSession.finalPrices.cemePriceDetail;

            } else {

                opcDetail = {
                    timePrice: {
                        excl_vat: 0
                    },
                    powerPrice: {
                        excl_vat: 0
                    },
                    flatPrice: {
                        excl_vat: 0
                    }
                };

                cemeDetail = {
                    timePrice: {
                        excl_vat: 0
                    },
                    powerPrice: {
                        excl_vat: 0
                    },
                    flatPrice: {
                        excl_vat: 0
                    }
                };

            };

            let gireveActivationFee = Number(process.env.GireveCommission)

            let timeCost = Number(opcDetail.timePrice.excl_vat.toFixed(2)) + Number(cemeDetail.timePrice.excl_vat.toFixed(2)) + Number(((opcDetail.timePrice.excl_vat) * evioPercentage).toFixed(2))
            let energyCost = Number(opcDetail.powerPrice.excl_vat.toFixed(2)) + Number(cemeDetail.powerPrice.excl_vat.toFixed(2)) + Number(((opcDetail.powerPrice.excl_vat) * evioPercentage).toFixed(2))
            let flatCost = Number(opcDetail.flatPrice.excl_vat.toFixed(2)) + Number(cemeDetail.flatPrice.excl_vat.toFixed(2)) + Number(((opcDetail.flatPrice.excl_vat) * evioPercentage).toFixed(2)) + Number(gireveActivationFee.toFixed(2))

            let tariffOPCTime;
            let tariffOPCEnergy;

            chargingSession.tariffOPC.elements.forEach(elem => {
                if (elem.price_components.find(component => {
                    return component.type.includes("TIME");
                })) {
                    tariffOPCTime = elem.price_components.find(component => {
                        return component.type.includes("TIME");
                    });
                };
            });
            chargingSession.tariffOPC.elements.forEach(elem => {
                if (elem.price_components.find(component => {
                    return component.type.includes("ENERGY");
                })) {
                    tariffOPCEnergy = elem.price_components.find(component => {
                        return component.type.includes("ENERGY");
                    });
                };
            });

            let tariffCemeTime = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "time");
            let tariffCemeEnergy = chargingSession.tariffCEME.tariff.find(tariff => tariff.type === "energy");

            let OPCTime = tariffOPCTime ? tariffOPCTime.price : 0;
            let OPCEnergy = tariffOPCEnergy ? tariffOPCEnergy.price : 0;
            let cemeTime = tariffCemeTime ? tariffCemeTime.price : 0;
            let cemeEnergy = tariffCemeEnergy ? tariffCemeEnergy.price : 0;


            let tariffTime = timeCost / (chargingSession.timeCharged / 60);
            let tariffEnergy;
            if (chargingSession.kwh)
                tariffEnergy = tariffOPCEnergy / chargingSession.kwh;
            else
                tariffEnergy = 0;

            resolve({
                timeCost: timeCost,
                energyCost: energyCost,
                flatCost: flatCost,
                tariffTime: tariffTime,
                tariffEnergy: tariffEnergy
            })

        } catch (error) {
            console.log(`[${context}] Error : ${error.message}`);
            resolve({
                timeCost: 0,
                energyCost: 0,
                flatCost: 0,
                tariffTime: 0,
                tariffEnergy: 0
            })
        };

    });

};

function addClientName() {
    let context = "Function addClientName";

    Session.updateMany({}, { $set: { clientName: "EVIO" } }, (err, result) => {
        if (err) {
            console.log(`[${context}] Error `, err.message);
        };
        console.log("result", result)
    })
};

function addUserIdToBilling() {
    let context = "Function addUserIdToBilling";

    Session.find({}, { _id: 1, userIdWillPay: 1 }, (err, sessionsFound) => {

        if (err) {
            console.log(`[${context}] Error `, err.message);
        };

        if (sessionsFound.length > 0) {
            sessionsFound.forEach(session => {
                Session.updateSession({ _id: session._id }, { $set: { userIdToBilling: session.userIdWillPay } }, (err, sessionsFound) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                    };

                    console.log("Success")
                });
            });
        };

    })
}

function getPlafond(evId) {
    const context = "Function getPlafond";
    return new Promise(async (resolve) => {
        try {

            let host = process.env.HostPayments + process.env.PathGetPlafondByEV + evId;
            let plafond = await axios.get(host);
            resolve(plafond.data);

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve(null);

        };
    });
};

function getFirstDateOfMonth(endDate) {
    let context = "getFirstDateOfMonth function"
    try {
        let currentIsoDateObj = new Date(endDate)
        currentIsoDateObj.setDate(1)
        currentIsoDateObj.setHours(0, 0, 0, 0)
        return currentIsoDateObj.toISOString()
    } catch (error) {
        return new Date().toISOString()
    }
}

function createExcelColumns() {
    const context = "Function createBillingPeriodExcelColumns"
    try {
        return [
            { header: "ID Posto", key: '_id' },
            { header: "Nº de sessões do posto", key: 'count' },
        ]
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function chargersSessionsReport(source, startDate, endDate) {
    const context = "Function chargersSessionsReport"
    try {

        // Generate Excel columns
        let columns = createExcelColumns()

        // Generate Excel lines
        let lines = await groupSessionsByCharger(source, startDate, endDate)

        // Create Excel Buffer to attach to email
        let excelBuffer = await Utils.createExcelBuffer('Utilização de postos', columns, lines)

        // Format dates to email
        startDate = moment.utc(startDate).format('DD-MM-YYYY')
        endDate = moment.utc(endDate).format('DD-MM-YYYY')

        // Generate Email html body
        let html = createEmailHtml(startDate, endDate)

        // Get emails to send
        let { emailTo, emailCc } = Utils.getEmailToSend()

        // Add environment to subject
        let subject = addEnvironmentToSubject(`MobiE utilização de postos de ${startDate} a ${endDate}`)

        // Send email with Excel report
        Utils.sendExcelToEmail(excelBuffer, emailTo, subject, 'MobiE utilização de postos' + '.xlsx', emailCc, html)
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

function createEmailHtml(startDate, endDate) {
    const context = "Function createEmailHtml"
    try {
        return '<b> Bom dia </b><br>' +
            '<br>' +
            '<b>' + `Aqui é enviado o ficheiro (em anexo) com todas as sessões dos postos Mobie entre ${startDate} e ${endDate}` + ' </b><br>' +
            '<br>' +
            '<b>' + "Obrigado" + ' </b><br>' +
            '<br>' +
            '<br>' +
            '<b> Nota: Neste ficheiro são apenas apresentados os postos que tiveram sessões no respetivo período.'
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return ''
    }
}

function addEnvironmentToSubject(subject) {
    let environment = "";

    if (process.env.NODE_ENV === 'pre-production') {
        environment = '[PRE] - '
    } else if (process.env.NODE_ENV === 'development') {
        environment = '[QA] - '
    }
    return environment + subject
}

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await Session.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ", result);
            };
        })

        await Session.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ", result);
            };
        })

        let sessions = await Session.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != sessions.length; i++) {
            if (sessions[i].address)
                if (sessions[i].address.country)
                    if (unicCountries.indexOf(sessions[i].address.country) == -1) {
                        unicCountries.push(sessions[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes")
        console.log(coutryCodes)

        console.log("unicCountries")
        console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await Session.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.log(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return error
    }
}

function updateCO2SavedMinumum() {
    let context = "FUNCTION updateCO2SavedMinumum"

    let query = {
        CO2Saved: { $lt: 0 }
    };

    let newValues = {
        "CO2Saved": 0,
    };

    Session.updateMany(query, { $set: newValues }, (err, result) => {
        if (err) {
            console.log(`[${context}][OCPI.findOneAndUpdate] Error`, err.message);
        }
    });
}
