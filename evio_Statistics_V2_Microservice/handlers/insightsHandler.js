require("dotenv-safe").load();
const History = require('../models/historyV2');
const axios = require("axios");

module.exports = {
    getInsightsApps: function (req, res) {
        let context = "Function getInsightsApps";
        return new Promise(async (resolve, reject) => {
            try {

                let userId = req.headers['userid'];
                //console.log("userId", userId);
                let received = req.query;

                if (!received.startDate) {
                    reject({ auth: false, code: 'server_startDate_required', message: "Start date is required" });
                }
                if (!received.endDate) {
                    reject({ auth: false, code: 'server_endDate_required', message: "End date is required" });
                }

                let myRating = await getMyRating(userId);
                //let numberOfEVs = await getNumberOfEVs(userId, received, "APP");
                //let numberOfChargers = await getNUmberOfChargers(userId, received);
                let insightsMyEvsTotal = await getInsightsMyEvsTotal(userId, received, "APP");

                //let insightsMyEvsByEv = await getInsightsMyEvsByEV(userId, received, "APP");
                //let insightsMyChargersByCharger = await getInsightsMyChargersByCharger(userId, received);

                let insightsMyChargersTotal = await getInsightsMyChargersTotal(userId, received);

                let insightsByEV = await getInsightsByEvApps(userId, received);
                insightsByEV = await getMostUsedChargerByEV(insightsByEV, received, userId, req);

                let insightsByCharger = await getInsightsByChargerApps(userId, received);
                insightsByCharger = await getMostUsedPlugApp(insightsByCharger, received);

                //let mostUsedEV = await getMostUsedEV(userId, received, "APP");
                //let mostUsedCharger = await getMostUsedCharger(received, "USER", userId);
                //let lastUsedCharger = await getLastUsedCharger(userId, received);
                //let mostUsedChargerByMe = await getMostUsedChargerByMe(userId, received);

                let myChargers;
                let myEvs;

                if (insightsMyEvsTotal.length > 0) {
                    myEvs = insightsMyEvsTotal[0];
                    myEvs.evs = insightsByEV;
                };

                if (insightsMyChargersTotal.length > 0) {
                    myChargers = insightsMyChargersTotal[0];
                    myChargers.chargers = insightsByCharger;
                };


                let insights = {
                    myEvs: myEvs,
                    myChargers: myChargers,
                    //mostUsedEV: mostUsedEV,
                    //mostUsedCharger: mostUsedCharger,
                    //lastUsedCharger: lastUsedCharger,
                    //mostUsedChargerByMe: mostUsedChargerByMe,
                    myRating: myRating.rating,
                    //mostUsedCharger: mostUsedCharger
                };

                resolve(insights);

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    getInsightsWeb: function (req, res) {
        let context = "Function getInsightsWeb";
        return new Promise(async (resolve, reject) => {

            try {


                let userId = req.headers['userid'];
                let received = req.query;

                if (!received.startDate) {
                    reject({ auth: false, code: 'server_startDate_required', message: "Start date is required" });
                }
                if (!received.endDate) {
                    reject({ auth: false, code: 'server_endDate_required', message: "End date is required" });
                }

                let myRating = await getMyRating(userId);
                let numberOfEVs = await getNumberOfEVs(userId, received, "WEB");
                let numberOfChargers = await getNUmberOfChargers(userId, received);
                let insightsMyEvsTotal = await getInsightsMyEvsTotal(userId, received, "WEB");
                //console.log(insightsMyEvsTotal)

                //let insightsMyEvsByEv = await getInsightsMyEvsByEV(userId, received, "WEB");                
                //let insightsMyChargersByCharger = await getInsightsMyChargersByCharger(userId, received);

                let insightsMyChargersTotal = await getInsightsMyChargersTotal(userId, received);
                let mostUsedEV = await getMostUsedEV(userId, received, "WEB");
                let mostUsedCharger = await getMostUsedCharger(received, "USER", userId);
                let lastUsedCharger = await getLastUsedCharger(userId, received);
                let mostUsedChargerByMe = await getMostUsedChargerByMe(userId, received, "WEB");

                let myChargers;
                let myEvs;

                if (insightsMyEvsTotal.length > 0) {
                    myEvs = insightsMyEvsTotal[0];
                    // myEvs.evs = insightsMyEvsByEv;
                };

                if (insightsMyChargersTotal.length > 0) {
                    myChargers = insightsMyChargersTotal[0];
                    //myChargers.chargers = insightsMyChargersByCharger;
                };

                if (myEvs)
                    myEvs.evs = numberOfEVs;
                if (myChargers)
                    myChargers.chargers = numberOfChargers;

                let insights = {
                    myEvs: myEvs,
                    myChargers: myChargers,
                    mostUsedEV: mostUsedEV,
                    mostUsedCharger: mostUsedCharger,
                    lastUsedCharger: lastUsedCharger,
                    mostUsedChargerByMe: mostUsedChargerByMe,
                    myRating: myRating.rating
                };

                resolve(insights);

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    getInsightsByEvApps: function (req, res) {
        let context = "Function getInsightsByEvApps";
        return new Promise(async (resolve, reject) => {

            try {
                let received = req.query;

                if (!received.evId) {
                    reject({ auth: false, code: 'server_ev_id_required', message: "Electric vehicle Id is required" })
                }
                if (!received.startDate) {
                    reject({ auth: false, code: 'server_startDate_required', message: "Start date is required" })
                }
                if (!received.endDate) {
                    reject({ auth: false, code: 'server_endDate_required', message: "End date is required" })
                }
                
                const {byToModel, userId, idToModel} = getUserHeaderOrReceivedIfExists(req.headers, received, 'ev')

                //console.log("received", received);
                let insightsMyEvsByEv = await getInsightsByEV(received, req);
                let mostUsedCharger = await getMostUsedCharger(received, "EV", userId);

                if (insightsMyEvsByEv.length > 0)
                    insightsMyEvsByEv[0].mostUsedCharger = mostUsedCharger;

                resolve(insightsMyEvsByEv);

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    getInsightsByEvWeb: function (req, res) {
        let context = "Function getInsightsByEvWeb";
        return new Promise(async (resolve, reject) => {

            try {

                let received = req.query;

                if (!received.evId) {
                    reject({ auth: false, code: 'server_ev_id_required', message: "Electric vehicle Id is required" })
                }
                if (!received.startDate) {
                    reject({ auth: false, code: 'server_startDate_required', message: "Start date is required" })
                }
                if (!received.endDate) {
                    reject({ auth: false, code: 'server_endDate_required', message: "End date is required" })
                }

                const {byToModel, userId, idToModel} = getUserHeaderOrReceivedIfExists(req.headers, received, 'ev')

                //console.log("received", received);
                let insightsMyEvsByEv = await getInsightsByEV(received, req);
                let ev = await getEV(received.evId);
                let mostUsedCharger = await getMostUsedCharger(received, "EV", userId );
                let insightsByDate = await getInsightsByDate(received, "EV", req);

                if (insightsMyEvsByEv.length > 0) {
                    insightsMyEvsByEv[0].mostUsedCharger = mostUsedCharger;
                    insightsMyEvsByEv[0].insightsByDate = insightsByDate;
                    insightsMyEvsByEv[0].ev = ev;
                }

                resolve(insightsMyEvsByEv[0]);

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    getInsightsByCharger: function (req, res) {
        let context = "Function getInsightsByCharger";
        return new Promise(async (resolve, reject) => {

            try {

                let received = req.query;

                if (!received.hwId) {
                    reject({ auth: false, code: 'server_hwid_required', message: 'Hardware Id is required!' });
                }
                if (!received.startDate) {
                    reject({ auth: false, code: 'server_startDate_required', message: "Start date is required" });
                }
                if (!received.endDate) {
                    reject({ auth: false, code: 'server_endDate_required', message: "End date is required" });
                }

                const {byToModel, idToModel} = getUserHeaderOrReceivedIfExists(req.headers, received, 'charger')
                //console.log("received", received);
                let insightsMyChargersByCharger = await getInsightsByCharger(received);
                let charger = await getCharger(received.hwId);
                let mostUsedPlug = await getMostUsedPlug(received);
                let insightsByDate = await getInsightsByDate(received, "CHARGER", req);
                //console.log("mostUsedPlug", mostUsedPlug);

                if (insightsMyChargersByCharger.length > 0) {
                    insightsMyChargersByCharger[0].mostUsedPlug = mostUsedPlug.plugId;
                    insightsMyChargersByCharger[0].insightsByDate = insightsByDate;
                    insightsMyChargersByCharger[0].charger = charger;
                }

                resolve(insightsMyChargersByCharger[0]);

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
}

//========== FUNCTION ==========

//Function to get insights my evs/my sessions (by EV)
function getInsightsMyEvsByEV(userId, received, requested) {
    var context = "Function getInsightsMyEvsByEV";
    return new Promise((resolve, reject) => {

        /*
        let query = {
            userId: userId,
            //evOwner: userId,
            stopDate: {
                $gte: received.startDate,
                $lte: received.endDate
            }
        };
        */

        let pipeline = [
            {
                "$match": {
                    $or: [
                        { userId: userId }
                    ],
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": { "ev": "$ev" },
                    "sessions": {
                        "$sum": 1
                    },
                    "totalChargingTime": {
                        "$sum": "$timeCharged"
                    },
                    "totalCO2Saved": {
                        "$sum": "$CO2Saved"
                    },
                    "totalSpendInclVat": {
                        "$sum": "$totalPrice.incl_vat"
                    },
                    "totalSpendExclVat": {
                        "$sum": "$totalPrice.excl_vat"
                    },
                    "totalEnergy": {
                        "$sum": "$totalPower"
                    },
                    "averageChargingTimeSession": {
                        "$avg": "$timeCharged"
                    },
                    "averageEnergyChargedSession": {
                        "$avg": "$totalPower"
                    }
                }
            },
            {
                "$project": {
                    "sessions": "$sessions",
                    "totalChargingTime": {
                        "$divide": ["$totalChargingTime", 3600.0]
                    },
                    "totalCO2Saved": "$totalCO2Saved",
                    "totalSpendInclVat": "$totalSpendInclVat",
                    "totalSpendExclVat": "$totalSpendExclVat",
                    "totalEnergy": {
                        "$divide": ["$totalEnergy", 1000.0]
                    },
                    "averageChargingTimeSession": {
                        "$divide": ["$averageChargingTimeSession", 3600.0]
                    },
                    "averageEnergyChargedSession": {
                        "$divide": ["$averageEnergyChargedSession", 1000.0]
                    },
                    "ev": "$_id.ev",
                    "_id": 0
                }
            }
        ];

        if (requested === "WEB") {
            pipeline[0].$match.$or.push({ evOwner: userId });
        };

        //console.log("pipeline", pipeline[0].$match.$or);

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                resolve(result);

            };
        });


    });
};

//Function to get insights my evs/My sessions (total)
function getInsightsMyEvsTotal(userId, received, requested) {
    var context = "Function getInsightsMyEvsTotal";
    return new Promise((resolve, reject) => {

        let pipeline = [
            {
                "$match": {
                    $or: [
                        { userId: userId },
                        { userIdWillPay: userId }
                    ],
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: { $ne: process.env.PaymentStatusFaild },
                    timeCharged: {
                        $lt: parseInt(process.env.MaxTimeChargedToCountHistories),
                        $gt: parseInt(process.env.MinTimeChargedToCountHistories)
                    },
                    ...(received.evId && { evId: { $in: received.evId.split(',')}}),
                    ...(received.contractId && { "contract._id": { $in: received.contractId.split(',') } })
                }
            },
            {
                "$group": {
                    "_id": {},
                    "totalSessions": {
                        "$sum": 1
                    },
                    "totalChargingTime": {
                        "$sum": "$timeCharged"
                    },
                    "totalCO2Saved": {
                        "$sum": "$CO2Saved"
                    },
                    "totalCostInclVat": {
                        "$sum": "$totalPrice.incl_vat"
                    },
                    "totalCostExclVat": {
                        "$sum": "$totalPrice.excl_vat"
                    },
                    "totalEnergy": {
                        "$sum": "$totalPower"
                    }
                }
            },
            {
                "$project": {
                    "totalSessions": "$totalSessions",
                    "totalChargingTime": {
                        "$divide": ["$totalChargingTime", 3600.0]
                    },
                    "totalCO2Saved": "$totalCO2Saved",
                    "totalCostInclVat": "$totalCostInclVat",
                    "totalCostExclVat": "$totalCostExclVat",
                    "totalEnergy": {
                        "$divide": ["$totalEnergy", 1000.0]
                    },
                    "_id": 0
                }
            }
        ];

        if (requested === "WEB") {
            pipeline[0].$match.$or.push({ evOwner: userId });
        };

        //console.log("pipeline", pipeline[0].$match.$or);

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                resolve(result);

            };
        });


    });
};

//Function to get most used EV
function getMostUsedEV(userId, received, requested) {
    var context = "Function getMostUsedEV";
    return new Promise((resolve, reject) => {

        let pipeline = [
            {
                "$match": {
                    $or: [
                        { userId: userId }
                    ],
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {
                        "ev": "$ev",
                        "evId": "$evId"
                    },
                    "COUNT(*)": {
                        "$sum": 1
                    }
                }
            },
            {
                "$project": {
                    "evId": "$_id.evId",
                    "ev": "$_id.ev",
                    "number": "$COUNT(*)",
                    "_id": 0
                }
            },
            {
                "$sort": {
                    "number": -1
                }
            }
        ];

        if (requested === "WEB") {
            pipeline[0].$match.$or.push({ evOwner: userId });
        };

        //console.log("pipeline", pipeline[0].$match.$or);

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                if (result.length > 0) {
                    //result.sort((a, b) => b.number - a.number);
                    if (result[0].evId != "-1") {
                        resolve(result[0].ev);
                    } else if (result.length > 1) {
                        resolve(result[1].ev);
                    } else {
                        resolve(result[0].ev);
                    }
                } else {
                    resolve(null)
                }
                //console.log("result 1", result);
                //resolve(result);
                //console.log("result", result);
                /*
                let total = {
                    totalSessions: 0,
                    totalChargingTime: 0,
                    totalCO2Saved: 0,
                    totalCost: 0,
                    totalEnergy: 0
                };

                Promise.all(
                    result.map(history => {
                        return new Promise((resolve) => {
                            total.totalSessions += history.totalSessions;
                            total.totalChargingTime += history.totalChargingTime;
                            total.totalCO2Saved += history.totalCO2Saved;
                            total.totalCost += history.totalCost;
                            total.totalEnergy += history.totalEnergy;
                            resolve();
                        });
                    })
                ).then(() => {

                    console.log("total", total);
                })
                */

            };
        });


    });
};

function getMostUsedCharger(received, request, userId) {
    var context = "Function getMostUsedCharger";
    return new Promise((resolve, reject) => {
        let pipeline;

        if (request === "USER") {
            pipeline = [
                {
                    "$match": {
                        chargerOwner: userId,
                        stopDate: {
                            $gte: new Date(received.startDate),
                            $lte: new Date(received.endDate)
                        },
                        status: {$ne: process.env.PaymentStatusFaild}
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "charger": "$charger",
                            "hwId": "$hwId"
                        },
                        "COUNT(*)": {
                            "$sum": 1
                        }
                    }
                },
                {
                    "$project": {
                        "hwId": "$_id.hwId",
                        "charger": "$_id.charger",
                        "number": "$COUNT(*)",
                        "_id": 0
                    }
                },
                {
                    "$sort": {
                        "number": -1
                    }
                }
            ];
        } else {
            pipeline = [
                {
                    "$match": {
                        evId: received.evId,
                        stopDate: {
                            $gte: new Date(received.startDate),
                            $lte: new Date(received.endDate)
                        },
                        status: {$ne: process.env.PaymentStatusFaild}
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "charger": "$charger",
                            "hwId": "$hwId"
                        },
                        "COUNT(*)": {
                            "$sum": 1
                        }
                    }
                },
                {
                    "$project": {
                        "hwId": "$_id.hwId",
                        "charger": "$_id.charger",
                        "number": "$COUNT(*)",
                        "_id": 0
                    }
                }
            ];

            if (received.userId)
                pipeline[0].$match.userId = received.userId;

            if (received.driverId)
                pipeline[0].$match.userId = received.driverId;

        }

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {


                if (result.length > 0) {
                    //console.log("result 1 ", result[0].number);
                    //console.log("result 2 ", result[result.length - 1].number);
                    //result.sort((a, b) => b.number - a.number);
                    resolve(result[0].charger);
                } else {
                    resolve({});
                }
                // console.log("result ", result);


            };
        });

    });
};

function getMostUsedChargerByMe(userId, received, requested) {
    var context = "Function getMostUsedChargerByMe";
    return new Promise((resolve, reject) => {
        let pipeline = [
            {
                "$match": {
                    $or: [
                        { userId: userId },
                        { userIdWillPay: userId }
                    ],
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {
                        "charger": "$charger",
                        "hwId": "$hwId"
                    },
                    "COUNT(*)": {
                        "$sum": 1
                    }
                }
            },
            {
                "$project": {
                    "hwId": "$_id.hwId",
                    "charger": "$_id.charger",
                    "number": "$COUNT(*)",
                    "_id": 0
                }
            },
            {
                "$sort": {
                    "number": -1
                }
            }
        ];

        if (requested === "WEB") {
            pipeline[0].$match.$or.push({ evOwner: userId });
        };

        //console.log("pipeline 1 ", pipeline);

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve(null);
            }
            else {

                //console.log("result 1 ", result);
                if (result.length > 0) {
                    //result.sort((a, b) => b.number - a.number);
                    resolve(result[0].charger);
                } else {
                    resolve(null);
                }
                // console.log("result ", result);


            };
        });

    });
};

function getLastUsedCharger(userId, received) {
    var context = "Function getLastUsedCharger";
    return new Promise(async (resolve, reject) => {

        let query = {
            chargerOwner: userId,
            stopDate: {
                $gte: new Date(received.startDate),
                $lte: new Date(received.endDate)
            },
            status: {$ne: process.env.PaymentStatusFaild}
        };

        try {

            let chargers = await History.find(query, { charger: 1 }).sort({ stopDate: -1 });

            if (chargers.length > 0) {
                resolve(chargers[0].charger);
            }
            else {
                resolve({});
            }

        } catch (error) {
            console.error(`[${context}] Error`, error.message);
            //ErrorHandler.ErrorHandler(err, res)
            resolve({});
        }


    });
};

function getMyRating(userId) {
    var context = "Function getMyRating";
    return new Promise((resolve, reject) => {

        let host = `${process.env.HostCharger}${process.env.PathGetRating}/${userId}`

        axios.get(host)
            .then((result) => {
                //console.log("result", result.data);
                resolve(result.data);

            })
            .catch((error) => {
                console.error(`[${context}] Error`, error.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve(
                    {
                        rating: 0
                    }
                );
            })

    });
};

//Function to get insights sessions my chargers (total)
function getInsightsMyChargersTotal(userId, received) {
    var context = "Function getInsightsMyChargersTotal";
    return new Promise((resolve, reject) => {

        let pipeline = [
            {
                "$match": {
                    chargerOwner: userId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {},
                    "totalSessions": {
                        "$sum": 1
                    },
                    "totalChargingTime": {
                        "$sum": "$timeCharged"
                    },
                    "totalCO2Saved": {
                        "$sum": "$CO2Saved"
                    },
                    "incomeInclVat": {
                        "$sum": "$totalPrice.incl_vat"
                    },
                    "incomeExclVat": {
                        "$sum": "$totalPrice.excl_vat"
                    },
                    "totalEnergy": {
                        "$sum": "$totalPower"
                    },
                    "purchaseTariffDetailsExclVat": {
                        "$sum": "$purchaseTariffDetails.excl_vat"
                    },
                    "purchaseTariffDetailsInclVat": {
                        "$sum": "$purchaseTariffDetails.incl_vat"
                    }
                }
            },
            {
                "$project": {
                    "totalSessions": "$totalSessions",
                    "totalChargingTime": {
                        "$divide": ["$totalChargingTime", 3600.0]
                    },
                    "totalCO2Saved": "$totalCO2Saved",
                    "incomeInclVat": "$incomeInclVat",
                    "incomeExclVat": "$incomeExclVat",
                    "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
                    "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
                    "totalEnergy": {
                        "$divide": ["$totalEnergy", 1000.0]
                    },
                    "_id": 0
                }
            }
        ];

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                //console.log("result", result);
                resolve(result);

            };
        });


    });
};

//Function to get insights sessions my chargers (by charger)
function getInsightsMyChargersByCharger(userId, received) {
    var context = "Function getInsightsMyChargersByCharger";
    return new Promise((resolve, reject) => {

        let pipeline = [
            {
                "$match": {
                    chargerOwner: userId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": { "charger": "$charger" },
                    "sessions": {
                        "$sum": 1
                    },
                    "totalChargingTime": {
                        "$sum": "$timeCharged"
                    },
                    "totalCO2Saved": {
                        "$sum": "$CO2Saved"
                    },
                    "incomeInclVat": {
                        "$sum": "$totalPrice.incl_vat"
                    },
                    "incomeExclVat": {
                        "$sum": "$totalPrice.excl_vat"
                    },
                    "totalEnergy": {
                        "$sum": "$totalPower"
                    },
                    "averageChargingTimeSession": {
                        "$avg": "$timeCharged"
                    },
                    "averageEnergyChargedSession": {
                        "$avg": "$totalPower"
                    }
                }
            },
            {
                "$project": {
                    "sessions": "$sessions",
                    "totalChargingTime": {
                        "$divide": ["$totalChargingTime", 3600.0]
                    },
                    "totalCO2Saved": "$totalCO2Saved",
                    "incomeInclVat": "$incomeInclVat",
                    "incomeExclVat": "$incomeExclVat",
                    "totalEnergy": {
                        "$divide": ["$totalEnergy", 1000.0]
                    },
                    "averageChargingTimeSession": {
                        "$divide": ["$averageChargingTimeSession", 3600.0]
                    },
                    "averageEnergyChargedSession": {
                        "$divide": ["$averageEnergyChargedSession", 1000.0]
                    },
                    "charger": "$_id.charger",
                    "_id": 0
                }
            }
        ];

        //console.log("pipeline", pipeline);

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                resolve(result);

            };
        });


    });
};

function getInsightsMyEvs(userId, received) {
    var context = "Function getInsightsMyEvs";
    return new Promise((resolve, reject) => {

        let query = {
            userId: userId,
            //evOwner: userId,
            stopDate: {
                $gte: received.startDate,
                $lte: received.endDate
            },
            status: {$ne: process.env.PaymentStatusFaild}
        };

        History.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve({
                    "totalChargingTime": 0.9938888888888889,
                    "totalSessions": 0,
                    "totalCost": 0,
                    "totalEnergy": 0,
                    "totalCO2Saved": 0,
                    "evs": []
                });
            }
            else {

                if (result.length === 0) {
                    resolve({
                        "totalChargingTime": 0.9938888888888889,
                        "totalSessions": 0,
                        "totalCost": 0,
                        "totalEnergy": 0,
                        "totalCO2Saved": 0,
                        "evs": []
                    });
                }
                else {

                };

            };
        });

    });
};

function getNumberOfEVs(userId, received, requested) {
    var context = "Function getNumberOfEVs";
    return new Promise((resolve, reject) => {

        /*
        let query = {
            userId: userId,
            //evOwner: userId,
            stopDate: {
                $gte: received.startDate,
                $lte: received.endDate
            }
        };
        */

        let pipeline = [
            {
                "$match": {
                    $or: [
                        { userId: userId }
                    ],
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {
                        "ev": "$ev",
                        "evId": "$evId"
                    },
                    "COUNT(evId)": {
                        "$sum": 1
                    }
                }
            },
            {
                "$project": {
                    "ev": "$_id.ev",
                    "evId": "$_id.evId",
                    "_id": 0
                }
            }
        ];

        if (requested === "WEB") {
            pipeline[0].$match.$or.push({ evOwner: userId });
        };

        //console.log("pipeline", pipeline[0].$match.$or);

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                if (result.length > 0) {

                    let newResult = Array.from(new Set(result.map(ev => ev.evId))).map(evId => {
                        return result.find(ev => ev.evId === evId)
                    })

                    //resolve(newResult.filter(ev => { return ev.ev != "-1" }));
                    resolve(newResult);

                } else {
                    resolve([]);
                }
                //resolve(newResult);
            };
        });
    });
};

//Function to get insights sessions my chargers (by charger)
function getNUmberOfChargers(userId, received) {
    var context = "Function getNUmberOfChargers";
    return new Promise((resolve, reject) => {

        let pipeline = [
            {
                "$match": {
                    chargerOwner: userId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {
                        "charger": "$charger",
                        "hwId": "$hwId"
                    },
                    "COUNT(hwId)": {
                        "$sum": 1
                    }
                }
            },
            {
                "$project": {
                    "charger": "$_id.charger",
                    "hwId": "$_id.hwId",
                    "_id": 0
                }
            }
        ];

        //console.log("pipeline", pipeline);

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                if (result.length > 0) {
                    let newResult = Array.from(new Set(result.map(charger => charger.hwId))).map(hwId => {
                        return result.find(charger => charger.hwId === hwId)
                    })

                    resolve(newResult.filter(charger => { return charger.charger != "-1" }));

                    //resolve(result);
                } else {
                    resolve([]);
                }
            };
        });


    });
};


function getInsightsByEV(received, requested) {
    var context = "Function getInsightsByEV";
    return new Promise((resolve, reject) => {

        let userId = requested.headers['userid'];
        let pipeline;
        if (received.evId !== "-1") {
            pipeline = [
                {
                    "$match": {
                        evId: received.evId,
                        stopDate: {
                            $gte: new Date(received.startDate),
                            $lte: new Date(received.endDate)
                        },
                        status: { $ne: process.env.PaymentStatusFaild },
                        timeCharged: {
                            $lt: parseInt(process.env.MaxTimeChargedToCountHistories),
                            $gt: parseInt(process.env.MinTimeChargedToCountHistories)
                        }
                    }
                },
                {
                    "$group": {
                        "_id": { "evId": "$evId" },
                        "sessions": {
                            "$sum": 1
                        },
                        "totalChargingTime": {
                            "$sum": "$timeCharged"
                        },
                        "totalCO2Saved": {
                            "$sum": "$CO2Saved"
                        },
                        "totalSpendInclVat": {
                            "$sum": "$totalPrice.incl_vat"
                        },
                        "totalSpendExclVat": {
                            "$sum": "$totalPrice.excl_vat"
                        },
                        "totalEnergy": {
                            "$sum": "$totalPower"
                        },
                        "averageChargingTimeSession": {
                            "$avg": "$timeCharged"
                        },
                        "averageEnergyChargedSession": {
                            "$avg": "$totalPower"
                        }
                    }
                },
                {
                    "$project": {
                        "sessions": "$sessions",
                        "totalChargingTime": {
                            "$divide": ["$totalChargingTime", 3600.0]
                        },
                        "totalCO2Saved": "$totalCO2Saved",
                        "totalSpendInclVat": "$totalSpendInclVat",
                        "totalSpendExclVat": "$totalSpendExclVat",
                        "totalEnergy": {
                            "$divide": ["$totalEnergy", 1000.0]
                        },
                        "averageChargingTimeSession": {
                            "$divide": ["$averageChargingTimeSession", 3600.0]
                        },
                        "averageEnergyChargedSession": {
                            "$divide": ["$averageEnergyChargedSession", 1000.0]
                        },
                        "evId": "$_id.evId",
                        "_id": 0
                    }
                }
            ];
        } else {
            pipeline = [
                {
                    "$match": {
                        evId: received.evId,
                        stopDate: {
                            $gte: new Date(received.startDate),
                            $lte: new Date(received.endDate)
                        },
                        status: {$ne: process.env.PaymentStatusFaild},
                        $or: [
                            { userId: userId },
                            { userId: userId },
                        ]
                    }
                },
                {
                    "$group": {
                        "_id": { "evId": "$evId" },
                        "sessions": {
                            "$sum": 1
                        },
                        "totalChargingTime": {
                            "$sum": "$timeCharged"
                        },
                        "totalCO2Saved": {
                            "$sum": "$CO2Saved"
                        },
                        "totalSpendInclVat": {
                            "$sum": "$totalPrice.incl_vat"
                        },
                        "totalSpendExclVat": {
                            "$sum": "$totalPrice.excl_vat"
                        },
                        "totalEnergy": {
                            "$sum": "$totalPower"
                        },
                        "averageChargingTimeSession": {
                            "$avg": "$timeCharged"
                        },
                        "averageEnergyChargedSession": {
                            "$avg": "$totalPower"
                        }
                    }
                },
                {
                    "$project": {
                        "sessions": "$sessions",
                        "totalChargingTime": {
                            "$divide": ["$totalChargingTime", 3600.0]
                        },
                        "totalCO2Saved": "$totalCO2Saved",
                        "totalSpendInclVat": "$totalSpendInclVat",
                        "totalSpendExclVat": "$totalSpendExclVat",
                        "totalEnergy": {
                            "$divide": ["$totalEnergy", 1000.0]
                        },
                        "averageChargingTimeSession": {
                            "$divide": ["$averageChargingTimeSession", 3600.0]
                        },
                        "averageEnergyChargedSession": {
                            "$divide": ["$averageEnergyChargedSession", 1000.0]
                        },
                        "evId": "$_id.evId",
                        "_id": 0
                    }
                }
            ];
        };
        if (received.userId)
            pipeline[0].$match.userId = received.userId;

        if (received.driverId)
            pipeline[0].$match.userId = received.driverId;

        //console.log("pipeline", pipeline);
        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                resolve([]);
            }
            else {

                //console.log("result", result);

                let newResult = Array.from(new Set(result.map(ev => ev.evId))).map(evId => {
                    return result.find(ev => ev.evId === evId)
                })
                resolve(newResult);

            };
        });


    });
};

function getInsightsByCharger(received) {
    var context = "Function getInsightsByCharger";
    return new Promise((resolve, reject) => {

        //console.log("received", received);

        let pipeline = [
            {
                "$match": {
                    hwId: received.hwId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": { "hwId": "$hwId" },
                    "sessions": {
                        "$sum": 1
                    },
                    "totalChargingTime": {
                        "$sum": "$timeCharged"
                    },
                    "totalCO2Saved": {
                        "$sum": "$CO2Saved"
                    },
                    "incomeInclVat": {
                        "$sum": "$totalPrice.incl_vat"
                    },
                    "incomeExclVat": {
                        "$sum": "$totalPrice.excl_vat"
                    },
                    "totalEnergy": {
                        "$sum": "$totalPower"
                    },
                    "averageChargingTimeSession": {
                        "$avg": "$timeCharged"
                    },
                    "averageEnergyChargedSession": {
                        "$avg": "$totalPower"
                    },
                    "purchaseTariffDetailsExclVat": {
                        "$sum": "$purchaseTariffDetails.excl_vat"
                    },
                    "purchaseTariffDetailsInclVat": {
                        "$sum": "$purchaseTariffDetails.incl_vat"
                    }
                }
            },
            {
                "$project": {
                    "sessions": "$sessions",
                    "totalChargingTime": {
                        "$divide": ["$totalChargingTime", 3600.0]
                    },
                    "totalCO2Saved": "$totalCO2Saved",
                    "incomeInclVat": "$incomeInclVat",
                    "incomeExclVat": "$incomeExclVat",
                    "totalEnergy": {
                        "$divide": ["$totalEnergy", 1000.0]
                    },
                    "averageChargingTimeSession": {
                        "$divide": ["$averageChargingTimeSession", 3600.0]
                    },
                    "averageEnergyChargedSession": {
                        "$divide": ["$averageEnergyChargedSession", 1000.0]
                    },
                    "purchaseTariffDetailsExclVat": "$purchaseTariffDetailsExclVat",
                    "purchaseTariffDetailsInclVat": "$purchaseTariffDetailsInclVat",
                    "hwId": "$_id.hwId",
                    "_id": 0
                }
            }
        ];

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            } else {

                resolve(result);

            };
        });

    });
};

function getMostUsedPlug(received) {
    var context = "Function getMostUsedPlug";
    return new Promise((resolve, reject) => {

        var pipeline = [
            {
                "$match": {
                    hwId: received.hwId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {
                        "plugId": "$plugId"
                    },
                    "COUNT(*)": {
                        "$sum": 1
                    }
                }
            },
            {
                "$project": {
                    "plugId": "$_id.plugId",
                    "number": "$COUNT(*)",
                    "_id": 0
                }
            }
        ];

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                if (result.length > 0) {
                    result.sort((a, b) => b.number - a.number);
                    resolve(result[0]);
                } else {
                    resolve({});
                }

            };
        });

    });
};

function getInsightsByDate(received, source, req) {
    var context = "Function getInsightsByDate";
    return new Promise((resolve, reject) => {

        let userId = req.headers['userid'];
        var pipeline;
        if (source === "CHARGER") {
            pipeline = [
                {
                    "$match": {
                        hwId: received.hwId,
                        stopDate: {
                            $gte: new Date(received.startDate),
                            $lte: new Date(received.endDate)
                        },
                        status: {$ne: process.env.PaymentStatusFaild}
                    }
                },
                {
                    "$group": {
                        "_id": {
                            "startDate": "$startDate"
                        },
                        "SUM(totalPower)": {
                            "$sum": "$totalPower"
                        },
                        "SUM(timeCharged)": {
                            "$sum": "$timeCharged"
                        }
                    }
                },
                {
                    "$project": {
                        "startDate": "$_id.startDate",
                        "totalPower": "$SUM(totalPower)",
                        "timeCharged": "$SUM(timeCharged)",
                        "_id": 0
                    }
                }
            ];
        } else {
            if (received.evId !== "-1") {
                pipeline = [
                    {
                        "$match": {
                            evId: received.evId,
                            stopDate: {
                                $gte: new Date(received.startDate),
                                $lte: new Date(received.endDate)
                            },
                            status: {$ne: process.env.PaymentStatusFaild}
                        }
                    },
                    {
                        "$group": {
                            "_id": {
                                "startDate": "$startDate"
                            },
                            "SUM(totalPower)": {
                                "$sum": "$totalPower"
                            },
                            "SUM(timeCharged)": {
                                "$sum": "$timeCharged"
                            }
                        }
                    },
                    {
                        "$project": {
                            "startDate": "$_id.startDate",
                            "totalPower": "$SUM(totalPower)",
                            "timeCharged": "$SUM(timeCharged)",
                            "_id": 0
                        }
                    }
                ];
            } else {
                pipeline = [
                    {
                        "$match": {
                            evId: received.evId,
                            stopDate: {
                                $gte: new Date(received.startDate),
                                $lte: new Date(received.endDate)
                            },
                            status: {$ne: process.env.PaymentStatusFaild},
                            $or: [
                                { userId: userId },
                                { userId: userId },
                            ]
                        }
                    },
                    {
                        "$group": {
                            "_id": {
                                "startDate": "$startDate"
                            },
                            "SUM(totalPower)": {
                                "$sum": "$totalPower"
                            },
                            "SUM(timeCharged)": {
                                "$sum": "$timeCharged"
                            }
                        }
                    },
                    {
                        "$project": {
                            "startDate": "$_id.startDate",
                            "totalPower": "$SUM(totalPower)",
                            "timeCharged": "$SUM(timeCharged)",
                            "_id": 0
                        }
                    }
                ];
            }
            if (received.userId)
                pipeline[0].$match.userId = received.userId;

            if (received.driverId)
                pipeline[0].$match.userId = received.driverId;
        };

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            } else {
                resolve(result);

            };
        });

    });
};

function getCharger(hwId) {
    var context = "Function getCharger";
    return new Promise((resolve, reject) => {

        History.findOne({ hwId: hwId }, { charger: 1 }, (err, result) => {
            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            } else {
                resolve(result);
            }
        });

    });
};

function getChargerAPP(hwId) {
    var context = "Function getChargerAPP";
    return new Promise((resolve, reject) => {

        let fields = {
            "charger._id": 1,
            "charger.hwId": 1,
            "charger.name": 1,
            "charger.defaultImage": 1,
            "charger.plugs": 1,
            "charger.rating": 1
        };

        History.findOne({ hwId: hwId }, fields, (err, result) => {
            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            } else {
                resolve(result);
            }
        });

    });
};

function getEV(evId) {
    var context = "Function getEV";
    return new Promise((resolve, reject) => {

        History.findOne({ evId: evId }, { ev: 1 }, (err, result) => {
            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            } else {
                resolve(result);
            }
        });

    });
};

function getInsightsByEvApps(userId, received) {
    var context = "Function getInsightsByEvApps";
    return new Promise((resolve, reject) => {

        let pipeline = [
            {
                "$match": {
                    userId: userId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild},
                    ...(received.evId && { evId: { $in: received.evId.split(',')}}),
                    ...(received.contractId && { "contract._id": { $in: received.contractId.split(',') } })
                }
            },
            {
                "$group": {
                    "_id": { "evId": "$evId" },
                    "sessions": {
                        "$sum": 1
                    },
                    "totalChargingTime": {
                        "$sum": "$timeCharged"
                    },
                    "totalCO2Saved": {
                        "$sum": "$CO2Saved"
                    },
                    "totalSpendInclVat": {
                        "$sum": "$totalPrice.incl_vat"
                    },
                    "totalSpendExclVat": {
                        "$sum": "$totalPrice.excl_vat"
                    },
                    "totalEnergy": {
                        "$sum": "$totalPower"
                    },
                    "averageChargingTimeSession": {
                        "$avg": "$timeCharged"
                    },
                    "averageEnergyChargedSession": {
                        "$avg": "$totalPower"
                    }
                }
            },
            {
                "$project": {
                    "sessions": "$sessions",
                    "totalChargingTime": {
                        "$divide": ["$totalChargingTime", 3600.0]
                    },
                    "totalCO2Saved": "$totalCO2Saved",
                    "totalSpendInclVat": "$totalSpendInclVat",
                    "totalSpendExclVat": "$totalSpendExclVat",
                    "totalEnergy": {
                        "$divide": ["$totalEnergy", 1000.0]
                    },
                    "averageChargingTimeSession": {
                        "$divide": ["$averageChargingTimeSession", 3600.0]
                    },
                    "averageEnergyChargedSession": {
                        "$divide": ["$averageEnergyChargedSession", 1000.0]
                    },
                    "evId": "$_id.evId",
                    "_id": 0
                }
            }
        ];

        if (received.userId)
            pipeline[0].$match.userId = received.userId;

        //console.log("pipeline", pipeline);
        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                resolve([]);
            }
            else {

                /*let newResult = Array.from(new Set(result.map(ev => ev.evId))).map(evId => {
                    return result.find(ev => ev.evId === evId)
                })*/
                resolve(result);

            };
        });


    });
};

function getMostUsedChargerByEV(insightsByEV, received, userId, req) {
    var context = "Function getMostUsedChargerByEV";
    return new Promise((resolve, reject) => {
        try {

            Promise.all(
                insightsByEV.map(ev => {
                    return new Promise(async (resolve, reject) => {

                        let evFound = await getEV(ev.evId);
                        received.evId = ev.evId;
                        let insights = await getInsightsByDate(received, "EV", req);

                        let pipeline = [
                            {
                                "$match": {
                                    userId,
                                    evId: ev.evId,
                                    stopDate: {
                                        $gte: new Date(received.startDate),
                                        $lte: new Date(received.endDate)
                                    },
                                    status: {$ne: process.env.PaymentStatusFaild}
                                }
                            },
                            {
                                "$group": {
                                    "_id": {
                                        "charger": "$charger",
                                        "hwId": "$hwId"
                                    },
                                    "COUNT(*)": {
                                        "$sum": 1
                                    }
                                }
                            },
                            {
                                "$project": {
                                    "hwId": "$_id.hwId",
                                    "charger": "$_id.charger",
                                    "number": "$COUNT(*)",
                                    "_id": 0
                                }
                            },
                            {
                                "$limit": 1000
                            }
                        ];

                        ev.statistics = insights;
                        if (evFound.ev === "-1") {

                            ev.ev = {
                                _id: "-1"
                            }

                        } else {

                            ev.ev = evFound.ev;

                        };

                        History.aggregate(pipeline, (err, result) => {

                            if (err) {
                                console.error(`[${context}] Error`, err.message);
                                reject(err)
                            }
                            else {

                                if (result.length > 0) {
                                    result.sort((a, b) => b.number - a.number);
                                    if (result[0].charger === "-1" || !result[0].charger) {

                                        ev.favouriteCharger = result[0].charger

                                    } else {

                                        ev.favouriteCharger = {
                                            rating: result[0].charger.rating,
                                            name: result[0].charger.name
                                        };

                                    }

                                    resolve(true);
                                    //resolve(result[0].charger);
                                } else {
                                    ev.favouriteCharger = {};
                                    resolve(true);
                                }


                            };
                        });

                    });
                })
            ).then((result) => {

                resolve(insightsByEV);

            }).catch(err => {
                console.error(`[${context}] Error`, err.message);
                reject(err);
            });

        } catch (error) {
            console.error(`[${context}] Error`, error.message);
            reject(error);
        };

    });

};

function getInsightsByChargerApps(userId, received) {
    var context = "Function getInsightsByChargerApps";
    return new Promise((resolve, reject) => {

        //console.log("received", received);

        let pipeline = [
            {
                "$match": {
                    chargerOwner: userId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {
                        "hwId": "$hwId"
                    },
                    "sessions": {
                        "$sum": 1
                    },
                    "totalChargingTime": {
                        "$sum": "$timeCharged"
                    },
                    "totalCO2Saved": {
                        "$sum": "$CO2Saved"
                    },
                    "incomeInclVat": {
                        "$sum": "$totalPrice.incl_vat"
                    },
                    "incomeExclVat": {
                        "$sum": "$totalPrice.excl_vat"
                    },
                    "totalEnergy": {
                        "$sum": "$totalPower"
                    },
                    "averageChargingTimeSession": {
                        "$avg": "$timeCharged"
                    },
                    "averageEnergyChargedSession": {
                        "$avg": "$totalPower"
                    }
                }
            },
            {
                "$project": {
                    "sessions": "$sessions",
                    "totalChargingTime": {
                        "$divide": ["$totalChargingTime", 3600.0]
                    },
                    "totalCO2Saved": "$totalCO2Saved",
                    "incomeInclVat": "$incomeInclVat",
                    "incomeExclVat": "$incomeExclVat",
                    "totalEnergy": {
                        "$divide": ["$totalEnergy", 1000.0]
                    },
                    "averageChargingTimeSession": {
                        "$divide": ["$averageChargingTimeSession", 3600.0]
                    },
                    "averageEnergyChargedSession": {
                        "$divide": ["$averageEnergyChargedSession", 1000.0]
                    },
                    "hwId": "$_id.hwId",
                    "_id": 0
                }
            }
        ];

        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                resolve(result);

            };
        });

    });
};

function getMostUsedPlugApp(insightsByCharger, received) {
    var context = "Function getMostUsedPlugApp";
    return new Promise((resolve, reject) => {

        try {

            Promise.all(

                insightsByCharger.map(charger => {
                    return new Promise(async (resolve, reject) => {

                        let chargerFound = await getChargerAPP(charger.hwId);
                        //let chargerFound = await getCharger(charger.hwId);

                        received.hwId = charger.hwId;
                        let insights = await getInsightsByPlug(received);

                        var pipeline = [
                            {
                                "$match": {
                                    hwId: charger.hwId,
                                    stopDate: {
                                        $gte: new Date(received.startDate),
                                        $lte: new Date(received.endDate)
                                    },
                                    status: {$ne: process.env.PaymentStatusFaild}
                                }
                            },
                            {
                                "$group": {
                                    "_id": {
                                        "plugId": "$plugId",
                                    },
                                    "COUNT(*)": {
                                        "$sum": 1
                                    }
                                }
                            },
                            {
                                "$project": {
                                    "plugId": "$_id.plugId",
                                    "number": "$COUNT(*)",
                                    "_id": 0
                                }
                            }
                        ];

                        //console.log("chargerFound", chargerFound)
                        if (chargerFound.charger && chargerFound.charger !== "-1")
                            charger.rating = chargerFound.charger.rating;

                        charger.statistics = insights;
                        charger.charger = chargerFound.charger;

                        History.aggregate(pipeline, (err, result) => {

                            if (err) {
                                console.error(`[${context}] Error`, err.message);
                                reject(err);
                            }
                            else {

                                if (result.length > 0) {

                                    result.sort((a, b) => b.number - a.number);
                                    let mostUsedPlug
                                    if (chargerFound.charger && chargerFound.charger !== "-1") {

                                        mostUsedPlug = chargerFound.charger.plugs.find(plug => { return plug.plugId === result[0].plugId })

                                        charger.mostUsedPlug = {
                                            plugId: mostUsedPlug.plugId,
                                            connectorType: mostUsedPlug.connectorType
                                        }
                                        resolve(true);

                                    } else {

                                        charger.mostUsedPlug = {};
                                        resolve(true);
                                    };

                                } else {
                                    charger.mostUsedPlug = {};
                                    resolve(true);
                                }

                            };
                        });
                    });
                })

            ).then((result) => {
                resolve(insightsByCharger);
            }).catch((error) => {
                console.error(`[${context}] Error`, error.message);
                reject(error);
            });

        } catch (error) {
            console.error(`[${context}] Error`, error.message);
            reject(error);
        };

    });
};

function getInsightsByPlug(received) {
    var context = "Function getInsightsByPlug";
    return new Promise((resolve, reject) => {
        var pipeline = [
            {
                "$match": {
                    hwId: received.hwId,
                    stopDate: {
                        $gte: new Date(received.startDate),
                        $lte: new Date(received.endDate)
                    },
                    status: {$ne: process.env.PaymentStatusFaild}
                }
            },
            {
                "$group": {
                    "_id": {
                        "plugId": "$plugId",
                        "startDate": "$startDate"
                    },
                    "SUM(totalPower)": {
                        "$sum": "$totalPower"
                    },
                    "SUM(timeCharged)": {
                        "$sum": "$timeCharged"
                    }
                }
            },
            {
                "$project": {
                    "plugId": "$_id.plugId",
                    "startDate": "$_id.startDate",
                    "totalPower": "$SUM(totalPower)",
                    "timeCharged": "$SUM(timeCharged)",
                    "_id": 0
                }
            }
        ];


        History.aggregate(pipeline, (err, result) => {

            if (err) {
                console.error(`[${context}] Error`, err.message);
                //ErrorHandler.ErrorHandler(err, res)
                resolve([]);
            }
            else {

                resolve(result);

            };
        });

    });
};

function getUserHeaderOrReceivedIfExists(headers, received, byIfNotHaveUser) {
    let byToModel = 'user'
    let userId = headers['userid'] || received?.userId 
    let idToModel = userId;
    if (!userId) {
        byToModel = byIfNotHaveUser
        idToModel = byIfNotHaveUser === 'ev' ? received.evId : received.evId
        userId = null
    }

    return {byToModel, userId, idToModel}
}
