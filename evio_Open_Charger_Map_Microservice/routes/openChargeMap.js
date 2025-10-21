const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const connectorType = require('../models/connectorType.json');
const TariffsOPC = require('../models/tariffsOPC');
const JsonFind = require('json-find');
const jsonFile = JsonFind(connectorType);
var https = require('https');

//========== POST ==========
router.post('/api/private/openChargeMap', (req, res, next) => {
    var context = "POST /api/private/openChargeMap";
    try {
        const tariffsOPC = new TariffsOPC(req.body);
        TariffsOPC.createTariffsOPC(tariffsOPC, (err, result) => {
            if (err) {
                console.log(`[${context}][createTariffsOPC] Error`, err);
                return res.status(500).send(err);
            }
            else {
                if (result) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_tariffsOPC_not_created', message: "Tariff OPC not created" });
                };
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get chargers from open charge map - when login
router.get('/api/private/openChargeMap', (req, res, next) => {
    var context = "GET /api/private/openChargeMap";
    try {
        var receivedQuery = req.query;
        var params = {
            key: process.env.KEY,
            latitude: receivedQuery.lat,
            longitude: receivedQuery.lng,
            distance: (receivedQuery.distance / 1000),//convert meters to kilometers
            distanceunit: 'KM',
            opendata: true,
            compact: true,
            usagetypeid: '1, 4, 7, 5',
            maxresults: 9999
        };
        if (Object.keys(req.body).length !== 0) {
            var body = req.body;
            if (body.rating.$gte === 0) {
                if (body.vehiclesType === undefined) {
                    if (body.parkingType === undefined) {
                        if (body.plugs.$elemMatch.tariff === undefined) {
                            makeQuery(params, body)
                                .then((params) => {
                                    getOCMAPI(params, res)
                                        .then((result) => {
                                            return res.status(200).send(result);
                                        })
                                        .catch((error) => {
                                            if (error == "Timeout") {
                                                return res.status(200).send([]);
                                            } else {
                                                console.log(`[${context}][getOCMAPI][.catch] Error `, error);
                                                return res.status(500).send(error.message);
                                            };
                                        });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][makeQuery][.catch] Error `, error);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            return res.status(200).send([]);
                        }
                    }
                    else {
                        return res.status(200).send([]);
                    };
                }
                else {
                    return res.status(200).send([]);
                };
            }
            else {
                return res.status(200).send([]);
            };
        }
        else
            getOCMAPI(params, res)
                .then((result) => {
                    return res.status(200).send(result);
                })
                .catch((error) => {
                    if (error == "Timeout") {
                        return res.status(200).send([]);
                    } else {
                        console.log(`[${context}][getOCMAPI][.catch] Error `, error);
                        return res.status(500).send(error.message);
                    };
                });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Get chargers from open charge map - when not login
router.get('/api/public/openChargeMap', (req, res, next) => {
    var context = "GET /api/public/openChargeMap";
    try {
        //TODO
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//Get chargers from open charge map favorites
router.get('/api/private/favorites', (req, res, next) => {
    var context = "GET /api/private/favorites";
    try {
        var body = req.body;
        var params = {
            key: process.env.KEY,
            chargepointid: body.baseId,
            opendata: true,
            compact: true,
            maxresults: 9999
        };
        getOCMAPI(params, res)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                if (error == "Timeout") {
                    return res.status(200).send([]);
                } else {
                    console.log(`[${context}][getOCMAPI][.catch] Error `, error);
                    return res.status(500).send(error.message);
                };
            });
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

function getOCMAPI(params, res) {
    var context = "Function getOCMAPI";
    return new Promise((resolve, reject) => {
        var host = process.env.HostOpenChargeMap;
        axios.get(host, { params }, { timeout: process.env.TimeOut })
            .then((result) => {
                var chargers = result.data;
                var chargersEVIO = [];
                const convertCharger = (charger) => {
                    return new Promise((resolve, reject) => {
                        try {
                            var plugs = [];
                            const getPlug = (connection, operatorID, title) => {
                                return new Promise((resolve, reject) => {
                                    try {
                                        var connectorType = Object.keys(jsonFile).find(key => jsonFile[key] === connection.ConnectionTypeID.toString());
                                        if (connectorType === undefined) {
                                            connectorType = Object.keys(jsonFile).find(key => jsonFile[key].includes(connection.ConnectionTypeID.toString()));
                                            if (connectorType === undefined)
                                                connectorType = "unknown";
                                        };
                                        if (operatorID == '21') {
                                            var query = {
                                                station: title
                                            };
                                            TariffsOPC.findOne(query, (err, result) => {
                                                if (err) {
                                                    console.log(`[${context}][TariffsOPC.findOne] Error `, error);
                                                    reject(err);
                                                } else {
                                                    if (result) {
                                                        var plug = {
                                                            plugId: connection.ID.toString(),
                                                            connectorType: connectorType,
                                                            power: connection.PowerKW,
                                                            status: "10",
                                                            serviceCost: {
                                                                initialCost: result.initialCost,
                                                                costByTime: result.costByTime,
                                                                costByPower: result.costByPower
                                                            }
                                                        };
                                                        plugs.push(plug);
                                                        resolve(true);
                                                    } else {
                                                        var plug = {
                                                            plugId: connection.ID.toString(),
                                                            connectorType: connectorType,
                                                            power: connection.PowerKW,
                                                            status: "10",
                                                            serviceCost: {
                                                                initialCost: '-1',
                                                                costByTime: [
                                                                    { cost: '-1' }
                                                                ],
                                                                costByPower: {
                                                                    cost: '-1'
                                                                }
                                                            }
                                                        };
                                                        plugs.push(plug);
                                                        resolve(true);
                                                    };
                                                };
                                            });
                                        }
                                        else {
                                            var plug = {
                                                plugId: connection.ID.toString(),
                                                connectorType: connectorType,
                                                power: connection.PowerKW,
                                                status: "10",
                                                serviceCost: {
                                                    initialCost: '-1',
                                                    costByTime: [
                                                        { cost: '-1' }
                                                    ],
                                                    costByPower: {
                                                        cost: '-1'
                                                    }
                                                }
                                            };
                                            plugs.push(plug);
                                            resolve(true);
                                        }
                                    } catch (error) {
                                        console.log(`[${context}][getPlug] Error `, error);
                                        reject(error);
                                    };
                                });
                            };

                            Promise.all(
                                charger.Connections.map(connection => getPlug(connection, charger.OperatorID, charger.AddressInfo.Title))
                            )
                                .then((values) => {
                                    var newcharger = {
                                        _id: charger.ID.toString(),
                                        hwId: charger.UUID,
                                        chargerType: '003',
                                        name: charger.AddressInfo.Title,
                                        address: charger.AddressInfo.AddressLine1 + ", " + charger.AddressInfo.Postcode + ", " + charger.AddressInfo.Town,
                                        geometry: {
                                            type: "Point",
                                            coordinates: [
                                                charger.AddressInfo.Longitude,
                                                charger.AddressInfo.Latitude
                                            ]
                                        },
                                        availability: {
                                            availabilityType: "Always"
                                        },
                                        status: '10',
                                        imageContent: [],
                                        rating: 0,
                                        plugs: plugs

                                    };
                                    chargersEVIO.push(newcharger);
                                    resolve(true);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][charger.Connections.map][.catch] Error `, error);
                                    reject(error);
                                });
                        } catch (error) {
                            console.log(`[${context}][convertCharger] Error `, error);
                            reject(error);
                        };
                    });
                };
                Promise.all(
                    chargers.map(charger => convertCharger(charger))
                )
                    .then((values) => {
                        resolve(chargersEVIO);
                    })
                    .catch((error) => {
                        console.log(`[${context}][chargers.map][.catch] Error `, error);
                        reject(error);
                    });
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.response.data);
                reject(error.response.data);
            });

        setTimeout(() => {
            reject("Timeout");
        }, process.env.SetTimeOut);
    });
};

function makeQuery(params, body) {
    var context = "Function makeQuery";
    return new Promise((resolve, reject) => {
        try {
            if (body.plugs.$elemMatch != undefined) {
                if (body.plugs.$elemMatch.connectorType != undefined) {

                    if (body.plugs.$elemMatch.connectorType.length === 1) {
                        var key = body.plugs.$elemMatch.connectorType[0];
                        params.connectiontypeid = jsonFile.checkKey(key);
                    }
                    else {
                        var keys = body.plugs.$elemMatch.connectorType;
                        params.connectiontypeid = "";

                        const getValue = (key) => {
                            return new Promise((resolve, reject) => {
                                try {
                                    params.connectiontypeid += jsonFile.checkKey(key) + ",";
                                    resolve(true);
                                } catch (error) {
                                    console.log(`[${context}][getValue] Error `, error);
                                    reject(error)
                                };
                            });
                        };
                        Promise.all(
                            keys.map(key => getValue(key))
                        )

                    };
                };
                if (body.plugs.$elemMatch.status != undefined) {
                    params.statustypeid = "";
                    var available = body.plugs.$elemMatch.status.find((status) => {
                        return status === 10;
                    });
                    var inUse = body.plugs.$elemMatch.status.find((status) => {
                        return status === 20;
                    });
                    var booked = body.plugs.$elemMatch.status.find((status) => {
                        return status === 30;
                    });

                    if (available !== undefined) {
                        params.statustypeid += 50 + ",";
                    };
                    if (inUse !== undefined) {
                        params.statustypeid += 20 + ",";
                    };
                    if (booked !== undefined) {
                        params.statustypeid += 30 + ",";
                    };

                };
                if (body.plugs.$elemMatch.$or != undefined) {
                    params.minpowerkw = body.plugs.$elemMatch.$or[1].power.$gte;
                    params.maxpowerkw = body.plugs.$elemMatch.$or[0].power.$lte;
                };
            };
            resolve(params)

        } catch (error) {
            console.log(`[${context}] Error `, error);
            reject(error);
        };
    });
};

module.exports = router;