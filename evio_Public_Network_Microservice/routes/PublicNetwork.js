const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const JsonFind = require('json-find');
const request = require('request');
const fs = require('fs');
const csv = require('csv-parser');
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
const moment = require('moment');
const { getCode, getName } = require('country-list');
const {
    getChargersByNameOrHardwareId,
    handlePublicNetworkRequest
} = require('../controllers/PublicNetworkController');
const filterMapping = require('../models/FilterMapping.json');
const jsonFile = JsonFind(filterMapping);
const ChargerEnums = require('../utils/enums/chargerEnums');
const timeZone = require("../controllers/timeZoneHandler")

const Charger = require('../models/charger');
const ManagementPOIs = require('../models/managementPOIs');
const EvseStatus = require('../utils/enums/evseEnums');
const timeEnums = require('../utils/enums/timeEnums');
const publicNetworkHelper = require('../helpers/PublicNetworkHelper')
const {verifyIfCoordinatesUpdate, returnCoordinatesAccordingToFlagMap, getGeoQueryAndFeatureFlag} = require('../helpers/handleCoordinates')
const { Enums } = require('evio-library-commons').default;

var ConfigsProxy = 'http://configs:3028';
//var ConfigsProxy = 'http://localhost:3028';
const feesConfig = `${ConfigsProxy}/api/private/config/fees`;

//========== POST =========
router.post('/api/private/chargers/all', (req, res, next) => {
    var context = "POST /api/private/chargers/all";

    try {

        var query = req.body;


        Charger.find(query).lean()
            .then(chargers => {
                if (chargers.length == 0) {
                    return res.status(200).send([]);
                }
                else {
                    return res.status(200).send(chargers);
                };
            })
            .catch(err => {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err);
            })


    } catch (error) {

        return res.status(500).send(error.message);
    }
})

//========== GET ==========
//Definir tipo de prioridade
//deprecated
/**
 * @deprecated Since version 27. Will be deleted in version 30. Use xxx instead.
 */
router.get('/api/public/publicNetwork_old', (req, res, next) => {
    var context = "GET /api/public/publicNetwork_old";
    try {

        let countryCodes = req.query.countryCode;

        let query = countryCodeFilter(countryCodes);
        if (query == false) {
            return res.status(200).send([]);
        }

        if (req.body) {
            Object.assign(query, req.body);
        }
        Charger.find({
            'geometry': {
                $near: {
                    $maxDistance: req.query.distance,
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                    }
                }
            },
            ...query
        })
            .then(chargersFound => {
                if (chargersFound.length === 0) {
                    return res.status(200).send([]);
                }
                else {
                    //console.log("chargersFound", chargersFound);
                    let allChargers = JSON.parse(JSON.stringify(chargersFound))
                    Promise.all(
                        chargersFound.map((charger, chargerIndex) => {
                            return new Promise((resolve, reject) => {
                                Promise.all(
                                    charger.plugs.map((plug, plugIndex) => {
                                        return new Promise((resolve, reject) => {
                                            // plug.serviceCost = result;
                                            if (plug.tariffId.length > 0) {
                                                let params = {
                                                    tariffId: plug.tariffId[0]
                                                }
                                                getTariffOPC(params)
                                                    .then((result) => {
                                                        allChargers[chargerIndex].plugs[plugIndex].serviceCost = result
                                                        resolve(true);
                                                    })
                                                    .catch(error => {
                                                        console.error(`[${context}] Error `, error.message);
                                                        reject(error);
                                                    })
                                            } else {
                                                resolve(true)
                                            }
                                        })
                                    })
                                ).then(() => {
                                    resolve(charger);
                                }).catch((error) => {
                                    console.error(`[${context}] Error `, error.message);
                                    reject(error);
                                })

                            })
                        })
                    ).then(() => {

                        var promise = new Promise(async (resolve, reject) => {
                            for (let i = 0; i < allChargers.length; i++) {

                                let charger = JSON.parse(JSON.stringify(allChargers[i]));

                                let feeds = await getFees(charger);
                                if (feeds !== false) {
                                    charger.feeds = feeds;
                                    charger.fees = feeds;
                                }

                                const { operator, operatorContact, operatorEmail } = await publicNetworkHelper.getChargerOperator(charger);
                                charger.operatorContact = operatorContact;
                                charger.operatorEmail = operatorEmail;
                                charger.operator = operator;

                                allChargers[i] = charger;

                                if (i === allChargers.length - 1) resolve();
                            }
                        });

                        promise.then(() => {
                            //console.log("allChargers 2 ", allChargers);
                            return res.status(200).send(allChargers);
                        });

                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });

                }
            })
            .catch(error => {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

//Definir tipo de prioridade
//Get charger public network
router.get('/api/public/publicNetwork_old2', (req, res, next) => {
    const context = "GET /api/public/publicNetwork";
    try {

        let countryCodes = req.query.countryCode;
        let clientName = req.headers['clientname'];
        let query;

        if (clientName === "EVIO") {

            query = {
                subStatus: { $ne: "UNKNOWN" },
                operationalStatus: process.env.OperationalStatusApproved,
                $or: [
                    { source: { $ne: process.env.NetworkMobiE } },
                    {
                        $and: [
                            { source: process.env.NetworkMobiE },
                            { publish: true }
                        ]
                    }
                ],
                countryCode: {
                    $not: {
                        $in: ["NL", "NO", "HR", "SE", "CH", "GB", "DK", "PL", "HU", "RO", "CZ"]
                    }
                },

            };

        } else {

            query = {
                subStatus: { $ne: "UNKNOWN" },
                operationalStatus: process.env.OperationalStatusApproved,
                $or: [
                    { source: { $ne: process.env.NetworkMobiE } },
                    {
                        $and: [
                            { source: process.env.NetworkMobiE },
                            { publish: true }
                        ]
                    }
                ],
                //chargerType: { $ne: process.env.ChargerTypeTesla },
                countryCode: {
                    $not: {
                        $in: ["NL", "NO", "HR", "SE", "CH", "GB", "DK", "PL", "HU", "RO", "CZ"]
                    }
                }
            };

        };

        /*let query = countryCodeFilter(countryCodes);
        if (query == false) {
            return res.status(200).send([]);
        }*/
        let tariffType;
        if (req.body) {
            if (req.body.tariffType) {
                tariffType = req.body.tariffType
                delete req.body.tariffType
            };

            delete req.body.tariffType;
            Object.assign(query, req.body);
        };

        //query.operationalStatus = process.env.OperationalStatusApproved;
        if (tariffType) {
            let temp;
            switch (tariffType) {
                case process.env.TARIFF_TYPE_POWER:

                    temp = {
                        $and: [
                            {
                                $or: [
                                    {
                                        chargerType: process.env.ChargerTypeGireve,
                                        plugs: {
                                            $elemMatch: {
                                                'serviceCost.costByPower.cost': { $gt: 0 }
                                            }
                                        }
                                    },
                                    {
                                        chargerType: process.env.ChargerTypeMobiE,
                                        plugs: {
                                            $elemMatch: {
                                                'serviceCost.elements': {
                                                    $elemMatch: {
                                                        price_components: {
                                                            $elemMatch: {
                                                                type: "ENERGY"
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }

                    Object.assign(query, temp);

                    break;
                case process.env.TARIFF_TYPE_TIME:

                    if (!query.chargerType) {
                        query.chargerType = { $ne: "009" }
                    }

                    temp = {
                        $and: [
                            {
                                $or: [
                                    {
                                        chargerType: process.env.ChargerTypeGireve,
                                        plugs: {
                                            $elemMatch: {
                                                'serviceCost.costByTime': {
                                                    $elemMatch: {
                                                        cost: { $gt: 0 }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    {
                                        chargerType: process.env.ChargerTypeMobiE,
                                        plugs: {
                                            $elemMatch: {
                                                'serviceCost.elements': {
                                                    $elemMatch: {
                                                        price_components: {
                                                            $elemMatch: {
                                                                type: "TIME"
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }

                    Object.assign(query, temp);

                    break;
                default:
                    break;
            };
        };

        let fields = {
            _id: 1,
            hwId: 1,
            geometry: 1,
            status: 1,
            accessType: 1,
            address: 1,
            name: 1,
            "plugs.subStatus": 1,
            "plugs.plugId": 1,
            "plugs.connectorType": 1,
            "plugs.status": 1,
            "plugs.statusChangeDate": 1,
            "plugs.power": 1,
            "plugs.tariffId": 1,
            "plugs.serviceCost": 1,
            "plugs.evseGroup": 1,
            rating: 1,
            imageContent: 1,
            chargerType: 1,
            defaultImage: 1,
            chargingDistance: 1,
            network: 1,
            partyId: 1,
            source: 1,
            evseGroup: 1,
            fees: 1,
            countryCode: 1,
            numberOfSessions: 1,
            voltageLevel: 1,
            updatedAt: 1
        };

        console.log({
            'geometry': {
                $near: {
                    $maxDistance: req.query.distance,
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                    }
                }
            },
            ...query
        })

        /*var fields = {
            _id : 1,
            geometry : 1,
            hwId : 1,
            chargerType: 1,
            "plugs.status" : 1
        };*/

        /*var fields = {
            _id: 1,
            hwId: 1,
            geometry: 1,
            status: 1,
            accessType: 1,
            address: 1,
            name: 1,
            "plugs.subStatus": 1,
            "plugs.plugId": 1,
            "plugs.connectorType": 1,
            "plugs.status": 1,
"plugs.statusChangeDate": 1,
            "plugs.power": 1,
            "plugs.tariffId": 1,
            "plugs.serviceCost": 1,
            "plugs.evseGroup": 1,
            rating: 1,
            imageContent: 1,
            chargerType: 1,
            defaultImage: 1,
            chargingDistance: 1,
            network: 1,
            partyId: 1,
            source: 1,
            evseGroup: 1,
            fees: 1,
            countryCode: 1,
            numberOfSessions: 1,
            voltageLevel: 1,
            updatedAt:1
        };*/

        Charger.find({
            'geometry': {
                $near: {
                    $maxDistance: req.query.distance,
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                    }
                }
            },
            //TODO : To delete this partyId filter in the future
            $and: [{ partyId: { $ne: "EPO" } }, { partyId: { $ne: "GFX" } }],
            ...query
        }, fields).lean()
            .then(chargersFound => {
                console.log(chargersFound.length)
                return res.status(200).send(chargersFound);

            })
            .catch(error => {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

router.get('/api/public/publicNetwork', async (req, res, next) => {
    const context = "GET /api/public/publicNetwork";
    try {
        let countryCodes = req.query.countryCode;
        let clientName = req.headers['clientname'];

        let fields = {
            _id: 1,
            hwId: 1,
            geometry: 1,
            status: 1,
            accessType: 1,
            address: 1,
            name: 1,
            "plugs.subStatus": 1,
            "plugs.plugId": 1,
            "plugs.connectorType": 1,
            "plugs.status": 1,
            "plugs.statusChangeDate": 1,
            "plugs.power": 1,
            "plugs.amperage":1,
            "plugs.voltage":1,
            "plugs.tariffId": 1,
            "plugs.serviceCost": 1,
            "plugs.evseGroup": 1,
            "plugs.connectorPowerType":1,
            "plugs.connectorFormat":1,
            rating: 1,
            imageContent: 1,
            chargerType: 1,
            defaultImage: 1,
            chargingDistance: 1,
            network: 1,
            partyId: 1,
            source: 1,
            evseGroup: 1,
            fees: 1,
            countryCode: 1,
            numberOfSessions: 1,
            voltageLevel: 1,
            updatedAt: 1,
            originalCoordinates: 1
        };

        const { queryGeoSearch, searchCoordinatesFlagActive } = await getGeoQueryAndFeatureFlag(req);

        //console.log("req.body", req.body);
        if (Object.keys(req.body).length > 0) {

            let tariffType;

            if (req.body.tariffType) {
                tariffType = req.body.tariffType
                delete req.body.tariffType
            };

            if (req.body.stations) {

                if (!req.body.stations.includes(process.env.StationsPublic) && !req.body.stations.includes(process.env.StationsTesla)) {

                    return res.status(200).send([]);

                } else {

                    let query = {
                        operationalStatus: process.env.OperationalStatusApproved,
                        plugs: {
                            $elemMatch: { 
                                subStatus: { 
                                    $nin: [
                                        EvseStatus.planned,
                                        EvseStatus.removed,
                                    ] 
                                } 
                            }
                        },
                        $or: [
                            { source: { $ne: process.env.NetworkMobiE } },
                            {
                                $and: [
                                    { source: process.env.NetworkMobiE },
                                    { publish: true }
                                ]
                            }
                        ],
                        countryCode: {
                            $not: {
                                $in: ["NL", "NO", "HR", "SE", "CH", "GB", "DK", "PL", "HU", "RO", "CZ"]
                            }
                        }
                    };

                    if (req.body.stations.includes(process.env.StationsPublic) && !req.body.stations.includes(process.env.StationsTesla)) {

                        query.chargerType = { $ne: "009" };

                    } else if (!req.body.stations.includes(process.env.StationsPublic) && req.body.stations.includes(process.env.StationsTesla)) {

                        query.chargerType = "009";

                    }

                    delete req.body.stations;
                    delete req.body.tariffType;
                    Object.assign(query, req.body);

                    if (tariffType) {
                        let temp;
                        switch (tariffType) {
                            case process.env.TARIFF_TYPE_POWER:

                                temp = {
                                    $and: [
                                        {
                                            $or: [
                                                {
                                                    chargerType: process.env.ChargerTypeGireve,
                                                    plugs: {
                                                        $elemMatch: {
                                                            'serviceCost.costByPower.cost': { $gt: 0 }
                                                        }
                                                    }
                                                },
                                                {
                                                    chargerType: process.env.ChargerTypeMobiE,
                                                    plugs: {
                                                        $elemMatch: {
                                                            'serviceCost.elements': {
                                                                $elemMatch: {
                                                                    price_components: {
                                                                        $elemMatch: {
                                                                            type: "ENERGY"
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                },
                                                {
                                                    chargerType: Enums.ChargerTypes.Hubject,
                                                    $or: [
                                                        {
                                                            plugs: {
                                                                $elemMatch: {
                                                                    "serviceCost.tariffs": {
                                                                        $elemMatch: {
                                                                            elements: {
                                                                                $elemMatch: {
                                                                                    price_components: {
                                                                                        $elemMatch: {
                                                                                            type: "ENERGY"
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        },
                                                        {
                                                            plugs: {
                                                                $elemMatch: {
                                                                    'serviceCost.elements': {
                                                                        $elemMatch: {
                                                                            price_components: {
                                                                                $elemMatch: {
                                                                                    type: "ENERGY"
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }

                                Object.assign(query, temp);

                                break;
                            case process.env.TARIFF_TYPE_TIME:

                                if (!query.chargerType) {
                                    query.chargerType = { $ne: "009" }
                                }

                                temp = {
                                    $and: [
                                        {
                                            $or: [
                                                {
                                                    chargerType: process.env.ChargerTypeGireve,
                                                    plugs: {
                                                        $elemMatch: {
                                                            'serviceCost.costByTime': {
                                                                $elemMatch: {
                                                                    cost: { $gt: 0 }
                                                                }
                                                            }
                                                        }
                                                    }
                                                },
                                                {
                                                    chargerType: process.env.ChargerTypeMobiE,
                                                    plugs: {
                                                        $elemMatch: {
                                                            'serviceCost.elements': {
                                                                $elemMatch: {
                                                                    price_components: {
                                                                        $elemMatch: {
                                                                            type: "TIME"
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                },
                                                {
                                                    chargerType: Enums.ChargerTypes.Hubject,
                                                    $or: [
                                                        {
                                                            plugs: {
                                                                $elemMatch: {
                                                                    "serviceCost.tariffs": {
                                                                        $elemMatch: {
                                                                            elements: {
                                                                                $elemMatch: {
                                                                                    price_components: {
                                                                                        $elemMatch: {
                                                                                            type: "TIME"
                                                                                        }
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        },
                                                        {
                                                            plugs: {
                                                                $elemMatch: {
                                                                    'serviceCost.elements': {
                                                                        $elemMatch: {
                                                                            price_components: {
                                                                                $elemMatch: {
                                                                                    type: "TIME"
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                }

                                Object.assign(query, temp);

                                break;
                            default:
                                break;
                        };
                    };
                    
                    Charger.find({
                        ...queryGeoSearch,
                        //TODO : To delete this partyId filter in the future
                        $and: [{ partyId: { $ne: "EPO" } }, { partyId: { $ne: "GFX" } }],
                        ...query
                    }, fields).lean()
                        .then(chargersFound => {
                            console.log(chargersFound.length)
                            return res.status(200).send(returnCoordinatesAccordingToFlagMap(chargersFound, searchCoordinatesFlagActive));

                        })
                        .catch(error => {
                            console.error(`[${context}][.then][find] Error `, error.message);
                            return res.status(500).send(error.message);
                        })
                }

            } else {

                let query = {
                    operationalStatus: process.env.OperationalStatusApproved,
                    plugs: {
                        $elemMatch: { 
                            subStatus: { 
                                $nin: [
                                    EvseStatus.planned,
                                    EvseStatus.removed,
                                ] 
                            } 
                        }
                    },
                    $or: [
                        { source: { $ne: process.env.NetworkMobiE } },
                        {
                            $and: [
                                { source: process.env.NetworkMobiE },
                                { publish: true }
                            ]
                        }
                    ],
                    countryCode: {
                        $not: {
                            $in: ["NL", "NO", "HR", "SE", "CH", "GB", "DK", "PL", "HU", "RO", "CZ"]
                        }
                    }
                };

                Object.assign(query, req.body);
                if (tariffType) {
                    let temp;
                    switch (tariffType) {
                        case process.env.TARIFF_TYPE_POWER:

                            temp = {
                                $and: [
                                    {
                                        $or: [
                                            {
                                                chargerType: process.env.ChargerTypeGireve,
                                                plugs: {
                                                    $elemMatch: {
                                                        'serviceCost.costByPower.cost': { $gt: 0 }
                                                    }
                                                }
                                            },
                                            {
                                                chargerType: process.env.ChargerTypeMobiE,
                                                plugs: {
                                                    $elemMatch: {
                                                        'serviceCost.elements': {
                                                            $elemMatch: {
                                                                price_components: {
                                                                    $elemMatch: {
                                                                        type: "ENERGY"
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            {
                                                chargerType: Enums.ChargerTypes.Hubject,
                                                $or: [
                                                    {
                                                        plugs: {
                                                            $elemMatch: {
                                                                "serviceCost.tariffs": {
                                                                    $elemMatch: {
                                                                        elements: {
                                                                            $elemMatch: {
                                                                                price_components: {
                                                                                    $elemMatch: {
                                                                                        type: "ENERGY"
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    },
                                                    {
                                                        plugs: {
                                                            $elemMatch: {
                                                                'serviceCost.elements': {
                                                                    $elemMatch: {
                                                                        price_components: {
                                                                            $elemMatch: {
                                                                                type: "ENERGY"
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }

                            Object.assign(query, temp);

                            break;
                        case process.env.TARIFF_TYPE_TIME:

                            if (!query.chargerType) {
                                query.chargerType = { $ne: "009" }
                            }

                            temp = {
                                $and: [
                                    {
                                        $or: [
                                            {
                                                chargerType: process.env.ChargerTypeGireve,
                                                plugs: {
                                                    $elemMatch: {
                                                        'serviceCost.costByTime': {
                                                            $elemMatch: {
                                                                cost: { $gt: 0 }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            {
                                                chargerType: process.env.ChargerTypeMobiE,
                                                plugs: {
                                                    $elemMatch: {
                                                        'serviceCost.elements': {
                                                            $elemMatch: {
                                                                price_components: {
                                                                    $elemMatch: {
                                                                        type: "TIME"
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            },
                                            {
                                                chargerType: Enums.ChargerTypes.Hubject,
                                                $or: [
                                                    {
                                                        plugs: {
                                                            $elemMatch: {
                                                                "serviceCost.tariffs": {
                                                                    $elemMatch: {
                                                                        elements: {
                                                                            $elemMatch: {
                                                                                price_components: {
                                                                                    $elemMatch: {
                                                                                        type: "TIME"
                                                                                    }
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    },
                                                    {
                                                        plugs: {
                                                            $elemMatch: {
                                                                'serviceCost.elements': {
                                                                    $elemMatch: {
                                                                        price_components: {
                                                                            $elemMatch: {
                                                                                type: "TIME"
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }

                            Object.assign(query, temp);

                            break;
                        default:
                            break;
                    };
                };

                let findQuery = {
                    $and: [{ partyId: { $nin: ["EPO", "GFX"] } }],
                    ...query
                };
                if (req.query.distance) {
                    findQuery = {...findQuery, ...queryGeoSearch };
                }

                Charger.find(findQuery, fields).lean()
                    .then(chargersFound => {
                        console.log(chargersFound.length)
                        return res.status(200).send(returnCoordinatesAccordingToFlagMap(chargersFound, searchCoordinatesFlagActive));
                    })
                    .catch(error => {
                        console.error(`[${context}][.then][find] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            }

        } else {

            //console.log("2")

            let query = {
                operationalStatus: process.env.OperationalStatusApproved,
                plugs: {
                    $elemMatch: { 
                        subStatus: { 
                            $nin: [
                                EvseStatus.planned,
                                EvseStatus.removed,
                                
                            ] 
                        } 
                    }
                },
                $or: [
                    { source: { $ne: process.env.NetworkMobiE } },
                    {
                        $and: [
                            { source: process.env.NetworkMobiE },
                            { publish: true }
                        ]
                    }
                ],
                countryCode: {
                    $not: {
                        $in: ["NL", "NO", "HR", "SE", "CH", "GB", "DK", "PL", "HU", "RO", "CZ"]
                    }
                }
            };
            
            Charger.find({
                ...queryGeoSearch,
                //TODO : To delete this partyId filter in the future
                $and: [{ partyId: { $ne: "EPO" } }, { partyId: { $ne: "GFX" } }],
                ...query
            }, fields).lean()
                .then(chargersFound => {
                    console.log(chargersFound.length)
                    return res.status(200).send(returnCoordinatesAccordingToFlagMap(chargersFound, searchCoordinatesFlagActive));

                })
                .catch(error => {
                    console.error(`[${context}][.then][find] Error `, error.message);
                    return res.status(500).send(error.message);
                })

        };

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

//deprecated
/**
 * @deprecated Since version 27. Will be deleted in version 30. Use xxx instead.
 */
router.get('/api/private/publicNetwork_old', (req, res, next) => {
    var context = "GET /api/private/publicNetwork_old";
    try {

        let countryCodes = req.query.countryCode;
        const userId = req.headers['userid']
        // countryCodes = JSON.parse(countryCodes)
        let query = countryCodeFilter(countryCodes);
        if (query == false) {
            return res.status(200).send([]);
        }

        if (req.body) {
            Object.assign(query, req.body);
        }
        Charger.find({
            'geometry': {
                $near: {
                    $maxDistance: req.query.distance,
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                    }
                }
            },
            ...query
        })
            .then(chargersFound => {
                if (chargersFound.length === 0) {
                    return res.status(200).send([]);
                }
                else {
                    //console.log("chargersFound", chargersFound);
                    let allChargers = JSON.parse(JSON.stringify(chargersFound))
                    Promise.all(
                        chargersFound.map((charger, chargerIndex) => {
                            return new Promise((resolve, reject) => {
                                Promise.all(
                                    charger.plugs.map((plug, plugIndex) => updatePlug(allChargers[chargerIndex].plugs[plugIndex], charger, userId))
                                ).then(() => {
                                    resolve(charger);
                                }).catch((error) => {
                                    console.error(`[${context}] Error `, error.message);
                                    reject(error);
                                })


                            })
                        })
                    ).then(() => {

                        var promise = new Promise(async (resolve, reject) => {
                            for (let i = 0; i < allChargers.length; i++) {

                                let charger = JSON.parse(JSON.stringify(allChargers[i]));

                                let feeds = await getFees(charger);

                                if (feeds !== false) {
                                    charger.feeds = feeds;
                                    charger.fees = feeds;
                                }

                                const { operator, operatorContact, operatorEmail } = await publicNetworkHelper.getChargerOperator(charger);
                                charger.operatorContact = operatorContact;
                                charger.operatorEmail = operatorEmail;
                                charger.operator = operator;

                                allChargers[i] = charger;

                                if (i === allChargers.length - 1) resolve();
                            }
                        });

                        promise.then(() => {
                            //console.log("allChargers 2 ", allChargers);
                            return res.status(200).send(allChargers);
                        });

                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });

                }

            })
            .catch(error => {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            })

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

/**
 * @deprecated Since version 28. Will be deleted in version 31. Use xxx instead.
 */
router.get('/api/private/publicNetwork_old2', (req, res, next) => {
    var context = "GET /api/private/publicNetwork_old2";
    try {
        console.log(`Start of ${context}`)
        let countryCodes = req.query.countryCode;
        const userId = req.headers['userid']
        // countryCodes = JSON.parse(countryCodes)
        let query = {
            operationalStatus: process.env.OperationalStatusApproved,
            $or: [
                { source: { $ne: process.env.NetworkMobiE } },
                {
                    $and: [
                        { source: process.env.NetworkMobiE },
                        { publish: true }
                    ]
                }
            ],
            countryCode: {
                $not: {
                    $in: ["NL", "NO", "HR", "SE", "CH", "GB", "DK", "PL", "HU", "RO", "CZ"]
                }
            }
        }
        /*let query = countryCodeFilter(countryCodes);
        if (query == false) {
            return res.status(200).send([]);
        }*/

        if (req.body) {
            Object.assign(query, req.body);
        }
        /*var fields = {
            _id : 1,
            geometry : 1,
            hwId : 1,
            chargerType: 1,
            "plugs.status" : 1
        };*/

        var fields = {
            _id: 1,
            hwId: 1,
            geometry: 1,
            status: 1,
            accessType: 1,
            address: 1,
            name: 1,
            "plugs.subStatus": 1,
            "plugs.plugId": 1,
            "plugs.connectorType": 1,
            "plugs.status": 1,
            "plugs.statusChangeDate": 1,
            "plugs.power": 1,
            "plugs.tariffId": 1,
            "plugs.serviceCost": 1,
            "plugs.evseGroup": 1,
            rating: 1,
            imageContent: 1,
            chargerType: 1,
            defaultImage: 1,
            chargingDistance: 1,
            network: 1,
            partyId: 1,
            source: 1,
            evseGroup: 1,
            fees: 1,
            countryCode: 1,
            numberOfSessions: 1,
            voltageLevel: 1,
            updatedAt: 1
        };

        //query.operationalStatus = process.env.OperationalStatusApproved;

        Charger.find({
            'geometry': {
                $near: {
                    $maxDistance: req.query.distance,
                    $geometry: {
                        type: "Point",
                        coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                    }
                }
            },
            //TODO : To delete this partyId filter in the future
            $and: [{ partyId: { $ne: "EPO" } }, { partyId: { $ne: "GFX" } }],
            ...query
        }, fields).lean()
            .then(chargersFound => {
                if (chargersFound.length === 0) {
                    return res.status(200).send([]);
                }
                else {
                    //console.log("todelete")
                    console.time("query end");
                    return res.status(200).send(chargersFound);
                }

            })
            .catch(error => {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            })

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});


//Get charger public network when are loged
router.get('/api/private/publicNetwork', async (req, res) => {
    await handlePublicNetworkRequest(req, res, 'GET /api/private/publicNetwork', false);
});

router.get('/api/private/publicNetwork/maps', async (req, res) => {
    await handlePublicNetworkRequest(req, res, 'GET /api/private/publicNetwork/maps', true);
});

router.get('/api/private/favorites', (req, res, next) => {
    var context = "GET /api/private/favorites";
    try {
        var body = req.body;

        Charger.find({ _id: body.baseId }, async (error, chargersFound) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send(error.message);
            } else {

                //let dateNow = new Date();

                for (let i = 0; i < chargersFound.length; i++) {

                    let charger = JSON.parse(JSON.stringify(chargersFound[i]));

                    let feeds = await getFees(charger);
                    //charger.feeds = feeds;

                    if (feeds !== false) {
                        charger.feeds = feeds;
                        charger.fees = feeds;
                        chargersFound[i] = charger;
                    }

                    //No need to fetch the service Cost here
                    // for (let l = 0; l < charger.plugs.length; l++) {
                    //     if (charger.plugs[l].serviceCost.initialCost == "-1" && charger.plugs[l].serviceCost.costByPower.cost == "-1" && charger.plugs[l].serviceCost.costByTime[0].cost == "-1") {
                    //         if (charger.plugs[l].tariffId.length > 0) {
                    //             let params = {
                    //                 tariffId: charger.plugs[l].tariffId[0]
                    //             }

                    //             await getTariffOPC(params)
                    //                 .then((result) => {
                    //                     charger.plugs[l].serviceCost = result
                    //                 })
                    //                 .catch(error => {
                    //                     console.error(`[${context}] Error `, error.message);
                    //                 })
                    //         }
                    //     }
                    // }

                    /*for (l = 0; l < charger.plugs.length; l++) {

                        if (charger.plugs[l].statusChangeDate) {

                            let statusChangeDate = new Date(charger.plugs[l].statusChangeDate)
                            charger.plugs[l].statusTime = ((dateNow.getTime() - statusChangeDate.getTime()) / 60000)

                        } else {

                            let updatedAt = new Date(charger.updatedAt);
                            charger.plugs[l].statusTime = ((dateNow.getTime() - updatedAt.getTime()) / 60000)

                        };
                        
                    }*/
                    chargersFound[i] = charger;

                }

                return res.status(200).send(chargersFound);

            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Definir o filtro de prioridade
router.get('/api/private/searchByName', async (req, res, next) => {
    const context = "GET /api/private/searchByName";
    try {
        const chargersFound = await getChargersByNameOrHardwareId(req);
        return res.status(200).send(chargersFound);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//deprecated
/**
 * @deprecated Since version 27. Will be deleted in version 30. Use xxx instead.
 */
router.get('/api/private/publicNetwork/details_old', (req, res, next) => {
    var context = "GET /api/private/publicNetwork/details_old";

    var query = req.query;

    ManagementPOIs.find({ chargerId: query._id }, (error, POIs) => {
        if (error) {
            console.error(`[${context}][.then][find] Error `, error.message);
            return res.status(500).send(error.message);
        }
        else {

            if (POIs.length === 0) {

                Charger.find({ _id: query._id })
                    .then(async (result) => {

                        if (result.length !== 0) {

                            let charger = JSON.parse(JSON.stringify(result[0]));

                            let feeds = await getFees(charger);

                            if (feeds !== false) {
                                charger.feeds = feeds;
                                charger.fees = feeds;
                            }

                            const { operator, operatorContact, operatorEmail } = await publicNetworkHelper.getChargerOperator(charger);
                            charger.operatorContact = operatorContact;
                            charger.operatorEmail = operatorEmail;
                            charger.operator = operator;

                            createPOI(charger)
                                .then((POI) => {
                                    charger.POIs = POI.POIs;
                                    var params = {
                                        station: charger.hwId
                                    };
                                    getTariffOPC(params)
                                        .then((result) => {
                                            if (result) {
                                                Promise.all(
                                                    charger.plugs.map(plug => {
                                                        return new Promise((resolve) => {
                                                            plug.serviceCost = result;
                                                            resolve(true);
                                                        })
                                                    })
                                                ).then(() => {
                                                    return res.status(200).send(charger);
                                                });
                                            }
                                            else {
                                                return res.status(200).send(charger);
                                            };
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });

                                })
                                .catch((error) => {
                                    console.error("[Error] " + error.message);
                                    return res.status(500).send({ message: 'Invalid charger id' });
                                });

                        }
                        else {
                            return res.status(400).send({ message: 'Invalid charger id' });
                        }

                    })
                    .catch((error) => {
                        console.error("[Error] [Invalid charger id] " + error.message);
                        return res.status(400).send({ message: 'Invalid charger id' });
                    });

            }
            else {

                let POI = POIs[0];
                const current_date = new Date();
                const differenceInDays = Math.round((current_date.getTime() - new Date(POI.updatedAt).getTime()) / timeEnums.oneDay);

                if (differenceInDays > POI.daysToUpdate) {

                    Charger.find({ _id: query._id })
                        .then(async (result) => {
                            if (result.length !== 0) {

                                let charger = JSON.parse(JSON.stringify(result[0]));

                                let feeds = await getFees(charger);

                                if (feeds !== false) {
                                    charger.feeds = feeds;
                                    charger.fees = feeds;
                                }

                                const { operator, operatorContact, operatorEmail } = await publicNetworkHelper.getChargerOperator(charger);
                                charger.operatorContact = operatorContact;
                                charger.operatorEmail = operatorEmail;
                                charger.operator = operator;

                                updatePOI(charger, POI)
                                    .then((POI) => {
                                        charger.POIs = POI.POIs;
                                        var params = {
                                            station: charger.hwId
                                        };
                                        getTariffOPC(params)
                                            .then((result) => {
                                                if (result) {
                                                    Promise.all(
                                                        charger.plugs.map(plug => {
                                                            return new Promise((resolve) => {
                                                                plug.serviceCost = result;
                                                                resolve(true);
                                                            })
                                                        })
                                                    ).then(() => {
                                                        return res.status(200).send(charger);
                                                    });
                                                }
                                                else {
                                                    return res.status(200).send(charger);
                                                };
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });

                                    })
                                    .catch((error) => {
                                        console.error("[Error] " + error.message);
                                        return res.status(500).send({ message: 'Invalid charger id' });
                                    });

                            }
                            else {
                                return res.status(400).send({ message: 'Invalid charger id' });
                            }

                        })
                        .catch((error) => {
                            console.error("[Error] [Invalid charger id] " + error.message);
                            return res.status(400).send({ message: 'Invalid charger id' });
                        });

                }
                else {

                    Charger.find({ _id: query._id })
                        .then(async (result) => {
                            if (result.length !== 0) {

                                let charger = JSON.parse(JSON.stringify(result[0]));

                                let feeds = await getFees(charger);

                                if (feeds !== false) {
                                    charger.feeds = feeds;
                                    charger.fees = feeds;
                                }

                                const { operator, operatorContact, operatorEmail } = await publicNetworkHelper.getChargerOperator(charger);
                                charger.operatorContact = operatorContact;
                                charger.operatorEmail = operatorEmail;
                                charger.operator = operator;

                                charger.POIs = POI.POIs;
                                var params = {
                                    station: charger.hwId
                                };
                                getTariffOPC(params)
                                    .then((result) => {
                                        if (result) {
                                            Promise.all(
                                                charger.plugs.map(plug => {
                                                    return new Promise((resolve) => {
                                                        plug.serviceCost = result;
                                                        resolve(true);
                                                    })
                                                })
                                            ).then(() => {
                                                return res.status(200).send(charger);
                                            });
                                        }
                                        else {
                                            return res.status(200).send(charger);
                                        };
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                            }
                            else {
                                return res.status(400).send({ message: 'Invalid charger id' });
                            }
                        })
                        .catch((error) => {
                            console.error("[Error] Invalid charger id] " + error.message);
                            return res.status(400).send({ message: 'Invalid charger id' });
                        })

                }

            }

        }

    });
});

router.get('/api/private/publicNetwork/details', async (req, res, next) => {
    var context = "GET /api/private/publicNetwork/details";

    try {
        const userId = req.headers['userid']
        var query = req.query;

        let chargerFound = await Charger.findOne(query).lean()

        if (chargerFound) {

            let charger = JSON.parse(JSON.stringify(chargerFound));
            let feeds = await getFees(charger);
            if (chargerFound.chargerType === process.env.ChargerTypeTesla) {
                var teslaTariff = await getTeslaTariff();
            };

            //console.log("teslaTariff", teslaTariff)

            if (feeds !== false) {
                charger.feeds = feeds;
                charger.fees = feeds;
            };

            const { operator, operatorContact, operatorEmail } = await publicNetworkHelper.getChargerOperator(charger);
            charger.operatorContact = operatorContact;
            charger.operatorEmail = operatorEmail;
            charger.operator = operator;

            let POIs = await ManagementPOIs.find({ hwId: charger.hwId }).lean()
                //console.log("POIs", POIs);
            if (POIs?.length > 0) {
                if (POIs[0].POIs.length > 0) {

                    let configManagementPOIs = await getConfigManagementPOIs();

                    let POI = POIs[0];
                    const current_date = new Date();
                    const differenceInDays = Math.round((current_date.getTime() - new Date(POI.updatedAt).getTime()) / timeEnums.oneDay);

                    if (differenceInDays >= configManagementPOIs.daysToUpdate) {

                        updatePOI(charger, POI)
                            .then((POI) => {
                                charger.POIs = POI.POIs;
                                Promise.all(
                                    charger.plugs.map(plug => updatePlug(plug, chargerFound, userId, charger.chargerType))
                                ).then(() => {
                                    if (chargerFound.chargerType === process.env.ChargerTypeTesla) {
                                        charger.teslaTariff = teslaTariff;
                                    };
                                    return res.status(200).send(charger);
                                }).catch(error => {
                                    console.log("[Error] " + error.message);
                                    return res.status(500).send(error.message);
                                })
                            })
                            .catch((error) => {
                                console.log("[Error] " + error.message);
                                return res.status(500).send({ message: 'Invalid charger id' });
                            });

                    }
                    else {

                        charger.POIs = POI.POIs;
                        Promise.all(
                            charger.plugs.map(plug => updatePlug(plug, chargerFound, userId, charger.chargerType))
                        ).then(() => {
                            if (chargerFound.chargerType === process.env.ChargerTypeTesla) {
                                charger.teslaTariff = teslaTariff;
                            };
                            return res.status(200).send(charger);
                        }).catch(error => {
                            console.log("[Error] " + error.message);
                            return res.status(500).send(error.message);
                        })

                    };

                } else {
                    //console.log("POIs", POIs);
                    let POI = POIs[0];
                    updatePOI(charger, POI)
                        .then((POI) => {
                            charger.POIs = POI.POIs;
                            Promise.all(
                                charger.plugs.map(plug => updatePlug(plug, chargerFound, userId, charger.chargerType))
                            ).then(() => {
                                if (chargerFound.chargerType === process.env.ChargerTypeTesla) {
                                    charger.teslaTariff = teslaTariff;
                                };
                                return res.status(200).send(charger);
                            }).catch(error => {
                                console.error("[Error] " + error.message);
                                return res.status(500).send(error.message);
                            })
                        })
                        .catch((error) => {
                            console.error("[Error] " + error.message);
                            return res.status(500).send({ message: 'Invalid charger id' });
                        });
                }
            } else {

                createPOI(charger)
                    .then((POI) => {

                        charger.POIs = POI.POIs;
                        Promise.all(
                            charger.plugs.map(plug => updatePlug(plug, chargerFound, userId, charger.chargerType))
                        ).then(() => {
                            if (chargerFound.chargerType === process.env.ChargerTypeTesla) {
                                charger.teslaTariff = teslaTariff;
                            };
                            return res.status(200).send(charger);
                        }).catch(error => {
                            console.error("[Error] " + error.message);
                            return res.status(500).send(error.message);
                        })

                    })
                    .catch((error) => {
                        console.error("[Error] " + error.message);
                        return res.status(500).send({ message: 'Invalid charger id' });
                    });

            };
        } else {
            return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
        };


    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.get('/api/private/chargers', (req, res, next) => {
    var context = "GET /api/private/chargers";

    try {

        var query = req.query;
        query = {
            ...query,
            operationalStatus: { $ne: "REMOVED" }
        }
        Charger.find(query).lean()
            .then(chargers => {
                if (chargers.length == 0) {
                    //return res.status(200).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    return res.status(200).send([]);
                }
                else {
                    return res.status(200).send(chargers);
                };
            })
            .catch(err => {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err);
            })
        // Charger.find(query, (err, chargers) => {
        //     if (err) {
        //         console.error(`[${context}][find] Error `, err.message);
        //         return res.status(500).send(err);
        //     }
        //     else {
        //         if (chargers.length == 0) {
        //             //return res.status(200).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
        //             return res.status(200).send([]);
        //         }
        //         else {
        //             return res.status(200).send(chargers);
        //         };
        //     };
        // });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

})

router.get('/api/private/chargers/all', (req, res, next) => {
    var context = "GET /api/private/chargers/all";

    try {

        var query = req.query;

        Charger.find(query).lean()
            .then(chargers => {
                if (chargers.length == 0) {
                    //return res.status(200).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    return res.status(200).send([]);
                }
                else {
                    return res.status(200).send(chargers);
                };
            })
            .catch(err => {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err);
            })


    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

})

//Endpoint to get only charger information. DO NOT put external requests. ONLY CHARGER'S INFO
router.get('/api/private/chargers/:hwId', (req, res, next) => {
    var context = "GET /api/private/chargers";

    try {

        var context = "GET /api/private/chargers/hwId";
        var hwId = req.params.hwId;

        let query = { hwId: hwId }

        Charger.findOne(query, (err, doc) => {
            if (err) {
                console.error(`[${context}][.then][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(doc);
            }
        });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };



})

router.get('/api/private/publicNetwork/history', (req, res, next) => {
    var context = "GET /api/private/publicNetwork/history";

    //console.log("req.query", req.query);

    var query = {
        hwId: req.query.hwId,
        chargerType: req.query.chargerType
    };

    //console.log("query", query);

    Charger.findOne(query, (err, doc) => {
        if (err) {
            console.error(`[${context}][.then][find] Error `, err.message);
            return res.status(500).send(err.message);
        } else {

            if (doc)
                return res.status(200).send({
                    charger: doc,
                    infrastructure: undefined
                });
            else
                return res.status(200).send({
                    charger: undefined,
                    infrastructure: undefined
                });

        };
    });


})

router.get('/api/private/publicNetwork/issues', (req, res, next) => {
    let context = "GET /api/private/publicNetwork/issues";

    let query = req.query;

    Charger.findOne(query, async (err, chargerFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }
        let charger = JSON.parse(JSON.stringify(chargerFound));
        
        const { operator, operatorContact, operatorEmail } = await publicNetworkHelper.getChargerOperator(charger);
        charger.operatorContact = operatorContact;
        charger.operatorEmail = operatorEmail;
        charger.operator = operator;

        return res.status(200).send(charger);
    });

});

router.get('/api/private/publicNetwork/findTariffId', async (req, res, next) => {
    let context = "GET /api/private/publicNetwork/findTariffId";
    try {
        let {source , tariffId} = req.query;
        const found = await Charger.findOne({source , "plugs.tariffId" : tariffId})
        return res.status(200).send(found);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== PUT ==========
//Call first one time to change chargerId to hwId
router.put('/api/private/publicNetwork/managementPOIs', (req, res, next) => {
    var context = "PUT /api/private/publicNetwork/managementPOIs";
    try {

        ManagementPOIs.find({}, async (err, poisFound) => {

            if (err) {

                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                let configManagementPOIs = await getConfigManagementPOIs();

                if (poisFound.length > 0) {

                    Promise.all(
                        poisFound.map(pois => {
                            return new Promise((resolve, reject) => {
                                var query = {
                                    _id: pois.chargerId
                                };

                                var fields = {
                                    hwId: 1
                                };

                                var newPOIs;


                                if (pois.POIs == null) {

                                    pois.POIs = [];
                                    newPOIs = [];

                                };

                                if (pois.POIs.length > 0) {

                                    newPOIs = pois.POIs.splice(0, configManagementPOIs.numberOfPois);

                                };

                                Charger.findOne(query, fields, (err, chargerFound) => {

                                    if (err) {

                                        console.error(`[${context}][Charger.findOne] Error `, err.message);
                                        reject(err);

                                    }
                                    else {

                                        if (chargerFound) {
                                            var newValues = { $set: { hwId: chargerFound.hwId, POIs: newPOIs } };
                                            var query = { _id: pois._id };

                                            ManagementPOIs.updateManagementPOIs(query, newValues, (err, result) => {

                                                if (err) {

                                                    console.error(`[${context}][updateManagementPOIs] Error `, err.message);
                                                    reject(err);

                                                }
                                                else {

                                                    resolve(true);

                                                };

                                            });
                                        }
                                        else {

                                            var query = { _id: pois._id };

                                            ManagementPOIs.removeManagementPOIs(query, (err, result) => {

                                                if (err) {

                                                    console.error(`[${context}][removeManagementPOIs] Error `, err.message);
                                                    reject(err);

                                                }
                                                else {

                                                    resolve(false);

                                                };

                                            });

                                        };

                                    };

                                });

                            });
                        })
                    ).then((result) => {

                        return res.status(200).send("Updated");

                    }).catch((error) => {

                        console.log(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);

                    });

                }
                else {

                    return res.status(400).send("Don't have POI's");

                };

            };

        });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };

});

router.put('/api/private/publicNetwork/addImage', (req, res, next) => {
    var context = "PUT /api/private/publicNetwork/addImage";
    try {

        let clientType = req.headers['client'];

        let newImages = req.body;

        /*
        if (clientType !== 'operationsManagement') {
            return res.status(400).send({ auth: false, code: 'server_not_authorized_access', message: 'You are not authorized to access, Only operation management' });
        };
        */

        validateFields(newImages)
            .then(() => {

                let query = {
                    hwId: newImages.hwId,
                    chargerType: newImages.chargerType
                };

                Charger.findOne(query, { imageContent: 1 }, (err, chargerFound) => {

                    if (err) {
                        console.log(`[${context}][Charger.findOne] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {

                        let addToDefaultImage = false;

                        if (chargerFound.imageContent.length === 0) {
                            addToDefaultImage = true;
                        };

                        chargerFound.imageContent = chargerFound.imageContent.concat(newImages.imageContent);

                        Promise.all(
                            chargerFound.imageContent.map((image, index) => {
                                return new Promise((resolve, reject) => {
                                    if (image.includes('base64')) {

                                        var path = '/usr/src/app/img/chargersPublic/' + newImages.hwId + '_' + index + '.jpg';
                                        var pathImage = '';
                                        var base64Image = image.split(';base64,').pop();
                                        if (process.env.NODE_ENV === 'production') {
                                            pathImage = process.env.HostProd + 'chargersPublic/' + newImages.hwId + '_' + index + '.jpg'; // For PROD server
                                        }
                                        else if (process.env.NODE_ENV === 'pre-production') {
                                            pathImage = process.env.HostPreProd + 'chargersPublic/' + newImages.hwId + '_' + index + '.jpg'; // For Pred PROD server
                                        }
                                        else {
                                            //pathImage = process.env.HostLocal  + 'chargersPublic/' + newImages.hwId + '_' + index + '.jpg';
                                            pathImage = process.env.HostQA + 'chargersPublic/' + newImages.hwId + '_' + index + '.jpg'; // For QA server
                                        };

                                        //console.log("base64Image", base64Image)
                                        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                            if (err) {
                                                console.error(`[${context}] Error `, err.message);;
                                                reject(err);
                                            }
                                            else {

                                                chargerFound.imageContent[index] = pathImage;
                                                resolve(true);
                                            };
                                        });

                                    }
                                    else {
                                        resolve(true);
                                    }
                                });
                            })
                        ).then(() => {

                            if (addToDefaultImage)
                                chargerFound.defaultImage = chargerFound.imageContent[0];

                            Charger.findOneAndUpdate(query, { $set: chargerFound }, { new: true }, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][Charger.updateCharger] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    return res.status(200).send(result);
                                };
                            });

                        }).catch((error) => {
                            console.log(`[${context}][chargerFound.imageContent.map] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                    };

                });

            })
            .catch(error => {
                return res.status(400).send(error);
            });

    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.put('/api/private/publicNetwork/evseGroupsToChargers', (req, res, next) => {
    var context = "PUT /api/private/publicNetwork/evseGroupsToChargers";
    try {
        let evseUid = req.body.uid
        parseCsvEvseGroups(evseUid)
        return res.status(200).send("OK");
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.put('/api/private/publicNetwork/serviceCostsOnGireve', (req, res, next) => {
    var context = "PUT /api/private/publicNetwork/serviceCostsOnGireve";
    try {
        updateServiceCostsOnGireve()
        return res.status(200).send("OK");
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.put('/api/private/publicNetwork/evseGroupsCsv', (req, res, next) => {
    var context = "PUT /api/private/publicNetwork/evseGroupsCsv";
    try {
        let csvBase64String = req.body.csvString
        let buff = new Buffer.from(csvBase64String, 'base64');
        fs.writeFileSync(process.env.evseGroupsPath + 'data.csv', buff);
        return res.status(200).send("OK");

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/publicNetwork/specificEVSEGroup', async (req, res, next) => {
    var context = "GET /api/private/publicNetwork/specificEVSEGroup";
    try {
        let evseUid = req.query.uid
        let evseGroup = await getSpecificEvseGroups(evseUid)
        return res.status(200).send(evseGroup);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//========== POST ==========
router.post('/api/private/publicNetwork/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/publicNetwork/runFirstTime";
    try {

        //updatePlugsTesla();
        //addTariffToMobiEChargers();
        //upperCaseChargerConnectors();
        // recoverImage()
        //addWrongBehaviorAttribute();
        //addOperationalStatus();
        //updateAddressModel();
        createTimeZones();

        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update Or create new or existing charger
router.post('/api/private/updateOrCreateCharger', (req, res, next) => {
    var context = "POST /api/private/updateOrCreateCharger";
    try {
        let chargers = req.body.chargers;
        let mode = req.body.mode;

        if (chargers.length > 0) {
            Promise.all(
                chargers.map(chargerInfo => {
                    return new Promise(async (resolve, reject) => {

                        // chargerInfo.operationalStatus = process.env.OperationalStatusApproved;

                        // let query = {
                        //     source: chargerInfo.source,
                        //     hwId: chargerInfo.hwId
                        // }
                        // Charger.updateCharger(query, { $set: chargerInfo }, (err, doc) => {
                        //     if (doc != null) {
                        //         console.log("Updated " + chargerInfo.hwId);
                        //         resolve(doc);
                        //     } else {
                        //         const new_charger = new Charger(chargerInfo);
                        //         Charger.createCharger(new_charger, (err, result) => {
                        //             if (result) {
                        //                 console.log("Created " + chargerInfo.hwId);
                        //                 resolve(result);
                        //             } else {
                        //                 console.log("Not created");
                        //                 reject(true);
                        //             }
                        //         })
                        //     }
                        // });
                        try {
                            let query = {
                                source: chargerInfo.source,
                                hwId: chargerInfo.hwId,
                            }

                            if(chargerInfo?.geometry?.coordinates)
                                chargerInfo.timeZone = timeZone.getTimezoneFromCoordinates(chargerInfo.geometry.coordinates)

                            let found = await Charger.findOne(query)
                            if (found) {
                                let oldPlugs = found.plugs
                                let newPlugs = chargerInfo.plugs.map(plug => updateNewPlug(oldPlugs, plug))
                                chargerInfo.plugs = newPlugs
                                chargerInfo = await verifyIfCoordinatesUpdate(chargerInfo.hwId, chargerInfo, found?.updatedCoordinates || false)
                                await Charger.updateOne(query, { $set: chargerInfo });
                                resolve(chargerInfo)
                            } else {
                                // chargerInfo.plugs = await Promise.all(chargerInfo.plugs.map(async plug => await addTariffOpc(plug)))
                                chargerInfo = await verifyIfCoordinatesUpdate(chargerInfo.hwId, chargerInfo)
                                const new_charger = new Charger(chargerInfo);
                                await new_charger.save()
                                resolve(chargerInfo)
                            }
                        } catch (error) {
                            console.log(`[${context}] Error `, error.message);
                            reject(error)
                        }
                    })
                })
            ).then(async (chargers) => {
                deleteMissingChargers(chargers, mode)
                return res.status(200).send("Chargers updated");

            }).catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error);
            });
        } else {
            return res.status(200).send("No chargers to Update");
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error);
    };
});

//========== PATCH ==========
//Endpoint tariff opc on charger MobiE (ChargerType 004)
router.patch('/api/private/publicNetwork/updateTariffOPC', async (req, res, next) => {
    var context = "PATCH /api/private/publicNetwork/updateTariffOPC";
    try {

        let received = req.body;

        let query = {
            "plugs.tariffId": received.tariffId
        };

        Charger.find(query, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {

                if (chargersFound.length > 0) {

                    Promise.all(
                        chargersFound.map(charger => {

                            return new Promise((resolve, reject) => {
                                Promise.all(
                                    charger.plugs.map(plug => {
                                        return new Promise((resolve, reject) => {

                                            if (plug.tariffId[0] === received.tariffId) {
                                                let serviceCost = {
                                                    costByPower: received.costByPower,
                                                    costByTime: received.costByTime,
                                                    initialCost: received.initialCost,
                                                    elements: received.elements,
                                                    currency: received.currency,
                                                };
                                                //plug.serviceCost = serviceCost;

                                                let query = {
                                                    _id: charger._id,
                                                    "plugs.plugId": plug.plugId
                                                };

                                                let newValues = {
                                                    $set: {
                                                        "plugs.$.serviceCost": serviceCost
                                                    }
                                                };

                                                Charger.updateCharger(query, newValues, (err, result) => {
                                                    if (err) {
                                                        console.error(`[${context}] Error `, err.message);
                                                        reject(err);
                                                    }
                                                    else {
                                                        resolve(true);
                                                    };
                                                });
                                            }
                                            else {
                                                resolve(true);
                                            };

                                        });
                                    })
                                ).then((result) => {
                                    resolve(true);
                                }).catch((error) => {
                                    console.error(`[${context}] Error `, error.message);
                                    reject(error);
                                });
                            });
                        })
                    ).then((result) => {
                        return res.status(200).send("Chargers Updated");
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });

                }
                else {
                    return res.status(200).send("No chargers to Update");
                };

            };
        });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to change plug power
router.patch('/api/private/publicNetwork/plugPower', async (req, res, next) => {
    var context = "PATCH /api/private/publicNetwork/plugPower";
    try {
        let chargers = req.body.chargers;
        if (chargers.length > 0) {
            Promise.all(
                chargers.map(chargerInfo => {
                    return new Promise((resolve, reject) => {
                        for (let plug of chargerInfo.plugs) {
                            let query = {
                                source: chargerInfo.source,
                                hwId: chargerInfo.hwId,
                                "plugs.uid": plug.uid
                            }
                            Charger.updateCharger(query, { $set: { "plugs.$.power": plug.power } }, (err, doc) => {
                                if (doc != null) {
                                    //console.log("Updated " + chargerInfo.hwId);
                                    resolve(doc);
                                }
                            });
                        }

                    })
                })
            ).then((chargers) => {
                return res.status(200).send("Chargers updated");
            }).catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error);
            });
        } else {
            return res.status(200).send("No chargers to Update");
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error);
    };
});

//Endpoint to change plug power
router.patch('/api/private/publicNetwork/tariffId', async (req, res, next) => {
    var context = "PATCH /api/private/publicNetwork/tariffId";
    try {
        let chargers = req.body.chargers;
        if (chargers.length > 0) {
            Promise.all(
                chargers.map(chargerInfo => {
                    return new Promise((resolve, reject) => {
                        if (chargerInfo.plugs.length > 1) {
                            for (let plug of chargerInfo.plugs) {
                                let query = {
                                    source: chargerInfo.source,
                                    hwId: chargerInfo.hwId,
                                    "plugs.plugId": plug.id
                                }
                                Charger.updateCharger(query, { $set: { "plugs.$.tariffId": [plug.tariffId] } }, (err, doc) => {
                                    if (doc != null) {
                                        console.log("Updated tariffId on charger " + chargerInfo.hwId + ` with plug ${plug.id}`);
                                        resolve(doc);
                                    }
                                });
                            }
                        } else if (chargerInfo.plugs.length === 1) {
                            if (chargerInfo.plugs[0].id === null || chargerInfo.plugs[0].id === undefined) {
                                let query = {
                                    source: chargerInfo.source,
                                    hwId: chargerInfo.hwId,
                                }
                                Charger.findOne(query, (err, result) => {

                                    if (err) {
                                        console.error(`[${context}] Error `, err.message);
                                        reject(err)
                                    }
                                    else {
                                        for (let plug of result.plugs) {
                                            let updateQuery = {
                                                source: chargerInfo.source,
                                                hwId: chargerInfo.hwId,
                                                "plugs.plugId": plug.plugId
                                            }
                                            Charger.updateCharger(updateQuery, { $set: { "plugs.$.tariffId": [chargerInfo.plugs[0].tariffId] } }, (err, doc) => {
                                                if (doc != null) {
                                                    console.log("Updated tariffId on charger " + chargerInfo.hwId + ` with plug ${plug.plugId}`);
                                                    resolve(doc);
                                                }
                                            });
                                        }
                                    };

                                });
                            } else {
                                let updateQuery = {
                                    source: chargerInfo.source,
                                    hwId: chargerInfo.hwId,
                                    "plugs.plugId": chargerInfo.plugs[0].id
                                }
                                Charger.updateCharger(updateQuery, { $set: { "plugs.$.tariffId": [chargerInfo.plugs[0].tariffId] } }, (err, doc) => {
                                    if (doc != null) {
                                        console.log("Updated tariffId on charger " + chargerInfo.hwId + ` with plug ${chargerInfo.plugs[0].id}`);
                                        resolve(doc);
                                    }
                                });
                            }


                        }
                    })
                })
            ).then((chargers) => {
                return res.status(200).send("Chargers updated with tariffId");

            }).catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error);
            });
        } else {
            return res.status(200).send("No chargers to Update");
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error);
    };
});

//Endpoint to change plug power
router.patch('/api/private/publicNetwork/wrongBehaviorStation', async (req, res, next) => {
    var context = "PATCH /api/private/publicNetwork/wrongBehaviorStation";
    try {
        let { hwId, source, wrongBehaviorStation } = req.body.chargerInfo;
        let foundCharger = await Charger.findOneAndUpdate({ hwId, source }, { $set: { wrongBehaviorStation } }, { new: true })
        return res.status(200).send(foundCharger);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error);
    };
});

//========== FUNCTIONS ==========
function validateFields(imagesDependencies) {
    return new Promise((resolve, reject) => {

        if (!imagesDependencies)
            reject({ auth: false, code: 'server_imagesDependencies_required', message: 'Image data is required' });

        //if (!imagesDependencies.chargerId)
        //    reject({ auth: false, code: 'server_charger_id_required', message: 'Charger id is required' });

        if (!imagesDependencies.hwId)
            reject({ auth: false, code: 'server_hwId_required', message: 'Hardware Id is required!' });

        if (!imagesDependencies.imageContent)
            reject({ auth: false, code: 'server_imageContent_required', message: 'Image content is required' });

        if (imagesDependencies.imageContent.length === 0)
            reject({ auth: false, code: 'server_imageContent_required', message: 'Image content is required' });

        if (!imagesDependencies.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });

        else
            resolve(true);

    });
};

const getFilterMapping = ((mapping_type) => {

    let mapping_obj = jsonFile[mapping_type];
    if (mapping_obj != undefined) {
        return mapping_obj;
    }
    return false;

});

/*
const countryCodeFilter = ((countryCodes) => {
    let filter = []
    for (let countryCode of countryCodes) {
        let mapping = getFilterMapping(countryCode);
        if (mapping != false) {
            console.log("mapping",mapping);
            filter.push(mapping);
        }
    }

    if (filter.length != 0) {
        console.log("mapping",mapping);
        return { $or: filter }
    }
    return false;
});
*/
function verifyNotifymeHistory(query) {
    var context = "Funciton verifyNotifymeHistory";
    let data = query
    let host = process.env.HostNotifications + process.env.PathNotifymeHistory
    return new Promise((resolve, reject) => {
        axios.get(host, { data })
            .then(result => {
                resolve(result.data)
            })
            .catch(err => {
                reject(err)
            })
    });
};

function chargingSessionFind(host, data) {
    var context = "Funciton chargingSessionFind";
    return new Promise((resolve, reject) => {
        axios.get(host, { data })
            .then(result => {
                resolve(result.data)
            })
            .catch(err => {
                reject(err)
            })
    });
};

const countryCodeFilter = ((countryCodes) => {

    let filter = []
    for (let countryCode of countryCodes) {
        let mapping_obj = getFilterMapping(countryCode);
        if (mapping_obj != false) {

            for (let mapping of mapping_obj.sources) {
                // TODO Temporary until Tesla source exists
                if (mapping === 'OCM' && mapping_obj.countryCode === 'PT') {
                    let entry = {
                        chargerType: process.env.ChargerTypeTesla,
                        countryCode: mapping_obj.countryCode
                    }
                    filter.push(entry);
                }
                else {
                    let entry = {
                        source: mapping,
                        countryCode: mapping_obj.countryCode
                    }
                    filter.push(entry);
                }
                //filter.push(entry);
            }

        }
    }

    if (filter.length != 0) {
        return { $or: filter }
    }
    return false;

});

const createPOI = ((charger) => {
    return new Promise(async (resolve, reject) => {

        var host = "";
        if (process.env.NODE_ENV === 'production') {
            host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
        }
        else {
            host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
        };

        //console.log("HOST");
        console.log(host);

        let configManagementPOIs = await getConfigManagementPOIs();

        getPOIsGoogle(host, configManagementPOIs.numberOfPois)
            .then((POIs) => {

                var POI = new ManagementPOIs();
                POI.chargerId = charger._id;
                POI.geometry = charger.geometry;
                POI.POIs = POIs;
                POI.hwId = charger.hwId;

                console.log(POIs);

                managementPOIsCreate(POI)
                    .then((result) => {
                        if (result) {
                            //console.log("Create");
                            resolve(POI);
                        }
                    })
                    .catch((error) => {
                        console.error(`[managementPOIsCreate]][.catch] Error `, error.message);
                        reject(error);
                    });

            })
            .catch((error) => {
                console.error(`[managementPOIsCreate]][.catch] Error `, error.message);
                reject(false)
            });

    });

});

const updatePOI = ((charger, managementPOI) => {
    return new Promise(async (resolve, reject) => {

        var host = "";
        if (process.env.NODE_ENV === 'production') {
            host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
        }
        else {
            host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
        };

        let configManagementPOIs = await getConfigManagementPOIs();

        //console.log("HOST");
        console.log(host);

        getPOIsGoogle(host, configManagementPOIs.numberOfPois)
            .then((POIs) => {

                let POI = {
                    chargerId: charger._id,
                    geometry: charger.geometry,
                    POIs: POIs
                }

                let query = {
                    _id: managementPOI._id
                };

                ManagementPOIs.updateManagementPOIs(query, { $set: POI }, (err, doc) => {
                    if (doc != null) {
                        //console.log("Updated");
                        resolve(doc);
                    }
                    else {
                        console.error(`[Error] `, err.message);
                        reject(err);
                    }

                });

            })
            .catch((error) => {
                console.error(`[managementPOIsCreate]][.catch] Error `, error.message);
            });

    });

});

function getPOIsGoogle(host, numberOfPois) {
    var context = "Function getPOIsGoogle";
    return new Promise((resolve, reject) => {

        axios.get(host)
            .then((result) => {
                if (result.data.results.length === 0) {
                    resolve([]);
                }
                else {

                    var newPOIs = result.data.results.sort((a, b) => b.rating - a.rating);
                    // var newPOIs = result.data.results.splice(0, numberOfPois);
                    savePhotosPOIs(newPOIs, numberOfPois)
                        .then((result) => {
                            resolve(result);
                        })
                        .catch((error) => {
                            console.error(`[${context}][savePhotosPOIs][.catch] Error `, error.message);
                            reject(error);
                        })

                };
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function savePhotosPOIs(POIs, numberOfPois) {
    var context = "Function savePhotosPOIs";
    return new Promise((resolve, reject) => {
        Promise.all(
            POIs.map((POI, poiIndex) => {
                return new Promise(async (resolve, reject) => {
                    if (poiIndex > numberOfPois - 1) {

                        let url = POI.icon

                        if (POI.id != undefined) {
                            var path = '/usr/src/app/img/publicNetwork/google/' + POI.id + '.jpg';
                        }
                        else {
                            var path = '/usr/src/app/img/publicNetwork/google/' + POI.place_id + '.jpg';
                        };
                        var pathImage = "";
                        if (process.env.NODE_ENV === 'production') {
                            if (POI.id != undefined) {
                                pathImage = process.env.HostProd + 'publicNetwork/google/' + POI.id + '.jpg'; // For PROD server
                            }
                            else {
                                pathImage = process.env.HostProd + 'publicNetwork/google/' + POI.place_id + '.jpg'; // For PROD server
                            };
                        }
                        else if (process.env.NODE_ENV === 'pre-production') {
                            if (POI.id != undefined) {
                                pathImage = process.env.HostPreProd + 'publicNetwork/google/' + POI.id + '.jpg'; // For PROD server
                            }
                            else {
                                pathImage = process.env.HostPreProd + 'publicNetwork/google/' + POI.place_id + '.jpg'; // For PROD server
                            };
                        }
                        else {
                            if (POI.id != undefined) {
                                // pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                pathImage = process.env.HostQA + 'publicNetwork/google/' + POI.id + '.jpg'; // For QA server
                            }
                            else {
                                // pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                pathImage = process.env.HostQA + 'publicNetwork/google/' + POI.place_id + '.jpg'; // For QA server
                            };
                        };
                        download(url, path, () => {
                            POI.photos = pathImage;
                            resolve(true);
                        });

                    } else if (POI.photos != undefined) {

                        if (POI.photos.length !== 0) {
                            var photo = POI.photos[0];

                            var url = "";
                            if (process.env.NODE_ENV === 'production') {
                                url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyProd;
                            }
                            else {
                                url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyQA;
                            };

                            //console.log("URL");
                            console.log(url);

                            if (POI.id != undefined) {
                                var path = '/usr/src/app/img/publicNetwork/google/' + POI.id + '.jpg';
                            }
                            else {
                                var path = '/usr/src/app/img/publicNetwork/google/' + POI.place_id + '.jpg';
                            };

                            var pathImage = "";
                            if (process.env.NODE_ENV === 'production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostProd + 'publicNetwork/google/' + POI.id + '.jpg'; // For PROD server
                                }
                                else {
                                    pathImage = process.env.HostProd + 'publicNetwork/google/' + POI.place_id + '.jpg'; // For PROD server
                                };
                            }
                            else if (process.env.NODE_ENV === 'pre-production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostPreProd + 'publicNetwork/google/' + POI.id + '.jpg'; // For PROD server
                                }
                                else {
                                    pathImage = process.env.HostPreProd + 'publicNetwork/google/' + POI.place_id + '.jpg'; // For PROD server
                                };
                            }
                            else {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostQA + 'publicNetwork/google/' + POI.id + '.jpg'; // For QA server
                                }
                                else {
                                    pathImage = process.env.HostQA + 'publicNetwork/google/' + POI.place_id + '.jpg'; // For QA server
                                };
                            };

                            download(url, path, () => {
                                POI.photos = pathImage;
                                resolve(true);
                            });

                        }
                        else {
                            POI.photos = '';
                            resolve(true);
                        };

                    }
                    else {
                        POI.photos = '';
                        resolve(true);
                    };

                });
            })
        ).then(() => {
            resolve(POIs);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });
    });
};

const download = (url, path, callback) => {
    console.log(url);
    if (fs.existsSync(path)) { return callback(); }
    
    request.head(url, (err, res, body) => {
        request(url)
            .pipe(fs.createWriteStream(path))
            .on('close', callback);
    });
};

function managementPOIsCreate(managementPOIs) {
    var context = "Function managementPOIsCreate";
    return new Promise((resolve, reject) => {
        ManagementPOIs.createManagementPOIs(managementPOIs, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

async function getTariffOPC(params) {
    var context = "Function getTariffOPC";
    return new Promise((resolve, reject) => {
        var host = process.env.HostOcpi + process.env.PathGetOPCTariffs
        axios.get(host, { params })
            .then((result) => {
                if (result.data) {
                    if (result.data.length != undefined) {
                        resolve({
                            initialCost: -1,
                            costByTime: [
                                {
                                    minTime: 0,
                                    cost: -1,
                                    uom: ""
                                }
                            ],
                            costByPower: {
                                cost: -1,
                                uom: ""
                            }
                        })
                    }
                    else {
                        resolve(result.data);
                    }

                }
                else {
                    resolve(null);
                }
            })
            .catch((error) => {
                if (error.response) {
                    console.error(`[${context}][get][.catch]`, error.response.data);
                    reject(error);
                }
                else {
                    console.error(`[${context}][get][.catch]`, error.message);
                    reject(error);
                }
            });
    });
};

async function getFees(charger) {
    return new Promise(async (resolve, reject) => {

        try {

            let countryCode;
            let postalCode;

            if (charger.address != undefined) {
                if (charger.address.country) {
                    if (charger.address.country === 'Portugal' || charger.address.country === '') {
                        countryCode = 'PT';
                    }
                    else {
                        countryCode = charger.address.country;
                    }
                }
                else {
                    countryCode = 'PT';
                }

                if (charger.address.zipCode != undefined && charger.address.zipCode !== "") {
                    let result = charger.address.zipCode.split("-");
                    if (result.length > 1) {
                        postalCode = result[0];
                    }
                    else {
                        postalCode = '';
                    }
                }
                else {
                    postalCode = '';
                }
            }
            else {
                countryCode = 'PT';
            }

            var params = {
                countryCode: countryCode,
                postalCode: postalCode
            }

            axios.get(feesConfig, { params })
                .then((fees) => {
                    if (fees.data) {
                        resolve(fees.data);
                    } else {
                        resolve(false);
                    }
                })
                .catch((error) => {
                    console.error("[Error getFees] " + error.message);
                    resolve(false)
                });

        } catch (error) {
            console.error("Error getFees " + error.message);
            resolve(false)
        };

    });

};

function getConfigManagementPOIs() {
    var context = "Function getConfigManagementPOIs";
    return new Promise((resolve, reject) => {

        var host = process.env.HostConfigs + process.env.PathConfigManagementPOIs;
        axios.get(host)
            .then((result) => {

                if (result.data.length > 0) {

                    resolve(result.data[0]);

                }
                else {

                    var configManagementPOIs = {
                        daysToUpdate: 365,
                        numberOfPois: 7
                    };

                    resolve(configManagementPOIs);

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                resolve(false);

            });

    });
};

function updatePlugsTesla() {
    var context = "Function updatePlugsTesla";

    var query = {
        chargerType: "009",
        "plugs.connectorType": "TESLA"
    };

    var newValues = {
        $set: {
            "plugs.$.connectorType": "TYPE 2"
        }
    };

    Charger.updateMany(query, newValues, (err, result) => {

        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            console.log("ChargerType Updated!", result)
        };
    })
}

const updatePlug = (plug, chargerFound, userId, chargerType) => {
    var context = "function updatePlug"
    return new Promise(async (resolve, reject) => {


        var find = {
            hwId: chargerFound.hwId,
            plugId: plug.plugId,
            'listOfUsers': {
                $elemMatch: {
                    'userId': userId
                }
            },
            active: true
        };
        let dateNow = new Date();

        if (plug.statusChangeDate) {

            let statusChangeDate = new Date(plug.statusChangeDate)
            plug.statusTime = ((dateNow.getTime() - statusChangeDate.getTime()) / 60000)

        } else {

            let updatedAt = new Date(chargerFound.updatedAt);
            plug.statusTime = ((dateNow.getTime() - updatedAt.getTime()) / 60000)

        }

        verifyNotifymeHistory(find)
            .then((value) => {
                if (!value) {
                    if (plug.tariffId.length > 0 && plug.tariffId[0] !== null && plug.tariffId[0] !== undefined) {
                        // Technically, we don't need to get the tariff opc since it already exists in the plug and it's updated
                        plug.canBeNotified = value;
                        resolve(true);
                        // let params = {
                        //     tariffId: plug.tariffId[0],
                        // }
                        // getTariffOPC(params)
                        //     .then((result) => {
                        //         plug.serviceCost = result
                        //         plug.canBeNotified = value;
                        //         resolve(true);
                        //     })
                        //     .catch(error => {
                        //         console.error(`[${context}] Error `, error.message);
                        //         reject(error)
                        //     })
                    } else {
                        plug.canBeNotified = value;
                        resolve(true);
                    }
                }
                else {
                    if (plug.tariffId.length > 0 && plug.tariffId[0] !== null && plug.tariffId[0] !== undefined) {
                        // let params = {
                        //     tariffId: plug.tariffId[0],
                        // }
                        // getTariffOPC(params)
                        //     .then((result) => {
                        //         plug.serviceCost = result;
                            plug.canBeNotified = value;
                            var body = {
                                $and: [
                                    { userId: userId },
                                    { connector_id: plug.plugId },
                                    { status: 'ACTIVE' }
                                ]
                            }
                            //TODO add Gireve
                            if (chargerFound.chargerType === '004' || chargerFound.chargerType === '010' || chargerFound.chargerType === '015') {
                                let chargingSessionProxy = process.env.HostOcpi + process.env.PathGetOCPIChargingSessions
                                chargingSessionFind(chargingSessionProxy, body)
                                    .then(result => {
                                        if (result.length > 0) {
                                            plug.canBeNotified = false;
                                            resolve(true);
                                        }
                                        else {
                                            plug.canBeNotified = true;
                                            resolve(true);
                                        };
                                    })
                                    .catch(err => {
                                        console.error(`[${context}][ChargingSession.findOne] Error `, err.message);
                                        reject(err);
                                    })
                            } else {
                                resolve(true);
                            }
                            // })
                            // .catch(error => {
                            //     console.error(`[${context}] Error `, error.message);
                            //     reject(error)
                            // })
                    } else {
                        plug.canBeNotified = value;
                        var body = {
                            $and: [
                                { userId: userId },
                                { connector_id: plug.plugId },
                                { status: 'ACTIVE' }
                            ]
                        }
                        //TODO add Gireve
                        if (chargerFound.chargerType === '004' || chargerFound.chargerType === '010' || chargerFound.chargerType === '015') {
                            let chargingSessionProxy = process.env.HostOcpi + process.env.PathGetOCPIChargingSessions
                            chargingSessionFind(chargingSessionProxy, body)
                                .then(result => {
                                    if (result.length > 0) {
                                        plug.canBeNotified = false;
                                        resolve(true);
                                    }
                                    else {
                                        plug.canBeNotified = true;
                                        resolve(true);
                                    };
                                })
                                .catch(err => {
                                    console.error(`[${context}][ChargingSession.findOne] Error `, err.message);
                                    reject(err);
                                })
                        } else {
                            resolve(true);
                        }

                    }

                };
            })
            .catch((error) => {
                console.error(`[${context}][verifyNotifymeHistory][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function addTariffToMobiEChargers() {
    var context = "Function addTariffToMobiEChargers";

    let query = {
        chargerType: process.env.ChargerTypeMobiE
    };

    Charger.find(query, (err, chargersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            if (chargersFound.length > 0) {
                chargersFound.map(charger => {
                    Promise.all(
                        charger.plugs.map(plug => {
                            return new Promise((resolve, reject) => {

                                if (plug.tariffId.length > 0) {
                                    var params = {
                                        tariffId: plug.tariffId[0]
                                    };
                                    getTariffOPC(params)
                                        .then((tariff) => {

                                            let query = {
                                                _id: charger._id,
                                                "plugs.plugId": plug.plugId
                                            };

                                            let newValues = {
                                                $set: {
                                                    "plugs.$.serviceCost": tariff
                                                }
                                            };

                                            Charger.updateCharger(query, newValues, (err, result) => {
                                                if (err) {
                                                    console.error(`[${context}] Error `, err.message);
                                                }
                                                else {
                                                    resolve(true);
                                                };
                                            });

                                        })
                                        .catch((error) => {
                                            console.error(`[${context}] Error `, error.message);
                                            reject(error);
                                        });
                                }
                                else {
                                    let query = {
                                        _id: charger._id,
                                        "plugs.plugId": plug.plugId
                                    };

                                    let newValues = {
                                        $set: {
                                            "plugs.$.serviceCost": {
                                                initialCost: -1,
                                                costByTime: [
                                                    {
                                                        minTime: 0,
                                                        cost: -1,
                                                        uom: ""
                                                    }
                                                ],
                                                costByPower: {
                                                    cost: -1,
                                                    uom: ""
                                                }
                                            }
                                        }
                                    };

                                    Charger.updateCharger(query, newValues, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}] Error `, err.message);
                                        }
                                        else {
                                            resolve(true);
                                        };
                                    });
                                }
                            });
                        })
                    ).then(() => {
                        console.log("Tariff added to charger", charger.hwId);
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                    });
                });
            };
        };
    });

};

function getTeslaTariff() {
    var context = "Function getTeslaTariff";
    return new Promise(async (resolve, reject) => {
        try {

            var proxy = process.env.TarriffServiceHost + process.env.PathTeslaTariff;
            var params = {
                active: true
            };

            axios.get(proxy, { params })
                .then((result) => {
                    if (result.data)
                        resolve(result.data);
                    else
                        resolve({
                            uom: 'KWh',
                            value: 0.262
                        })
                })
                .catch((error) => {
                    console.error(`[${context}] [${proxy}] Error `, error.message);
                    //reject(error);
                    resolve({
                        uom: 'KWh',
                        value: 0.262
                    })
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            //reject(error);
            resolve({
                uom: 'KWh',
                value: 0.262
            })
        };
    });
};

function upperCaseChargerConnectors() {
    var context = "Function upperCaseChargerConnectors";
    try {
        let query = {
            $or: [
                { network: 'Tesla' },
                { network: 'MobiE' }
            ]
        };

        Charger.find(query, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}][findChargers] Error `, err.message);
            }
            else {
                //console.log("chargersFound", chargersFound.length);
                if (chargersFound.length > 0) {

                    chargersFound.map(charger => {

                        charger.plugs.map(plug => {
                            let connectorType = plug.connectorType;
                            plug.connectorType = connectorType.toUpperCase();
                        });

                        query = {
                            _id: charger._id
                        };

                        var newValues = { $set: { plugs: charger.plugs } };

                        Charger.updateCharger(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                            }
                            else {
                                if (result) {
                                    console.log("Update successfully");
                                }
                                else {
                                    console.log("Update unsuccessfully");
                                }
                            };
                        });

                    });
                };
            };
        });
    }
    catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};


function recoverImage() {

    var context = "Function recoverImage";
    var path = '/usr/src/app/img/chargersPublic/';

    fs.readdir(path, (err, files) => {
        if (err) {

            console.error(`[${context}] Error `, err.message);

        }
        else {

            if (files.length > 0) {

                files.forEach(file => {
                    let imageName = file.split('_');
                    let index = imageName[1].split('.');

                    let query = {
                        hwId: imageName[0],
                        chargerType: "004"
                    };

                    let fields = {
                        _id: 1,
                        hwId: 1,
                        imageContent: 1
                    };

                    Charger.findOne(query, fields, (err, result) => {

                        if (err) {

                            console.error(`[${context}] Error `, err.message);

                        }
                        else {

                            let pathImage = '';
                            if (process.env.NODE_ENV === 'production') {
                                pathImage = `${process.env.HostProd}chargersPublic/${file}`; // For PROD server
                            }
                            else if (process.env.NODE_ENV === 'pre-production') {
                                pathImage = `${process.env.HostPreProd}chargersPublic/${file}`; // For Pred PROD server
                            }
                            else {
                                //pathImage = `${process.env.HostLocal}chargersPublic/${file}`;
                                pathImage = `${process.env.HostQA}chargersPublic/${file}`; // For QA server
                            };

                            result.imageContent[index[0]] = pathImage;

                            Charger.updateCharger(query, { $set: result }, (err, result) => {
                                if (err) {

                                    console.error(`[${context}] Error `, err.message);

                                }
                                else {
                                    console.log("Image updated");
                                }
                            })

                        };

                    });
                });

            };

        };
    });

};

function addWrongBehaviorAttribute() {
    var context = "Function addWrongBehaviorAttribute";

    Charger.find({}, (err, chargersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            if (chargersFound.length > 0) {
                for (let chargerI of chargersFound) {
                    let query = {
                        _id: chargerI._id
                    };

                    var newValues = { $set: { wrongBehaviorStation: false } };

                    Charger.updateCharger(query, newValues, (err, result) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                        }
                        else {
                            if (result) {
                                console.log(`Updated successfully charger`);
                            }
                            else {
                                console.log(`Updated unsuccessfully charger ${chargerI.hwId}`);
                            }
                        };
                    });

                }
            };
        };
    });
}

async function deleteMissingChargers(chargers, mode) {
    const context = "Function deleteMissingChargers"
    try {
        if (mode === "full") {
            //console.log("full mode delete")
            let updatedChargersIds = chargers.map(charger => { return charger.hwId })
            let source = chargers[0].source
            if (chargers.length > 0) {
                let chargersFound = await Charger.find({ source: source, subStatus: { $ne: "REMOVED" }, operationalStatus: { $ne: "REMOVED" } }).lean()
                if (chargersFound.length > 0) {
                    let foundChargersIds = chargersFound.map(charger => { return charger.hwId })
                    let result = foundChargersIds.filter(hwId => !updatedChargersIds.includes(hwId))
                    if (result.length > 0) {
                        for (let hwId of result) {
                            let query = {
                                source,
                                hwId,
                            }

                            let newValues = {
                                $set: { status: "50", subStatus: "REMOVED", operationalStatus: "REMOVED" }
                            }
                            let updatedCharger = await Charger.updateOne(query, newValues)
                            if (updatedCharger) {
                                console.log(`Charger ${hwId} was removed from GIREVE repository and updated to status REMOVED on EVIO`)
                            }
                        }
                    }
                } else {
                    console.log(`No chargers found for source ${source}`)
                };
            }
        }
    } catch (error) {
        console.error("error on deleteMissingChargers")
        console.error(`[${context}] Error `, error.message);
    }
}

//addOperationalStatus()
function addOperationalStatus() {
    var context = "Function addOperationalStatus";

    Charger.updateMany({}, { $set: { operationalStatus: process.env.OperationalStatusApproved } }, (err, results) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            console.log("results", results);
        }
    });
};

async function parseCsvEvseGroups(evseUid = null) {
    var context = "Function parseCsvEvseGroups";
    try {
        let csvFile = fs.readdirSync(process.env.evseGroupsPath)[0]
        if (csvFile) {
            fs.createReadStream(process.env.evseGroupsPath + csvFile)
                .pipe(csv({ separator: ';' }))
                .on('data', async (row) => {
                    let query = {
                        "plugs.uid": row[process.env.csvEvseUidKey],
                        "countryCode": row[process.env.csvCountryKey],
                        "source": "Gireve"
                    }
                    let newValues = {
                        "plugs.$.evseGroup": row[process.env.csvGroupOfPointsKey].length !== 0 ? row[process.env.csvGroupOfPointsKey] : process.env.otherPointsEnum,
                    }
                    let fields = {
                        _id: 1,
                        source: 1,
                        countryCode: 1,
                        "plugs._id": 1,
                        "plugs.uid": 1,
                    }
                    if (evseUid !== null && evseUid !== undefined) {
                        if (row[process.env.csvEvseUidKey] === evseUid) {
                            // let newValues = {
                            //     "plugs.$.evseGroup": row[process.env.csvGroupOfPointsKey].length !== 0 ? row[process.env.csvGroupOfPointsKey] : process.env.otherPointsEnum,
                            // }
                            let found = await Charger.findOne(query, fields).lean()
                            if (found) {
                                for (let plug of found.plugs) {
                                    if (row[process.env.csvEvseUidKey] === plug.uid) {
                                        await Charger.updateOne({ _id: found._id, "plugs._id": plug._id }, newValues)
                                    }
                                }
                            }

                            // await Charger.findOneAndUpdate(query, newValues, { new: true })
                            // let found = await Charger.findOne(query)
                            // if (found) {
                            //     let plug = found.plugs.find(plugI => plugI.uid === row[process.env.csvEvseUidKey])
                            //     let serviceCost = await buildServiceCost(found,plug)
                            //     let newValues = {
                            //         "plugs.$.evseGroup": row[process.env.csvGroupOfPointsKey].length !== 0 ? row[process.env.csvGroupOfPointsKey] : process.env.otherPointsEnum,
                            //         "plugs.$.serviceCost": serviceCost
                            //     }
                            //     await Charger.updateOne(query ,newValues)
                            // }
                        }
                    } else {
                        // let newValues = {
                        //     "plugs.$.evseGroup": row[process.env.csvGroupOfPointsKey].length !== 0 ? row[process.env.csvGroupOfPointsKey] : process.env.otherPointsEnum,
                        // }
                        let found = await Charger.findOne(query, fields).lean()
                        if (found) {
                            for (let plug of found.plugs) {
                                if (row[process.env.csvEvseUidKey] === plug.uid) {
                                    await Charger.updateOne({ _id: found._id, "plugs._id": plug._id }, newValues)
                                }
                            }
                        }

                        // await Charger.findOneAndUpdate(query, newValues, { new: true })
                        // let found = await Charger.findOne(query)
                        // if (found) {
                        //     let plug = found.plugs.find(plugI => plugI.uid === row[process.env.csvEvseUidKey])
                        //     let serviceCost = await buildServiceCost(found,plug)
                        // let newValues = {
                        //     "plugs.$.evseGroup": row[process.env.csvGroupOfPointsKey].length !== 0 ? row[process.env.csvGroupOfPointsKey] : process.env.otherPointsEnum,
                        //     "plugs.$.serviceCost": serviceCost
                        // }
                        // await Charger.updateOne(query ,newValues)
                        // }
                    }
                })
                .on('end', () => {
                    console.log(`[${context}]`, 'CSV file successfully processed');
                });
        } else {
            console.log(`[${context}] Error `, "No CSV file in evseGroups folder")
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function getSpecificEvseGroups(evseUid = null) {
    var context = "Function getSpecificEvseGroups";
    return new Promise(async (resolve, reject) => {
        try {
            let csvFile = fs.readdirSync(process.env.evseGroupsPath)[0]
            let returnData = []
            if (csvFile) {
                await fs.createReadStream(process.env.evseGroupsPath + csvFile)
                    .pipe(csv({ separator: ';' }))
                    .on('data', async (row) => {
                        if (evseUid !== null && evseUid !== undefined) {
                            if (row[process.env.csvEvseUidKey] === evseUid) {
                                evseGroup = row[process.env.csvGroupOfPointsKey].length !== 0 ? row[process.env.csvGroupOfPointsKey] : process.env.otherPointsEnum
                                returnData.push(evseGroup)
                            }
                        }
                    })
                    .on('end', () => {
                        console.log(`[${context}]`, 'CSV file successfully processed');
                        resolve(...returnData)
                    });
            } else {
                console.log(`[${context}] Error `, "No CSV file in evseGroups folder")
                resolve(...returnData)
            }

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(null)
        }
    })
}

async function buildServiceCost(charger, plug) {
    var context = "Function buildServiceCost";

    try {
        let countryCode = charger.countryCode
        let total_charging_time = 0.5; //Time in hours
        let sessionStartDate = moment.utc().format()
        let sessionStopDate = moment.utc(sessionStartDate).add(total_charging_time, 'hours').format()
        let total_energy = 50

        let data = {
            sessionStartDate,
            sessionStopDate,
            power: plug.power,
            total_energy: total_energy,
            total_charging_time: total_charging_time,
            total_parking_time: 0,
            countryCode,
            partyId: charger.partyId,
            source: charger.source,
            evseGroup: plug.evseGroup,
        }
        console.log(JSON.stringify(data, null, 2))

        // let { flat , energy , time , currency} = await getOpcTariffsPrices(data)
        // return {
        //     initialCost: flat.price,
        //     costByTime: [
        //         {
        //             minTime: 0,
        //             cost: time.label.value,
        //             uom: time.label.uom
        //         }
        //     ],
        //     costByPower: {
        //         cost: energy.label.value,
        //         uom: energy.label.uom
        //     },
        //     currency
        // }
        return {
            initialCost: -1,
            costByTime: [
                {
                    minTime: 0,
                    cost: -1,
                    uom: ""
                }
            ],
            costByPower: {
                cost: -1,
                uom: ""
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {
            initialCost: -1,
            costByTime: [
                {
                    minTime: 0,
                    cost: -1,
                    uom: ""
                }
            ],
            costByPower: {
                cost: -1,
                uom: ""
            }
        }
    }
}

function getOpcTariffsPrices(data) {
    var context = "Function getOpcTariffsPrices";
    return new Promise((resolve, reject) => {
        try {
            var serviceProxy = process.env.HostOcpi + process.env.PathGetOpcTariffsPrices;

            axios.post(serviceProxy, data)
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

async function updateServiceCostsOnGireve() {
    var context = "Function updateServiceCostsOnGireve";

    try {
        let query = {
            source: "Gireve"
        }
        let fields = {
            _id: 1,
            partyId: 1,
            source: 1,
            countryCode: 1,
            "plugs.power": 1,
            "plugs.evseGroup": 1,
            // "plugs.uid" : 1,
            "plugs._id": 1,
        }
        let total_charging_time = 0.5; //Time in hours
        let sessionStartDate = moment.utc(new Date().toISOString()).format()
        let sessionStopDate = moment.utc(sessionStartDate).add(total_charging_time, 'hours').format()
        let total_energy = 50
        let total_parking_time = 0
        let chargersFound = await Charger.find(query, fields).lean()
        if (chargersFound.length > 0) {
            console.log(`[!] Start of ${context} `)
            for (let charger of chargersFound) {
                let countryCode = charger.countryCode
                let source = charger.source
                let partyId = charger.partyId
                // let serviceCostValues = []
                for (let plug of charger.plugs) {
                    let power = plug.power
                    let evseGroup = plug.evseGroup
                    // let uid = plug.uid
                    let plug_id = plug._id
                    // Gireve Service Cost body 
                    let data = {
                        sessionStartDate,
                        sessionStopDate,
                        power,
                        total_energy,
                        total_charging_time,
                        total_parking_time,
                        countryCode,
                        partyId,
                        source,
                        evseGroup,
                    }
                    let { flat, energy, time, currency, total_cost } = await getOpcTariffsPrices(data)
                    let serviceCost = {
                        initialCost: flat.price,
                        costByTime: [
                            {
                                minTime: 0,
                                cost: time.label.value,
                                uom: time.label.uom
                            }
                        ],
                        costByPower: {
                            cost: energy.label.value,
                            uom: energy.label.uom
                        },
                        currency
                    }
                    // serviceCostValues.push({serviceCost , total_cost : total_cost.excl_vat})
                    await Charger.updateOne({ _id: charger._id, "plugs._id": plug_id }, { "plugs.$.serviceCost": serviceCost })
                }
                // let maxServiceCost = serviceCostValues.reduce((acc, i)=>(i.total_cost > acc.total_cost ? i : acc)).serviceCost
                // await Charger.updateOne({_id : charger._id } , {maxServiceCost})
            }
            console.log(`[!] Finished ${context} `)
        } else {
            console.error(`[${context}] No chargers were found `);
        }
        return true
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false
    }
}

function updateNewPlug(oldPlugs, plug) {
    var context = "Function updateNewPlug";
    try {
        let foundPlug = oldPlugs.find(oldPlug => (oldPlug.plugId === plug.plugId && oldPlug.uid === plug.uid))
        if (foundPlug) {
            return {
                ...plug,
                // serviceCost: foundPlug.serviceCost,
                evseGroup: foundPlug.evseGroup,
            }
        } else {
            return plug
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return plug
    }
}

async function addTariffOpc(plug) {
    var context = "Function addTariffOpc";
    try {
        let serviceCost = undefined
        if (plug.tariffId.length > 0) {
            let params = {
                tariffId: plug.tariffId[0]
            }
            serviceCost = await getTariffOPC(params)
        }
        return {
            ...plug,
            serviceCost
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return plug
    }
}
// Routine to update EVSE Group on chargers
/**
 * deprecated Since version 28. Will be deleted in version 31. Use xxx instead.
 */
//cron.schedule('0 0 * * *', () => {
//    parseCsvEvseGroups()
//});

// cron.schedule('0 5 * * *', () => {
//     updateServiceCostsOnGireve()
// });



async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await Charger.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ", result);
            };
        })

        await Charger.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ", result);
            };
        })

        let chargers = await Charger.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != chargers.length; i++) {
            if (chargers[i].address)
                if (chargers[i].address.country)
                    if (unicCountries.indexOf(chargers[i].address.country) == -1) {
                        unicCountries.push(chargers[i].address.country)
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
                await Charger.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
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
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

async function createTimeZones() {
    const context = "Function createTimeZones"
    try {

        const chargers = await Charger.find({ 'timeZone': { '$exists': false } }).lean()

        for (let i = 0; i != chargers.length; i++) {

            const timeZoneString =  timeZone.getTimezoneFromCoordinates(chargers[i].geometry.coordinates)
            const newValues = {"$set":  {"timeZone": timeZoneString}}

            const query = {_id: chargers[i]._id}

            await Charger.findOneAndUpdate(query, newValues)
        }




    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

module.exports = router;