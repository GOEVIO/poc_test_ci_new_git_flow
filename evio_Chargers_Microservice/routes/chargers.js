// Models
import Infrastructure from '../models/infrastructure';
import Charger from '../models/charger';
// Middlewares
import chargerMiddleware from '../middleware/chargerMiddleware';
import { ensureCountryCode, matchPriceComponent } from '../services/chargersServices';
import { OcpiTariffDimenstionType } from 'evio-library-commons';
import {
    verifyIfCoordinatesUpdate,
    isFlagChooseSearchCoordinatesActive,
    returnCoordinatesAccordingToFlag,
    returnCoordinatesAccordingToFlagMap,
    getGeoQueryAndFeatureFlag
} from '../utils/handleCoordinates'

const { captureException } = require('@sentry/node');
import toggle from 'evio-toggle'

require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const axios = require("axios");
const fs = require('fs')
const request = require('request')
const { StatusCodes } = require('http-status-codes');
const ChargingSession = require('../models/chargingSession');
// var NotifymeHistory = require('../models/notifymeHistory');
const QrCode = require('../models/qrCode');
const ChargersEvio = require('../models/chargersEvio');
const ManagementPOIs = require('../models/managementPOIs');
const { Console } = require('console');
const GeoTZ = require('geo-tz')
// Disable node-cron by mocking for an easy turn-back
// const cron = require('node-cron');
const cron = {
    schedule: () => ({
        start: () => { },
        stop: () => { },
        validate: () => { },
        status: '',
    })
};
const Comission = require('../handlers/comissionClient');
const ErrorHandler = require('../controllers/errorHandler');
const ChargersHandler = require('../controllers/chargersHandler');
const OperatorHandler = require('../controllers/operator');
const addressS = require("../services/address")
const { getCode, getName } = require('country-list');
const timeZone = require("../handlers/timeZoneHandler")
let moment = require('moment');
const { getOperators } = require('../utils/getOperators')
const { findOneGroupCSUser, findGroupCSUser, findGroupCSUserGroupMap } = require('evio-library-identity').default;

const ObjectId = require("mongoose").Types.ObjectId;
const ConfigsProxy = 'http://configs:3028';
const feesConfig = `${ConfigsProxy}/api/private/config/fees`;
const { notifyChargerAvailable } = require('evio-library-notifications').default;
const { Enums } = require('evio-library-commons').default;

const pendingStatusesStartSessions = [Enums.SessionStatusesNumberTypes.PENDING, Enums.SessionStatusesNumberTypes.PENDING_DELAY, Enums.SessionStatusesNumberTypes.PENDING_START];
const { hasValidCoordinates } = require('../utils/validationUtils')
const { getPlugStatusesByHwId } = require('../controllers/chargers.controller')

//========== POST ==========
//Create a new Charger
router.post('/api/private/chargers', async (req, res, next) => {
    var context = "POST /api/private/chargers";
    try {
        let charger = new Charger(req.body);
        const createUser = req.headers['userid'];
        const clientName = req.headers['clientname'];
        charger.createUser = createUser;
        charger.createdBy = createUser;
        charger.networks = chargerDefaultNetworks(charger.hwId)
        charger.availability = {
            availabilityType: process.env.ChargerAvailabilityAlways
        };
        charger.clientName = clientName;

        let chargerType;
        let network;

        if (charger?.geometry?.coordinates) {
            charger.timeZone = timeZone.getTimezoneFromCoordinates(charger.geometry.coordinates);

            if (hasValidCoordinates(charger?.geometry?.coordinates)) {
                charger.originalCoordinates = charger?.geometry
            }

        }

        if ((charger.defaultImage === undefined) || (charger.defaultImage === "")) {
            charger.defaultImage = "0";
        };

        if (await toggle.isEnable('charge-114') && charger.address && !charger.address.countryCode) {
            const { countryCode } = await ensureCountryCode({ country: charger.address.country }, context);
            charger.address.countryCode = countryCode;
        }

        switch (clientName) {

            case process.env.WhiteLabelGoCharge:
                if (charger.chargerType === process.env.EVIOBoxType || charger.chargerType === process.env.SonOFFType) {
                    chargerType = charger.chargerType;
                    network = process.env.NetworkGoCharge;
                } else {
                    chargerType = "011";
                    network = process.env.NetworkGoCharge;
                };
                break;
            case process.env.WhiteLabelHyundai:
                if (charger.chargerType === process.env.EVIOBoxType || charger.chargerType === process.env.SonOFFType) {
                    chargerType = charger.chargerType;
                    network = process.env.NetworkHyundai;
                } else {
                    chargerType = "012";
                    network = process.env.NetworkHyundai;
                };
                break;
            case process.env.WhiteLabelKLC:
                if (charger.chargerType === process.env.EVIOBoxType || charger.chargerType === process.env.SonOFFType) {
                    chargerType = charger.chargerType;
                    network = process.env.NetworkKLC;
                } else {
                    chargerType = process.env.chargerTypeKLC
                    network = process.env.NetworkKLC;
                };
                break;
            case process.env.WhiteLabelKinto:
                if (charger.chargerType === process.env.EVIOBoxType || charger.chargerType === process.env.SonOFFType) {
                    chargerType = charger.chargerType;
                    network = process.env.NetworkKinto;
                } else {
                    chargerType = process.env.chargerTypeKinto
                    network = process.env.NetworkKinto;
                };
                break;
            default:
                chargerType = "008";
                network = process.env.NetworkEVIO;
                break;

        };

        charger.chargerType = chargerType;
        charger.network = network;

        if (charger.chargerType === process.env.EVIOBoxType || charger.chargerType === process.env.SonOFFType)
            charger.operationalStatus = process.env.OperationalStatusApproved;
        else
            charger.operationalStatus = process.env.OperationalStatusWaitingAproval;

        //if(charger.chargerType)

        validateFields(charger)
            .then(() => {
                if ((req.body.imageContent != undefined) && (req.body.imageContent.length > 0)) {
                    saveImageContent(charger)
                        .then((value) => {
                            createCharger(charger, res);
                        })
                        .catch((error) => {
                            console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    createCharger(charger, res);
                };
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Run first time for chargers
router.post('/api/private/chargers/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/chargers/runFirstTime";
    try {

        //addTariffCharger();
        //offlineNotification();
        // upperCaseChargerConnectors();
        // updatePublicChargers();
        //addWrongBehaviorAttribute();
        //addOperationalStatus();
        //addClientName();
        //updateImageHistory();
        //updateAddOperator();
        //updateAddressModel();
        createTimeZones();

        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Run first time for chargers
router.post('/api/private/chargers/addWhitelistsToChargers', (req, res, next) => {
    const context = "POST /api/private/chargers/addWhitelistsToChargers";
    try {
        // Running async function, no need to wait
        ChargersHandler.forceUpdateWhiteLists()
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.post('/api/private/charges/allChargersToWhiteList', (req, res, next) => {
    var context = "POST /api/private/charges/allChargersToWhiteList";
    try {

        let conditions = [];

        if (req.body.userid) {
            conditions.push({
                createUser: req.body.userid,
                hasInfrastructure: true,
                operationalStatus: { $ne: process.env.OperationalStatusRemoved }
            })
        }

        if (req.body.accessType) {
            conditions.push({ accessType: req.body.accessType })
        }

        if (req.body.fleetId) {
            conditions.push({
                listOfFleets: {
                    $elemMatch: {
                        fleetId: req.body.fleetId
                    }
                }
            })
        }

        if (req.body.groupIds) {
            conditions.push(
                {
                    listOfGroups: {
                        $elemMatch: {
                            groupId: req.body.groupIds
                        }
                    }
                }
            )
        }

        if (conditions.length > 0) {
            var query = {
                $or: conditions
            };
            chargerFind(query)
                .then(async (chargersFound) => {
                    if (chargersFound.length != 0) {
                        return res.status(200).send(chargersFound);
                    }
                    else {
                        return res.status(200).send([]);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);

                });
        }
        else
            return res.status(200).send([]);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
//========== GET ==========
//Get to be used without being logged in, Get all charger reduce details
router.get('/api/public/chargers', async (req, res, next) => {
    const context = "GET /api/public/chargers";
    try {
        const clientName = req.headers['clientname'];

        let query = {
            /*$or: [
                {*/
            'accessType': process.env.ChargerAccessPublic
                /*},
                {
                    'accessType': process.env.ChargerAccessFreeCharge
                }
            ]*/,
            mapVisibility: true,
            hasInfrastructure: true,
            active: true,
            operationalStatus: process.env.OperationalStatusApproved
        };
        let tariffType;

        if (req.body) {
            if (req.body.tariffType) {
                tariffType = req.body.tariffType
                delete req.body.tariffType
            }
            Object.assign(query, req.body)
        };

        if (tariffType) {
            let temp;
            switch (tariffType) {
                case process.env.TARIFF_TYPE_POWER:

                    temp = {
                        'tariff.tariffType': process.env.TariffByPower,
                        'tariff.tariff.parkingDuringChargingAmount.value': { $eq: 0 }
                    }

                    Object.assign(query.plugs.$elemMatch, temp);

                    break;
                case process.env.TARIFF_TYPE_TIME:

                    if (query.plugs.$elemMatch.$or) {
                        ////console.log("1")
                        temp = {
                            $and: [
                                {
                                    $or: [
                                        { 'tariff.tariffType': process.env.TariffByTime },
                                        {
                                            'tariff.tariffType': process.env.TariffByPower,
                                            'tariff.tariff.parkingDuringChargingAmount.uom': 'min',
                                            'tariff.tariff.parkingDuringChargingAmount.value': { $gt: 0 }
                                        }
                                    ]
                                }
                            ]

                        };
                        let aux = { $or: query.plugs.$elemMatch.$or };

                        delete query.plugs.$elemMatch.$or

                        if (query.plugs.$elemMatch.$and) {
                            ////console.log("2")
                            let auxToAnd = query.plugs.$elemMatch.$and;

                            delete query.plugs.$elemMatch.$and

                            temp.$and.push(aux);

                            temp.$and = temp.$and.concat(auxToAnd);


                            Object.assign(query.plugs.$elemMatch, temp);

                        } else {
                            ////console.log("3")
                            //let aux = { $or: query.plugs.$elemMatch.$or };

                            //delete query.plugs.$elemMatch.$or
                            temp.$and.push(aux);
                            Object.assign(query.plugs.$elemMatch, temp);

                        };

                    } else {
                        ////console.log("4")
                        temp = {
                            $or: [
                                { 'tariff.tariffType': process.env.TariffByTime },
                                {
                                    'tariff.tariffType': process.env.TariffByPower,
                                    'tariff.tariff.parkingDuringChargingAmount.uom': 'min',
                                    'tariff.tariff.parkingDuringChargingAmount.value': { $gt: 0 }
                                }
                            ]
                        }


                        Object.assign(query.plugs.$elemMatch, temp);

                    }

                    break;
                default:
                    break;
            };
        };

        if (!req.query.lat)
            return res.status(400).send({ auth: false, code: "server_latitude_required", message: 'Latitude is required' });

        if (!req.query.lng)
            return res.status(400).send({ auth: false, code: "server_longitude_required", message: 'Longitude is required' });

        if (!req.query.distance)
            return res.status(400).send({ auth: false, code: "server_distance_required", message: 'Distance is required' });

        let fields = {
            _id: 1,
            hwId: 1,
            geometry: 1,
            status: 1,
            netStatus: 1,
            accessType: 1,
            address: 1,
            availability: 1,
            name: 1,
            plugs: 1,
            rating: 1,
            imageContent: 1,
            chargerType: 1,
            createUser: 1,
            defaultImage: 1,
            chargingDistance: 1,
            partyId: 1,
            network: 1,
            clientName: 1,
            numberOfSessions: 1,
            voltageLevel: 1,
            originalCoordinates: 1
        };

        const { queryGeoSearch, searchCoordinatesFlagActive } = await getGeoQueryAndFeatureFlag(req)

        if (req.body && req.body.stations) {

            if (req.body.stations.length === 1 && req.body.stations.includes(process.env.StationsTesla)) {
                return res.status(200).send([]);
            };
            ////console.log("1")

            let networks = req.body.stations;
            delete req.body.stations;
            delete req.body.tariffType

            let listOfChargers = [];

            Promise.all(
                networks.map(network => {
                    return new Promise(async (resolve, reject) => {

                        let queryFilter = {
                            mapVisibility: true,
                            hasInfrastructure: true,
                            active: true,
                            operationalStatus: process.env.OperationalStatusApproved
                        };
                        Object.assign(queryFilter, req.body);

                        if (tariffType) {
                            let temp;
                            switch (tariffType) {
                                case process.env.TARIFF_TYPE_POWER:

                                    temp = {
                                        'tariff.tariffType': process.env.TariffByPower,
                                        'tariff.tariff.parkingDuringChargingAmount.value': { $eq: 0 }
                                    }

                                    Object.assign(queryFilter.plugs.$elemMatch, temp);

                                    break;
                                case process.env.TARIFF_TYPE_TIME:

                                    if (queryFilter.plugs.$elemMatch.$or) {
                                        ////console.log("1")
                                        temp = {
                                            $and: [
                                                {
                                                    $or: [
                                                        { 'tariff.tariffType': process.env.TariffByTime },
                                                        {
                                                            'tariff.tariffType': process.env.TariffByPower,
                                                            'tariff.tariff.parkingDuringChargingAmount.uom': 'min',
                                                            'tariff.tariff.parkingDuringChargingAmount.value': { $gt: 0 }
                                                        }
                                                    ]
                                                }
                                            ]

                                        };
                                        let aux = { $or: queryFilter.plugs.$elemMatch.$or };

                                        delete queryFilter.plugs.$elemMatch.$or

                                        if (queryFilter.plugs.$elemMatch.$and) {
                                            //console.log("2")
                                            let auxToAnd = queryFilter.plugs.$elemMatch.$and;

                                            delete queryFilter.plugs.$elemMatch.$and

                                            temp.$and.push(aux);

                                            temp.$and = temp.$and.concat(auxToAnd);


                                            Object.assign(queryFilter.plugs.$elemMatch, temp);

                                        } else {
                                            //console.log("3")
                                            //let aux = { $or: query.plugs.$elemMatch.$or };

                                            //delete query.plugs.$elemMatch.$or
                                            temp.$and.push(aux);
                                            Object.assign(queryFilter.plugs.$elemMatch, temp);

                                        };

                                    } else {
                                        //console.log("4")
                                        temp = {
                                            $or: [
                                                { 'tariff.tariffType': process.env.TariffByTime },
                                                {
                                                    'tariff.tariffType': process.env.TariffByPower,
                                                    'tariff.tariff.parkingDuringChargingAmount.uom': 'min',
                                                    'tariff.tariff.parkingDuringChargingAmount.value': { $gt: 0 }
                                                }
                                            ]
                                        }


                                        Object.assign(queryFilter.plugs.$elemMatch, temp);

                                    }

                                    break;
                                default:
                                    break;
                            };
                        };

                        //console.log("query", query);
                        //console.log(" network", network);

                        switch (network) {
                            case process.env.StationsPrivate:
                                resolve(true);
                                break;

                            case process.env.StationsEVIO:

                                queryFilter.clientName = "EVIO";

                                queryFilter.$or = [
                                    {
                                        'accessType': process.env.ChargerAccessPublic
                                    }/*,
                                    {
                                        'accessType': process.env.ChargerAccessFreeCharge
                                    }*/
                                ]

                                let listEVIO = await Charger.find(queryGeoSearch, fields).find(queryFilter);

                                if (listEVIO.length > 0) {
                                    listOfChargers = listOfChargers.concat(listEVIO);
                                };

                                resolve(true);
                                break;

                            case process.env.StationsGoCharge:


                                //console.log(" process.env.StationsGoCharge", process.env.StationsGoCharge);

                                queryFilter = {
                                    /*$or: [
                 {*/
                                    'accessType': process.env.ChargerAccessPublic
            /*},
            {
                'accessType': process.env.ChargerAccessFreeCharge
            }
        ]*/,
                                    mapVisibility: true,
                                    hasInfrastructure: true,
                                    active: true,
                                    operationalStatus: process.env.OperationalStatusApproved
                                };



                                queryFilter.clientName = process.env.WhiteLabelGoCharge;

                                //console.log("query", query);

                                let listGoCharge = await Charger.find(queryGeoSearch, fields).find(queryFilter);

                                //console.log("listGoCharge.length", listGoCharge.length);
                                if (listGoCharge.length > 0) {
                                    listOfChargers = listOfChargers.concat(listGoCharge);

                                    //console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;
                            case process.env.StationsKlc:


                                //console.log(" process.env.StationsGoCharge", process.env.StationsGoCharge);

                                queryFilter = {
                                    /*$or: [
                    {*/
                                    'accessType': process.env.ChargerAccessPublic
            /*},
            {
                'accessType': process.env.ChargerAccessFreeCharge
            }
        ]*/,
                                    mapVisibility: true,
                                    hasInfrastructure: true,
                                    active: true,
                                    operationalStatus: process.env.OperationalStatusApproved
                                };



                                queryFilter.clientName = process.env.WhiteLabelKLC;

                                //console.log("query", query);

                                let listKLC = await Charger.find(queryGeoSearch, fields).find(queryFilter);

                                //console.log("listKLC.length", listKLC.length);
                                if (listKLC.length > 0) {
                                    listOfChargers = listOfChargers.concat(listKLC);

                                    //console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;

                            case process.env.StationsHyundai:

                                queryFilter = {
                                    /*$or: [
                {*/
                                    'accessType': process.env.ChargerAccessPublic
            /*},
            {
                'accessType': process.env.ChargerAccessFreeCharge
            }
        ]*/,
                                    mapVisibility: true,
                                    hasInfrastructure: true,
                                    active: true,
                                    operationalStatus: process.env.OperationalStatusApproved
                                };

                                queryFilter.clientName = process.env.WhiteLabelHyundai;
                                let listHyundai = await Charger.find(queryGeoSearch, fields).find(queryFilter);

                                //console.log("listHyundai.length", listHyundai.length);
                                if (listHyundai.length > 0) {
                                    listOfChargers = listOfChargers.concat(listHyundai);

                                    //console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;
                            case process.env.StationsKinto:


                                //console.log(" process.env.StationsGoCharge", process.env.StationsGoCharge);

                                queryFilter = {
                                    /*$or: [
                    {*/
                                    'accessType': process.env.ChargerAccessPublic
            /*},
            {
                'accessType': process.env.ChargerAccessFreeCharge
            }
        ]*/,
                                    mapVisibility: true,
                                    hasInfrastructure: true,
                                    active: true,
                                    operationalStatus: process.env.OperationalStatusApproved
                                };



                                queryFilter.clientName = process.env.WhiteLabelKinto;

                                //console.log("query", query);

                                let listKinto = await Charger.find(queryGeoSearch, fields).find(queryFilter);

                                //console.log("listKinto.length", listKinto.length);
                                if (listKinto.length > 0) {
                                    listOfChargers = listOfChargers.concat(listKinto);

                                    //console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;
                            case process.env.StationsPublic:

                                switch (clientName) {
                                    case process.env.WhiteLabelGoCharge:

                                        queryFilter.$and = [
                                            {
                                                $or: [
                                                    {
                                                        clientName: process.env.WhiteLabelHyundai
                                                    }
                                                ]
                                            },
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    case process.env.WhiteLabelHyundai:

                                        queryFilter.$and = [
                                            {
                                                $or: [
                                                    {
                                                        clientName: process.env.WhiteLabelGoCharge
                                                    }
                                                ]
                                            },
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    case process.env.WhiteLabelKLC:

                                        queryFilter.$and = [
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    case process.env.WhiteLabelKinto:

                                        queryFilter.$and = [
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    default:

                                        queryFilter.$and = [
                                            {
                                                $or: [
                                                    {
                                                        clientName: process.env.WhiteLabelGoCharge
                                                    },
                                                    {
                                                        clientName: process.env.WhiteLabelHyundai
                                                    },
                                                    {
                                                        clientName: process.env.WhiteLabelKLC
                                                    },
                                                    {
                                                        clientName: process.env.WhiteLabelKinto
                                                    },
                                                ]
                                            },
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                };

                                let listPublic = await Charger.find(queryGeoSearch, fields).find(queryFilter);

                                if (listPublic.length > 0) {
                                    listOfChargers = listOfChargers.concat(listPublic);
                                };
                                resolve(true);
                                break;

                            case process.env.StationsShared:

                                resolve(true);
                                break;

                            default:
                                resolve(true);
                                break;
                        };
                    })
                })
            ).then(() => {
                //console.log("listOfChargers.legth", listOfChargers.length);
                if (listOfChargers.length === 0) {
                    return res.status(200).send(listOfChargers);
                } else {

                    let responseList = removeDuplicates(listOfChargers, searchCoordinatesFlagActive);
                    //console.log("responseList.legth", responseList.length);
                    return res.status(200).send(responseList);

                }
            }).catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });


        } else {

            //console.log("2")
            Charger.find(queryGeoSearch, fields).find(query, (error, chargersFound) => {
                if (error) {
                    console.error(`[${context}][find] Error `, error.message);
                    return res.status(500).send(error.message);
                };

                if (chargersFound.length === 0) {
                    return res.status(200).send(chargersFound);
                } else {
                    availabilityChargers(chargersFound, searchCoordinatesFlagActive)
                        .then(chargersFound => {

                            return res.status(200).send(chargersFound);

                        })
                        .catch(error => {

                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);

                        });
                };

            });
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get to be used without being logged in, operations management
router.get('/api/public/chargers/opm', async (req, res, next) => {
    var context = "GET /api/public/chargers/opm";
    try {
        var query = {
            hasInfrastructure: true,
            active: true
        };
        if (req.body) {
            Object.assign(query, req.body)
        };
        if (!req.query.lat)
            return res.status(400).send({ auth: false, code: "server_latitude_required", message: 'Latitude is required' });

        if (!req.query.lng)
            return res.status(400).send({ auth: false, code: "server_longitude_required", message: 'Longitude is required' });

        if (!req.query.distance)
            return res.status(400).send({ auth: false, code: "server_distance_required", message: 'Distance is required' });

        const { queryGeoSearch, searchCoordinatesFlagActive } = await getGeoQueryAndFeatureFlag(req)
        Charger.find(queryGeoSearch).find(query, (error, chargersFound) => {
            if (error) {
                console.error(`[${context}][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                if (typeof chargersFound === 'undefined' || chargersFound.length <= 0) {
                    //return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    return res.status(200).send(chargersFound);
                }
                else {
                    var newListOfChargers = [];
                    const getImage = (charger) => {
                        charger = JSON.parse(JSON.stringify(charger));
                        charger.geometry = returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive);
                        return new Promise((resolve, reject) => {
                            const updatePlug = (plug) => {
                                return new Promise(async (resolve, reject) => {
                                    let tariff = await getTariffs(plug.tariff);
                                    plug.tariff = tariff;
                                    resolve(true);
                                });
                            };
                            Promise.all(
                                charger.plugs.map(plug => updatePlug(plug))
                            ).then(() => {
                                /*
                                if (charger.imageContent.length != 0) {
                                    charger.imageContent = charger.imageContent[0];
                                };
                                */
                                if (charger.listOfGroups.length == 0) {

                                    newListOfChargers.push(charger);
                                    resolve(true);
                                }
                                else {
                                    getListOfGroups(charger)
                                        .then((charger) => {
                                            newListOfChargers.push(charger);
                                            resolve(true);
                                        });
                                };
                            }).catch((error) => {
                                console.error(`[${context}][map][.catch] Error `, error.message);
                                resolve(false);
                            });
                        });
                    };
                    Promise.all(
                        chargersFound.map(charger => getImage(charger))
                    ).then(() => {
                        newListOfChargers.sort((a, b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0));
                        return res.status(200).send(newListOfChargers);
                    });
                    /*
                    chargersFound.sort((a, b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0));
                    return res.status(200).send(chargersFound);
                    */
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all Chargers or charger by ID
router.get('/api/private/chargers', async (req, res, next) => {
    var context = "GET /api/private/chargers";
    try {
        const filter = {};
        var userId = req.headers['userid'];

        if (req.query) {
            filter.query = req.query;
        };

        filter.query.hasInfrastructure = true;
        filter.query.active = true;
        filter.query.operationalStatus = { $ne: process.env.OperationalStatusRemoved }

        Charger.find(filter.query, (err, chargers) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {
                if (chargers.length == 0) {
                    //return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    return res.status(200).send([]);
                }
                else {
                    var listOfChargers = [];
                    chargers = JSON.parse(JSON.stringify(chargers));
                    Promise.all(
                        chargers.map(charger => {
                            return new Promise((resolve, reject) => {

                                if (charger.listOfGroups.length == 0) {
                                    listOfChargers.push(charger);
                                    resolve(true);
                                }
                                else {
                                    getListOfGroups(charger)
                                        .then((charger) => {
                                            listOfChargers.push(charger);
                                            resolve(true);
                                        });
                                };

                            });
                        })
                    ).then((result) => {
                        return res.status(200).send(listOfChargers);
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all Chargers, even inactive or no longer operational chargers
router.get('/api/private/chargers/all', (req, res, next) => {
    var context = "GET /api/private/chargers/all";
    try {
        const filter = {};

        if (req.query) {
            filter.query = req.query;
        };

        Charger.find(filter.query, (err, chargers) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(chargers);
            }
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger details for public use
router.get('/api/public/chargers/details', (req, res, next) => {
    var context = "GET /api/public/chargers/details";
    try {

        var query = req.query;
        query.active = true;
        query.hasInfrastructure = true;
        query.operationalStatus = { $ne: process.env.OperationalStatusRemoved }

        if (Object.keys(query).length == 0) {
            return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
        }
        else {
            Charger.findOne(query, async (err, chargerFound) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);;
                    return res.status(500).send(err.message);
                } else {
                    if (chargerFound) {
                        const { operator, operatorContact, operatorEmail } = await getOperators(chargerFound);
                        const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();

                        chargerFound.operatorContact = operatorContact;
                        chargerFound.operatorEmail = operatorEmail;
                        chargerFound.operator = operator;

                        chargerFound.geometry = returnCoordinatesAccordingToFlag(chargerFound, searchCoordinatesFlagActive);

                        getTariffPlug(chargerFound)
                            .then((chargerFound) => {
                                var query = {
                                    chargerId: chargerFound._id
                                };
                                getPOIsByCharger(query, chargerFound.geometry, chargerFound.hwId)
                                    .then((result) => {
                                        chargerFound.POIs = result;
                                        getFees(chargerFound)
                                            .then((feesFound) => {
                                                //chargerFound.feeds = feesFound;
                                                chargerFound.fees = feesFound;
                                                return res.status(200).send(chargerFound);
                                            });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][getPOIsByCharger] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                            })
                            .catch((error) => {
                                console.error(`[${context}][getTariffPlug] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else
                        return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger details for private use
router.get('/api/private/chargers/details', (req, res, next) => {
    const context = "GET /api/private/chargers/details";
    try {
        const query = req.query;

        const userId = req.headers['userid'];

        query.hasInfrastructure = true;
        query.operationalStatus = { $ne: process.env.OperationalStatusRemoved }

        if (Object.keys(query).length == 0) {
            return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
        }
        else {
            chargerFindOne(query)
                .then(async (chargerFound) => {
                    if (chargerFound) {

                        chargerFound = JSON.parse(JSON.stringify(chargerFound));
                        const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
                        chargerFound.geometry = returnCoordinatesAccordingToFlag(chargerFound, searchCoordinatesFlagActive);

                        const query = {
                            chargerId: chargerFound._id
                        };

                        // if (chargerFound.listOfGroups.length > 0) {
                        //     let listOfGroups = await getGroupsCSUsers(chargerFound.listOfGroups);
                        //     chargerFound.listOfGroups = listOfGroups;
                        // };

                        if (chargerFound.listOfGroups.length > 0) {
                            // let listOfGroups = await getGroupsCSUsers(chargerFound.listOfGroups);
                            let listOfGroups = await getGroupsCSUsersListIds(chargerFound.listOfGroups);
                            // console.log(JSON.stringify(listOfGroups))
                            chargerFound.listOfGroups = listOfGroups;
                        };


                        // if (chargerFound.listOfFleets.length > 0) {
                        //     let listOfFleets = await getFleetsGroup(chargerFound.listOfFleets);
                        //     chargerFound.listOfFleets = listOfFleets;
                        // };

                        if (chargerFound.listOfFleets.length > 0) {
                            let listOfFleets = await getFleetsGroupListIds(chargerFound.listOfFleets);
                            chargerFound.listOfFleets = listOfFleets;
                        };

                        let POIs = await getPOIsByCharger(query, chargerFound.geometry, chargerFound.hwId);
                        let fees = await getFees(chargerFound);


                        const { operator, operatorContact, operatorEmail } = await getOperators(chargerFound);

                        chargerFound.operatorContact = operatorContact;
                        chargerFound.operatorEmail = operatorEmail;
                        chargerFound.operator = operator;

                        const updatePlug = (plug) => {
                            return new Promise(async (resolve, reject) => {

                                //console.log("userId 1", userId);
                                let data = {
                                    plugId: plug.plugId,
                                    userId: userId
                                };

                                //console.log("userId 2", userId);
                                // let tariff = await getTariffs(plug.tariff);
                                let host = process.env.HostBooking + process.env.PathGetAutomaticBooking;
                                /*axios.get(host, { data })
                                    .then((values) => {
                                if (values.data)
                                    plug.canBeAutomaticallyBooked = false;
                                else
                                    plug.canBeAutomaticallyBooked = true;
                                    */
                                //TODO Booking
                                plug.canBeAutomaticallyBooked = false;

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

                                //console.log("userId 3", userId);
                                // plug.tariff = tariff;
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

                                        // console.log("value", value);
                                        if (!value) {
                                            // console.log("1 can be notify");
                                            plug.canBeNotified = value;
                                            resolve(true);
                                        }
                                        else {
                                            //plug.canBeNotified = value;

                                            //console.log("userId 4", userId);
                                            let query = {
                                                $and: [
                                                    { hwId: chargerFound.hwId },
                                                    { plugId: plug.plugId },
                                                    { userId: userId },
                                                    { status: process.env.SessionStatusRunning }
                                                ]
                                            }

                                            //console.log("userId 5", userId);
                                            //console.log("2 query", query);
                                            ChargingSession.findOne(query, (err, result) => {
                                                if (err) {
                                                    console.error(`[${context}][ChargingSession.findOne] Error `, err.message);;
                                                    reject(err);
                                                }
                                                else {

                                                    // console.log("3 result", result);
                                                    if (result) {
                                                        plug.canBeNotified = false;
                                                        resolve(true);
                                                    }
                                                    else {
                                                        plug.canBeNotified = true;
                                                        resolve(true);
                                                    };
                                                };
                                            });
                                        };
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][verifyNotifymeHistory][.catch] Error `, error.message);
                                        reject(error);
                                    });
                                /*})
                                .catch((error) => {
                                    console.error(`[${context}][axios.get][.catch] Error `, error.message);
                                    reject(error);
                                });*/
                            });
                        };
                        Promise.all(
                            chargerFound.plugs.map(plug => updatePlug(plug))
                        ).then((value) => {
                            chargerFound.bookings = [];
                            chargerFound.POIs = POIs;
                            //chargerFound.feeds = feeds;
                            chargerFound.fees = fees;
                            return res.status(200).send(chargerFound);
                        }).catch((error) => {
                            console.error(`[${context}][map][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });

                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][chargerFindOne] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger details for private use
router.get('/api/private/chargers/details_new', (req, res, next) => {
    var context = "GET /api/private/chargers/details_new";
    try {

        var query = req.query;
        var userId = req.headers['userid'];

        query.active = true;
        query.hasInfrastructure = true;
        query.operationalStatus = { $ne: process.env.OperationalStatusRemoved }

        if (Object.keys(query).length == 0) {
            return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
        }
        else {

            chargerFindOne(query)
                .then(async (chargerFound) => {
                    if (chargerFound) {
                        chargerFound = JSON.parse(JSON.stringify(chargerFound));

                        var query = {
                            chargerId: chargerFound._id
                        };

                        if (chargerFound.listOfGroups.length > 0) {
                            let listOfGroups = await getGroupsCSUsers(chargerFound.listOfGroups);
                            chargerFound.listOfGroups = listOfGroups;
                        };

                        if (chargerFound.listOfFleets.length > 0) {
                            let listOfFleets = await getFleetsGroup(chargerFound.listOfFleets);
                            chargerFound.listOfFleets = listOfFleets;
                        };

                        let bookings = await getBooking(chargerFound);
                        let POIs = await getPOIsByCharger(query, chargerFound.geometry, chargerFound.hwId);
                        let fees = await getFees(chargerFound);


                        const { operator, operatorContact, operatorEmail } = await getOperators(chargerFound);

                        chargerFound.operatorContact = operatorContact;
                        chargerFound.operatorEmail = operatorEmail;
                        chargerFound.operator = operator;

                        const updatePlug = (plug) => {
                            return new Promise(async (resolve, reject) => {
                                /*var data = {
                                    plugId: plug.plugId,
                                    userId: userId
                                };*/

                                //var host = process.env.HostBooking + process.env.PathGetAutomaticBooking;
                                /*axios.get(host, { data })
                                    .then((values) => {
                                if (values.data)
                                    plug.canBeAutomaticallyBooked = false;
                                else
                                    plug.canBeAutomaticallyBooked = true;
                                    */
                                //TODO Booking

                                let tariff = await getGroups(plug.tariff);
                                plug.canBeAutomaticallyBooked = false;

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
                                plug.tariff = tariff;

                                verifyNotifymeHistory(find)
                                    .then((value) => {
                                        if (!value) {
                                            plug.canBeNotified = value;
                                            resolve(true);
                                        }
                                        else {
                                            plug.canBeNotified = value;
                                            var query = {
                                                $and: [
                                                    { plugId: plug.plugId },
                                                    { userId: userId },
                                                    { status: process.env.SessionStatusRunning }
                                                ]
                                            }
                                            ChargingSession.findOne(query, (err, result) => {
                                                if (err) {
                                                    console.error(`[${context}][ChargingSession.findOne] Error `, err.message);;
                                                    reject(err);
                                                }
                                                else {
                                                    if (result) {
                                                        plug.canBeNotified = false;
                                                        resolve(true);
                                                    }
                                                    else {
                                                        plug.canBeNotified = true;
                                                        resolve(true);
                                                    };
                                                };
                                            });
                                        };
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][verifyNotifymeHistory][.catch] Error `, error.message);
                                        reject(error);
                                    });
                                /*})
                                .catch((error) => {
                                    console.error(`[${context}][axios.get][.catch] Error `, error.message);
                                    reject(error);
                                });*/
                            });
                        };

                        Promise.all(
                            chargerFound.plugs.map(plug => updatePlug(plug))
                        ).then((value) => {
                            chargerFound.bookings = bookings;
                            chargerFound.POIs = POIs;
                            chargerFound.fees = fees;
                            return res.status(200).send(chargerFound);
                        }).catch((error) => {

                            console.error(`[${context}][map][.catch] Error `, error.message);
                            return res.status(500).send(error.message);

                        });
                    }
                    else {
                        return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    };

                })
                .catch((error) => {

                    console.error(`[${context}][chargerFindOne] Error `, error.message);
                    return res.status(500).send(error.message);

                });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get for charger status
router.get('/api/private/chargers/status', (req, res, next) => {
    var context = "GET /api/private/chargers/status";
    try {

        var query = {

            hwId: req.query.hwId,
            hasInfrastructure: true,
            operationalStatus: { $ne: process.env.OperationalStatusRemoved }
        }

        Charger.find(query, (err, charger) => {

            if (err) {
                console.error(`[${context}][find] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {
                if (charger)
                    return res.status(200).send({ charger });
                else
                    return res.status(200).send({ auth: true, code: 'server_request_dont_found', message: "Request don't found" })
            }
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/:hwId/plugs/status', getPlugStatusesByHwId);

//Get charger Private for map, operations management
router.get('/api/private/chargers/opm', async (req, res, next) => {
    const context = "GET /api/private/chargers/opm";

    try {
        var query = {
            hasInfrastructure: true
        };
        if (req.body) {
            Object.assign(query, req.body)
        };

        if (!req.query.lat)
            return res.status(400).send({ auth: false, code: "server_latitude_required", message: 'Latitude is required' });

        if (!req.query.lng)
            return res.status(400).send({ auth: false, code: "server_longitude_required", message: 'Longitude is required' });

        if (!req.query.distance)
            return res.status(400).send({ auth: false, code: "server_distance_required", message: 'Distance is required' });

        const { queryGeoSearch, searchCoordinatesFlagActive } = await getGeoQueryAndFeatureFlag(req)

        Charger.find(queryGeoSearch).find(query, (error, chargersFound) => {
            if (error) {
                console.error(`[${context}][find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                if (typeof chargersFound === 'undefined' || chargersFound.length <= 0) {

                    //return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                    return res.status(200).send(chargersFound);
                }
                else {
                    var newListOfChargers = [];
                    const getImage = (charger) => {
                        charger = JSON.parse(JSON.stringify(charger));
                        charger.geometry = returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive);
                        return new Promise((resolve, reject) => {
                            const updatePlug = (plug) => {
                                return new Promise(async (resolve, reject) => {
                                    let tariff = await getTariffs(plug.tariff);
                                    plug.tariff = tariff;
                                    resolve(true);
                                });
                            };
                            Promise.all(
                                charger.plugs.map(plug => updatePlug(plug))
                            ).then(() => {
                                /*
                                if (charger.imageContent.length != 0) {
                                    charger.imageContent = charger.imageContent[0];
                                };
                                */
                                if (charger.listOfGroups.length == 0) {

                                    newListOfChargers.push(charger);
                                    resolve(true);
                                }
                                else {
                                    getListOfGroups(charger)
                                        .then((charger) => {
                                            newListOfChargers.push(charger);
                                            resolve(true);
                                        });
                                };
                            }).catch((error) => {
                                console.error(`[${context}][map][.catch] Error `, error.message);
                                resolve(false);
                            });
                        });
                    };
                    Promise.all(
                        chargersFound.map(charger => getImage(charger))
                    ).then(() => {
                        newListOfChargers.sort((a, b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0));
                        return res.status(200).send(newListOfChargers);
                    });
                    /*
                    chargers.sort((a, b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0));
                    return res.status(200).send(chargers);
                    */
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger Private for map
//deprecated
/**
 * @deprecated Since version 28. Will be deleted in version 31. Use xxx instead.
 */
router.get('/api/private/chargers/map_old', async (req, res, next) => {
    var context = "GET /api/private/chargers/map_old";
    try {
        var userId = req.headers['userid'];

        //let groups = await getGroupsCSUsersMap(userId);
        let groups = await getGroupsMap(userId);
        let fleets = await getEVsMap(userId, groups.groupDrivers);
        //let fleets = await getFleetsMap(userId);

        var query;

        let result = new Promise((resolve, reject) => {

            if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                query = {
                    $or: [
                        {
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },
                        { createUser: userId }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                query = {
                    $or: [
                        {
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },
                        { createUser: userId },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                query = {
                    $or: [
                        {
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },
                        { createUser: userId },
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else {

                query = {
                    $or: [
                        {
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },
                        { createUser: userId },
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            };

        });

        Promise.all([result])
            .then(() => {

                if (req.body) {
                    Object.assign(query, req.body)
                };

                //console.log("query", query);

                var fields = {
                    _id: 1,
                    hwId: 1,
                    geometry: 1,
                    status: 1,
                    netStatus: 1,
                    accessType: 1,
                    address: 1,
                    availability: 1,
                    name: 1,
                    plugs: 1,
                    rating: 1,
                    imageContent: 1,
                    chargerType: 1,
                    createUser: 1,
                    listOfGroups: 1,
                    defaultImage: 1,
                    chargingDistance: 1,
                    network: 1,
                    partyId: 1,
                    clientName: 1,
                    numberOfSessions: 1,
                    voltageLevel: 1
                };

                Charger.find({
                    'geometry': {
                        $near: {
                            $maxDistance: req.query.distance,
                            $geometry: {
                                type: "Point",
                                coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                            }
                        }
                    }
                }, fields).find(query, (error, chargersFound) => {
                    if (error) {
                        console.error(`[${context}][.then][find] Error `, error.message);
                        return res.status(500).send(error.message);
                    }
                    else {
                        //console.log("Chargers response: " + userId + " - " + new Date());

                        //console.log("chargersFound", chargersFound.length)
                        return res.status(200).send(chargersFound);

                    };
                });

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//deprecated
/**
 * @deprecated Since version 28. Will be deleted in version 31. Use xxx instead.
 */
router.get('/api/private/chargers/map_old2', async (req, res, next) => {
    var context = "GET /api/private/chargers/map_old2";
    try {
        var userId = req.headers['userid'];

        //let groups = await getGroupsCSUsersMap(userId);
        let groups = await getGroupsMap(userId);
        let fleets = await getEVsMap(userId, groups.groupDrivers);
        //let fleets = await getFleetsMap(userId);

        var query;

        let result = new Promise((resolve, reject) => {

            if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                query = {
                    $or: [
                        /*{
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },*/
                        { createUser: userId }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                query = {
                    $or: [
                        /*{
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },*/
                        { createUser: userId },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                query = {
                    $or: [
                        /*{
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },*/
                        { createUser: userId },
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else {

                query = {
                    $or: [
                        /*{
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },*/
                        { createUser: userId },
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            };

        });

        Promise.all([result])
            .then(() => {

                let chargers = new Promise((resolve, reject) => {
                    if (req.body) {
                        Object.assign(query, req.body)
                    };

                    var fields = {
                        _id: 1,
                        hwId: 1,
                        geometry: 1,
                        status: 1,
                        netStatus: 1,
                        accessType: 1,
                        address: 1,
                        availability: 1,
                        name: 1,
                        plugs: 1,
                        rating: 1,
                        imageContent: 1,
                        chargerType: 1,
                        createUser: 1,
                        listOfGroups: 1,
                        defaultImage: 1,
                        chargingDistance: 1,
                        network: 1,
                        partyId: 1,
                        clientName: 1,
                        numberOfSessions: 1,
                        voltageLevel: 1
                    };

                    Charger.find({
                        'geometry': {
                            $near: {
                                $maxDistance: req.query.distance,
                                $geometry: {
                                    type: "Point",
                                    coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                                }
                            }
                        }
                    }, fields).find(query, (error, chargersFound) => {
                        if (error) {
                            console.error(`[${context}][.then][find] Error `, error.message);
                            resolve([]);
                            //return res.status(500).send(error.message);
                        }
                        else {
                            //console.log("Chargers response: " + userId + " - " + new Date());
                            //return res.status(200).send(chargersFound);
                            resolve(chargersFound);
                        };
                    });

                });

                let chargersPublic = new Promise((resolve, reject) => {

                    let queryPublic = {
                        /*$or: [
                {*/
                        'accessType': process.env.ChargerAccessPublic
            /*},
            {
                'accessType': process.env.ChargerAccessFreeCharge
            }
        ]*/,
                        mapVisibility: true,
                        hasInfrastructure: true,
                        active: true,
                        operationalStatus: process.env.OperationalStatusApproved
                    };

                    if (req.body) {

                        if (req.body.$or) {

                            let body = JSON.parse(JSON.stringify(req.body));
                            let temp = body.$or;
                            let temp2 = queryPublic.$or;
                            delete body.$or;
                            delete queryPublic.$or;

                            queryPublic.$and = [
                                { $or: temp2 },
                                { $or: temp }
                            ];

                            Object.assign(queryPublic, body)

                        } else {

                            Object.assign(queryPublic, req.body)

                        };
                    };


                    //console.log("queryPublic", queryPublic);

                    var fields = {
                        _id: 1,
                        hwId: 1,
                        geometry: 1,
                        status: 1,
                        netStatus: 1,
                        accessType: 1,
                        address: 1,
                        availability: 1,
                        name: 1,
                        plugs: 1,
                        rating: 1,
                        imageContent: 1,
                        chargerType: 1,
                        createUser: 1,
                        listOfGroups: 1,
                        defaultImage: 1,
                        chargingDistance: 1,
                        network: 1,
                        partyId: 1,
                        clientName: 1,
                        numberOfSessions: 1,
                        voltageLevel: 1
                    };

                    Charger.find({
                        'geometry': {
                            $near: {
                                $maxDistance: req.query.distance,
                                $geometry: {
                                    type: "Point",
                                    coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                                }
                            }
                        }
                    }, fields).find(queryPublic, (error, chargersFound) => {
                        if (error) {
                            console.error(`[${context}][.then][find] Error `, error.message);
                            resolve([]);
                            //return res.status(500).send(error.message);
                        }
                        else {
                            //Chargers response: " + userId + " - " + new Date());
                            //return res.status(200).send(chargersFound);
                            if (chargersFound.length === 0) {

                                resolve(chargersFound);

                            } else {


                                //console.log("chargersFound", chargersFound.length)
                                availabilityChargers(chargersFound)
                                    .then(chargersFound => {

                                        resolve(chargersFound);

                                    })
                                    .catch(error => {

                                        console.error(`[${context}] Error `, error.message);
                                        resolve([]);

                                    });

                            };
                        };
                    });

                });

                Promise.all([chargers, chargersPublic])
                    .then((response) => {

                        let otherChargers = response[0];
                        let publicChargers = response[1];

                        //console.log("otherChargers", otherChargers.length)
                        //console.log("publicChargers", publicChargers.length)

                        //var newListOfChargers = otherChargers.concat(publicChargers);
                        compareChargers(otherChargers, publicChargers)
                            .then((newListOfChargers) => {
                                //console.log("newListOfChargers", newListOfChargers.length)
                                return res.status(200).send(newListOfChargers);
                            })
                            .catch((error) => {

                                console.error(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);

                            });

                    })
                    .catch((error) => {

                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);

                    });


            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger Private for map
router.get('/api/private/chargers/map', async (req, res, next) => {
    const context = "GET /api/private/chargers/map";
    try {
        const userId = req.headers['userid'];
        const clientName = req.headers['clientname'];
        const filter = req.body;
        let tariffType;

        //let groups = await getGroupsCSUsersMap(userId);
        let groups = await getGroupsMap(userId);
        let fleets = await getEVsMap(userId, groups.groupDrivers);

        if (filter) {
            if (filter.tariffType) {
                tariffType = filter.tariffType
            }
        }

        let fields = {
            _id: 1,
            hwId: 1,
            geometry: 1,
            status: 1,
            netStatus: 1,
            accessType: 1,
            address: 1,
            availability: 1,
            name: 1,
            plugs: 1,
            rating: 1,
            imageContent: 1,
            chargerType: 1,
            createUser: 1,
            listOfGroups: 1,
            listOfFleets: 1,
            defaultImage: 1,
            chargingDistance: 1,
            network: 1,
            partyId: 1,
            clientName: 1,
            numberOfSessions: 1,
            voltageLevel: 1,
            originalCoordinates: 1
        };
        const { queryGeoSearch, searchCoordinatesFlagActive } = await getGeoQueryAndFeatureFlag(req)

        let result;

        if (req.body && req.body.stations) {

            if (req.body.stations.length === 1 && req.body.stations.includes(process.env.StationsTesla)) {
                return res.status(200).send([]);
            };

            //console.log("req.body", req.body);
            //console.log("tariffType ", tariffType)

            let networks = req.body.stations;
            delete req.body.stations;
            delete req.body.tariffType

            let listOfChargers = []
            Promise.all(
                networks.map(network => {
                    return new Promise(async (resolve, reject) => {

                        let query = {
                            mapVisibility: true,
                            hasInfrastructure: true,
                            active: true,
                            operationalStatus: process.env.OperationalStatusApproved
                        };
                        Object.assign(query, req.body);

                        if (tariffType) {
                            let temp;
                            switch (tariffType) {
                                case process.env.TARIFF_TYPE_POWER:

                                    temp = matchPriceComponent(OcpiTariffDimenstionType.Energy);

                                    Object.assign(query.plugs.$elemMatch, temp);

                                    break;
                                case process.env.TARIFF_TYPE_TIME:

                                    if (query.plugs.$elemMatch.$or) {
                                        //console.log("1")
                                        temp = {
                                            $and: [
                                                matchPriceComponent(OcpiTariffDimenstionType.Time),
                                            ]

                                        };
                                        let aux = { $or: query.plugs.$elemMatch.$or };

                                        delete query.plugs.$elemMatch.$or

                                        if (query.plugs.$elemMatch.$and) {
                                            //console.log("2")
                                            let auxToAnd = query.plugs.$elemMatch.$and;

                                            delete query.plugs.$elemMatch.$and

                                            temp.$and.push(aux);

                                            temp.$and = temp.$and.concat(auxToAnd);


                                            Object.assign(query.plugs.$elemMatch, temp);

                                        } else {
                                            //console.log("3")
                                            //let aux = { $or: query.plugs.$elemMatch.$or };

                                            //delete query.plugs.$elemMatch.$or
                                            temp.$and.push(aux);
                                            Object.assign(query.plugs.$elemMatch, temp);

                                        };

                                    } else {
                                        //console.log("4")
                                        temp = matchPriceComponent(OcpiTariffDimenstionType.Time);


                                        Object.assign(query.plugs.$elemMatch, temp);

                                    }

                                    break;
                                default:
                                    break;
                            };
                        };

                        switch (network) {
                            case process.env.StationsPrivate:

                                query.createUser = userId;
                                let listPrivate = await Charger.find(queryGeoSearch, fields).find(query);

                                if (listPrivate.length > 0) {
                                    listOfChargers = listOfChargers.concat(listPrivate);
                                };

                                resolve(true);
                                break;

                            case process.env.StationsEVIO:

                                query.clientName = "EVIO";

                                if (groups.groupCSUsers.length === 0 && fleets.length === 0) {
                                    query.$or = [
                                        {
                                            'accessType': process.env.ChargerAccessPublic
                                        },
                                        /* {
                                             'accessType': process.env.ChargerAccessFreeCharge
                                         },*/
                                        {
                                            createUser: userId
                                        }
                                    ]
                                } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                                    query.$or = [
                                        {
                                            'listOfGroups': {
                                                $elemMatch: {
                                                    'groupId': groups.groupCSUsers
                                                }
                                            }
                                        },
                                        {
                                            'accessType': process.env.ChargerAccessPublic
                                        },
                                        /* {
                                             'accessType': process.env.ChargerAccessFreeCharge
                                         },*/
                                        {
                                            createUser: userId
                                        }
                                    ]

                                } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                                    query.$or = [
                                        {
                                            'listOfFleets': {
                                                $elemMatch: {
                                                    'fleetId': fleets
                                                }
                                            }
                                        },
                                        {
                                            'accessType': process.env.ChargerAccessPublic
                                        },
                                        /*{
                                            'accessType': process.env.ChargerAccessFreeCharge
                                        },*/
                                        {
                                            createUser: userId
                                        }
                                    ]

                                } else {

                                    query.$or = [
                                        {
                                            'listOfFleets': {
                                                $elemMatch: {
                                                    'fleetId': fleets
                                                }
                                            }
                                        },
                                        {
                                            'listOfGroups': {
                                                $elemMatch: {
                                                    'groupId': groups.groupCSUsers
                                                }
                                            }
                                        },
                                        {
                                            'accessType': process.env.ChargerAccessPublic
                                        },
                                        /*{
                                            'accessType': process.env.ChargerAccessFreeCharge
                                        },*/
                                        {
                                            createUser: userId
                                        }
                                    ]

                                };

                                let listEVIO = await Charger.find(queryGeoSearch, fields).find(query);

                                if (listEVIO.length > 0) {
                                    listOfChargers = listOfChargers.concat(listEVIO);
                                };

                                resolve(true);
                                break;

                            case process.env.StationsGoCharge:


                                // process.env.StationsGoCharge", process.env.StationsGoCharge);
                                if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /* {
                                                 'accessType': process.env.ChargerAccessFreeCharge
                                             },*/
                                            { createUser: userId },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };


                                } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else {

                                    query = {
                                        $or: [

                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                };

                                query.clientName = process.env.WhiteLabelGoCharge;

                                //console.log("query", query);

                                let listGoCharge = await Charger.find(queryGeoSearch, fields).find(query);

                                //console.log("listGoCharge.length", listGoCharge.length);
                                if (listGoCharge.length > 0) {
                                    listOfChargers = listOfChargers.concat(listGoCharge);

                                    // console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;
                            case process.env.StationsKlc:


                                // process.env.StationsGoCharge", process.env.StationsGoCharge);
                                if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /* {
                                                    'accessType': process.env.ChargerAccessFreeCharge
                                                },*/
                                            { createUser: userId },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };


                                } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else {

                                    query = {
                                        $or: [

                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                };

                                query.clientName = process.env.WhiteLabelKLC;

                                //console.log("query", query);

                                let listKLC = await Charger.find(queryGeoSearch, fields).find(query);

                                //console.log("listKLC.length", listKLC.length);
                                if (listKLC.length > 0) {
                                    listOfChargers = listOfChargers.concat(listKLC);

                                    // console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;

                            case process.env.StationsHyundai:

                                if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };


                                } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else {

                                    query = {
                                        $or: [

                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                };

                                query.clientName = process.env.WhiteLabelHyundai;
                                let listHyundai = await Charger.find(queryGeoSearch, fields).find(query);

                                //console.log("listHyundai.length", listHyundai.length);
                                if (listHyundai.length > 0) {
                                    listOfChargers = listOfChargers.concat(listHyundai);

                                    //console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;

                            case process.env.StationsKinto:


                                // process.env.StationsGoCharge", process.env.StationsGoCharge);
                                if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /* {
                                                    'accessType': process.env.ChargerAccessFreeCharge
                                                },*/
                                            { createUser: userId },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };


                                } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                                    query = {
                                        $or: [
                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else {

                                    query = {
                                        $or: [

                                            {
                                                'accessType': process.env.ChargerAccessPublic
                                            },
                                            /*{
                                                'accessType': process.env.ChargerAccessFreeCharge
                                            },*/
                                            { createUser: userId },
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        mapVisibility: true,
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                };

                                query.clientName = process.env.WhiteLabelKinto;

                                //console.log("query", query);

                                let listKinto = await Charger.find(queryGeoSearch, fields).find(query);

                                //console.log("listKinto.length", listKinto.length);
                                if (listKinto.length > 0) {
                                    listOfChargers = listOfChargers.concat(listKinto);

                                    // console.log("listOfChargers.length", listOfChargers.length);
                                };
                                resolve(true);
                                break;

                            case process.env.StationsPublic:

                                switch (clientName) {
                                    case process.env.WhiteLabelGoCharge:

                                        query.$and = [
                                            {
                                                $or: [
                                                    {
                                                        clientName: process.env.WhiteLabelHyundai
                                                    }
                                                ]
                                            },
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    case process.env.WhiteLabelHyundai:

                                        query.$and = [
                                            {
                                                $or: [
                                                    {
                                                        clientName: process.env.WhiteLabelGoCharge
                                                    }
                                                ]
                                            },
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*u,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    case process.env.WhiteLabelKLC:

                                        query.$and = [
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*u,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    case process.env.WhiteLabelKinto:

                                        query.$and = [
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*u,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                    default:

                                        query.$and = [
                                            {
                                                $or: [
                                                    {
                                                        clientName: process.env.WhiteLabelGoCharge
                                                    },
                                                    {
                                                        clientName: process.env.WhiteLabelHyundai
                                                    },
                                                    {
                                                        clientName: process.env.WhiteLabelKLC
                                                    },
                                                    {
                                                        clientName: process.env.WhiteLabelKinto
                                                    },
                                                ]
                                            },
                                            {
                                                $or: [
                                                    {
                                                        'accessType': process.env.ChargerAccessPublic
                                                    }/*,
                                                    {
                                                        'accessType': process.env.ChargerAccessFreeCharge
                                                    }*/
                                                ]
                                            }
                                        ]

                                        break;
                                };

                                let listPublic = await Charger.find(queryGeoSearch, fields).find(query);

                                if (listPublic.length > 0) {
                                    listOfChargers = listOfChargers.concat(listPublic);
                                };
                                resolve(true);
                                break;

                            case process.env.StationsShared:

                                if (groups.groupCSUsers.length === 0 && fleets.length === 0) {
                                    query = null;
                                } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                                    query = {
                                        $or: [
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                                    query = {
                                        $or: [
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            }
                                        ],
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                } else {

                                    query = {
                                        $or: [
                                            {
                                                'listOfFleets': {
                                                    $elemMatch: {
                                                        'fleetId': fleets
                                                    }
                                                }
                                            },
                                            {
                                                'listOfGroups': {
                                                    $elemMatch: {
                                                        'groupId': groups.groupCSUsers
                                                    }
                                                }
                                            }
                                        ],
                                        hasInfrastructure: true,
                                        active: true,
                                        operationalStatus: process.env.OperationalStatusApproved
                                    };

                                };

                                if (query !== null) {

                                    let listInternal = await Charger.find(queryGeoSearch, fields).find(query);

                                    if (listInternal.length > 0) {
                                        listOfChargers = listOfChargers.concat(listInternal);
                                    };

                                    resolve(true);
                                    break;

                                } else {

                                    resolve(true);
                                    break;

                                };

                            default:
                                resolve(true);
                                break;
                        };
                    })
                })
            ).then(() => {
                if (listOfChargers.length === 0) {
                    return res.status(200).send(listOfChargers);
                } else {

                    let responseList = removeDuplicates(listOfChargers, searchCoordinatesFlagActive);
                    return res.status(200).send(responseList);

                }
            }).catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });

        } else {

            //console.log("tariffType 1 ", tariffType)
            // console.log("3")
            let query = {
                mapVisibility: true,
                hasInfrastructure: true,
                active: true,
                operationalStatus: process.env.OperationalStatusApproved
            };

            result = new Promise((resolve) => {

                if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                    query = {
                        $or: [
                            {
                                $and: [
                                    { 'accessType': process.env.ChargerAccessPublic },
                                    { mapVisibility: true }
                                ]
                            },
                            { createUser: userId }
                        ],
                        mapVisibility: true,
                        hasInfrastructure: true,
                        active: true,
                        operationalStatus: process.env.OperationalStatusApproved
                    };

                    resolve(true);

                } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                    query = {
                        $or: [
                            {
                                $and: [
                                    { 'accessType': process.env.ChargerAccessPublic },
                                    { mapVisibility: true }
                                ]
                            },
                            { createUser: userId },
                            {
                                'listOfGroups': {
                                    $elemMatch: {
                                        'groupId': groups.groupCSUsers
                                    }
                                }
                            }
                        ],
                        mapVisibility: true,
                        hasInfrastructure: true,
                        active: true,
                        operationalStatus: process.env.OperationalStatusApproved
                    };

                    resolve(true);

                } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                    query = {
                        $or: [
                            {
                                $and: [
                                    { 'accessType': process.env.ChargerAccessPublic },
                                    { mapVisibility: true }
                                ]
                            },
                            { createUser: userId },
                            {
                                'listOfFleets': {
                                    $elemMatch: {
                                        'fleetId': fleets
                                    }
                                }
                            }
                        ],
                        mapVisibility: true,
                        hasInfrastructure: true,
                        active: true,
                        operationalStatus: process.env.OperationalStatusApproved
                    };

                    resolve(true);

                } else {

                    query = {
                        $or: [
                            {
                                $and: [
                                    { 'accessType': process.env.ChargerAccessPublic },
                                    { mapVisibility: true }
                                ]
                            },
                            { createUser: userId },
                            {
                                'listOfFleets': {
                                    $elemMatch: {
                                        'fleetId': fleets
                                    }
                                }
                            },
                            {
                                'listOfGroups': {
                                    $elemMatch: {
                                        'groupId': groups.groupCSUsers
                                    }
                                }
                            }
                        ],
                        mapVisibility: true,
                        hasInfrastructure: true,
                        active: true,
                        operationalStatus: process.env.OperationalStatusApproved
                    };

                    resolve(true);

                };

            });

            Promise.all([result])
                .then(() => {

                    let chargers = new Promise((resolve, reject) => {

                        if (req.body) {

                            if (req.body.stations)
                                delete req.body.stations

                            if (req.body.tariffType)
                                delete req.body.tariffType

                            if (req.body.tariffType === '')
                                delete req.body.tariffType

                            Object.assign(query, req.body)
                        };

                        if (tariffType) {
                            let temp;
                            switch (tariffType) {
                                case process.env.TARIFF_TYPE_POWER:

                                    temp = matchPriceComponent(OcpiTariffDimenstionType.Energy);

                                    Object.assign(query.plugs.$elemMatch, temp);

                                    break;
                                case process.env.TARIFF_TYPE_TIME:

                                    if (query.plugs.$elemMatch.$or) {
                                        //console.log(query.plugs.$elemMatch.$or)
                                        temp = {
                                            $and: [
                                                matchPriceComponent(OcpiTariffDimenstionType.Time),
                                            ]

                                        };
                                        let aux = { $or: query.plugs.$elemMatch.$or };

                                        delete query.plugs.$elemMatch.$or

                                        if (query.plugs.$elemMatch.$and) {

                                            let auxToAnd = query.plugs.$elemMatch.$and;

                                            delete query.plugs.$elemMatch.$and

                                            temp.$and.push(aux);

                                            temp.$and = temp.$and.concat(auxToAnd);


                                            Object.assign(query.plugs.$elemMatch, temp);

                                        } else {

                                            //let aux = { $or: query.plugs.$elemMatch.$or };

                                            //delete query.plugs.$elemMatch.$or
                                            temp.$and.push(aux);
                                            Object.assign(query.plugs.$elemMatch, temp);

                                        };

                                    } else {

                                        temp = matchPriceComponent(OcpiTariffDimenstionType.Time);


                                        Object.assign(query.plugs.$elemMatch, temp);

                                    }

                                    break;
                                default:
                                    break;
                            };
                        };

                        // console.log("query ", query)

                        Charger.find(queryGeoSearch, fields).find(query, (error, chargersFound) => {
                            if (error) {
                                console.error(`[${context}][.then][find] Error `, error.message);
                                resolve([]);
                                //return res.status(500).send(error.message);
                            }
                            else {
                                //console.log("Chargers response: " + userId + " - " + new Date());
                                //return res.status(200).send(chargersFound);
                                resolve(returnCoordinatesAccordingToFlagMap(chargersFound, searchCoordinatesFlagActive));
                            };
                        });

                    });

                    let chargersPublic = new Promise((resolve, reject) => {

                        let queryPublic = {
                            /*$or: [
                 {*/
                            'accessType': process.env.ChargerAccessPublic
            /*},
            {
                'accessType': process.env.ChargerAccessFreeCharge
            }
        ]*/,
                            mapVisibility: true,
                            hasInfrastructure: true,
                            active: true,
                            operationalStatus: process.env.OperationalStatusApproved
                        };

                        if (req.body) {

                            if (req.body.stations)
                                delete req.body.stations

                            if (req.body.tariffType)
                                delete req.body.tariffType

                            if (req.body.tariffType === '')
                                delete req.body.tariffType

                            Object.assign(queryPublic, req.body)
                        };

                        // console.log("queryPublic ", queryPublic)

                        Charger.find(queryGeoSearch, fields).find(queryPublic, (error, chargersFound) => {
                            if (error) {
                                console.error(`[${context}][.then][find] Error `, error.message);
                                resolve([]);
                                //return res.status(500).send(error.message);
                            }

                            //console.log("Chargers response: " + userId + " - " + new Date());
                            //return res.status(200).send(chargersFound);
                            if (chargersFound.length === 0) {

                                resolve(chargersFound);

                            } else {


                                //console.log("chargersFound", chargersFound.length)
                                availabilityChargers(chargersFound, searchCoordinatesFlagActive)
                                    .then(chargersFound => {

                                        resolve(chargersFound);

                                    })
                                    .catch(error => {

                                        console.error(`[${context}] Error `, error.message);
                                        resolve([]);

                                    });

                            };

                        });

                    });

                    Promise.all([chargers, chargersPublic])
                        .then((response) => {

                            let otherChargers = response[0];
                            let publicChargers = response[1];

                            //console.log("otherChargers", otherChargers.length)
                            //console.log("publicChargers", publicChargers.length)

                            //var newListOfChargers = otherChargers.concat(publicChargers);
                            compareChargers(otherChargers, publicChargers)
                                .then((newListOfChargers) => {
                                    //console.log("newListOfChargers", newListOfChargers.length)
                                    return res.status(200).send(newListOfChargers);
                                })
                                .catch((error) => {

                                    console.error(`[${context}] Error `, error.message);
                                    return res.status(500).send(error.message);

                                });

                        })
                        .catch((error) => {

                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);

                        });


                })
                .catch((error) => {

                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);

                });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/map/internalNetwork', async (req, res, next) => {
    var context = "GET /api/private/chargers/map/internalNetwork";
    try {
        const userId = req.headers['userid'];

        //let groups = await getGroupsCSUsersMap(userId);
        let groups = await getGroupsMap(userId);
        let fleets = await getEVsMap(userId, groups.groupDrivers);
        //let fleets = await getFleetsMap(userId);

        var query;

        let result = new Promise((resolve, reject) => {

            if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                query = {
                    $or: [
                        /*{
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },*/
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve(true);

            } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                query = {
                    $or: [
                        /*{
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },*/
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve(true);

            } else if (groups.groupCSUsers.length > 0 && fleets.length > 0) {

                query = {
                    $or: [
                        /*{
                            $and: [
                                { 'accessType': process.env.ChargerAccessPublic },
                                { mapVisibility: true }
                            ]
                        },*/
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve(true);

            } else {

                resolve(false);

            };

        });

        Promise.all([result])
            .then((values) => {

                if (values[0]) {
                    let chargers = new Promise(async (resolve, reject) => {

                        if (req.body) {

                            if (req.body.$or) {

                                let body = JSON.parse(JSON.stringify(req.body));
                                let temp = body.$or;
                                let temp2 = query.$or;

                                delete body.$or;
                                delete query.$or;

                                query.$and = [
                                    { $or: temp2 },
                                    { $or: temp }
                                ];

                                Object.assign(query, body)

                            } else {

                                Object.assign(query, req.body)

                            };
                        };

                        var fields = {
                            _id: 1,
                            hwId: 1,
                            geometry: 1,
                            status: 1,
                            netStatus: 1,
                            accessType: 1,
                            address: 1,
                            availability: 1,
                            name: 1,
                            plugs: 1,
                            rating: 1,
                            imageContent: 1,
                            chargerType: 1,
                            createUser: 1,
                            listOfGroups: 1,
                            listOfFleets: 1,
                            defaultImage: 1,
                            chargingDistance: 1,
                            network: 1,
                            partyId: 1,
                            clientName: 1,
                            numberOfSessions: 1,
                            voltageLevel: 1,
                            originalCoordinates: 1
                        };
                        const { queryGeoSearch, searchCoordinatesFlagActive } = await getGeoQueryAndFeatureFlag(req)

                        Charger.find(queryGeoSearch, fields).find(query, (error, chargersFound) => {
                            if (error) {
                                console.error(`[${context}][.then][find] Error `, error.message);
                                resolve([]);
                                //return res.status(500).send(error.message);
                            }
                            else {
                                //console.log("Chargers response: " + userId + " - " + new Date());
                                //return res.status(200).send(chargersFound);
                                resolve(returnCoordinatesAccordingToFlagMap(chargersFound, searchCoordinatesFlagActive));
                            };
                        });

                    });

                    Promise.all([chargers])
                        .then((response) => {

                            let otherChargers = response[0];
                            return res.status(200).send(otherChargers);

                        })
                        .catch((error) => {

                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);

                        });
                } else {

                    return res.status(200).send([]);
                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get my chargers
router.get('/api/private/chargers/myChargers', (req, res, next) => {
    var context = "GET /api/private/chargers/myChargers";
    try {
        var userId = req.headers['userid'];
        var query = {
            createUser: userId,
            hasInfrastructure: true,
            operationalStatus: { $ne: process.env.OperationalStatusRemoved }
        };
        chargerFind(query)
            .then(async (chargersFound) => {
                if (chargersFound.length != 0) {
                    const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
                    return res.status(200).send(returnCoordinatesAccordingToFlagMap(chargersFound, searchCoordinatesFlagActive));
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get favorites chargers
router.get('/api/private/chargers/favorites', (req, res, next) => {
    var context = "GET /api/private/chargers/favorites";
    try {
        const filter = {};
        if (req.body) {
            filter.query = req.body;
        };
        filter.query.active = true;
        filter.query.hasInfrastructure = true;
        filter.query.operationalStatus = { $ne: process.env.OperationalStatusRemoved };

        //console.log("req.body;", req.body)
        Charger.find(filter.query, async (err, chargers) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {

                //console.log("filter", chargers.length)
                if (Object.keys(chargers).length === 0) {
                    var chargers = [];
                    return res.status(200).send(chargers);
                    //return res.status(200).send({ auth: true, code: "server_charger_not_found", message: 'Charger not found for given parameters' });
                }
                else {

                    //let dateNow = new Date();
                    //console.log("1")
                    for (let i = 0; i < chargers.length; i++) {
                        //console.log("i ", i)
                        let charger = JSON.parse(JSON.stringify(chargers[i]));

                        let fees = await getFees(charger);
                        //charger.feeds = feeds;

                        if (fees !== false) {
                            //charger.feeds = feeds;
                            charger.fees = fees;
                            chargers[i] = charger;
                        }

                        for (let l = 0; l < charger.plugs.length; l++) {

                            /* if (charger.plugs[l].statusChangeDate) {

                                 let statusChangeDate = new Date(charger.plugs[l].statusChangeDate)
                                 charger.plugs[l].statusTime = ((dateNow.getTime() - statusChangeDate.getTime()) / 60000)

                             } else {

                                 let updatedAt = new Date(charger.updatedAt);
                                 charger.plugs[l].statusTime = ((dateNow.getTime() - updatedAt.getTime()) / 60000)

                             };*/

                            let plug = charger.plugs[l];
                            let tariff = await getTariffs(plug.tariff);
                        }

                    }

                    //console.log("2")

                    return res.status(200).send(chargers);

                }
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//get chargers by rating
router.get('/api/private/chargers/rating', (req, res, next) => {
    var context = "GET /api/private/chargers/rating";
    try {
        if (Object.keys(req.query).length != 0) {
            var rating = req.query;
            var query = {
                rating: { $gte: rating.rating },
                hasInfrastructure: true,
                active: true,
                operationalStatus: { $ne: process.env.OperationalStatusRemoved }
            };
            Charger.find(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);;
                    return res.status(500).send(err.message);
                }
                else {
                    if (result.length !== 0)
                        return res.status(200).send(result);
                    else
                        return res.status(200).send({ auth: true, code: 'chargers_not_found', message: "Chargers not found for the given parameters." });
                };
            });
        }
        else {
            return res.status(400).send({ auth: false, code: 'server_data_required', message: "Rating data is required" });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//get chargers by type
router.get('/api/private/chargers/chargerType', (req, res, next) => {
    var context = "GET /api/private/chargers/chargerType";
    try {

        var query = req.body;
        query.active = true;
        query.operationalStatus = { $ne: process.env.OperationalStatusRemoved };

        var fields = {
            hwId: 1
        };

        Charger.find(query, fields, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(chargersFound);
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger by Qr Code Id
router.get('/api/private/chargers/qrCodeId', (req, res, next) => {
    var context = "GET /api/private/chargers/qrCodeId";
    try {

        var qrCode = req.query;
        var userId = req.headers['userid'];

        if (!qrCode.qrCodeId) {
            return res.status(400).send({ auth: false, code: "server_qrCodeId_required", message: "Qr code id is required" });
        }
        if (!qrCode.type) {
            return res.status(400).send({ auth: false, code: "server_type_required", message: "Type is required" });
        }

        var query = {

            qrCodeId: qrCode.qrCodeId

        };

        QrCode.findOne(query, async (err, qrCodeFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (qrCodeFound) {
                    if (qrCodeFound.qrCode.hwId == "") {
                        return res.status(400).send({ auth: false, code: "server_qrCode_not_found", message: "Invalid QR Code" });
                    } else {

                        switch (qrCode.type) {
                            case process.env.Charging:

                                var query = {
                                    hwId: qrCodeFound.qrCode.hwId,
                                    hasInfrastructure: true,
                                    active: true,
                                    operationalStatus: { $ne: process.env.OperationalStatusRemoved }
                                };

                                chargerFindOne(query)
                                    .then(async (chargerFound) => {
                                        if (chargerFound) {

                                            //console.log("chargerFound", chargerFound);
                                            //console.log("qrCodeFound", qrCodeFound);

                                            let newCharger = await getChargerDetails(chargerFound, userId);

                                            /* validateChargingStationConditionsQrCode(userId, newCharger, qrCodeFound.qrCode.plugId)
                                                 .then(() => {*/

                                            qrCodeFound = JSON.parse(JSON.stringify(qrCodeFound));

                                            qrCodeFound.qrCode.chargerType = chargerFound.chargerType;
                                            qrCodeFound.qrCode.chargingDistance = chargerFound.chargingDistance;
                                            qrCodeFound.qrCode.chargerId = chargerFound._id;
                                            qrCodeFound.qrCode.charger = newCharger;
                                            return res.status(200).send(qrCodeFound);

                                            /*})
                                            .catch((error) => {
                                                if (error.auth === false) {
                                                    console.error("code 400", error);
                                                    return res.status(400).send(error);
                                                }
                                                else {
                                                    console.error(`[${context}][validateChargingStationConditionsQrCode] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                };
                                            });*/


                                            /*
                                            qrCodeFound = JSON.parse(JSON.stringify(qrCodeFound));

                                            qrCodeFound.qrCode.chargerType = chargerFound.chargerType;
                                            qrCodeFound.qrCode.chargingDistance = chargerFound.chargingDistance;
                                            qrCodeFound.qrCode.chargerId = chargerFound._id;
                                            qrCodeFound.qrCode.charger = newCharger;
                                            return res.status(200).send(qrCodeFound);
                                            */

                                        } else {

                                            return res.status(400).send({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                                        };

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][chargerFindOne] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                                break;

                            case process.env.NewChargerEVIO:
                                var query = {
                                    hwId: qrCodeFound.qrCode.hwId
                                };

                                ChargersEvio.findOne(query, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][find] Error `, err.message);;
                                        return res.status(500).send(err.message);
                                    }
                                    else {

                                        if (result) {
                                            qrCodeFound = JSON.parse(JSON.stringify(qrCodeFound));
                                            qrCodeFound.charger = result;
                                            delete qrCodeFound.qrCode;
                                            return res.status(200).send(qrCodeFound);
                                        }
                                        else {
                                            return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                                        };

                                    };
                                });
                                break;

                            default:
                                return res.status(400).send({ auth: false, code: 'server_type_not_supported', message: "Type not supported" });
                        };

                    };
                } else
                    return res.status(400).send({ auth: false, code: "server_qrCode_not_found", message: "Invalid QR Code" });
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger by Qr Code Id
router.get('/api/private/chargers/tariffs', async (req, res, next) => {
    var context = "GET /api/private/chargers/tariffs";
    try {
        var received = req.query;
        if (req.headers['userid'] != undefined) {
            var userId = req.headers['userid'];
        }
        else {
            var userId = received.userId;
        };

        var query = {
            hwId: received.hwId,
            hasInfrastructure: true,
            active: true,
            operationalStatus: { $ne: process.env.OperationalStatusRemoved }
        };

        let groups = await getGroupsCSUsersMap(userId);
        let charger = await chargerFindOne(query);

        if (charger.accessType == process.env.ChargerAccessPrivate) {
            if (charger.createUser == userId) {
                var tariff = {
                    groupName: 'Private',
                    groupId: '',
                    tariffId: '-1'
                };
                return res.status(200).send(tariff);
            }
            else if (charger.accessType == process.env.ChargerAccessFreeCharge) {
                var tariff = {
                    groupName: 'FreeCharge',
                    groupId: '',
                    tariffId: '-1'
                };
                return res.status(200).send(tariff);
            }
            else {
                return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
            };
        }
        else {
            var found = charger.plugs.find(plug => {
                return plug.plugId == received.plugId;
            });

            if (found) {
                if (charger.listOfGroups.length === 0) {
                    var tariff = found.tariff.find(tariff => {
                        return tariff.groupName === process.env.ChargerAccessPublic;
                    });
                    return res.status(200).send(tariff);
                }
                else {
                    var tariffFound = [];

                    Promise.all(
                        groups.map(group => {
                            return new Promise((resolve, reject) => {
                                var groupFound = found.tariff.find(tariff => {
                                    return tariff.groupId === group;
                                });

                                if (groupFound) {
                                    tariffFound.push(groupFound);
                                    resolve(true);
                                }
                                else {
                                    resolve(false);
                                };
                            });
                        })
                    ).then((result) => {
                        if (tariffFound.length == 0) {
                            if (charger.accessType == process.env.ChargerAccessPublic) {
                                var tariff = found.tariff.find(tariff => {
                                    return tariff.groupName === process.env.ChargerAccessPublic;
                                });
                                return res.status(200).send(tariff);
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                            };
                        }
                        else if (tariffFound.length == 1) {
                            return res.status(200).send(tariffFound[0]);
                        }
                        else {
                            getLowestTariff(tariffFound)
                                .then((tariffFound) => {
                                    return res.status(200).send(tariffFound);
                                })
                                .catch((error) => {
                                    console.error(`[${context}][getLowestTariff] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                            //return res.status(200).send(tariffFound[0]);
                        };
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            }
            else {
                return res.status(400).send({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
            };
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger by name private
router.get('/api/private/chargers/searchByName', async (req, res, next) => {
    var context = "GET /api/private/chargers/searchByName";
    try {
        var received = req.query;

        if (received.countryCode == undefined || received.countryCode.length == 0) {
            received.countryCode = ["PT", "ES"];
        };

        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];

        let chargerOPM = await getChargerOPCM(received, clientName);
        //let groups = await getGroupsCSUsersMap(userId);
        let groups = await getGroupsMap(userId);
        let fleets = await getEVsMap(userId, groups.groupDrivers);

        const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
        var query;

        let result = new Promise((resolve, reject) => {

            if (groups.groupCSUsers.length === 0 && fleets.length === 0) {

                query = {
                    name: { $regex: new RegExp("^" + `.*${received.name}.*`, "i") },
                    $or: [
                        { 'accessType': process.env.ChargerAccessPublic },
                        // { 'accessType': process.env.ChargerAccessFreeCharge },
                        { createUser: userId }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else if (groups.groupCSUsers.length > 0 && fleets.length === 0) {

                query = {
                    name: { $regex: new RegExp("^" + `.*${received.name}.*`, "i") },
                    $or: [
                        { 'accessType': process.env.ChargerAccessPublic },
                        //{ 'accessType': process.env.ChargerAccessFreeCharge },
                        { createUser: userId },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else if (groups.groupCSUsers.length === 0 && fleets.length > 0) {

                query = {
                    name: { $regex: new RegExp("^" + `.*${received.name}.*`, "i") },
                    $or: [
                        { 'accessType': process.env.ChargerAccessPublic },
                        //{ 'accessType': process.env.ChargerAccessFreeCharge },
                        { createUser: userId },
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            } else {

                query = {
                    name: { $regex: new RegExp("^" + `.*${received.name}.*`, "i") },
                    $or: [
                        { 'accessType': process.env.ChargerAccessPublic },
                        //{ 'accessType': process.env.ChargerAccessFreeCharge },
                        { createUser: userId },
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups.groupCSUsers
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true,
                    operationalStatus: process.env.OperationalStatusApproved
                };

                resolve();

            };

        });

        Promise.all([result])
            .then(() => {

                var fields = {
                    _id: 1,
                    hwId: 1,
                    geometry: 1,
                    status: 1,
                    netStatus: 1,
                    accessType: 1,
                    address: 1,
                    availability: 1,
                    name: 1,
                    plugs: 1,
                    rating: 1,
                    imageContent: 1,
                    chargerType: 1,
                    createUser: 1,
                    listOfGroups: 1,
                    listOfFleets: 1,
                    defaultImage: 1,
                    chargingDistance: 1,
                    network: 1,
                    partyId: 1,
                    clientName: 1,
                    numberOfSessions: 1,
                    voltageLevel: 1,
                    originalCoordinates: 1
                };

                Charger.find(query, fields, (err, chargersFound) => {
                    if (err) {
                        console.error(`[${context}][Charger.find] Error `, err.message);;
                        return res.status(500).send(err.message);
                    }
                    else {
                        const newListOfChargers = chargersFound.concat(chargerOPM);

                        return res.status(200).send(newListOfChargers.map(charger => ({ ...charger, geometry: returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive) })));
                    };
                });

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/searchByName/v2', async (req, res) => {
    const context = "GET /api/private/chargers/searchByName/v2";
    try {
        return await ChargersHandler.getChargersByName(req, res);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//Get charger by name public
router.get('/api/public/chargers/searchByName', async (req, res, next) => {
    var context = "GET /api/public/chargers/searchByName";
    try {
        var received = req.query;
        var clientName = req.headers['clientname'];

        if (received.countryCode == undefined || received.countryCode.length == 0) {
            received.countryCode = ["PT", "ES"];
        };

        var query = {
            name: { $regex: new RegExp("^" + `.*${received.name}.*`, "i") },
            /*$or: [
                {*/
            'accessType': process.env.ChargerAccessPublic
                /*},
                {
                    'accessType': process.env.ChargerAccessFreeCharge
                }
            ]*/,
            hasInfrastructure: true,
            active: true,
            operationalStatus: process.env.OperationalStatusApproved
        };
        /*
        var fields = {
            name: 1,
            hwId: 1,
            address: 1,
            geometry: 1
        };
        */
        const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
        var fields = {
            _id: 1,
            hwId: 1,
            geometry: 1,
            status: 1,
            netStatus: 1,
            accessType: 1,
            address: 1,
            availability: 1,
            name: 1,
            plugs: 1,
            rating: 1,
            imageContent: 1,
            chargerType: 1,
            createUser: 1,
            listOfGroups: 1,
            listOfFleets: 1,
            defaultImage: 1,
            chargingDistance: 1,
            network: 1,
            partyId: 1,
            clientName: 1,
            numberOfSessions: 1,
            voltageLevel: 1,
            originalCoordinates: 1
        };

        let chargerOPM = await getChargerOPCM(received, clientName);
        Charger.find(query, fields, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}][Charger.find] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {
                const newListOfChargers = chargersFound.concat(chargerOPM);
                return res.status(200).send(newListOfChargers.map(charger => ({ ...charger, geometry: returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive) })));
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger by id
router.get('/api/private/chargers/byId', (req, res, next) => {
    var context = "GET /api/private/chargers/byId";
    try {

        var query = req.query;
        //query.operationalStatus = { $ne: process.env.OperationalStatusRemoved };

        chargerFindOne(query)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.error(`[${context}][chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger history
router.get('/api/private/chargers/history', (req, res, next) => {
    var context = "GET /api/private/chargers/history";
    try {

        var query = {
            hwId: req.query.hwId,
            hasInfrastructure: true,
            active: true
        }

        //console.log("query", query);

        chargerFindOne(query)
            .then(async (result) => {

                if (result) {
                    //console.log("result", result);
                    let infrastructure
                    if (result && result.infrastructure)
                        infrastructure = await Infrastructure.findOne({ _id: result.infrastructure });
                    else
                        infrastructure = undefined;

                    if (result.listOfGroups.length > 0) {
                        result = JSON.parse(JSON.stringify(result));
                        let listOfGroups = await getGroupsCSUsers(result.listOfGroups);
                        result.listOfGroups = listOfGroups;
                    };

                    return res.status(200).send({
                        charger: result,
                        infrastructure: infrastructure
                    });
                } else {
                    return res.status(200).send({
                        charger: undefined,
                        infrastructure: undefined
                    });
                }
            })
            .catch((error) => {
                console.error(`[${context}][chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get charger by id
router.get('/api/private/chargers/getTariff', async (req, res, next) => {
    var context = "GET /api/private/chargers/getTariff";
    try {

        var received = req.query;
        var userId = received.userId;
        var query = {
            hwId: received.hwId,
            hasInfrastructure: true,
            operationalStatus: { $ne: process.env.OperationalStatusRemoved }
        };

        let groups = await getGroupsCSUsersMap(userId);
        let charger = await chargerFindOne(query);
        let fleetId = received.fleetId;

        if (charger.accessType == process.env.ChargerAccessPrivate || charger.accessType == process.env.ChargerAccessFreeCharge) {

            var tariff = '-1';
            return res.status(200).send(tariff);

        }
        else {
            var found = charger.plugs.find(plug => {
                return plug.plugId == received.plugId;
            });

            if (found) {
                if (fleetId != '-1') {
                    var tariff = found.tariff.find(tariff => {
                        return tariff.fleetId === fleetId;
                    });
                    if (tariff) {
                        return res.status(200).send(tariff.tariffId);

                    } else if (charger.accessType == process.env.ChargerAccessPublic) {
                        tariff = found.tariff.find(tariff => {
                            return tariff.groupName === process.env.ChargerAccessPublic;
                        });
                        return res.status(200).send(tariff.tariffId);
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                    };
                }
                else {

                    if (charger.listOfGroups.length === 0) {
                        var tariff = found.tariff.find(tariff => {
                            return tariff.groupName === process.env.ChargerAccessPublic;
                        });
                        return res.status(200).send(tariff.tariffId);
                    }
                    else {
                        var tariffFound = [];

                        Promise.all(
                            groups.map(group => {
                                return new Promise((resolve, reject) => {
                                    var groupFound = found.tariff.find(tariff => {
                                        return tariff.groupId === group;
                                    });

                                    if (groupFound) {
                                        tariffFound.push(groupFound);
                                        resolve(true);
                                    }
                                    else {
                                        resolve(false);
                                    };
                                });
                            })
                        ).then((result) => {
                            if (tariffFound.length == 0) {
                                if (charger.accessType == process.env.ChargerAccessPublic) {
                                    var tariff = found.tariff.find(tariff => {
                                        return tariff.groupName === process.env.ChargerAccessPublic;
                                    });
                                    return res.status(200).send(tariff.tariffId);
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                };
                            }
                            else if (tariffFound.length == 1) {
                                return res.status(200).send(tariffFound[0].tariffId);
                            }
                            else {
                                getLowestTariff(tariffFound)
                                    .then((tariffFound) => {
                                        return res.status(200).send(tariffFound.tariffId);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][getLowestTariff] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                                //return res.status(200).send(tariffFound[0]);
                            };
                        }).catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                    };
                }
            }
            else {
                return res.status(400).send({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
            };
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all chargers
router.get('/api/private/chargers/allChargers', (req, res, next) => {
    var context = "GET /api/private/chargers/allChargers";
    try {
        var query = {};
        chargerFind(query)
            .then((chargersFound) => {
                if (chargersFound.length != 0) {
                    return res.status(200).send(chargersFound);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/validateChargingStationConditions', async (req, res, next) => {
    var context = "GET /api/private/chargers/validateChargingStationConditions";
    try {
        var userId = req.body.userId;
        var chargerFound = req.body.charger;
        var plugId = req.body.plugId;

        //console.log(" req.body", req.body);

        validateChargingStationConditions(userId, chargerFound, plugId)
            .then(() => {
                return res.status(200).send(true);
            })
            .catch((error) => {
                if (error.auth === false) {
                    return res.status(400).send(error);
                }
                else {
                    console.error(`[${context}][validateChargingStationConditions] Error `, error.message);
                    return res.status(500).send(error.message);
                };
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/numberCharger/:userId', async (req, res, next) => {
    var context = "GET /api/private/chargers/numberCharger/:userId";
    try {

        var userId = req.params.userId


        let numberOfChargers = await getNumberOfChargers(userId);
        let numberOfSessions = await getNumberOfSessions(userId);

        let result = {
            numberOfChargers: numberOfChargers,
            numberOfSessions: numberOfSessions
        };

        return res.status(200).send(result);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/chargersKPIs', async (req, res, next) => {
    var context = "GET /api/private/chargers/chargersKPIs";
    try {



        let query = { active: true, hasInfrastructure: true, operationalStatus: { $ne: process.env.OperationalStatusRemoved } };

        let pipeline = [
            {
                "$match": {
                    "status": "40"
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

        let chargers = await Charger.find(query);
        let sessions = await ChargingSession.aggregate(pipeline);

        //console.log("chargers", chargers);
        //console.log("totalPower", sessions);

        let response = {
            numberOfChargers: chargers.length,
            chargers: chargers,
            totalPower: sessions[0].totalPower,
            timeCharged: sessions[0].timeCharged,
            totalNumberOfSessions: sessions[0].numberOfSession
        };

        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//get chargers by rating
router.get('/api/private/chargers/getRating/:userId', async (req, res, next) => {
    var context = "GET /api/private/chargers/getRating";
    try {
        const userId = req.params.userId;
        //console.log("userId", userId);

        var pipeline = [
            {
                "$match": {
                    "createUser": userId,
                    "active": true,
                    "operationalStatus": { "$ne": process.env.OperationalStatusRemoved },
                    "numberOfSessions": {
                        "$gt": 0
                    }
                }
            },
            {
                "$group": {
                    "_id": {},
                    "AVG(rating)": {
                        "$avg": "$rating"
                    }
                }
            },
            {
                "$project": {
                    "rating": "$AVG(rating)",
                    "_id": 0
                }
            }
        ];

        let rating = await Charger.aggregate(pipeline)
        //let listOfChargers = await Charger.find({ createUser: userId }, { _id: 1, hwId: 1 })

        //console.log("rating[0]", rating[0]);

        //console.log("rating[listOfChargers]", listOfChargers);

        return res.status(200).send(rating[0]);


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/byGroupId', (req, res, next) => {
    var context = "GET /api/private/chargers/byGroupId";
    try {
        let groupId = req.query.groupId
        var query = {
            listOfGroups: {
                $elemMatch: {
                    groupId: groupId
                }
            }
        };

        chargerFind(query)
            .then((chargersFound) => {
                if (chargersFound.length != 0) {
                    return res.status(200).send(chargersFound);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/byFleetId', (req, res, next) => {
    var context = "GET /api/private/chargers/byFleetId";
    try {
        let fleetId = req.query.fleetId
        var query = {
            listOfFleets: {
                $elemMatch: {
                    fleetId: fleetId
                }
            }
        };
        chargerFind(query)
            .then((chargersFound) => {
                if (chargersFound.length != 0) {
                    return res.status(200).send(chargersFound);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/chargers/allConfigurationKeys', async (req, res, next) => {
    var context = "GET /api/private/chargers/allConfigurationKeys";
    try {

        getConfigurationKeysAllChargers()
        return res.status(200).send("OK")

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all chargers with operational status Waiting Aproval
router.get('/api/private/chargers/waitingAproval', async (req, res, next) => {
    var context = "GET /api/private/chargers/waitingAproval";

    let query = {
        active: true,
        hasInfrastructure: true,
        operationalStatus: process.env.OperationalStatusWaitingAproval
    };

    Charger.find(query, (err, chargersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }
        return res.status(200).send(chargersFound);
    });

});

//Get all charger by operational status
router.get('/api/private/chargers/operationalStatus', (req, res, next) => {
    let context = "GET /api/private/chargers/operationalStatus";

    let received = req.query;

    if (!received.operationalStatus)
        return res.status(400).send({ auth: false, code: 'server_operationalStatus_required', message: "Operational Status data is required" })

    let operationalStatus = received.operationalStatus.toUpperCase();

    let query = {
        operationalStatus: operationalStatus
    };

    Charger.find(query, (err, chargersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }
        return res.status(200).send(chargersFound);
    });

});

// it will be getting deprecated
router.get('/evioapi/chargers', (req, res, next) => {
    var context = "GET /evioapi/chargers";
    try {
        var userId = req.headers['userid'];
        var query = {
            createUserId: userId
        };

        var fields = {
            _id: 1,
            name: 1,
            imageContent: 1,
            listChargers: 1,
            CPE: 1
        }
        findInfrastructureFields(query, fields)
            .then((infrastructureFound) => {
                if (infrastructureFound.length === 0)
                    return res.status(200).send(infrastructureFound);
                else {
                    var newInfrastructureFound = [];
                    Promise.all(
                        infrastructureFound.map(infrastructure => {
                            return new Promise((resolve, reject) => {
                                getChargers(infrastructure)
                                    .then((infrastructure) => {
                                        newInfrastructureFound.push(infrastructure);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                        reject(error);
                                    });
                            });
                        })
                    ).then((result) => {
                        newInfrastructureFound.sort((a, b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0));
                        return res.status(200).send(newInfrastructureFound);
                    }).catch((error) => {
                        console.error(`[${context}][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findInfrastructureFields][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
router.get('/evioapi/chargingstations/energy/:chargerId', ChargersHandler.getPlugsExternalApi)

router.get('/evioapi/chargingstations', (req, res, next) => {
    var context = "GET /evioapi/chargingstations";
    try {
        const createdAt = req.query.createdAt
        const updatedAt = req.query.updatedAt
        let query;
        const hwId = req.query.hwId
        const token = req.headers.token

        const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

        if (!token) {
            console.error(`[${context}] Error - Missing Input Data`);
            return res.status(400).send('Missing Input Data');
        }

        if ((createdAt && !datePattern.test(createdAt)) || (updatedAt && !datePattern.test(updatedAt))) {
            console.error(`[${context}] Error - Data Format Invalid`);
            return res.status(400).send('Invalid date format. Use yyyy-mm-ddThh:mm format.');
        }

        // get user id by the token
        getUserIDByToken(token).then(function (user) {
            if (!user) {
                console.error(`[${context}] Error - No User ??`)
                return res.status(500).send('Unknown userID')
            }

            query = { createUser: user.userId }

            if (!createdAt && !updatedAt) {
                query = {
                    createUser: user.userId
                };
            } else if (!createdAt) {
                query = {
                    createUser: user.userId,
                    updatedAt: { $gte: new Date(updatedAt) }
                };
            } else if (!updatedAt) {
                query = {
                    createUser: user.userId,
                    createdAt: { $gte: new Date(createdAt) },
                };
            } else {
                query = {
                    createUser: user.userId,
                    $and: [
                        { createdAt: { $gte: new Date(createdAt) } },
                        { updatedAt: { $gte: new Date(updatedAt) } }
                    ]
                };
            }

            if (hwId) query.hwId = hwId

            ChargersHandler.getChargerExternalApi(query).then(function (chargers) {

                return res.status(200).send(chargers);

            }).catch(function (erro) {
                console.error(`[${context}] Error `, error.message ? error.message : error)
                return res.status(500).send('Internal error')
            })

        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message ? error.message : error)
            return res.status(500).send('Internal error')
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send('Internal error');
    };
});


router.get('/evioapi/infrastructures', (req, res, next) => {
    var context = "GET /evioapi/infrastructures";
    try {

        const infrastructure = req.query._id
        const token = req.headers.token
        const createdAt = req.query.createdAt
        const updatedAt = req.query.updatedAt
        let query;

        const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

        if (!token) {
            console.error(`[${context}] Error - Missing Input Data`);
            return res.status(400).send('Missing Input Data');
        }

        if ((createdAt && !datePattern.test(createdAt)) || (updatedAt && !datePattern.test(updatedAt))) {
            console.error(`[${context}] Error - Data Format Invalid`);
            return res.status(400).send('Invalid date format. Use yyyy-mm-ddThh:mm format.');
        }

        // get user id by the token
        getUserIDByToken(token).then(function (user) {
            if (!user) {
                console.error(`[${context}] Error - No User ??`)
                return res.status(500).send('Unknown userID')
            }

            query = { createUserId: user.userId }

            if (!createdAt && !updatedAt) {
                query = {
                    createUserId: user.userId
                };
            } else if (!createdAt) {
                query = {
                    createUserId: user.userId,
                    updatedAt: { $gte: new Date(updatedAt) }
                };
            } else if (!updatedAt) {
                query = {
                    createUserId: user.userId,
                    createdAt: { $gte: new Date(createdAt) },
                };
            } else {
                query = {
                    createUserId: user.userId,
                    $and: [
                        { createdAt: { $gte: new Date(createdAt) } },
                        { updatedAt: { $gte: new Date(updatedAt) } }
                    ]
                };
            }

            if (infrastructure) query._id = infrastructure

            findInfrastructureFields(query, null).then(async function (infrastructures) {
                if (infrastructures.length < 1) return res.status(200).send(infrastructures)

                let listOfInfrstructures = []
                for (let infrastructure of infrastructures) {

                    let newInfrastrutcture = {
                        id: infrastructure._id,
                        name: infrastructure.name,
                        imageContent: infrastructure.imageContent,
                        listChargers: [],
                        deliveryPoint: infrastructure.CPE
                    }

                    if (infrastructure.listChargers.length < 1) {
                        listOfInfrstructures.push(newInfrastrutcture)
                        continue
                    }

                    let chargerIds = []
                    for (let charger of infrastructure.listChargers) {
                        chargerIds.push(charger.chargerId)
                    }
                    query = {
                        _id: chargerIds,
                        createUser: user.userId
                    }
                    newInfrastrutcture.listChargers = await ChargersHandler.getChargerExternalApi(query)
                    if (!newInfrastrutcture.listChargers) {
                        console.error(`[${context}] Error - No chargers returned ??`)
                        return res.status(500).send('Internal error')
                    }

                    listOfInfrstructures.push(newInfrastrutcture)
                }

                return res.status(200).send(listOfInfrstructures)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message ? error.message : error)
                return res.status(500).send('Internal error')
            })

        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message ? error.message : error)
            return res.status(500).send('Internal error')
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send('Internal error');
    }
})



router.get('/locations', (req, res) => getChargersToOCM(req, res));

router.get('/api/private/chargers/issues', (req, res, next) => {
    let context = "GET /api/private/chargers/issues";

    let query = req.query;

    Charger.findOne(query, (err, chargersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }
        return res.status(200).send(chargersFound);
    });

});

//Get charger details for private use
router.get('/api/private/chargers/details/validatePaymentConditions', (req, res, next) => {
    var context = "GET /api/private/chargers/details/validatePaymentConditions";
    try {
        var query = req.query;
        query.hasInfrastructure = true;
        query.operationalStatus = { $ne: process.env.OperationalStatusRemoved }
        if (Object.keys(query).length == 0) {
            return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
        }
        else {
            chargerFindOne(query)
                .then((result) => {
                    return res.status(200).send(result);
                })
                .catch((error) => {
                    console.error(`[${context}][chargerFindOne] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
//========== PATCH ==========
//Patch for plug status to put the charge status in loading or free and booking with conformation
router.patch('/api/private/chargers/status', (req, res, next) => {
    var context = "PATCH /api/private/chargers/status";
    try {
        var charger = req.body.body;
        if (charger.chargerType === process.env.EVIOBoxType || charger.chargerType === process.env.SonOFFType) {
            if (charger.hwId != undefined && charger.hwId != "") {
                var query = {
                    hwId: charger.hwId,
                    plugId: charger.plugId,
                    $or: [
                        {
                            status: { $ne: process.env.SessionStatusStopped }
                        },
                        {
                            status: { $ne: process.env.SessionStatusFailed }
                        }
                    ]
                };
            }
            else {
                return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
            };
        }
        else {
            if (charger._id != undefined && charger._id != "") {
                var query = {
                    _id: charger._id,
                    plugId: charger.plugId,
                    $or: [
                        {
                            status: { $ne: process.env.SessionStatusStopped }
                        },
                        {
                            status: { $ne: process.env.SessionStatusFailed }
                        }
                    ]
                };
            }
            else if (charger.hwId != undefined && charger.hwId != "") {
                var query = {
                    hwId: charger.hwId,
                    plugId: charger.plugId,
                    $or: [
                        {
                            status: { $ne: process.env.SessionStatusStopped }
                        },
                        {
                            status: { $ne: process.env.SessionStatusFailed }
                        }
                    ]
                };
            }
            else {
                return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
            };
        };
        ChargingSession.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][ChargingSession.findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {
                    var query = {
                        _id: charger._id,
                        hasInfrastructure: true,
                        "plugs.plugId": charger.plugId
                    };

                    var newValues = {
                        $set: {
                            "plugs.$.status": charger.status
                        }
                    };

                    updateCharger(query, newValues)
                        .then((answers) => {
                            if (answers) {
                                // console.log("To Notification 1")
                                if (charger.status === process.env.PlugStatusAvailable) {
                                    // console.log("To Notification 2")
                                    notifymeHistory(charger);
                                };
                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                            }
                            else
                                return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                        })
                        .catch((error) => {
                            console.error(`[${context}][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                };
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Patch for plug status to put the charge status in loading or free and booking with conformation
router.patch('/api/private/chargers/multiStatus', (req, res, next) => {
    var context = "PATCH /api/private/chargers/multiStatus";
    try {

        var charger = req.body.body;
        var query = {
            _id: charger._id,
            hasInfrastructure: true
        };

        Charger.findOne(query, (error, chargerFound) => {
            if (error) {
                console.error(`[${context}][findOne] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                if (chargerFound) {
                    if (chargerFound.chargerType === process.env.ChargerTypeSiemens) {
                        if (charger.status === process.env.PlugStatusAvailable) {
                            var status = process.env.PlugStatusAvailable;
                        }
                        else {
                            var status = process.env.PlugsStatusUnavailable;
                        };

                        Promise.all(
                            chargerFound.plugs.map(plug => {
                                return new Promise((resolve) => {
                                    if (plug.plugId === charger.plugId) {
                                        plug.status = charger.status;
                                        resolve(true);
                                    }
                                    else {
                                        plug.status = status;
                                        resolve(true);
                                    }
                                });
                            })
                        ).then((result) => {
                            var newValues = { $set: chargerFound };
                            updateCharger(query, newValues)
                                .then((answers) => {
                                    if (answers)
                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                    else
                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                })
                                .catch((error) => {
                                    console.error(`[${context}][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }).catch((error) => {
                            console.error(`[${context}][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        })
                    }
                    else {
                        var found = chargerFound.plugs.indexOf(chargerFound.plugs.find((plug) => {
                            return plug.plugId == charger.plugId;
                        }));
                        if (found != -1) {
                            chargerFound.plugs[found].status = charger.status;
                            var newValues = { $set: chargerFound };
                            updateCharger(query, newValues)
                                .then((answers) => {
                                    if (answers)
                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                    else
                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                })
                                .catch((error) => {
                                    console.error(`[${context}][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            return res.status(200).send({ auth: true, code: 'server_plug_error', message: "Plug not found for given parameters" });
                        };
                    };
                }
                else {
                    return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//update charger Status
router.patch('/api/private/chargers/chargerStatus', (req, res, next) => {
    var context = "PATCH /api/private/chargers/chargerStatus";
    try {
        //console.log("Teste");
        var charger = req.body;
        if (charger._id !== undefined) {
            var query = {
                _id: charger._id,
                hasInfrastructure: true
            };
        }
        else {
            var query = {
                hwId: charger.hwId,
                hasInfrastructure: true
            };
        };
        /*Charger.findOne(query, (error, result) => {
            if (error) {
                console.error(`[${context}][findOne] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                if (result) {
            */
        var result = { status: charger.status };
        var newValues = { $set: result };
        updateCharger(query, newValues)
            .then((answers) => {
                if (answers)
                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                else
                    return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
            })
            .catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
        /*}
        else {
            return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
        };
    };
});*/
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Patch for update a charger
/*
    Use to update:
    - name;
    - parkingType;
*/
router.patch('/api/private/chargers', async (req, res, next) => {
    const context = "PATCH /api/private/chargers";
    try {

        let charger = req.body;
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        let chargerId = charger._id;

        if (charger?.geometry?.coordinates) {
            charger.timeZone = timeZone.getTimezoneFromCoordinates(charger.geometry.coordinates);
            if (hasValidCoordinates(charger?.geometry?.coordinates)) {
                charger.originalCoordinates = charger?.geometry
            }
        }

        charger = JSON.parse(JSON.stringify(charger))

        if (!clientName) {
            let chargerFoundClientName = await Charger.findOne({ _id: chargerId }, { _id: 1, clientName: 1 });
            clientName = chargerFoundClientName.clientName;
        };

        if (charger.hwId) {

            let query = {
                hwId: charger.hwId,
                _id: { $ne: charger._id },
                hasInfrastructure: true
            };

            Charger.find(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                if (result.length > 0) {
                    return res.status(400).send({ auth: false, code: "server_hwId_already_use", message: "HwId already in use by another charger." });
                } else {

                    switch (clientName) {
                        case process.env.WhiteLabelGoCharge:
                            charger.chargerType = "011";
                            charger.network = process.env.NetworkGoCharge;
                            break;
                        case process.env.WhiteLabelHyundai:
                            charger.chargerType = "012";
                            charger.network = process.env.NetworkHyundai;
                            break;
                        case process.env.WhiteLabelKLC:
                            charger.chargerType = process.env.chargerTypeKLC
                            charger.network = process.env.NetworkKLC;
                            break;
                        case process.env.WhiteLabelKinto:
                            charger.chargerType = process.env.chargerTypeKinto
                            charger.network = process.env.NetworkKinto;
                            break;
                        default:
                            charger.chargerType = "008";
                            charger.network = process.env.NetworkEVIO;
                            break;
                    };

                    makeUpdateOnChargers(charger, userId)
                        .then(async response => {
                            if (response.auth) {
                                if (clientName === "EVIO") {
                                    return res.status(200).send(response);
                                } else {
                                    let chargerFound = await Charger.findOne({ _id: chargerId });
                                    return res.status(200).send(chargerFound);
                                };
                            } else
                                return res.status(400).send(response);
                        })
                        .catch(error => {
                            if (error.response) {
                                console.error(`[${context}][makeUpdateOnChargers][400] Error `, error.response.data.message);
                                return res.status(400).send(error.response.data.message);
                            }
                            else {
                                console.error(`[${context}][makeUpdateOnChargers][500] Error `, error.message);
                                return res.status(500).send(error.message);
                            }
                        });
                };
            });

        } else {

            switch (clientName) {
                case process.env.WhiteLabelGoCharge:
                    charger.chargerType = "011";
                    charger.network = process.env.NetworkGoCharge;
                    break;
                case process.env.WhiteLabelHyundai:
                    charger.chargerType = "012";
                    charger.network = process.env.NetworkHyundai;
                    break;
                case process.env.WhiteLabelKLC:
                    charger.chargerType = process.env.chargerTypeKLC
                    charger.network = process.env.NetworkKLC;
                    break;
                case process.env.WhiteLabelKinto:
                    charger.chargerType = process.env.chargerTypeKinto
                    charger.network = process.env.NetworkKinto;
                    break;
                default:
                    charger.chargerType = "008";
                    charger.network = process.env.NetworkEVIO;
                    break;
            };

            makeUpdateOnChargers(charger, userId)
                .then(async response => {
                    if (response.auth) {
                        if (clientName === "EVIO") {
                            return res.status(200).send(response);
                        } else {
                            let chargerFound = await Charger.findOne({ _id: chargerId });
                            return res.status(200).send(chargerFound);
                        };
                    } else
                        return res.status(400).send(response);
                })
                .catch(error => {
                    if (error.response) {
                        console.error(`[${context}][makeUpdateOnChargers][400] Error `, error.response.data.message);
                        return res.status(400).send(error.response.data.message);
                    }
                    else {
                        console.error(`[${context}][makeUpdateOnChargers][500] Error `, error.message);
                        return res.status(500).send(error.message);
                    }
                });

        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Patch to enable and disable RFID card
router.patch('/api/private/chargers/allowRFID', (req, res, next) => {
    var context = "PATCH /api/private/chargers/allowRFID";
    try {

        var charger = req.body;
        var userId = req.headers['userid'];
        var query = {
            _id: charger._id,
            hasInfrastructure: true
        };

        chargerFindOne(query)
            .then((chargerFound) => {
                if (chargerFound) {
                    chargerFound.allowRFID = charger.allowRFID;
                    var newValues = { $set: chargerFound };
                    updateCharger(query, newValues)
                        .then((result) => {
                            if (result)
                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                            else
                                return res.status(400).send({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                        })
                        .catch((error) => {
                            console.error(`[${context}] [updateCharger] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}] [chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update a tariff in a plug
router.patch('/api/private/chargers/tariffs', async (req, res, next) => {
    var context = "PATCH /api/private/chargers/tariffs";
    try {
        var received = req.body;
        if (!received._id)
            return res.status(400).send({ auth: false, code: "server_id_required", message: "Id is required" });
        else if (!received.plugId)
            return res.status(400).send({ auth: false, code: "server_plug_id_required", message: "Plug Id is required" });
        else {

            let chargerFound = await chargerFindOne({ _id: received._id });
            getTariffs(received.tariff)
                .then((tariffs) => {

                    let plugFound = chargerFound.plugs.find(plug => {
                        return plug.plugId === received.plugId;
                    });

                    if (plugFound) {
                        //console.log("plugFound", plugFound.tariff.length);
                        //console.log("tariff", received.tariff.length);
                        if (plugFound.tariff.length === received.tariff.length) {

                            let query = {
                                _id: received._id,
                                active: true,
                                hasInfrastructure: true,
                                "plugs.plugId": received.plugId
                            };

                            let newData = {
                                $set: {
                                    "plugs.$.tariff": tariffs
                                }
                            };

                            updateCharger(query, newData)
                                .then(async (result) => {
                                    if (result) {
                                        var query = {
                                            _id: received._id,
                                            active: true,
                                            hasInfrastructure: true
                                        };

                                        let chargerFound = await chargerFindOne(query);
                                        return res.status(200).send(chargerFound);
                                        //return res.status(200).send({ auth: true, code: "server_update_successfully", message: "Update successfully" });
                                    }
                                    else
                                        return res.status(400).send({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                                })
                                .catch((error) => {
                                    console.error(`[${context}][updateCharger] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });

                        }
                        else {

                            return res.status(400).send({ auth: false, code: 'server_different_size_tariff', message: "Different tariff list size than what is in the plug" });

                        };

                    }
                    else {

                        return res.status(400).send({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });

                    };

                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);
                });

        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Remove tariffs from a plug
//TODO Review
router.patch('/api/private/chargers/removeTariffs', (req, res, next) => {
    let context = "PATCH /api/private/chargers/removeTariffs";
    try {

        let received = req.body
        let query = {
            createUser: received.userId,
            active: true,
            hasInfrastructure: true
        };

        chargerFind(query)
            .then((chargersFound) => {
                if (chargersFound.length == 0) {
                    return res.status(200).send(true);
                }
                else {
                    Promise.all(
                        chargersFound.map(charger => {
                            return new Promise((resolve, reject) => {
                                Promise.all(
                                    charger.plugs.map(plug => {
                                        return new Promise((resolve, reject) => {

                                            let tariffsFound = plug.tariff.filter(tariff => {
                                                return tariff.tariffId == received.tariffId;
                                            })

                                            //console.log("tariffsFound", tariffsFound);
                                            if (tariffsFound.length > 0) {
                                                for (let tariffFound of tariffsFound) {
                                                    //console.log("tariffFound", tariffFound);
                                                    let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                        return tariff.tariffId == tariffFound.tariffId;
                                                    }));
                                                    if (found >= 0) {
                                                        plug.tariff[found].tariffId = "";
                                                        plug.tariff[found].tariffType = "";
                                                        plug.tariff[found].tariff = {};
                                                        plug.tariff[found].name = "";
                                                        //resolve(true);
                                                    }
                                                }
                                                /*let found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                    return tariff.tariffId == received.tariffId;
                                                }));
                                                if (found >= 0) {
                                                    plug.tariff[found].tariffId = "";
                                                    plug.tariff[found].tariffType = "";
                                                    plug.tariff[found].tariff = {};
                                                    plug.tariff[found].name = "";*/
                                                resolve(true);
                                                /*}
                                                else {
                                                    resolve(false);
                                                };*/
                                            } else {
                                                resolve(false);
                                            }

                                        });
                                    })
                                ).then((result) => {
                                    let query = {
                                        _id: charger._id
                                    };
                                    let newValues = { $set: charger };
                                    updateCharger(query, newValues)
                                        .then((result) => {
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            resolve(false);
                                        });
                                }).catch((error) => {
                                    resolve(false);
                                });
                            });
                        })
                    ).then((result) => {
                        return res.status(200).send(true);
                    }).catch((error) => {
                        console.error(`[${context}][chargerFind] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargerFind] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Edit tariff on charger
router.patch('/api/private/chargers/editTariffs', (req, res, next) => {
    var context = "PATCH /api/private/chargers/editTariffs";
    try {

        let received = req.body;

        let query = {
            active: true,
            hasInfrastructure: true,
            "plugs.tariff.tariffId": received._id
        };

        chargerFind(query)
            .then((chargersFound) => {

                Promise.all(
                    chargersFound.map(charger => {
                        return new Promise((resolve, reject) => {
                            Promise.all(
                                charger.plugs.map(plug => {
                                    return new Promise((resolve, reject) => {

                                        Promise.all(
                                            plug.tariff.map(tariff => {

                                                return new Promise((resolve, reject) => {
                                                    if (tariff.tariffId === received._id) {

                                                        tariff.tariffType = received.tariffType;
                                                        tariff.tariff = received.tariff
                                                        tariff.name = received.name
                                                        tariff.elements = received.elements
                                                        tariff.type = received.type
                                                        tariff.currency = received.currency

                                                        resolve(true);

                                                    }
                                                    else {

                                                        resolve(false);

                                                    };
                                                });

                                            })

                                        ).then((result) => {

                                            let query = {
                                                _id: charger._id,
                                                "plugs.plugId": plug.plugId
                                            };

                                            let newValues = {
                                                $set: { "plugs.$.tariff": plug.tariff }
                                            };

                                            Charger.updateCharger(query, newValues, (err, result) => {

                                                if (err) {
                                                    console.error(`[${context}][] Error `, err.message);
                                                    reject(err);
                                                }
                                                else {
                                                    resolve(true);
                                                };

                                            });

                                        }).catch((error) => {
                                            console.error(`[${context}][] Error `, error.message);
                                            reject(error);
                                        });

                                    });
                                })
                            ).then((result) => {

                                resolve(true);

                            }).catch((error) => {
                                console.error(`[${context}][] Error `, error.message);
                                reject(error);
                            });
                        });
                    })
                ).then((result) => {

                    return res.status(200).send("OK");

                }).catch((error) => {
                    console.error(`[${context}][] Error `, error.message);
                    return res.status(500).send(error.message);
                });

            })
            .catch((error) => {
                console.error(`[${context}][chargerFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//patch to add/edit a plug
router.patch('/api/private/chargers/plugs', (req, res, next) => {
    var context = "PATCH /api/private/chargers/plugs";
    try {

        if (!req.body._id) {
            return res.status(400).send({ auth: false, code: 'server_id_required', message: "Id is required" })
        }
        else {

            var query = {
                _id: req.body._id,
                hasInfrastructure: true
            };

            var charger = req.body;
            //console.log("/plugs - ", charger);
            Charger.findOne(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][finOne] Error `, err.message);;
                    return res.status(500).send(err.message);
                }
                else {
                    if (result) {
                        if (result.plugs.length === 0) {

                            result.plugs = charger.plugs;
                            changeTariff(result)
                                .then((result) => {
                                    addQrCodeId(result)
                                        .then((result) => {
                                            var newValues = { $set: result };
                                            updateCharger(query, newValues)
                                                .then((answers) => {
                                                    if (answers) {
                                                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                                    }
                                                    else {
                                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                    };
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][addQrCodeId][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                })
                                .catch((error) => {
                                    console.error(`[${context}][changeTariff][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });

                        }
                        else {

                            const checkPlug = (plug) => {
                                return new Promise((resolve, reject) => {
                                    try {
                                        if (typeof plug.plugId === "string" && plug.plugId.length !== 0) {
                                            let found = result.plugs.indexOf(result.plugs.find((plugResult) => {
                                                return plugResult.plugId === plug.plugId;
                                            }));

                                            if (found == -1) {
                                                plug.statusChangeDate = new Date();

                                                if (plug.status === process.env.PlugStatusAvailable) {
                                                    let notify = {
                                                        clientName: result.clientName,
                                                        hwId: result.hwId,
                                                        plugId: plug.plugId
                                                    };
                                                    notifymeHistory(notify);
                                                };

                                                let dataPlugStatusChange = {
                                                    hwId: result.hwId,
                                                    plugId: plug.plugId,
                                                    status: plug.status,
                                                    substatus: plug.substatus,
                                                    date: plug.statusChangeDate ? plug.statusChangeDate : new Date(),
                                                    address: result.address
                                                };

                                                //sendToSaveDataPlugStatusChange(dataPlugStatusChange)


                                                verifyQrCode(result, plug)
                                                    .then((qrCodeFound) => {
                                                        if (qrCodeFound) {
                                                            // console.log(qrCodeFound);
                                                            plug.qrCodeId = qrCodeFound.qrCodeId;
                                                            result.plugs.push(plug);
                                                            resolve(true);
                                                        }
                                                        else {
                                                            var qrCode = new QrCode(
                                                                {
                                                                    qrCode: {
                                                                        hwId: result.hwId,
                                                                        plugId: plug.plugId,
                                                                        chargerType: result.chargerType,
                                                                        chargingDistance: result.chargingDistance,
                                                                        geometry: result.geometry
                                                                    }
                                                                }
                                                            );
                                                            saveQrCode(qrCode)
                                                                .then((qrCode) => {
                                                                    plug.qrCodeId = qrCode.qrCodeId;
                                                                    result.plugs.push(plug);
                                                                    resolve(true);
                                                                })
                                                                .catch((error) => {
                                                                    console.error(`[${context}] Error `, error.message);
                                                                    reject(error);
                                                                });
                                                        };
                                                    })
                                                    .catch((error) => {
                                                        reject(error);
                                                    });

                                            }
                                            else {
                                                if (result.plugs[found].status !== plug.status) {
                                                    result.plugs[found].statusChangeDate = new Date();

                                                    if (plug.status === process.env.PlugStatusAvailable) {
                                                        let notify = {
                                                            clientName: result.clientName,
                                                            hwId: result.hwId,
                                                            plugId: plug.plugId,
                                                        };
                                                        notifymeHistory(notify);
                                                    };

                                                    let dataPlugStatusChange = {
                                                        hwId: result.hwId,
                                                        plugId: plug.plugId,
                                                        status: plug.status,
                                                        substatus: plug.substatus,
                                                        date: plug.statusChangeDate ? plug.statusChangeDate : new Date(),
                                                        address: result.address
                                                    };

                                                    //sendToSaveDataPlugStatusChange(dataPlugStatusChange)

                                                }

                                                result.plugs[found].status = plug.status;
                                                result.plugs[found].plugId = plug.plugId;
                                                result.plugs[found].connectorType = plug.connectorType;
                                                result.plugs[found].subStatus = plug.subStatus;
                                                result.plugs[found].evseStatus = plug.evseStatus;
                                                if (plug.amperage !== undefined && plug.amperage !== "") {
                                                    result.plugs[found].amperage = plug.amperage;
                                                };
                                                if (plug.power !== undefined && plug.power !== "") {
                                                    result.plugs[found].power = plug.power;
                                                };
                                                if (plug.voltage !== undefined && plug.voltage !== "") {
                                                    result.plugs[found].voltage = plug.voltage;
                                                };
                                                if (plug.active !== undefined) {
                                                    result.plugs[found].active = plug.active;
                                                };
                                                resolve(true);
                                            };

                                        } else {
                                            var error = {
                                                message: "Plug Id is required"
                                            };
                                            reject(error);
                                        };
                                    } catch (error) {
                                        reject(error);
                                    };
                                });
                            };
                            Promise.all(
                                charger.plugs.map(plug => checkPlug(plug))
                            ).then((values) => {
                                var newValues = { $set: result };
                                //console.log("Update Charger: ", newValues);
                                updateCharger(query, newValues)
                                    .then((answers) => {
                                        if (answers)
                                            return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                        else
                                            return res.status(400).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            }).catch((error) => {
                                console.error(`[${context}][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                        };

                    }
                    else {
                        return res.status(500).send({ auth: true, code: "server_charger_not_found", message: 'Charger not found for given parameters' });
                    };
                };
            });

        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/chargers/plugs_new', async (req, res, next) => {
    const context = "PATCH /api/private/chargers/plugs";
    try {

        let response = await ChargersHandler(res)
        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

/** Used to update the set points of chargers plugs for energy management */
router.patch('/api/private/chargers/plugs/v1/setpoints', chargerMiddleware.ValidatePlugsSetPointsRequest, ChargersHandler.handlePatchSetPointsRequest)

//patch to config plugs
router.patch('/api/private/chargers/configPlugs', async (req, res, next) => {
    var context = "PATCH /api/private/chargers/configPlugs";
    try {

        if (!req.body._id) {
            return res.status(400).send({ auth: false, code: 'server_id_required', message: "Id is required" })
        }
        if (req.body.plugs === undefined || req.body.plugs.length < 1) {
            return res.status(400).send({ auth: false, code: 'server_plug_data_required', message: "Plug data is required" })
        }
        if (req.body.plugs.length > 1) {
            return res.status(400).send({ auth: false, code: 'server_only_one_plug', message: "Only one plug can be edited" })
        }
        else {

            let chargerId = req.body._id;
            let plug = req.body.plugs[0];

            let query = {
                _id: chargerId,
                active: true,
                hasInfrastructure: true,
                "plugs.plugId": plug.plugId
            };

            let newValue = {
                $set: {
                    "plugs.$.plugId": plug.plugId,
                    "plugs.$.connectorType": plug.connectorType,
                    "plugs.$.amperage": plug.amperage,
                    "plugs.$.voltage": plug.voltage,
                    "plugs.$.power": plug.power,
                    "plugs.$.active": plug.active
                }
            };

            let updatedCharger = await Charger.findOneAndUpdate(query, newValue, { new: true }).lean()
            if (updatedCharger) {
                changeAvailability(updatedCharger.hwId, plug.plugId, plug.active)
                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
            } else {
                return res.status(400).send({ auth: false, code: 'server_plug_not_updated', message: "Charger not in a valid state to be updated" });
            };
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update rating of charger
router.patch('/api/private/chargers/rating', (req, res, next) => {
    var context = "PATCH /api/private/chargers/rating";
    try {
        var calc = req.body;
        var query = {};
        if (Object.keys(calc).length !== 0) {
            if (calc._id != undefined && calc.hwId != undefined) {
                query = {
                    $or: [
                        { _id: calc._id },
                        { hwId: calc.hwId }
                    ],
                    hasInfrastructure: true
                };
            }
            else if (calc._id != undefined) {
                query = {
                    _id: calc._id,
                    hasInfrastructure: true
                };
            }
            else {
                query = {
                    hwId: calc.hwId,
                    hasInfrastructure: true
                };
            };
        }
        else {
            return res.status(400).send({ auth: false, code: 'server_data_required', message: "Data is required" });
        };
        var fields = {
            _id: 1,
            rating: 1,
            numberOfSessions: 1
        };

        Charger.findOne(query, fields, (err, result) => {
            if (err) {
                console.error(`[${context}][fnidOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {
                    var newRating = ((result.rating * result.numberOfSessions) + calc.rating) / (result.numberOfSessions + 1);
                    result.rating = newRating;
                    result.numberOfSessions += 1;
                    var newValues = { $set: result };
                    updateCharger(query, newValues)
                        .then((value) => {
                            return res.status(200).send({ auth: true, code: 'server_rating_updated', message: "Rating updated successfully" })
                        })
                        .catch((error) => {
                            console.error(`[${context}][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(200).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for the given parameters." });
                };
            };

        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update images of charger
router.patch('/api/private/chargers/images', (req, res, next) => {
    var context = "PATCH /api/private/chargers/images";
    try {
        var charger = req.body;
        var num = 0;
        const updateImageContent = (image) => {
            return new Promise((resolve, reject) => {

                var path = '/usr/src/app/img/chargers/' + charger.imageContent[num];
                var base64Image = image.split(';base64,').pop();
                fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                    if (err) {
                        console.error(`[${context}][updateImageContent] Error `, err.message);;
                        reject(err);
                    }
                    else {
                        resolve(true);
                    };
                });
                num += 1;
            });
        };
        Promise.all(
            charger.newImage.map(image => updateImageContent(image))
        ).then((result) => {
            return res.status(200).send({ auth: true, code: 'server_images_updated', message: "Images updated successfully" })
        }).catch((error) => {
            console.error(`[${context}][charger.newImage.map] Error `, error.message);
            return res.status(500).send(error.message);
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message); K
        return res.status(500).send(error.message);
    };
});

//Update Heart Beat
router.patch('/api/private/chargers/heartBeat', async (req, res, next) => {
    var context = "PATCH /api/private/chargers/heartBeat";
    try {
        var query = req.body;
        query.hasInfrastructure = true;

        let chargerFound = await Charger.findOne(query, { _id: 1, status: 1 });
        /*Charger.findOne(query, (err, chargerFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {*/
        if (!chargerFound) {
            return res.status(200).send(null);
        }

        var newDataCharger = {
            heartBeat: new Date(new Date().toISOString()),
            status: process.env.ChargePointStatusEVIO,
            active: true
        };
        var newValues = { $set: newDataCharger };
        Charger.findOneAndUpdate(query, newValues, { new: true }, (err, result) => {
            if (err) {
                console.error(`[${context}][updateCharger] Error `, err.message);;
                return res.status(500).send(err.message);
            }
            else {

                if (chargerFound.status != newDataCharger.status) {
                    notifymeHistory(result);
                }

                if (result) {
                    return res.status(200).send(result.data);
                } else {
                    return res.status(200).send(null);
                }
            };
        });
        /*}
        else {
            return res.status(200).send(null);
        };
    };
});*/
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to change Availability
router.patch('/api/private/chargers/updateAvailability', (req, res, next) => {
    var context = "PATCH /api/private/chargers/updateAvailability";
    try {
        var received = req.body;
        var query = {
            _id: received._id,
            hasInfrastructure: true
        };
        chargerFindOne(query)
            .then((chargerFound) => {
                if (chargerFound) {
                    validateSession(chargerFound)
                        .then((result) => {
                            if (result) {
                                return res.status(400).send({ auth: false, code: 'server_availability_not_update', message: "Availability cannot be edited. Charger in use" });
                            }
                            else {

                                if (received.availability.availabilityType === process.env.ChargerAvailabilityAlways) {
                                    var availability = {
                                        availabilityType: received.availability.availabilityType
                                    };
                                    chargerFound.availability = availability;
                                }
                                else {
                                    chargerFound.availability = received.availability;
                                };
                                var newValue = { $set: chargerFound };
                                updateChargerFilter(query, newValue, { new: true })
                                    .then((newChargerFound) => {
                                        if (newChargerFound)
                                            return res.status(200).send(newChargerFound);
                                        else {
                                            return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                        };
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateCharger] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][validateSession] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to change access type
router.patch('/api/private/chargers/updateAccessType', (req, res, next) => {
    var context = "PATCH /api/private/chargers/updateAccessType";
    try {

        var clientRequest = req.headers.client;

        //console.log("clientRequest", clientRequest);

        var received = req.body;
        var query = {
            _id: received._id,
            hasInfrastructure: true
        };
        chargerFindOne(query)
            .then((chargerFound) => {
                if (chargerFound) {

                    validateSession(chargerFound)
                        .then((result) => {
                            if (result) {
                                return res.status(400).send({ auth: false, code: 'server_accessType_not_update', message: "AccessType cannot be edited. Charger in use" });
                            } else {

                                if (received.accessType === process.env.ChargerAccessPrivate || received.accessType === process.env.ChargerAccessFreeCharge) {

                                    chargerFound.accessType = received.accessType;
                                    chargerFound.listOfGroups = [];
                                    chargerFound.listOfFleets = [];

                                } else {

                                    chargerFound.accessType = received.accessType;
                                    if (received.accessType === process.env.ChargerAccessPublic) {
                                        if (received.mapVisibility === undefined || received.mapVisibility === null) {
                                            chargerFound.mapVisibility = chargerFound.mapVisibility;
                                        }
                                        else
                                            chargerFound.mapVisibility = received.mapVisibility;
                                    };

                                    if (received.listOfGroups != undefined) {

                                        chargerFound.listOfGroups = received.listOfGroups;

                                    }
                                    else {

                                        chargerFound.listOfGroups = [];

                                    };
                                    //chargerFound.listOfGroups = received.listOfGroups;

                                    if (clientRequest === process.env.ClientTypeBackOffice) {

                                        if (received.listOfFleets != undefined) {

                                            chargerFound.listOfFleets = received.listOfFleets;

                                        }
                                        else {

                                            chargerFound.listOfFleets = [];

                                        };

                                    }

                                };

                                changeTariff(chargerFound)
                                    .then((chargerFound) => {

                                        //var newValue = { $set: chargerFound };
                                        var newValue;
                                        if (received.accessType === process.env.ChargerAccessPublic) {

                                            newValue = {
                                                $set: {
                                                    accessType: chargerFound.accessType,
                                                    listOfGroups: chargerFound.listOfGroups,
                                                    listOfFleets: chargerFound.listOfFleets,
                                                    plugs: chargerFound.plugs,
                                                    mapVisibility: chargerFound.mapVisibility
                                                }
                                            };

                                        }
                                        else {

                                            newValue = {
                                                $set: {
                                                    accessType: chargerFound.accessType,
                                                    listOfGroups: chargerFound.listOfGroups,
                                                    listOfFleets: chargerFound.listOfFleets,
                                                    plugs: chargerFound.plugs
                                                }
                                            };

                                        };
                                        updateChargerFilter(query, newValue, { new: true })
                                            //updateCharger(query, newValue)
                                            .then((result) => {

                                                if (result) {
                                                    return res.status(200).send(result);
                                                } else {
                                                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                }


                                            })
                                            .catch((error) => {

                                                console.error(`[${context}][updateCharger] Error `, error.message);
                                                return res.status(500).send(error.message);

                                            });

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][changeTariff] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][validateSession] Error `, error.message);
                            return res.status(500).send(error.message);
                        });

                } else {

                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });

                };
            })
            .catch((error) => {

                console.error(`[${context}][chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);

            });
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//remove groupsCSUsers from a charger
router.patch('/api/private/chargers/groupCSUsers', (req, res, next) => {
    var context = "PATCH /api/private/chargers/groupCSUsers";
    try {
        var charger = req.body;
        var query = {
            _id: charger._id,
            hasInfrastructure: true
        };
        chargerFindOne(query)
            .then((chargerFound) => {
                Promise.all(
                    charger.listOfGroups.map(groups => {
                        return new Promise((resolve, reject) => {
                            Promise.all(
                                chargerFound.plugs.map(plug => {
                                    return new Promise((resolve, reject) => {
                                        plug.tariff = plug.tariff.filter(tariff => {
                                            return tariff.groupId != groups;
                                        });
                                        resolve(true);
                                    });
                                })
                            ).then((result) => {
                                chargerFound.listOfGroups = chargerFound.listOfGroups.filter(group => {
                                    return group.groupId !== groups;
                                });
                                resolve(true);
                            }).catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                        });
                    })
                ).then((result) => {
                    var newValues = { $set: chargerFound };
                    updateCharger(query, newValues)
                        .then((value) => {
                            return res.status(200).send(chargerFound);
                        })
                        .catch((error) => {
                            console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }).catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);
                });
            })
            .catch((error) => {
                console.error(`[${context}][chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//remove a groupsCSUsers from chargers (internal endpoint)
router.patch('/api/private/chargers/removeGroupCSUsers', (req, res, next) => {
    var context = "PATCH /api/private/chargers/removeGroupCSUsers";
    try {
        var group = req.body;
        var query = {
            listOfGroups: {
                $elemMatch: {
                    groupId: group.groupCSUsers
                }
            },
            hasInfrastructure: true
        };
        chargerFind(query)
            .then((chargersFound) => {
                if (chargersFound.length == 0) {
                    return res.status(200).send(true);
                }
                else {
                    Promise.all(
                        chargersFound.map(charger => {
                            return new Promise((resolve, reject) => {
                                Promise.all(
                                    charger.plugs.map(plug => {
                                        return new Promise((resolve, reject) => {
                                            plug.tariff = plug.tariff.filter(tariff => {
                                                return tariff.groupId != group.groupCSUsers;
                                            });
                                            resolve(true);
                                        });
                                    })
                                ).then((result) => {
                                    charger.listOfGroups = charger.listOfGroups.filter(groups => {
                                        return groups.groupId != group.groupCSUsers;
                                    });
                                    var query = {
                                        _id: charger._id
                                    };
                                    var newValues = { $set: charger };
                                    updateCharger(query, newValues)
                                        .then((result) => {
                                            if (result) {
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            };
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}] Error `, error.message);
                                            reject(error);
                                        });
                                }).catch((error) => {
                                    console.error(`[${context}] Error `, error.message);
                                    reject(error);
                                });
                            });
                        })
                    ).then((result) => {
                        return res.status(200).send(true);
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Change status charger evio when mqtt fail (Internal endpoint)
router.patch('/api/private/chargers/mqttFail', (req, res, next) => {
    var context = "PATCH /api/private/chargers/mqttFail";
    try {

        var query = req.body;
        query.active = true;
        query.hasInfrastructure = true;

        chargerFind(query)
            .then((chargerFound) => {
                if (chargerFound.length == 0) {
                    return res.status(200).send(true);
                }
                else {
                    Promise.all(
                        chargerFound.map(charger => {
                            return new Promise((resolve, reject) => {
                                charger.status = process.env.ChargePointStatusEVIOFaulted;
                                var query = {
                                    _id: charger._id
                                };
                                var newValues = { $set: charger };
                                updateCharger(query, newValues)
                                    .then((result) => {
                                        resolve(result);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}] Error `, error.message);
                                        reject(error);
                                    });
                            });
                        })
                    ).then(() => {
                        return res.status(200).send(true);
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/chargers/parkingSession', (req, res, next) => {
    var context = "PATCH /api/private/chargers/parkingSession";
    try {

        var charger = req.body;
        var query = { _id: charger._id };
        var newValues = { $set: charger };

        updateCharger(query, newValues)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.error('[updateCharger] Error ', error);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Internal endpoint
router.patch('/api/private/chargers/removeFleetFromChargers', (req, res, next) => {
    var context = "PATCH /api/private/chargers/removeFleetFromChargers";
    try {

        let received = req.body;

        let query = {
            listOfFleets: {
                $elemMatch: {
                    fleetId: received.fleetId
                }
            }
        };

        let fields = {
            listOfFleets: 1,
            plugs: 1

        };

        //console.log("received", received)

        Charger.find(query, fields, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {

                if (result.length > 0) {
                    Promise.all(
                        result.map(charger => {
                            return new Promise((resolve, reject) => {

                                charger.listOfFleets = charger.listOfFleets.filter(elem => {
                                    return elem.fleetId !== received.fleetId
                                });

                                Promise.all(
                                    charger.plugs.map(plug => {
                                        return new Promise((resolve, reject) => {
                                            plug.tariff = plug.tariff.filter(tariff => {
                                                return tariff.fleetId != received.fleetId;
                                            });
                                            resolve(true);
                                        });
                                    })
                                ).then(() => {

                                    let query = {
                                        _id: charger._id
                                    };
                                    let newValues = {
                                        $set: {
                                            listOfFleets: charger.listOfFleets,
                                            plugs: charger.plugs
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

                                }).catch((error) => {
                                    console.error(`[${context}] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });

                            });
                        })
                    ).then(() => {

                        return res.status(200).send("OK");

                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                }
                else {
                    return res.status(200).send("OK");
                };

            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to add purchase tariff to charger
router.patch('/api/private/chargers/addPurchaseTariff', (req, res, next) => {
    let context = "PATCH /api/private/chargers/addPurchaseTariff";
    let received = req.body;

    //console.log("received", received);

    validateFieldsAddPurchaseTariff(received)
        .then(() => {

            Charger.updateChargerFilter({ _id: received._id }, { $set: { purchaseTariff: received.purchaseTariff } }, { new: true }, (err, chargerUpdated) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    return res.status(500).send(err.message);
                }

                if (chargerUpdated) {
                    return res.status(200).send(chargerUpdated);
                } else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                }
            });

        })
        .catch((error) => {
            return res.status(400).send(error);
        });

});

//update purchase tariff to multi chargers
router.patch('/api/private/chargers/updatePurchaseTariff', (req, res, next) => {
    let context = "PATCH /api/private/chargers/updatePurchaseTariff";
    let received = req.body;

    //console.log("received", received);

    let query = {
        "purchaseTariff.purchaseTariffId": received._id
    };

    received.purchaseTariffId = received._id;

    //console.log("query", query);
    //console.log("received", received);

    Charger.updateMany(query, { $set: { purchaseTariff: received } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }

        //console.log("result", result);
        if (result.n === result.nModified) {
            return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
        } else {
            return res.status(400).send({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
        };

    })

});

//Change Operational Status to Approval
router.patch('/api/private/chargers/operationalStatus', async (req, res, next) => {
    let context = "PATCH /api/private/chargers/operationalStatus";

    let received = req.body;

    if (!received.chargerId) {
        return res.status(400).send({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
    };

    if (!received.operationalStatus) {
        return res.status(400).send({ auth: false, code: 'server_operationalStatus_required', message: "Operational Status data is required" });
    };

    let query = {
        _id: received.chargerId
    };

    let newValues = {
        operationalStatus: received.operationalStatus
    };

    Charger.updateChargerFilter(query, { $set: newValues }, { new: true }, (err, newCharger) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        } else {
            return res.status(200).send(newCharger);
        };
    });

});

//========== PUT ==========
//Add new Images to a charger
router.put('/api/private/chargers/images', (req, res, next) => {
    var context = "PUT /api/private/chargers/images";
    try {
        var charger = req.body;
        var query = {
            _id: charger._id,
            hasInfrastructure: true
        };

        Charger.findOne(query, (err, chargerFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (chargerFound) {
                    addImageContent(charger, chargerFound)
                        .then((result) => {
                            var newValues = { $set: result };
                            updateCharger(query, newValues)
                                .then((value) => {
                                    return res.status(200).send(result);
                                })
                                .catch((error) => {
                                    console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }).catch((error) => {
                            console.error(`[${context}][addImageContent][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        })
                } else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Add new groupsCSUsers to a charger
router.put('/api/private/chargers/groupCSUsers', (req, res, next) => {
    var context = "PUT /api/private/chargers/groupCSUsers";
    try {
        var charger = req.body;
        var query = {
            _id: charger._id,
            hasInfrastructure: true
        };
        chargerFindOne(query)
            .then((chargerFound) => {
                if (chargerFound) {
                    Promise.all(
                        charger.listOfGroups.map(group => {
                            return new Promise((resolve, reject) => {
                                var found = chargerFound.listOfGroups.find(newGroup => {
                                    return newGroup.groupId === group.groupId;
                                });
                                if (found) {
                                    resolve(true);
                                }
                                else {
                                    chargerFound.listOfGroups.push(group);
                                    Promise.all(
                                        chargerFound.plugs.map(plug => {
                                            return new Promise((resolve) => {
                                                var tariff = {
                                                    groupName: group.groupName,
                                                    groupId: group.groupId,
                                                    tariffId: ''
                                                };
                                                plug.tariff.push(tariff);
                                                resolve(true);
                                            });
                                        })
                                    ).then((result) => {
                                        resolve(true);
                                    });
                                };
                            });
                        })
                    ).then((result) => {
                        var newValues = { $set: chargerFound };
                        updateCharger(query, newValues)
                            .then((value) => {
                                return res.status(200).send(chargerFound);
                            })
                            .catch((error) => {
                                console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.put('/api/private/chargers/statusAvailable', (req, res, next) => {
    var context = "PUT /api/private/chargers/statusAvailable";
    try {


        var received = req.body;

        var query = {
            hwId: received.hwId,
            hasInfrastructure: true,
            "plugs.plugId": received.plugId
        };

        var newValues = {
            $set: {
                "plugs.$.status": received.status
            }
        };

        updateCharger(query, newValues)
            .then((result) => {

                return res.status(200).send(result);

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//========== DELETE ==========
//Delete a charger
router.delete('/api/private/chargers', async (req, res, next) => {
    var context = "DELETE /api/private/chargers";
    try {

        var userId = req.headers['userid'];
        var charger = req.body;

        var query = {
            _id: charger._id,
            hasInfrastructure: true
        };

        let chargerFound = await chargerFindOne(query);

        var queryHwId = {
            hwId: chargerFound.hwId
        };

        var queryChargerId = {
            chargerId: chargerFound._id
        };

        let sessionsOfTheCharger = await chargingSessionFind(queryHwId);

        if (chargerFound) {

            var found = chargerFound.plugs.filter(plug => {
                return plug.status == process.env.PlugsStatusInUse;
            });

            if (found.length != 0) {

                return res.status(400).send({ auth: false, code: 'server_charger_in_use', message: "Charger has not been deleted, charger in use" });

            }
            else {

                if (chargerFound.infrastructure != "") {

                    var infra = {
                        _id: chargerFound.infrastructure,
                        chargerId: chargerFound._id
                    };

                    removeFromInfra(infra);

                };

                if (chargerFound.chargerType === '002') {
                    var host = process.env.HostSonOff + process.env.PathRemoveSonOff;
                    var data = {
                        hwId: chargerFound.hwId
                    };
                    axios.post(host, data);
                }

                if (chargerFound.chargerType === '007') {

                    var host = process.env.HostEVIOBox + process.env.PathRemoveEVIOBOx;
                    var data = {
                        hwId: chargerFound.hwId
                    };
                    axios.post(host, data);
                }

                removeQrCode(chargerFound);
                deleteChargerFromFavorite(queryChargerId);
                managementPOIsDelete(queryHwId);

                if (sessionsOfTheCharger.length > 0) {

                    var chargerToDelete = {

                        active: false,
                        infrastructure: "",
                        hasInfrastructure: false,
                        status: process.env.ChargePointStatusEVIOFaulted,
                        operationalStatus: process.env.OperationalStatusRemoved

                    };
                    var newValues = { $set: chargerToDelete };
                    updateCharger(query, newValues)
                        .then((result) => {

                            if (result) {

                                return res.status(200).send({ auth: true, code: 'server_successfully_removed', message: "Charger successfully removed" });

                            }
                            else {

                                return res.status(400).send({ auth: false, code: 'server_unsuccessfully_removed', message: "Charger unsuccessfully removed" });

                            };
                        })
                        .catch((error) => {

                            return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });

                        });
                }
                else {

                    Charger.removeCharger(query, (error, result) => {
                        if (error) {

                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);

                        }
                        else {

                            if (result) {

                                return res.status(200).send({ auth: true, code: 'server_successfully_removed', message: "Charger successfully removed" });

                            }
                            else {

                                return res.status(400).send({ auth: false, code: 'server_unsuccessfully_removed', message: "Charger unsuccessfully removed" });

                            };

                        };

                    });

                };

            };

        }
        else {

            return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//Remove images of charger
router.delete('/api/private/chargers/images', (req, res, next) => {
    var context = "DELETE /api/private/chargers/images";
    try {
        var charger = req.body;
        var query = {
            _id: charger._id,
            hasInfrastructure: true
        };
        Charger.findOne(query, (err, chargerFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (chargerFound) {
                    const removeImage = (image) => {
                        return new Promise((resolve, reject) => {
                            var path = '/usr/src/app/img/chargers/' + image;
                            fs.unlink(path, (err) => {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);;
                                    //reject(err)
                                    resolve(true);
                                }
                                else {
                                    var found = chargerFound.imageContent.indexOf(chargerFound.imageContent.find((url) => {
                                        return url.includes(image);
                                    }));
                                    if (found >= 0) {
                                        chargerFound.imageContent.splice(found, 1);
                                        resolve(true);
                                    } else {
                                        reject(false);
                                    };
                                };
                            });
                        });
                    };
                    Promise.all(
                        charger.imageContent.map(image => removeImage(image))
                    ).then((result) => {
                        var newValues = { $set: chargerFound }
                        updateCharger(query, newValues)
                            .then((resul) => {
                                return res.status(200).send(chargerFound);
                            })
                            .catch((error) => {
                                console.error(`[${context}][updateCharger] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }).catch((error) => {
                        console.error(`[${context}][charger.imageContent.map] Error `, error.message);
                        return res.status(500).send(error.message);
                    })
                } else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.delete('/api/private/chargers/removePurchaseTariff', (req, res, next) => {
    let context = "DELETE /api/private/chargers/removePurchaseTariff";
    let received = req.body;

    Charger.updateChargerFilter({ _id: received._id }, { $set: { purchaseTariff: {} } }, { new: true }, (err, chargerUpdated) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }

        if (chargerUpdated) {
            return res.status(200).send(chargerUpdated);
        } else {
            return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
        }
    });

});

cron.schedule('0 */12 * * *', () => {
    console.log("Running routine to get ConfigurationKeys from all OCPP chargers")
    getConfigurationKeysAllChargers()
});

cron.schedule('0 0 */2 * *', () => {
    console.log("Running routine to update offline whitelists")
    ChargersHandler.forceUpdateWhiteLists()
});

//JOB - GET ConfigurationKeys from all OCPP chargers
router.post('/api/job/getConfigurationKeysOCPPChargers', async (req, res) => {
    const context = "JOB getConfigurationKeysOCPPChargers";
    try {
        console.info(`[${context}] Process started`);
        await getConfigurationKeysAllChargers();

        console.info(`[${context}] Process completed`)
        return res.status(StatusCodes.OK).send(`${context} - Process completed successfully`);
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    };
});

//JOB - Force Update Whitelists
router.post('/api/job/forceUpdateWhiteLists', async (req, res) => {
    const context = "JOB forceUpdateWhiteLists";
    try {
        console.info(`[${context}] Process started`);
        await ChargersHandler.forceUpdateWhiteLists();

        console.info(`[${context}] Process completed`)
        return res.status(StatusCodes.OK).send(`${context} - Process completed successfully`);
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: `${context} - An error occurred while processing` });
    };
});

router.post('/api/private/chargers/:hwId/updateWhiteList', async (req, res) => {
    try {
        const { hwId } = req.params
        const result = await ChargersHandler.forceUpdateWhiteListByHwId(hwId);

        return res.status(StatusCodes.OK).send(result);
    } catch (error) {
        console.error(`Unexpected Error`, error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ success: false, message: `An error occurred while processing`, cause: error });
    };
});

async function getConfigurationKeysAllChargers() {
    var context = "Function getConfigurationKeysAllChargers";
    try {
        let allActiveOCPPChargers = await Charger.find({ chargerType: process.env.OCPPJ16Type, status: "10" })
        for (let chargerI of allActiveOCPPChargers) {
            await getChargerConfigurationKeys(chargerI)
        }
        return allActiveOCPPChargers
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getChargerConfigurationKeys(charger) {
    var context = "Function getChargerConfigurationKeys";
    try {
        let body = {
            hwId: charger.hwId
        }
        let configurationKeysHost = process.env.HostOCPP16 + process.env.PathGetConfigurationKeys
        let resp = await axios.post(configurationKeysHost, body)
        if (resp.data) {
            console.log(`[${context}] Configuration keys of charger ${charger.hwId} updated with success!`)
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

//========== FUNCTION ==========
//Function to validate fields received
function validateFields(charger) {
    return new Promise((resolve, reject) => {
        if (!charger)
            reject({ auth: false, code: 'server_charger_data_required', message: 'Charger data required' });

        else if (!charger.hwId)
            reject({ auth: false, code: 'server_hwid_required', message: 'Charger Hardware Id is required' });
        else
            resolve(true);

    });
};

function validateFieldsAddPurchaseTariff(received) {
    return new Promise((resolve, reject) => {
        if (!received._id) {
            reject({ auth: false, code: 'server_charger_id_required', message: "Charger id is required" });
        }
        else if (!received.purchaseTariff || Object.keys(received.purchaseTariff).length == 0) {
            reject({ auth: false, code: 'server_purchaseTariff_data_required', message: "PurchaseTariff data required" });
        }
        else
            resolve(true);

    });
};

//Function to update a charger
function updateCharger(query, values) {
    var context = "Function updateCharger";
    return new Promise((resolve, reject) => {
        try {

            Charger.updateCharger(query, values, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateCharger] Error `, err.message);;
                    reject(err);
                }
                else {
                    if (result) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    };
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

export function updateChargerFilter(query, values, filter) {
    var context = "Function updateChargerFilter";
    return new Promise((resolve, reject) => {
        try {
            Charger.updateChargerFilter(query, values, filter, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateChargerFilter] Error `, err.message);;
                    reject(err);
                }
                else {
                    resolve(result);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to get users group map
function getGroupsCSUsersMap(user) {
    var context = "Function getGroupsCSUsersMap";
    return new Promise((resolve, reject) => {
        try {
            var headers = { userid: user };
            var host = process.env.HostUser + process.env.PathGetGroupCSUsersMap;
            axios.get(host, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][get][.catch] Error `, error.message);
                    //reject(error.response.data);
                    resolve([]);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            //reject(error);
            resolve([]);
        };
    });
};

function getGroupsMap(userId) {
    var context = "Function getGroupsMap in routes/chargers.js";
    return findGroupCSUserGroupMap(userId)
        .catch((error) => {
            captureException(error);
            console.error(`[${context}][.catch] Error `, error.message);
            throw error;
        });
};

function getFleetsMap(user) {
    var context = "Function getFleetsMap";
    return new Promise((resolve, reject) => {
        try {
            var headers = { userid: user };
            var host = process.env.HostEvs + process.env.PathFleetsMap;
            axios.get(host, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][get][.catch] Error `, error.message);
                    //reject(error.response.data);
                    resolve([]);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            //reject(error);
            resolve([]);
        };
    });
};

//Function to verify if a group exist on charger
function verifyGroup(charger, answer, userId, groups) {
    var context = "Function verifyGroup";
    return new Promise((resolve, reject) => {
        try {
            var notBaseId = groups.groups.filter((elem) => {
                return elem.baseId === "";
            });
            var baseId = groups.groups.filter((elem) => {
                return elem.baseId !== "";
            });

            if (notBaseId.length > 0) {
                reject({ auth: false, code: 'server_baseId_required', message: "Group Id is required" });
            }
            else if (baseId.length > 0) {

                var baseIdUndef = baseId.filter((element) => {
                    return element.baseId === undefined;
                });

                var withBaseId = baseId.filter((element) => {
                    return element.baseId !== undefined;
                });

                if (baseIdUndef.length > 0) {
                    reject({ auth: false, code: 'server_baseId_required', message: "Group Id is required" });
                }
                else if (withBaseId.length > 0) {
                    var exist = [];
                    groups.groups.forEach(group => {
                        var found = charger.groups.find((elem) => {
                            return elem.baseId === group.baseId;
                        });
                        if (found == undefined) {
                            var newGroup = {
                                baseId: group.baseId
                            };
                            charger.groups.push(newGroup);
                            charger.modifyUser = userId;
                            charger.accessType = process.env.ChargerAccessRestrict;
                            exist.push("Add to the group " + group.baseId);
                        }
                        else {
                            exist.push("Already in the group " + group.baseId);
                        }
                    });
                    answer.exist = exist;
                    answer.result = charger;
                    resolve(answer);
                }
                else {
                    reject({ auth: false, code: 'server_groups_required', message: "Groups are required" });
                };
            }
            else {
                reject({ auth: false, code: 'server_groups_required', message: "Groups are required" });
            };
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to save image in file
function saveImageContent(charger) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {
            const saveImageContent = (image, index) => {
                return new Promise((resolve, reject) => {

                    var dateNow = Date.now();
                    var path = `/usr/src/app/img/chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                    var pathImage = '';
                    var base64Image = image.split(';base64,').pop();
                    if (process.env.NODE_ENV === 'production') {
                        pathImage = `${process.env.HostProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For PROD server
                    }
                    else if (process.env.NODE_ENV === 'pre-production') {
                        pathImage = `${process.env.HostPreProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;// For Pred PROD server
                    }
                    else {
                        //pathImage = `${process.env.HostLocal}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                        pathImage = `${process.env.HostQA}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For QA server
                    };
                    fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);;
                        }
                        else {
                            var defaultImage = parseInt(charger.defaultImage, 10);
                            if (index === defaultImage) {
                                charger.defaultImage = pathImage;
                            };
                            charger.imageContent[index] = pathImage;
                            resolve(true);
                        };
                    });
                });
            };
            Promise.all(
                charger.imageContent.map((image, index) => saveImageContent(image, index))
            ).then((result) => {
                resolve(charger);
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to add new image to a charger
function addImageContent(charger, chargerFound) {
    var context = "Function addImageContent";
    return new Promise((resolve, reject) => {
        try {
            var num = chargerFound.imageContent.length;
            const saveImageContent = (image) => {
                return new Promise((resolve, reject) => {
                    var path = '/usr/src/app/img/chargers/' + charger.hwId + '_' + num + '.jpg';
                    var pathImage = '';
                    var base64Image = image.split(';base64,').pop();
                    if (process.env.NODE_ENV === 'production') {
                        pathImage = process.env.HostProd + 'chargers/' + charger.hwId + '_' + num + '.jpg'; // For PROD server
                    }
                    else if (process.env.NODE_ENV === 'pre-production') {
                        pathImage = process.env.HostPreProd + 'chargers/' + charger.hwId + '_' + num + '.jpg'; // For Pred PROD server
                    }
                    else {
                        //pathImage = process.env.HostLocal  + chargers/' + charger.hwId + '_' + num + '.jpg';
                        pathImage = process.env.HostQA + 'chargers/' + charger.hwId + '_' + num + '.jpg'; // For QA server
                    };
                    fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                        if (err) {
                            console.error(`[${context}][saveImageContent] Error `, err.message);;
                            reject(err);
                        }
                        else {
                            resolve(true);
                        };
                    });
                    chargerFound.imageContent.push(pathImage);
                    num += 1;
                });
            };
            Promise.all(
                charger.newImage.map(image => saveImageContent(image))
            ).then((result) => {
                resolve(chargerFound);
            }).catch((error) => {
                reject(error);
            })

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to delete a file
function deleteFile(imageContent) {
    var context = "Function deleteFile";
    return new Promise((resolve, reject) => {
        try {
            var num = 0;
            while (num != imageContent.length) {
                var name = imageContent[num].split('/');
                var path = `/usr/src/app/img/chargers/${name[name.length - 1]}`;
                fs.unlink(path, (err) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        resolve(true);
                        //reject(err)
                    };
                });
                num += 1;
            };
            resolve(true);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to create a charger
function createCharger(charger, res) {
    var context = "Function createCharger";
    try {

        var query = {
            hwId: charger.hwId,
            hasInfrastructure: true
        };

        Charger.findOne(query, async (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            };

            if (!result) {

                // Funtion adding partyId, operator, operatorEmail and operatorContact to charger
                charger = await addOperatorInfoToCharger(charger);
                charger = await addOperatorId(charger);

                if (!charger.partyId) {
                    charger = await addOperatorEVIO(charger);
                }

                if (charger.plugs.length == 0) {

                    Charger.createCharger(charger, (err, result) => {
                        if (err) {
                            console.error(`[${context}][createCharger] Error `, err.message);
                            return res.status(500).send(err.message);
                        };

                        if (result) {
                            if (charger.chargerType === '002') {
                                var host = process.env.HostSonOff + process.env.PathSonOff;
                                var data = {
                                    hwId: charger.hwId
                                };
                                axios.post(host, data);
                            }
                            if (charger.chargerType === '007') {

                                var host = process.env.HostEVIOBox + process.env.PathEVIOBox;
                                var data = {
                                    hwId: charger.hwId
                                };
                                axios.post(host, data);
                            }
                            addInfrastructure(result);
                            createPOIs(charger);
                            Comission.create(charger.createUser, charger.hwId)
                            return res.status(200).send(result);
                        } else {
                            return res.status(400).send({ auth: false, code: 'server_charger_not_created', message: "Charger not created" });
                        };

                    });

                } else {

                    if (charger.chargerType === '002' || charger.chargerType === '007') {
                        Charger.createCharger(charger, (err, result) => {
                            if (err) {
                                console.error(`[${context}][createCharger] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {
                                    if (charger.chargerType === '002') {
                                        var host = process.env.HostSonOff + process.env.PathSonOff;
                                        var data = {
                                            hwId: charger.hwId
                                        };
                                        axios.post(host, data);
                                    }
                                    if (charger.chargerType === '007') {

                                        var host = process.env.HostEVIOBox + process.env.PathEVIOBox;
                                        var data = {
                                            hwId: charger.hwId
                                        };
                                        axios.post(host, data);
                                    }
                                    addInfrastructure(result);
                                    updateQrCode(charger);
                                    createPOIs(charger);
                                    return res.status(200).send(result);
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_charger_not_created', message: "Charger not created" });
                                };
                            };
                        });
                    } else {
                        addQrCodeId(charger)
                            .then((charger) => {
                                Charger.createCharger(charger, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][createCharger] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        if (result) {
                                            if (charger.chargerType === '002') {
                                                var host = process.env.HostSonOff + process.env.PathSonOff;
                                                var data = {
                                                    hwId: charger.hwId
                                                };
                                                axios.post(host, data);
                                            }
                                            if (charger.chargerType === '007') {

                                                var host = process.env.HostEVIOBox + process.env.PathEVIOBox;
                                                var data = {
                                                    hwId: charger.hwId
                                                };
                                                axios.post(host, data);
                                            }
                                            addInfrastructure(result);
                                            createPOIs(charger);
                                            return res.status(200).send(result);
                                        }
                                        else {
                                            return res.status(400).send({ auth: false, code: 'server_charger_not_created', message: "Charger not created" });
                                        };
                                    };
                                });
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    };

                };

            } else {

                return res.status(400).send({ auth: false, code: 'server_charger_already_registered', message: "Charger is already registered" });

            };

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
};

//Function to add a charger to an infrastructure
function addInfrastructure(charger) {
    var context = "Function addInfrastructure";
    try {
        var query = {
            _id: charger.infrastructure
        };
        Infrastructure.findOne(query, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);;
            } else {
                if (infrastructureFound) {
                    var toAdd = { chargerId: charger._id };
                    infrastructureFound.listChargers.push(toAdd);
                    var newValue = { $set: infrastructureFound };
                    Infrastructure.updateInfrastructure(query, newValue, (err, result) => {
                        if (err) {
                            console.error(`[${context}][updateInfrastructure] Error `, err.message);;
                        } else {
                            if (result)
                                console.error(`[${context}][updateInfrastructure] Charger added successfully`);
                            else
                                console.error(`[${context}][updateInfrastructure] Charger added unsuccessfully`);
                        };
                    });
                } else {
                    console.error(`[${context}][findOne] infrastructure not found`);
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

//Function to find one charger by query
function chargerFindOne(query) {
    var context = "Function chargerFindOne";
    return new Promise((resolve, reject) => {
        Charger.findOne(query, (err, chargerFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(chargerFound);
            };
        });
    });
};

//Function to find  charger by query
function chargerFind(query) {
    var context = "Function chargerFind";
    return new Promise((resolve, reject) => {
        Charger.find(query, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(chargersFound);
            };
        });
    });
};

export function changeTariff(charger) {
    var context = "Function changeTariff";
    return new Promise((resolve) => {

        Promise.all(

            charger.plugs.map(plug => {

                plug.statusChangeDate = new Date();
                var tariff = [];
                return new Promise((resolve) => {

                    if (charger.accessType === process.env.ChargerAccessRestrict) {

                        if (charger.listOfGroups.length > 0 && charger.listOfFleets.length === 0) {

                            //Só tem lista de grupos
                            Promise.all(
                                charger.listOfGroups.map(group => {
                                    return new Promise(resolve => {
                                        var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.groupId == group.groupId;
                                        }));
                                        if (found > -1) {

                                            var newTariff = {
                                                groupName: group.groupName,
                                                groupId: plug.tariff[found].groupId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };

                                            /*
                                            var found = tariff.find(verifyTariff => {
                                                return verifyTariff.groupId == newTariff.groupId
                                            });
                                            */

                                            tariff.push(newTariff);
                                            resolve(true);

                                        }
                                        else {
                                            var newTariff = {
                                                groupName: group.groupName,
                                                groupId: group.groupId,
                                                tariffId: "",
                                                tariffType: "",
                                                tariff: {},
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {
                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        var found = newTariffs.find(tar => {
                                            return tar.groupId == tariff[index].groupId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });

                        }
                        else if (charger.listOfGroups.length === 0 && charger.listOfFleets.length > 0) {

                            //Só tem lista de fleets
                            Promise.all(
                                charger.listOfFleets.map(group => {
                                    return new Promise(resolve => {
                                        var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.fleetId == group.fleetId;
                                        }));
                                        if (found > -1) {

                                            var newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: plug.tariff[found].fleetId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };

                                            /*
                                            var found = tariff.find(verifyTariff => {
                                                return verifyTariff.fleetId == newTariff.fleetId
                                            });
                                            */

                                            tariff.push(newTariff);
                                            resolve(true);

                                        }
                                        else {
                                            var newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: group.fleetId,
                                                tariffId: "",
                                                tariff: {},
                                                tariffType: "",
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {

                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        var found = newTariffs.find(tar => {
                                            return tar.fleetId == tariff[index].fleetId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });
                        }
                        else {

                            //Tem lista de fleets e de grupos
                            let newlist = charger.listOfGroups.concat(charger.listOfFleets);
                            Promise.all(
                                newlist.map(group => {
                                    return new Promise(resolve => {

                                        if (group.groupId != undefined) {

                                            var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.groupId == group.groupId;
                                            }));
                                            if (found > -1) {

                                                var newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: plug.tariff[found].groupId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };

                                                /*
                                                var found = tariff.find(verifyTariff => {
                                                    return verifyTariff.groupId == newTariff.groupId
                                                });
                                                */

                                                tariff.push(newTariff);
                                                resolve(true);

                                            }
                                            else {
                                                var newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: group.groupId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        }
                                        else {

                                            var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.fleetId == group.fleetId;
                                            }));
                                            if (found > -1) {

                                                var newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: plug.tariff[found].fleetId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };

                                                /*
                                                var found = tariff.find(verifyTariff => {
                                                    return verifyTariff.fleetId == newTariff.fleetId
                                                });
                                                */

                                                tariff.push(newTariff);
                                                resolve(true);

                                            }
                                            else {
                                                var newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: group.fleetId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        }

                                    });
                                })
                            ).then(async () => {

                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {

                                        if (tariff[index].groupId != undefined) {
                                            var found = newTariffs.find(tar => {
                                                return tar.groupId == tariff[index].groupId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        }
                                        else {
                                            var found = newTariffs.find(tar => {
                                                return tar.fleetId == tariff[index].fleetId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });
                        };

                    }
                    else if (charger.accessType === process.env.ChargerAccessPublic) {

                        var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                            return tariff.groupName === process.env.ChargerAccessPublic;
                        }));

                        if (found > -1) {
                            var newTariff = {
                                groupName: process.env.ChargerAccessPublic,
                                groupId: plug.tariff[found].groupId,
                                tariffId: plug.tariff[found].tariffId,
                                tariff: plug.tariff[found].tariff,
                                tariffType: plug.tariff[found].tariffType,
                                name: plug.tariff[found].name
                            };
                        }
                        else {
                            var newTariff = {
                                groupName: process.env.ChargerAccessPublic,
                                groupId: "",
                                tariffId: "",
                                tariff: {},
                                tariffType: "",
                                name: ""
                            };
                        }

                        tariff.push(newTariff);

                        if (charger.listOfGroups.length > 0 && charger.listOfFleets.length === 0) {

                            //Só tem lista de grupos
                            Promise.all(
                                charger.listOfGroups.map(group => {
                                    return new Promise(resolve => {
                                        var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.groupId === group.groupId;
                                        }));
                                        if (found > -1) {
                                            var newTariff = {
                                                groupName: group.groupName,
                                                groupId: plug.tariff[found].groupId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        }
                                        else {
                                            var newTariff = {
                                                groupName: group.groupName,
                                                groupId: group.groupId,
                                                tariffId: "",
                                                tariff: {},
                                                tariffType: "",
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {
                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        var found = newTariffs.find(tar => {
                                            return tar.groupId == tariff[index].groupId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });
                        }
                        else if (charger.listOfGroups.length === 0 && charger.listOfFleets.length > 0) {

                            //Só tem lista de fleets
                            Promise.all(
                                charger.listOfFleets.map(group => {
                                    return new Promise(resolve => {
                                        var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                            return tariff.fleetId === group.fleetId;
                                        }));
                                        if (found > -1) {
                                            var newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: plug.tariff[found].fleetId,
                                                tariffId: plug.tariff[found].tariffId,
                                                tariff: plug.tariff[found].tariff,
                                                tariffType: plug.tariff[found].tariffType,
                                                name: plug.tariff[found].name
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        }
                                        else {
                                            var newTariff = {
                                                fleetName: group.fleetName,
                                                fleetId: group.fleetId,
                                                tariffId: "",
                                                tariff: {},
                                                tariffType: "",
                                                name: ""
                                            };
                                            tariff.push(newTariff);
                                            resolve(true);
                                        };
                                    });
                                })
                            ).then(async () => {
                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {
                                        var found = newTariffs.find(tar => {
                                            return tar.fleetId == tariff[index].fleetId;
                                        });
                                        if (!found) {
                                            newTariffs[index] = tariff[index];
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });

                        }
                        else if (charger.listOfGroups.length > 0 && charger.listOfFleets.length > 0) {
                            //Tem lista de fleets e de grupos
                            let newlist = charger.listOfGroups.concat(charger.listOfFleets);
                            Promise.all(
                                newlist.map(group => {
                                    return new Promise(resolve => {

                                        if (group.groupId != undefined) {
                                            var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.groupId === group.groupId;
                                            }));
                                            if (found > -1) {
                                                var newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: plug.tariff[found].groupId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            }
                                            else {
                                                var newTariff = {
                                                    groupName: group.groupName,
                                                    groupId: group.groupId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        }
                                        else {
                                            var found = plug.tariff.indexOf(plug.tariff.find(tariff => {
                                                return tariff.fleetId === group.fleetId;
                                            }));
                                            if (found > -1) {
                                                var newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: plug.tariff[found].fleetId,
                                                    tariffId: plug.tariff[found].tariffId,
                                                    tariff: plug.tariff[found].tariff,
                                                    tariffType: plug.tariff[found].tariffType,
                                                    name: plug.tariff[found].name
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            }
                                            else {
                                                var newTariff = {
                                                    fleetName: group.fleetName,
                                                    fleetId: group.fleetId,
                                                    tariffId: "",
                                                    tariff: {},
                                                    tariffType: "",
                                                    name: ""
                                                };
                                                tariff.push(newTariff);
                                                resolve(true);
                                            };
                                        };
                                    });
                                })
                            ).then(async () => {
                                var newTariffs = [];
                                for (let index = 0; index < tariff.length; index++) {
                                    if (newTariffs.length == 0) {
                                        newTariffs[index] = tariff[index];
                                    }
                                    else {

                                        if (tariff[index].groupId != undefined) {
                                            var found = newTariffs.find(tar => {
                                                return tar.groupId == tariff[index].groupId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        }
                                        else {
                                            var found = newTariffs.find(tar => {
                                                return tar.fleetId == tariff[index].fleetId;
                                            });
                                            if (!found) {
                                                newTariffs[index] = tariff[index];
                                            };
                                        };
                                    };
                                }
                                plug.tariff = newTariffs;
                                resolve(true);
                            });

                        }
                        else {
                            plug.tariff = tariff;
                            resolve(true);
                        };

                    }
                    else {

                        /*
                        var newTariff = {
                            groupName: process.env.ChargerAccessPrivate,
                            groupId: "",
                            tariffId: ""
                        };
                        tariff.push(newTariff);
                        */
                        plug.tariff = [];
                        resolve(true);

                    };

                });

            })
        ).then(() => {
            resolve(charger);
        });

    });
};

function getTariffPlug(chargerFound) {
    var context = "Funciton getTariffPlug";
    return new Promise((resolve, reject) => {
        chargerFound = JSON.parse(JSON.stringify(chargerFound));
        const getTariffPlug = (plug) => {
            return new Promise((resolve, reject) => {

                let dateNow = new Date();

                if (plug.statusChangeDate) {

                    let statusChangeDate = new Date(plug.statusChangeDate)
                    plug.statusTime = ((dateNow.getTime() - statusChangeDate.getTime()) / 60000)

                } else {

                    let updatedAt = new Date(chargerFound.updatedAt);
                    plug.statusTime = ((dateNow.getTime() - updatedAt.getTime()) / 60000)

                }
                if (plug.tariff.length != 0) {
                    Promise.all(
                        plug.tariff.map(tariff => {
                            return new Promise((resolve, reject) => {

                                // console.log(context, " tariff.tariffId ", tariff.tariffId)
                                if (!tariff.tariffId) {
                                    if ((tariff.groupName == process.env.ChargerAccessPublic) || (tariff.groupName == process.env.ChargerAccessPrivate) || (tariff.groupName == process.env.ChargerAccessFreeCharge)) {
                                        resolve(true);
                                    }
                                    else {
                                        const query = {
                                            _id: tariff.groupId
                                        };
                                        findOneGroupCSUser(query)
                                            .then((groupCSUsers) => {
                                                if (groupCSUsers?.imageContent)
                                                    tariff.imageContent = groupCSUsers.imageContent;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    };
                                }
                                else {
                                    if (tariff.groupName == process.env.ChargerAccessPrivate) {
                                        resolve(true);
                                    }
                                    else if (tariff.groupName == process.env.ChargerAccessPublic) {

                                        var host = process.env.HostTariffs + process.env.PathGetTariff;
                                        var data = {
                                            _id: tariff.tariffId
                                        };
                                        axios.get(host, { data })
                                            .then((value) => {
                                                var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                tariff.name = tariffFound.name;
                                                tariff.tariffType = tariffFound.tariffType;
                                                tariff.tariff = tariffFound.tariff;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    }
                                    else {
                                        const query = {
                                            _id: tariff.groupId
                                        };
                                        findOneGroupCSUser(query)
                                            .then((groupCSUsers) => {
                                                if (groupCSUsers?.imageContent)
                                                    tariff.imageContent = groupCSUsers.imageContent;
                                                var host = process.env.HostTariffs + process.env.PathGetTariff;
                                                var data = {
                                                    _id: tariff.tariffId
                                                };
                                                axios.get(host, { data })
                                                    .then((value) => {
                                                        var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                        tariff.name = tariffFound.name;
                                                        tariff.tariffType = tariffFound.tariffType;
                                                        tariff.tariff = tariffFound.tariff;
                                                        resolve(true);
                                                    })
                                                    .catch((error) => {
                                                        console.error(`[${context}][axios.get] Error `, error.message);
                                                        reject(error);
                                                    });
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    };
                                };
                            });
                        })
                    ).then(() => {
                        resolve(true);
                    }).catch((error) => {
                        console.error(`[${context}] Promise.all] Error `, error.message);
                        reject(error);
                    })
                }
                else {
                    resolve(true);
                };
            });
        };
        Promise.all(
            chargerFound.plugs.map(plug => getTariffPlug(plug))
        ).then((result) => {
            resolve(chargerFound);
        }).catch((error) => {
            console.error(`[${context}] Promise.all] Error `, error.message);
            reject(error);
        });
    });
};

export const getListOfGroups = async (chargerFound) => {
    var context = "Funciton getListOfGroups";
    try {
        if (chargerFound?.listOfGroups?.length) {

            const groupIds = chargerFound.listOfGroups
                .map((group) =>
                    ObjectId.isValid(group.groupId?.toString())
                        ? new ObjectId(group.groupId.toString())
                        : undefined
                )
                .filter(group => Boolean(group))

            const query = { "_id": { $in: groupIds } }
            const groupsResult = await findGroupCSUser(query);
            const groupsResultWithGroupId = groupsResult.map(groupFound => {
                const group = chargerFound.listOfGroups.find(sourceGroup => sourceGroup.groupId == groupFound._id);
                delete groupFound._id;
                return {
                    ...group,
                    ...groupFound,
                }
            })
            chargerFound.listOfGroups = groupsResultWithGroupId;
            return chargerFound
        } else {
            console.warn(`[${context}] Warn `, 'chargerFound.listOfGroups is not valid array');
            return [];
        }
    } catch (error) {
        console.error(`[${context}][axios.get][.catch] Error `, error.message);
        throw error
    }
};

function getBooking(chargerFound) {
    var context = "Funciton getBooking";
    return new Promise((resolve, reject) => {
        var data = {
            hwId: chargerFound.hwId
        };
        var host = process.env.HostBooking + process.env.PathBookingByCharger;

        axios.get(host, { data })
            .then((value) => {
                var bookings = value.data;
                resolve(bookings);
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                resolve([]);
                //reject(error.response.data);
            });
    });
};

const getGroupsCSUsers = async (groups) => {
    const context = "Function getGroupsCSUsers";
    try {

        const groupIds = groups
            .map((group) =>
                ObjectId.isValid(group.groupId?.toString())
                    ? new ObjectId(group.groupId.toString())
                    : undefined
            )
            .filter(group => Boolean(group))

        const query = { "_id": { $in: groupIds } }

        const groupsResult = await findGroupCSUser(query);

        const result = groupsResult.map(groupFound => {
            const group = groups.find(sourceGroup => sourceGroup.groupId == groupFound._id);
            delete groupFound._id;
            return {
                ...group,
                ...groupFound,
            }
        })

        return result

    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
        throw error;
    }
};

function getGroupsCSUsersListIds(groups) {
    var context = "Funciton getGroupsCSUsersListIds";
    return new Promise(async (resolve, reject) => {
        try {
            var host = process.env.HostUser + process.env.PathGetGroupCSUsersByIdList;
            var listOfGroups = [];
            let data = {
                listOfGroupsIds: groups.map(group => group.groupId)
            }
            let allGroups = await axios.get(host, { data })
            allGroups = allGroups.data
            for (let newGroup of allGroups) {
                let originalGroup = groups.find(og => og.groupId === newGroup._id)
                newGroup._id = originalGroup?._id ?? newGroup._id;
                newGroup.groupId = originalGroup?.groupId ?? newGroup._id;
                listOfGroups.push(newGroup);
            }
            resolve(listOfGroups);
        } catch (error) {
            resolve(groups);
        }
    });
};


function getFleetsGroup(groups) {
    var context = "Funciton getFleetsGroup";
    return new Promise((resolve, reject) => {

        let headers = { 'origin-microservice': 'chargers' };
        var host = process.env.HostEvs + process.env.PathFleetById;
        var listOfFleets = [];


        Promise.all(
            groups.map(group => {
                return new Promise((resolve, reject) => {
                    var params = {
                        _id: group.fleetId
                    };
                    axios.get(host, { params, headers })
                        .then((values) => {
                            var newGroup = JSON.parse(JSON.stringify(values.data));
                            newGroup._id = group._id;
                            newGroup.fleetId = group.fleetId;
                            newGroup.fleetName = group.fleetName;
                            listOfFleets.push(newGroup);
                            resolve(true);
                        })
                        .catch((error) => {
                            console.error(`[${context}][axios.get][.catch] Error `, error.message);
                            reject(error);
                        });
                });
            })
        ).then(() => {

            resolve(listOfFleets);
        }).catch((error) => {
            console.error(`[${context}][Promise.all][.catch] Error `, error.message);
            resolve(groups);
        });
    });
};

function getTariffs(tariffs) {
    var context = "Funciton getTariffs";
    return new Promise((resolve, reject) => {
        if (tariffs.length != 0) {
            Promise.all(
                tariffs.map(tariff => {
                    return new Promise((resolve, reject) => {

                        // console.log(context, " tariff.tariffId ", tariff.tariffId);
                        if (!tariff.tariffId) {

                            if ((tariff.groupName == process.env.ChargerAccessPublic) || (tariff.groupName == process.env.ChargerAccessPrivate) || (tariff.groupName == process.env.ChargerAccessFreeCharge)) {
                                resolve(true);
                            }
                            else {
                                const query = {
                                    _id: tariff.groupId
                                };
                                findOneGroupCSUser(query)
                                    .then((groupCSUsers) => {
                                        if (groupCSUsers?.imageContent)
                                            tariff.imageContent = groupCSUsers.imageContent;
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][axios.get] Error `, error.message);
                                        reject(error);
                                    });
                            };
                        }
                        else {
                            if (tariff.groupName == process.env.ChargerAccessPrivate) {
                                resolve(true);
                            }
                            else if (tariff.groupName == process.env.ChargerAccessPublic) {

                                var host = process.env.HostTariffs + process.env.PathGetTariff;
                                var data = {
                                    _id: tariff.tariffId
                                };
                                axios.get(host, { data })
                                    .then((value) => {
                                        var tariffFound = JSON.parse(JSON.stringify(value.data));
                                        tariff.name = tariffFound.name;
                                        tariff.tariffType = tariffFound.tariffType;
                                        tariff.tariff = tariffFound.tariff;
                                        tariff.type = tariffFound.type
                                        tariff.currency = tariffFound.currency
                                        tariff.elements = tariffFound.elements
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][axios.get] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                const query = {
                                    _id: tariff.groupId
                                };
                                findOneGroupCSUser(query)
                                    .then((groupCSUsers) => {
                                        if (groupCSUsers?.imageContent)
                                            tariff.imageContent = groupCSUsers.imageContent;
                                        var host = process.env.HostTariffs + process.env.PathGetTariff;
                                        var data = {
                                            _id: tariff.tariffId
                                        };
                                        axios.get(host, { data })
                                            .then((value) => {
                                                var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                tariff.name = tariffFound.name;
                                                tariff.tariffType = tariffFound.tariffType;
                                                tariff.tariff = tariffFound.tariff;
                                                tariff.type = tariffFound.type
                                                tariff.currency = tariffFound.currency
                                                tariff.elements = tariffFound.elements
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][axios.get] Error `, error.message);
                                        reject(error);
                                    });
                            };
                        };
                    });
                })
            ).then(() => {
                resolve(tariffs);
            }).catch((error) => {
                console.error(`[${context}] Promise.all] Error `, error.message);
                reject(error);
            })
        }
        else {
            resolve(tariffs);
        };
    });
};

function getGroups(tariffs) {
    var context = "Funciton getGroups";
    return new Promise((resolve, reject) => {

        if (tariffs.length != 0) {

            Promise.all(

                tariffs.map(tariff => {

                    return new Promise((resolve, reject) => {

                        if ((tariff.groupName == process.env.ChargerAccessPublic) || (tariff.groupName == process.env.ChargerAccessPrivate) || (tariff.groupName == process.env.ChargerAccessFreeCharge)) {

                            resolve(true);

                        }
                        else {

                            const query = {
                                _id: tariff.groupId
                            };
                            findOneGroupCSUser(query)
                                .then((groupCSUsers) => {
                                    if (groupCSUsers?.imageContent)
                                        tariff.imageContent = groupCSUsers.imageContent;
                                    resolve(true);

                                })
                                .catch((error) => {

                                    console.error(`[${context}][axios.get] Error `, error.message);
                                    reject(error);

                                });

                        };

                    });

                })

            ).then(() => {

                resolve(tariffs);

            }).catch((error) => {

                console.error(`[${context}] Promise.all] Error `, error.message);
                reject(error);

            });

        }
        else {

            resolve(tariffs);

        };

    });
};

// function verifyNotifymeHistory(query) {
//     var context = "Funciton verifyNotifymeHistory";
//     return new Promise((resolve, reject) => {
//         NotifymeHistory.findOne(query, (err, notifymeHistoryFound) => {
//             if (err) {
//                 console.error(`[${context}] Error `, err.message);;
//                 reject(err);
//             }
//             else {
//                 if (notifymeHistoryFound)
//                     resolve(false);
//                 else
//                     resolve(true);
//             };
//         });
//     });
// };

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

function getChargerInf(result, userId) {
    var context = "Funciton getChargerInf";
    return new Promise(async (resolve, reject) => {
        let fees = await getFees(result);

        const updatePlug = (plug) => {
            return new Promise((resolve, reject) => {
                var data = {
                    plugId: plug.plugId,
                    userId: userId
                };
                var host = process.env.HostBooking + process.env.PathGetAutomaticBooking;

                /*axios.get(host, { data })
                    .then((values) => {
                        if (values.data)
                            plug.canBeAutomaticallyBooked = false;
                        else
                            plug.canBeAutomaticallyBooked = true;*/
                //var host = process.env.HostNotifications + process.env.PathNotified;
                //axios.get(host, { data })
                //TODO Booking
                plug.canBeAutomaticallyBooked = false;
                var find = {
                    hwId: result.hwId,
                    plugId: plug.plugId,
                    'listOfUsers': {
                        $elemMatch: {
                            'userId': userId
                        }
                    },
                    active: true
                };
                verifyNotifymeHistory(find)
                    .then((value) => {
                        if (!value) {
                            plug.canBeNotified = value;
                            resolve(true);
                        }
                        else {
                            plug.canBeNotified = value;
                            var query = {
                                $and: [
                                    { plugId: plug.plugId },
                                    { userId: userId },
                                    { status: process.env.SessionStatusRunning }
                                ]
                            }
                            ChargingSession.findOne(query, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][ChargingSession.findOne] Error `, err.message);;
                                    reject(err);
                                } else {
                                    if (result) {
                                        plug.canBeNotified = false;
                                        resolve(true);
                                    } else {
                                        plug.canBeNotified = true;
                                        resolve(true);
                                    };
                                };
                            });
                        };
                    })
                    .catch((error) => {
                        console.error(`[${context}][verifyNotifymeHistory][.catch] Error `, error.message);
                        reject(error);
                    });
                /*})
                .catch((error) => {
                    console.error(`[${context}][axios.get][.catch] Error `, error.message);
                    reject(error);
                });*/
            });
        };
        Promise.all(
            result.plugs.map(plug => updatePlug(plug))
        ).then((value) => {
            var data = {
                hwId: result.hwId
            };
            var host = process.env.HostBooking + process.env.PathBookingByCharger;
            /*axios.get(host, { data })
                .then((value) => {
                    var bookings = value.data;
                    result.bookings = bookings;
                    */

            getTariffPlug(result)
                .then(async (chargerFound) => {

                    const { operator, operatorContact, operatorEmail } = await getOperators(chargerFound);

                    chargerFound.operatorContact = operatorContact;
                    chargerFound.operatorEmail = operatorEmail;
                    chargerFound.operator = operator;

                    chargerFound.fees = fees;

                    if (chargerFound.listOfGroups.length == 0) {
                        resolve(chargerFound);
                    }
                    else {
                        getListOfGroups(chargerFound)
                            .then((chargerFound) => {

                                resolve(chargerFound);
                            });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][getTariffPlug] Error `, error.message);
                    reject(error);
                });
            /*})
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                reject(error);
            });*/

        }).catch((error) => {
            console.error(`[${context}][map][.catch] Error `, error.message);
            reject(error);
        });


    });
};

function removeFromInfra(infra) {
    var context = "Funciton removeFromInfra";
    var query = {
        _id: infra._id
    };
    findOneInfrastructure(query)
        .then((infrastructureFound) => {
            if (infrastructureFound) {
                infrastructureFound.listChargers = infrastructureFound.listChargers.filter(charger => {
                    return charger.chargerId != infra.chargerId;
                });
                var newValues = { $set: infrastructureFound };
                updateInfrastructure(newValues, query)
                    .then((result) => {
                        if (result) {
                            console.log(`[${context}] Update successfully`);
                        }
                        else {
                            console.log(`[${context}] Update unsuccessfully`);
                        };
                    })
                    .catch((error) => {
                        console.error(`[${context}][findOneInfrastructure] Error `, error.message);
                    });
            }
            else {
                console.log(`[${context}] No infrastructure found`);
            };
        })
        .catch((error) => {
            console.error(`[${context}][findOneInfrastructure] Error `, error.message);
        });
};

//Function to find one infrastructure using query
function findOneInfrastructure(query) {
    var context = "Funciton findOneInfrastructure";
    return new Promise((resolve, reject) => {
        Infrastructure.findOne(query, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            } else {
                resolve(infrastructureFound);
            };
        });
    });
};

//Function to update an infrastructure
function updateInfrastructure(newValues, query) {
    var context = "Funciton updateInfrastructure";
    return new Promise((resolve, reject) => {
        try {
            Infrastructure.updateInfrastructure(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateInfrastructure] Error `, err.message);;
                    reject(err);
                } else {
                    if (result)
                        resolve(true);
                    else
                        resolve(false);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function rearrangeImage(charger) {
    var context = "Funciton rearrangeImage";
    return new Promise((resolve, reject) => {
        var newImage = charger.imageContent.filter(image => {
            return image != "";
        });
        Promise.all(
            newImage.map((image, index) => {
                return new Promise((resolve, reject) => {
                    var name = "_" + index + ".jpg";
                    if (image.includes(name)) {
                        resolve(true);
                    }
                    else {
                        var nameOfImage = image.split("/");
                        var dateNow = Date.now();
                        var path = `/usr/src/app/img/chargers/${nameOfImage[nameOfImage.length - 1]}`;
                        var auxName = nameOfImage[nameOfImage.length - 1].split("_");
                        var newName = `${auxName[0]}_${dateNow}_${index}.jpg`;
                        var newPath = `/usr/src/app/img/chargers/${newName}`;
                        fs.rename(path, newPath, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);;
                                reject(err);
                            }
                            else {
                                if (process.env.NODE_ENV === 'production') {
                                    pathImage = `${process.env.HostProd}chargers/${newName}`; // For PROD server
                                }
                                else if (process.env.NODE_ENV === 'pre-production') {
                                    pathImage = `${process.env.HostPreProd}chargers/${newName}`; // For Pred PROD server
                                }
                                else {
                                    //pathImage = `${process.env.HostLocal}chargers/${newName}`;
                                    pathImage = `${process.env.HostQA}chargers/${newName}`; // For QA server
                                };
                                if (charger.defaultImage === image) {
                                    charger.defaultImage = pathImage;
                                    newImage[index] = pathImage;
                                    resolve(true);
                                }
                                else {
                                    newImage[index] = pathImage;
                                    resolve(true);
                                };
                            };
                        });
                    };
                });
            })
        ).then(() => {
            charger.imageContent = newImage;
            resolve(charger);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });
    });
};

function verifyBooking(plug) {
    var context = "Funciton verifyBooking";
    return new Promise((resolve, reject) => {
        var host = process.env.HostBooking + process.env.PathBookingByPlug;
        var dateNow = new Date()
        var data = {
            plugId: plug.plugId,
            startDate: { $lte: dateNow },
            stopDate: { $gte: dateNow }
        };
        axios.get(host, { data })
            .then((result) => {
                if (result.data.length === 0) {
                    resolve(false);
                }
                else {
                    resolve(true);
                };
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                resolve(false);
            });
    });
};

function addQrCodeId(charger) {
    var context = "Function addQrCodeId";
    return new Promise(async (resolve, reject) => {
        try {
            Promise.all(
                charger.plugs.map(plug => {
                    return new Promise((resolve, reject) => {
                        if (plug.qrCodeId !== undefined) {
                            var query = {
                                qrCodeId: plug.qrCodeId
                            };
                            var qrCode = {
                                qrCode: {
                                    hwId: charger.hwId,
                                    plugId: plug.plugId,
                                    chargerType: charger.chargerType,
                                    chargingDistance: charger.chargingDistance,
                                    geometry: charger.geometry
                                }
                            };
                            var newValues = { $set: qrCode };
                            QrCode.updateQrCode(query, newValues, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateQrCode] Error `, err.message);;
                                }
                                else {
                                    if (result) {
                                        resolve(true);
                                    }
                                    else {
                                        resolve(false);
                                    };
                                };
                            });
                        }
                        else {
                            var query = {
                                $and: [
                                    {
                                        "qrCode.hwId": charger.hwId
                                    },
                                    {
                                        "qrCode.plugId": plug.plugId
                                    }
                                ]
                            };
                            qrCodeFindOnde(query)
                                .then((qrCodeFound) => {
                                    if (qrCodeFound) {
                                        qrCodeFound.qrCode.geometry = charger.geometry;
                                        qrCodeFound.qrCode.chargerType = charger.chargerType;
                                        qrCodeFound.qrCode.chargingDistance = charger.chargingDistance;

                                        var query = {
                                            _id: qrCodeFound._id
                                        };
                                        var newValues = { $set: qrCodeFound };
                                        QrCode.updateQrCode(query, newValues, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}][updateQrCode] Error `, err.message);;
                                            }
                                            else {
                                                if (result) {
                                                    plug.qrCodeId = qrCodeFound.qrCodeId;
                                                    resolve(true);
                                                }
                                                else {
                                                    resolve(false);
                                                };
                                            };
                                        });


                                    }
                                    else {
                                        var qrCode = new QrCode(
                                            {
                                                qrCode: {
                                                    hwId: charger.hwId,
                                                    plugId: plug.plugId,
                                                    chargerType: charger.chargerType,
                                                    chargingDistance: charger.chargingDistance,
                                                    geometry: charger.geometry
                                                }
                                            }
                                        );
                                        saveQrCode(qrCode)
                                            .then((result) => {
                                                plug.qrCodeId = result.qrCodeId;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][saveQrCode] Error `, error.message);
                                                reject(error);
                                            });
                                    };

                                })
                                .catch((error) => {
                                    console.error(`[${context}][qrCodeFindOnde] Error `, error.message);
                                    reject(error);
                                })

                        };
                    });
                })
            ).then(() => {
                resolve(charger);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function verifyQrCode(charger, plug) {
    var context = "Function verifyQrCode";
    return new Promise(async (resolve, reject) => {
        try {
            var query = {
                $and: [
                    {
                        "qrCode.hwId": charger.hwId
                    },
                    {
                        "qrCode.plugId": plug.plugId
                    }
                ]
            };
            qrCodeFindOnde(query)
                .then((qrCodeFound) => {
                    if (qrCodeFound) {
                        qrCodeFound.qrCode.geometry = charger.geometry;
                        qrCodeFound.qrCode.chargerType = charger.chargerType;
                        qrCodeFound.qrCode.chargingDistance = charger.chargingDistance;

                        var query = {
                            _id: qrCodeFound._id
                        };
                        var newValues = { $set: qrCodeFound };
                        QrCode.updateQrCode(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}][updateQrCode] Error `, err.message);;
                            }
                            else {
                                if (result) {
                                    plug.qrCodeId = qrCodeFound.qrCodeId;
                                    resolve(plug);
                                }
                                else {
                                    resolve(false);
                                };
                            };
                        });
                    }
                    else {
                        resolve(false);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][qrCodeFindOnde] Error `, error.message);
                    reject(error);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function saveQrCode(qrCode) {
    var context = "Function saveQrCode";
    return new Promise(async (resolve, reject) => {
        try {
            QrCode.createQrCode(qrCode, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);;
                    reject(err);
                }
                else {
                    switch (result.qrCodeNumber.toString().length) {
                        case 1:
                            result.qrCodeId = "00000" + result.qrCodeNumber.toString();
                            break;
                        case 2:
                            result.qrCodeId = "0000" + result.qrCodeNumber.toString();
                            break;
                        case 3:
                            result.qrCodeId = "000" + result.qrCodeNumber.toString();
                            break;
                        case 4:
                            result.qrCodeId = "00" + result.qrCodeNumber.toString();
                            break;
                        case 5:
                            result.qrCodeId = "0" + result.qrCodeNumber.toString();
                            break;
                        default:
                            result.qrCodeId = result.qrCodeNumber.toString();
                            break;
                    };
                    var query = {
                        _id: result._id
                    };
                    var newValue = { $set: result };
                    QrCode.updateQrCode(query, newValue, (err, newUpdate) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);;
                            reject(err);
                        }
                        else {
                            resolve(result);
                        };
                    });
                };
            });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function removeQrCode(chargerFound) {
    var context = "Function removeQrCode";

    chargerFound.plugs.map(plug => {

        if (plug.qrCodeId != undefined) {
            var query = {
                qrCodeId: plug.qrCodeId
            };

            QrCode.findOne(query, (err, qrCodeFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);;
                }
                else {

                    if ((chargerFound.chargerType != process.env.EVIOBoxType) && (chargerFound.chargerType != process.env.SonOFFType)) {

                        qrCodeFound.qrCode.hwId = '';
                        qrCodeFound.qrCode.plugId = '';
                        qrCodeFound.qrCode.chargerType = '';
                        qrCodeFound.qrCode.chargingDistance = '';
                        qrCodeFound.qrCode.geometry.coordinates = [];
                        var newValues = { $set: qrCodeFound };
                        QrCode.updateQrCode(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);;
                            }
                            else {
                                console.log(`[${context}] Qr code deleted `);
                            };
                        });
                    }
                    else {

                        qrCodeFound.qrCode.chargingDistance = '';
                        qrCodeFound.qrCode.geometry.coordinates = [];
                        var newValues = { $set: qrCodeFound };
                        QrCode.updateQrCode(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);;
                            }
                            else {
                                console.log(`[${context}] Qr code deleted `);
                            };
                        });

                    };

                };
            });
        };
    });

};

function qrCodeFindOnde(query) {
    var context = "Function qrCodeFindOnde";
    return new Promise((resolve, reject) => {
        QrCode.findOne(query, (err, qrCodeFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(qrCodeFound);
            };
        });
    });
};

function updateQrCode(charger) {
    var context = "Function updateQrCode";
    charger.plugs.map(plug => {
        var query = {
            qrCodeId: plug.qrCodeId
        };
        QrCode.findOne(query, (err, qrCode) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
            }
            else {
                qrCode.qrCode.geometry = charger.geometry;
                qrCode.qrCode.chargingDistance = charger.chargingDistance;
                var newValues = { $set: qrCode };
                QrCode.updateQrCode(query, newValues, (err, result) => {
                    if (err) {
                        console.error(`[${context}][updateQrCode] Error `, err.message);;
                    }
                    else {
                        if (result) {
                            console.log(`[${context}] Result Update`);
                        }
                        else {
                            console.log(`[${context}] Result Not Update`);
                        };
                    };
                });
            };
        });
    });
};

function getLowestTariff(tariffFound) {
    var context = "Function getLowestTariff";
    return new Promise(async (resolve, reject) => {

        var tariffsId = [];
        for (let i = 0; i < tariffFound.length; i++) {
            tariffsId.push(tariffFound[i].tariffId);
        };
        var params = {
            _id: tariffsId
        };
        var host = process.env.HostTariffs + process.env.PathGetMultiTariffById;

        axios.get(host, { params })
            .then((result) => {
                var tariffs = result.data;
                //console.log("tariffs", tariffs);
                if (tariffs.length == 1) {

                    var newTariff = tariffFound.find(tariff => {
                        return tariff.tariffId == tariffs[0]._id;
                    });
                    resolve(newTariff);
                }
                else if (tariffs.length > 1) {
                    var lowest = {
                        tariffId: tariffs[0]._id,
                        value: tariffs[0]?.tariff?.chargingAmount?.value
                    };
                    for (let i = 1; i < tariffs.length; i++) {
                        if (lowest.value > tariffs[i]?.tariff?.chargingAmount?.value) {
                            lowest.tariffId = tariffs[i]._id;
                            lowest.value = tariffs[i]?.tariff?.chargingAmount?.value
                        }
                    };
                    var newTariff = tariffFound.find(tariff => {
                        return tariff.tariffId == lowest.tariffId;
                    });
                    resolve(newTariff);
                };

            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function getPOIsByCharger(query, geometry, hwId) {
    const context = "Function getPOIsByCharger";
    return new Promise(async (resolve, reject) => {

        try {

            let configManagementPOIs = await getConfigManagementPOIs();

            ManagementPOIs.findOne({ hwId: hwId, chargerId: query.chargerId }, (err, result) => {

                if (err) {

                    console.error(`[${context}] Error `, err.message);;
                    reject(err);

                }
                else {

                    if (result) {

                        if (result.POIs.length == 0) {

                            let host;
                            if (process.env.NODE_ENV === 'production') {
                                host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${geometry.coordinates[1]},${geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                            }
                            else {
                                host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${geometry.coordinates[1]},${geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                            };

                            getPOIsGoogle(host, configManagementPOIs.numberOfPois)
                                .then((POIs) => {

                                    // console.log("POIs", POIs)
                                    result.POIs = POIs;
                                    var query = {
                                        _id: result._id
                                    };
                                    var newValues = { $set: result };
                                    managementPOIsUpdate(query, newValues)
                                        .then((values) => {
                                            resolve(result.POIs);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][managementPOIsUpdate]][.catch] Error `, error.message);
                                            reject(error);
                                        });

                                })
                                .catch((error) => {
                                    console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
                                    reject(error);
                                });
                        } else {

                            let dateNow = new Date();

                            let timeInSecunds = configManagementPOIs.daysToUpdate * 86400;
                            let dif = (dateNow - result.updatedAt) * 0.001;

                            if (dif >= timeInSecunds) {
                                let host
                                if (process.env.NODE_ENV === 'production') {
                                    host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${geometry.coordinates[1]},${geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                }
                                else {
                                    host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${geometry.coordinates[1]},${geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                };
                                getPOIsGoogle(host, configManagementPOIs.numberOfPois)
                                    .then((POIs) => {

                                        if (POIs.length == 0) {
                                            let query = {
                                                _id: result._id
                                            };
                                            let newValues = { $set: result };
                                            managementPOIsUpdate(query, newValues)
                                                .then((values) => {
                                                    console.log(`[${context}] POIs updated`);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][managementPOIsUpdate]][.catch] Error `, error.message);
                                                    reject(error);
                                                });
                                        }
                                        else {
                                            console.log(`[${context}] POIs not updated`);
                                        };

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
                                        reject(error);
                                    });
                            };
                            resolve(result.POIs);
                        };

                    }
                    else {

                        Charger.findOne({ _id: query.chargerId }, (err, result) => {

                            if (err) {

                                console.error(`[${context}][find] Error `, err.message);
                                reject(err);

                            }
                            else {
                                let host;
                                if (process.env.NODE_ENV === 'production') {
                                    host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${geometry.coordinates[1]},${geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                }
                                else {
                                    host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${geometry.coordinates[1]},${geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                };

                                getPOIsGoogle(host, configManagementPOIs.numberOfPois)
                                    .then((POIs) => {

                                        var POI = new ManagementPOIs();
                                        POI.chargerId = query.chargerId;
                                        POI.hwId = hwId;
                                        POI.geometry = geometry;
                                        POI.POIs = POIs;

                                        managementPOIsCreate(POI)
                                            .then((result) => {
                                                if (result) {
                                                    resolve(result.POIs);
                                                };
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][managementPOIsCreate]][.catch] Error `, error.message);
                                                reject(error);
                                            });

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
                                        reject(error);

                                    });

                            };

                        });

                    };

                };

            });

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };

    });
};

async function createPOIs(charger) {
    var context = "Function createPOIs";

    let configManagementPOIs = await getConfigManagementPOIs();

    if (process.env.NODE_ENV === 'production') {
        var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
    }
    else {
        var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
    };
    getPOIsGoogle(host, configManagementPOIs.numberOfPois)
        .then((POIs) => {
            var POI = new ManagementPOIs();
            //POI.chargerId = charger._id;
            POI.hwId = charger.hwId;
            POI.geometry = charger.geometry;
            POI.POIs = POIs;
            managementPOIsCreate(POI)
                .then((result) => {
                    if (result) {
                        // console.log("Create");
                    }
                })
                .catch((error) => {
                    console.error(`[${context}][managementPOIsCreate]][.catch] Error `, error.message);
                });
        })
        .catch((error) => {
            console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
        });
};

function managementPOIsCreate(managementPOIs) {
    var context = "Function managementPOIsCreate";
    return new Promise((resolve, reject) => {
        ManagementPOIs.createManagementPOIs(managementPOIs, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                if (result) {
                    resolve(result);
                }
            };
        });
    });
};

function managementPOIsUpdate(query, newValues) {
    var context = "Function managementPOIsUpdate";
    return new Promise((resolve, reject) => {
        ManagementPOIs.updateManagementPOIs(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function managementPOIsDelete(query) {
    var context = "Function managementPOIsDelete";
    return new Promise((resolve, reject) => {
        ManagementPOIs.removeManagementPOIs(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

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
                            var path = '/usr/src/app/img/google/' + POI.id + '.jpg';
                        }
                        else {
                            var path = '/usr/src/app/img/google/' + POI.place_id + '.jpg';
                        };
                        var pathImage = "";
                        if (process.env.NODE_ENV === 'production') {
                            if (POI.id != undefined) {
                                pathImage = process.env.HostProd + 'google/' + POI.id + '.jpg'; // For PROD server
                            }
                            else {
                                pathImage = process.env.HostProd + 'google/' + POI.place_id + '.jpg'; // For PROD server
                            };
                        }
                        else if (process.env.NODE_ENV === 'pre-production') {
                            if (POI.id != undefined) {
                                pathImage = process.env.HostPreProd + 'google/' + POI.id + '.jpg'; // For Pred PROD server
                            }
                            else {
                                pathImage = process.env.HostPreProd + 'google/' + POI.place_id + '.jpg'; // For Pred PROD server
                            };
                        }
                        else {
                            if (POI.id != undefined) {
                                // pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                pathImage = process.env.HostQA + 'google/' + POI.id + '.jpg'; // For QA server
                            }
                            else {
                                // pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                pathImage = process.env.HostQA + 'google/' + POI.place_id + '.jpg'; // For QA server
                            };
                        };
                        download(url, path, () => {
                            POI.photos = pathImage;
                            resolve(true);
                        });

                    } else if (POI.photos != undefined) {


                        if (POI.photos.length !== 0) {
                            var photo = POI.photos[0];
                            if (process.env.NODE_ENV === 'production') {
                                var url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyProd;
                            }
                            else {
                                var url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyQA;
                            };

                            if (POI.id != undefined) {
                                var path = '/usr/src/app/img/google/' + POI.id + '.jpg';
                            }
                            else {
                                var path = '/usr/src/app/img/google/' + POI.place_id + '.jpg';
                            };
                            var pathImage = "";
                            if (process.env.NODE_ENV === 'production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostProd + 'google/' + POI.id + '.jpg'; // For PROD server
                                }
                                else {
                                    pathImage = process.env.HostProd + 'google/' + POI.place_id + '.jpg'; // For PROD server
                                };
                            }
                            else if (process.env.NODE_ENV === 'pre-production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostPreProd + 'google/' + POI.id + '.jpg'; // For Pred PROD server
                                }
                                else {
                                    pathImage = process.env.HostPreProd + 'google/' + POI.place_id + '.jpg'; // For Pred PROD server
                                };
                            }
                            else {
                                if (POI.id != undefined) {
                                    //pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                    pathImage = process.env.HostQA + 'google/' + POI.id + '.jpg'; // For QA server
                                }
                                else {
                                    //pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                    pathImage = process.env.HostQA + 'google/' + POI.place_id + '.jpg'; // For QA server
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

function getChargerOPCM(received, clientName) {
    var context = "Function getChargerOPCM";
    return new Promise((resolve, reject) => {
        //var host = process.env.HostOpenChargeMapStorage + process.env.PathOPCMsearchByName;
        var host = process.env.HostPublicNetWork + process.env.PathOPCMsearchByName;
        var params = {
            name: received.name,
            countryCode: ['PT'],
            clientName: clientName
        };

        axios.get(host, { params })
            .then((result) => {
                var chargerFoundOPCM = result.data;
                resolve(chargerFoundOPCM);
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                //reject(error);
                resolve([]);
            });
    });
};

//Function to save image in file
const download = (url, path, callback) => {
    if (fs.existsSync(path)) { return callback(); }
    request.head(url, (err, res, body) => {
        if (err) {
            console.error("Error ", err);
        }
        else {
            request(url)
                .pipe(fs.createWriteStream(path))
                .on('close', callback);
        };

    });
};

function deleteChargerFromFavorite(query) {
    var context = "Function deleteChargerFromFavorite";

    var host = process.env.HostUser + process.env.PathFavorites;
    var data = query;

    axios.patch(host, data)
        .then((result) => {
            console.log(`[${context}][axios.get] Deleted from favorites`);
        })
        .catch((error) => {
            console.error(`[${context}][axios.get][.catch] Error `, error.message);
        });
};

function getFees(charger) {
    return new Promise(async (resolve, reject) => {

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

            if (charger.address.zipCode !== undefined && charger.address.zipCode !== "") {
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
                    //console.log(fees.data);
                    resolve(fees.data);
                }
                else {
                    resolve({});
                }
            })
            .catch((error) => {
                console.error("[Error] " + error);
                resolve({});
            });

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
                reject(error);

            });

    });
};

function chargingSessionFind(query) {
    var context = "Function chargingSessionFind";
    return new Promise((resolve, reject) => {

        ChargingSession.find(query, (error, chargingSessionFounds) => {

            if (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            }
            else {

                resolve(chargingSessionFounds);

            };

        });

    });
};

function getTariffFromPlug(plug, myCSGroups) {
    var context = "Function getTariffFromPlug";
    return new Promise((resolve, reject) => {

        var tariffs = [];
        Promise.all(
            myCSGroups.map(group => {
                return new Promise((resolve, reject) => {

                    var tariff = plug.tariff.find(tariff => {

                        return tariff.groupId === group.groupId && tariff.tariffId != "";
                    });

                    if (tariff) {
                        tariffs.push(tariff);
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    };

                });
            })
        ).then(() => {

            resolve(tariffs);

        }).catch((error) => {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        });

    });
};

function validateChargingStationConditions_old(userId, chargerFound, plugId) {
    var context = "Function validateChargingStationConditions";
    return new Promise(async (resolve, reject) => {
        try {
            //Check charger status is active
            if (chargerFound.operationalStatus === process.env.OperationalStatusApproved) {
                if (chargerFound.status === process.env.ChargePointStatusEVIO) {

                    //Check if have plugs
                    if (chargerFound.plugs.length !== 0) {

                        //Valdate if the user is the owner
                        if (chargerFound.createUser === userId) {

                            var plugFound = chargerFound.plugs.find(plug => {
                                return plug.plugId === plugId;
                            });

                            if (plugFound) {
                                //Check if selected plug status is active
                                if (plugFound.status === process.env.PlugStatusAvailable) {
                                    resolve(true);
                                }
                                else {
                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                };
                            }
                            else {
                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                            };

                        }
                        else if (chargerFound.accessType === process.env.ChargerAccessPrivate) {
                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                        }
                        else {

                            //Check charger avalability
                            //if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                            //Validate if have groups - validate to plubic and restrict
                            if (chargerFound.listOfGroups.length === 0) {

                                //validate if public
                                if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                    var plugFound = chargerFound.plugs.find(plug => {
                                        return plug.plugId === plugId;
                                    });

                                    if (plugFound) {

                                        //Check if selected plug status is active
                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                            //Validate tariff of public
                                            var tariff = plugFound.tariff.find(tariff => {
                                                return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                            });

                                            if (tariff) {
                                                resolve(true);
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                            };

                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };
                                    }
                                    else {
                                        reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                    };

                                }
                                else {
                                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                };

                            }
                            else {

                                var myCSGroups = chargerFound.listOfGroups.filter(group => {
                                    return group.listOfUsers.find(user => {
                                        return user.userId === userId;
                                    });
                                });

                                //Validate if the user is part of any CSGroup
                                if (myCSGroups.length > 0) {

                                    var plugFound = chargerFound.plugs.find(plug => {
                                        return plug.plugId === plugId;
                                    });

                                    if (plugFound) {

                                        //Check if selected plug status is active
                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                            let tariffs = await getTariffFromPlug(plugFound, myCSGroups);

                                            if (tariffs.length > 0) {
                                                resolve(true);
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                            };

                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };

                                    }
                                    else {
                                        reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                    };
                                }
                                else {

                                    //validate if public
                                    if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                        var plugFound = chargerFound.plugs.find(plug => {
                                            return plug.plugId === plugId;
                                        });

                                        if (plugFound) {

                                            //Check if selected plug status is active
                                            if (plugFound.status === process.env.PlugStatusAvailable) {

                                                //Validate tariff of public
                                                var tariff = plugFound.tariff.find(tariff => {
                                                    return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                });

                                                if (tariff) {
                                                    resolve(true);
                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                };

                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };
                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                        };

                                    }
                                    else {
                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                    };

                                };

                            };

                            /*}
                            else {
                                //TODO
                                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available' });
                            };*/
                        };
                    }
                    else {
                        reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });
                    };
                }
                else {
                    reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });
                };
            } else {

                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function validateChargingStationConditions(userId, chargerFound, plugId) {
    var context = "Function validateChargingStationConditions";
    return new Promise(async (resolve, reject) => {
        try {
            //Check charger status is active
            if (chargerFound.operationalStatus === process.env.OperationalStatusApproved) {

                if (chargerFound.status === process.env.ChargePointStatusEVIO) {

                    //Check if have plugs
                    if (chargerFound.plugs.length !== 0) {

                        //Valdate if the user is the owner
                        if (chargerFound.createUser === userId || chargerFound.accessType === process.env.ChargerAccessFreeCharge) {

                            var plugFound = chargerFound.plugs.find(plug => {
                                return plug.plugId === plugId;
                            });

                            if (plugFound) {
                                //Check if selected plug status is active
                                if (plugFound.status === process.env.PlugStatusAvailable) {
                                    resolve(true);
                                }
                                else {
                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                };
                            }
                            else {
                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                            };

                        } else if (chargerFound.accessType === process.env.ChargerAccessPrivate) {
                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                        } else {

                            //Validate if have groups - validate to plubic and restrict
                            if (chargerFound.listOfGroups.length === 0) {

                                //validate if public
                                if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                    if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                                        var plugFound = chargerFound.plugs.find(plug => {
                                            return plug.plugId === plugId;
                                        });

                                        if (plugFound) {

                                            //Check if selected plug status is active
                                            if (plugFound.status === process.env.PlugStatusAvailable) {

                                                //Validate tariff of public
                                                var tariff = plugFound.tariff.find(tariff => {
                                                    return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                });

                                                if (tariff) {
                                                    resolve(true);
                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                };

                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };
                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };

                                    } else {

                                        var plugFound = chargerFound.plugs.find(plug => {
                                            return plug.plugId === plugId;
                                        });

                                        if (plugFound) {

                                            //Check if selected plug status is active
                                            if (plugFound.status === process.env.PlugStatusAvailable) {

                                                //Validate tariff of public
                                                var tariff = plugFound.tariff.find(tariff => {
                                                    return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                });

                                                if (tariff) {
                                                    resolve(true);
                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                };

                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };
                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                        };
                                    }

                                } else {
                                    reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                };

                            } else {

                                var myCSGroups = chargerFound.listOfGroups.filter(group => {
                                    return group.listOfUsers.find(user => {
                                        return user.userId === userId;
                                    });
                                });

                                //Validate if the user is part of any CSGroup
                                if (myCSGroups.length > 0) {

                                    var plugFound = chargerFound.plugs.find(plug => {
                                        return plug.plugId === plugId;
                                    });

                                    if (plugFound) {

                                        //Check if selected plug status is active
                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                            let tariffs = await getTariffFromPlug(plugFound, myCSGroups);

                                            if (tariffs.length > 0) {
                                                resolve(true);
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                            };

                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };

                                    }
                                    else {
                                        reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                    };
                                } else {

                                    //validate if public
                                    if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                        if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                                            var plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                //Check if selected plug status is active
                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    //Validate tariff of public
                                                    var tariff = plugFound.tariff.find(tariff => {
                                                        return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                    });

                                                    if (tariff) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                    };

                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                };
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };

                                        } else {

                                            var plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                //Check if selected plug status is active
                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    //Validate tariff of public
                                                    var tariff = plugFound.tariff.find(tariff => {
                                                        return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                    });

                                                    if (tariff) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                    };

                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                };
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                            };
                                        }
                                    }
                                    else {
                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                    };

                                };

                            };

                        };

                    } else {

                        reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                    };
                } else {

                    reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                };

            } else {

                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function validateChargingStationConditionsQrCode_old(userId, chargerFound, plugId) {
    var context = "Function validateChargingStationConditionsQrCode_old";
    return new Promise(async (resolve, reject) => {
        try {
            //Check charger status is active
            if (chargerFound.operationalStatus === process.env.OperationalStatusApproved) {
                if (chargerFound.status === process.env.ChargePointStatusEVIO) {

                    //Check if have plugs
                    if (chargerFound.plugs.length !== 0) {

                        //Valdate if the user is the owner
                        if (chargerFound.createUser === userId) {

                            var plugFound = chargerFound.plugs.find(plug => {
                                return plug.plugId === plugId;
                            });

                            if (plugFound) {
                                //Check if selected plug status is active
                                if (plugFound.status === process.env.PlugStatusAvailable) {
                                    resolve(true);
                                }
                                else {
                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                };
                            }
                            else {
                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                            };

                        }
                        else if (chargerFound.accessType === process.env.ChargerAccessPrivate) {
                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                        }
                        else {

                            //Check charger avalability
                            if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                                //Validate if have groups - validate to plubic and restrict
                                if (chargerFound.listOfGroups.length === 0) {

                                    //validate if public
                                    if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                        var plugFound = chargerFound.plugs.find(plug => {
                                            return plug.plugId === plugId;
                                        });

                                        if (plugFound) {

                                            //Check if selected plug status is active
                                            if (plugFound.status === process.env.PlugStatusAvailable) {

                                                //Validate tariff of public
                                                var tariff = plugFound.tariff.find(tariff => {
                                                    return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                });

                                                if (tariff) {
                                                    resolve(true);
                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                };


                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };
                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };

                                    }
                                    else {
                                        if (chargerFound.listOfFleets.length === 0) {
                                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                        }
                                        else {
                                            resolve(true);
                                        };
                                    };

                                }
                                else {

                                    let groups = await getGroupsCSUsersMap(userId);

                                    listOfGroups(chargerFound.listOfGroups, groups)
                                        .then(async myCSGroups => {
                                            if (myCSGroups.length > 0) {

                                                var plugFound = chargerFound.plugs.find(plug => {
                                                    return plug.plugId === plugId;
                                                });

                                                if (plugFound) {

                                                    //Check if selected plug status is active
                                                    if (plugFound.status === process.env.PlugStatusAvailable) {

                                                        let tariffs = await getTariffFromPlug(plugFound, myCSGroups);

                                                        if (tariffs.length > 0) {
                                                            resolve(true);
                                                        }
                                                        else {
                                                            reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                        };

                                                    }
                                                    else {
                                                        reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                    };

                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                                };
                                            }
                                            else {

                                                //validate if public
                                                if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                                    var plugFound = chargerFound.plugs.find(plug => {
                                                        return plug.plugId === plugId;
                                                    });

                                                    if (plugFound) {

                                                        //Check if selected plug status is active
                                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                                            //Validate tariff of public
                                                            var tariff = plugFound.tariff.find(tariff => {
                                                                return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                            });

                                                            if (tariff) {
                                                                resolve(true);
                                                            }
                                                            else {
                                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                            };

                                                        }
                                                        else {
                                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                        };
                                                    }
                                                    else {
                                                        reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                                    };

                                                }
                                                else {
                                                    if (chargerFound.listOfFleets.length === 0) {
                                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });
                                                    }
                                                    else {
                                                        resolve(true);
                                                    };
                                                };

                                            };
                                        });

                                    /*
                                    var myCSGroups = chargerFound.listOfGroups.filter(group => {
                                        return group.listOfUsers.find(user => {
                                            return user.userId === userId;
                                        });
                                    });

                                    //Validate if the user is part of any CSGroup
                                    */

                                };

                            }
                            else {
                                //TODO
                                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available' });
                            };
                        };
                    }
                    else {
                        reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });
                    };
                }
                else {
                    reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });
                };
            } else {

                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function validateChargingStationConditionsQrCode(userId, chargerFound, plugId) {
    var context = "Function validateChargingStationConditionsQrCode";
    return new Promise(async (resolve, reject) => {
        try {
            //Check charger status is active
            if (chargerFound.operationalStatus === process.env.OperationalStatusApproved) {

                if (chargerFound.status === process.env.ChargePointStatusEVIO) {

                    //Check if have plugs
                    if (chargerFound.plugs.length !== 0) {

                        //Valdate if the user is the owner
                        if (chargerFound.createUser === userId || chargerFound.accessType == process.env.ChargerAccessFreeCharge) {

                            var plugFound = chargerFound.plugs.find(plug => {
                                return plug.plugId === plugId;
                            });

                            if (plugFound) {

                                //Check if selected plug status is active
                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                    resolve(true);

                                } else {

                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });

                                };
                            } else {

                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });

                            };

                        } else if (chargerFound.accessType === process.env.ChargerAccessPrivate) {

                            reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                        } else {

                            //Validate if have groups - validate to plubic and restrict
                            if (chargerFound.listOfGroups.length === 0) {

                                //validate if public
                                //if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                                    var plugFound = chargerFound.plugs.find(plug => {
                                        return plug.plugId === plugId;
                                    });

                                    if (plugFound) {

                                        //Check if selected plug status is active
                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                            //Validate tariff of public
                                            /*var tariff = plugFound.tariff.find(tariff => {
                                                return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                            });*/

                                            //if (tariff) {
                                            resolve(true);
                                            /*}
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                            };*/

                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };
                                    }
                                    else {
                                        reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                    };

                                } else {


                                    var plugFound = chargerFound.plugs.find(plug => {
                                        return plug.plugId === plugId;
                                    });

                                    if (plugFound) {

                                        //Check if selected plug status is active
                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                            //Validate tariff of public
                                            var tariff = plugFound.tariff.find(tariff => {
                                                return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                            });

                                            if (tariff) {
                                                resolve(true);
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                            };

                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };
                                    }
                                    else {
                                        reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                    };
                                }
                            } else {

                                var myCSGroups = chargerFound.listOfGroups.filter(group => {
                                    //console.log("group.listOfUsers", group.listOfUsers)
                                    return group.listOfUsers.find(user => {
                                        return user.userId === userId;
                                    });
                                });

                                //Validate if the user is part of any CSGroup
                                if (myCSGroups.length > 0) {

                                    var plugFound = chargerFound.plugs.find(plug => {
                                        return plug.plugId === plugId;
                                    });

                                    if (plugFound) {

                                        //Check if selected plug status is active
                                        if (plugFound.status === process.env.PlugStatusAvailable) {

                                            let tariffs = await getTariffFromPlug(plugFound, myCSGroups);

                                            if (tariffs.length > 0) {
                                                resolve(true);
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                            };

                                        }
                                        else {
                                            reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                        };

                                    }
                                    else {
                                        reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                    };
                                }
                                else {

                                    //validate if public
                                    if (chargerFound.accessType === process.env.ChargerAccessPublic) {

                                        if (chargerFound.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                                            var plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                //Check if selected plug status is active
                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    //Validate tariff of public
                                                    var tariff = plugFound.tariff.find(tariff => {
                                                        return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                    });

                                                    if (tariff) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                    };

                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                };
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                            };

                                        } else {

                                            var plugFound = chargerFound.plugs.find(plug => {
                                                return plug.plugId === plugId;
                                            });

                                            if (plugFound) {

                                                //Check if selected plug status is active
                                                if (plugFound.status === process.env.PlugStatusAvailable) {

                                                    //Validate tariff of public
                                                    var tariff = plugFound.tariff.find(tariff => {
                                                        return tariff.groupName === process.env.ChargerAccessPublic && tariff.tariffId != ""
                                                    });

                                                    if (tariff) {
                                                        resolve(true);
                                                    }
                                                    else {
                                                        reject({ auth: false, code: 'server_plug_not_have_tariff', message: 'Plug not have tariff' });
                                                    };

                                                }
                                                else {
                                                    reject({ auth: false, code: 'server_plug_not_available', message: 'Plug not available for use' });
                                                };
                                            }
                                            else {
                                                reject({ auth: false, code: 'server_plug_not_found', message: "Plug not found for given parameters" });
                                            };
                                        };
                                    } else {

                                        reject({ auth: false, code: 'server_not_authorized', message: 'Not authorized to start charging' });

                                    };

                                };

                            };

                        };

                    } else {

                        reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                    };

                } else {

                    reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

                };

            } else {

                reject({ auth: false, code: 'server_charger_not_available', message: 'Charger not available for use' });

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function listOfGroups(listOfGroups, groups) {
    var context = "Function listOfGroups";
    return new Promise((resolve, reject) => {

        let mygroups = [];

        //console.log("groups", groups);

        Promise.all(
            listOfGroups.map(group => {
                return new Promise((resolve, reject) => {

                    let found = groups.find(newGroup => {
                        return newGroup === group.groupId;
                    });
                    if (found) {
                        mygroups.push(group);
                        resolve(true)

                    }
                    else {
                        resolve(true)
                    }

                });
            })
        ).then(() => {
            resolve(mygroups);
        })
    });
};

function notifymeHistory(charger) {
    var context = "Function notifymeHistory";
    try {

        var body = {
            hwId: charger.hwId,
            plugId: charger.plugId,
            //chargerType: charger.chargerType,
            active: true
        };

        // console.log("To Notification 3")
        notifymeHistoryFindOne(body)
            .then(async (notifymeHistoryFound) => {

                // console.log("To Notification 5", notifymeHistoryFound)

                if (notifymeHistoryFound) {
                    sendNotificationToUsers(notifymeHistoryFound.listOfUsers, charger.hwId);

                    notifymeHistoryFound.active = false
                    notifymeHistoryUpdate(notifymeHistoryFound)
                        .then((result) => {
                            if (result) {
                                console.log("Update successfully");
                            }
                            else {
                                console.log("Update unsuccessfully");
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][notifymeHistoryUpdate] Error `, error.message);

                        });

                }
                else {
                    // console.log("To Notification 7")
                    console.log("Notification not found for given parameters");
                };
            })
            .catch((error) => {
                console.error(`[${context}][notifymeHistoryFindOne] Error `, error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function notifymeHistoryFindOne(query) {
    var context = "Function notifymeHistoryFindOne";
    let data = query
    let host = process.env.HostNotifications + process.env.PathNotifymeHistoryFindOne
    return new Promise((resolve, reject) => {
        axios.get(host, { data })
            .then(result => {

                // console.log("To Notification 4 " - result.data)
                resolve(result.data)
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
};

function notifymeHistoryUpdate(newValue) {
    var context = "Function notifymeHistoryUpdate";
    let data = newValue
    let host = process.env.HostNotifications + process.env.PathNotifymeHistoryUpdate
    return new Promise((resolve, reject) => {
        axios.patch(host, data)
            .then(result => {
                resolve(result.data)
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
};

async function sendNotificationToUsers(listOfUsers, hwId) {
    var context = "Function sendNotificationToUsers";
    const promises = listOfUsers.map(userI => notifyChargerAvailable(hwId, userI.userId));
    await Promise.allSettled(promises)
        .catch(errors => errors.forEach(error => console.error(`[${context}] Error`, error.message)));
}


function getEVsMap(user, groupDrivers) {
    var context = "Function getEVsMap";
    return new Promise((resolve, reject) => {
        try {
            var headers = { userid: user };
            var host = process.env.HostEvs + process.env.PathGetEVSMap;
            //console.log("groupDrivers", groupDrivers);
            var data = {
                groupDrivers: groupDrivers
            }
            axios.get(host, { data, headers })
                .then((result) => {
                    if (result.data.length > 0) {

                        var listFleet = [];
                        Promise.all(
                            result.data.map(ev => {
                                return new Promise((resolve, reject) => {
                                    listFleet.push(ev.fleet);
                                    resolve(true);
                                });
                            })
                        ).then(() => {
                            resolve(listFleet);
                        })

                    }
                    else {
                        resolve([]);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][get][.catch] Error `, error.message);
                    //reject(error.response.data);
                    resolve([]);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            //reject(error);
            resolve([]);
        };
    });
};

function addTariffCharger() {
    var context = "Function addTariffCharger";
    try {

        let query = {
            active: true
        };

        chargerFind(query)
            .then(chargersFound => {

                chargersFound.map(charger => {
                    Promise.all(
                        charger.plugs.map(plug => {
                            return new Promise((resolve, reject) => {
                                getTariffs(plug.tariff)
                                    .then((tariffs) => {
                                        plug.tariff = tariffs;
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][] Error `, error.message);
                                        reject(error);
                                    });
                            });
                        })
                    ).then(() => {

                        Charger.updateCharger({ _id: charger._id }, { $set: charger }, (err, result) => {
                            if (err) {
                                console.error(`[${context}][] Error `, err.message);
                            }
                            else {
                                console.log("Updated");
                            };
                        })

                    }).catch(error => {
                        console.error(`[${context}][] Error `, error.message);
                    })
                });

            })
            .catch(error => {
                console.error(`[${context}][chargerFind] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

export function validateSession(chargerFound) {
    var context = "Function validateSession";
    return new Promise((resolve, reject) => {


        let query = {
            hwId: chargerFound.hwId,
            $or: [
                { status: process.env.SessionStatusToStart },
                { status: process.env.SessionStatusRunning },
                { status: process.env.SessionStatusToStop },
                { status: process.env.SessionStatusInPause },
            ]
        };

        ChargingSession.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                if (result.length > 0) {
                    resolve(true)
                }
                else {
                    resolve(false)
                };
            };
        });

    });
};

function offlineNotification() {
    var context = "Function offlineNotification";
    try {

        let query = {
            active: true
        };

        chargerFind(query)
            .then(chargersFound => {

                //console.log("chargersFound", chargersFound.length);
                if (chargersFound.length > 0) {

                    chargersFound.map(charger => {
                        //console.log("charger", charger);

                        var host = process.env.HostUser + process.env.PathGetUser;
                        var headers = {
                            userid: charger.createUser
                        };

                        axios.get(host, { headers })
                            .then((value) => {
                                let userFound = value.data;

                                Charger.updateCharger({ _id: charger._id }, { $set: { offlineNotification: true, offlineEmailNotification: userFound.email } }, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][updateCharger] Error `, err.message)
                                    }
                                    else {
                                        console.log(`[${context}]Charger Updated`);
                                    }
                                });

                            })
                            .catch((error) => {
                                console.error(`[${context}][] Error `, error.message)

                            });
                    });
                };

            })
            .catch(error => {
                console.error(`[${context}][chargerFind] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

async function addOperatorInfoToCharger(charger) {
    let context = "addOperatorInfoToCharger function"
    try {

        let userOperator = await fetchUserOperator(charger.createUser)

        // Add operator info to charger
        if (userOperator) {
            charger.partyId = userOperator.partyId
            charger.operatorEmail = userOperator.operatorEmail
            charger.operatorContact = userOperator.operatorContact
            charger.operator = userOperator.operator
        }
        return charger

    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return charger
    }
}

async function addOperatorId(charger) {
    let context = "addOperatorId function"
    try {

        let userFound = await fetchUserById(charger.createUser)
        if (userFound) {
            charger.operatorId = userFound.operatorId
        }
        return charger

    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return charger
    }
}

function addOperatorEVIO(charger) {
    let context = "Function addOperatorEVIO"
    return new Promise(async (resolve) => {
        try {

            let req = {
                query: {}
            }

            let operatorsFound = await OperatorHandler.getOperator(req);
            let operator;

            switch (charger.chargerType) {
                case "011":
                    operator = operatorsFound.find(operator => { return operator.network === process.env.NetworkGoCharge })
                    break;
                case "012":
                    operator = operatorsFound.find(operator => { return operator.network === process.env.NetworkHyundai })
                    break;
                case process.env.chargerTypeKLC:
                    operator = operatorsFound.find(operator => { return operator.network === process.env.NetworkKLC })
                    break;
                case process.env.chargerTypeKinto:
                    operator = operatorsFound.find(operator => { return operator.network === process.env.NetworkKinto })
                    break;
                default:
                    operator = operatorsFound.find(operator => { return operator.network === process.env.NetworkEVIO })
                    break;
            }

            if (operator) {
                charger.partyId = operator.partyId
                resolve(charger)
            } else {
                operator = operatorsFound.find(operator => { return operator.network === process.env.NetworkEVIO })
                charger.partyId = operator.partyId
                resolve(charger)
            }

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(charger)
        }

    })
}

async function fetchUserOperator(userId) {
    let context = "fetchUserOperator function"

    try {
        let host = process.env.HostUser + process.env.PathGetUserByClientListUserId;
        let config = {
            headers: {
                userid: userId,
            }
        }

        const response = await axios.get(host, config)
        return response.data
    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return null
    }
};

async function fetchUserById(userId) {
    let context = "fetchUserOperator function"

    try {
        let host = process.env.HostUser + process.env.PathGetUserById;
        let params = {
            _id: userId
        }

        const response = await axios.get(host, { params })
        return response.data
    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return null
    }
};

async function makeUpdateOnChargers(charger, userId) {
    let context = "Function makeUpdateOnChargers";

    return new Promise(async (resolve, reject) => {

        let query = {
            _id: charger._id,
            hasInfrastructure: true
        };

        if (charger.geometry !== undefined) {
            if (Object.keys(charger.geometry).length == 0) {
                delete charger.geometry;
            }
            else {
                charger.geometry.type = "Point";
            };
        };


        if (await toggle.isEnable('charge-114') && charger.address) {
            charger.address = await ensureCountryCode(charger.address, context);
        }

        charger.modifyUser = userId;

        updateHwIdOnQrCode(charger);

        if (charger.imageContent != undefined) {

            Charger.findOne(query, (err, chargerFound) => {

                if (err) {

                    console.error(`[${context}][findOne] Error `, err.message);;
                    return res.status(500).send(err.message);

                }
                else {

                    if (charger.imageContent.length == 0) {
                        deleteFile(chargerFound.imageContent)
                            .then(async () => {

                                const newValues = { $set: await verifyIfCoordinatesUpdate(charger) };
                                updateCharger(query, newValues)
                                    .then((answers) => {
                                        if (answers) {
                                            // updateImageStatistics(charger._id);
                                            resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                        } else
                                            //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                                            resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                        reject(error);
                                    });

                            })
                            .catch((error) => {
                                console.error(`[${context}][deleteFile][.catch] Error `, error.message);
                                reject(error);
                            });

                    } else {

                        Promise.all(
                            charger.imageContent.map((image, index) => {
                                return new Promise((resolve, reject) => {
                                    if (image) {
                                        if (image.includes('base64')) {
                                            var dateNow = Date.now();
                                            var path = `/usr/src/app/img/chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                                            var pathImage = '';
                                            var base64Image = image.split(';base64,').pop();

                                            if (process.env.NODE_ENV === 'production') {
                                                pathImage = `${process.env.HostProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For PROD server
                                            }
                                            else if (process.env.NODE_ENV === 'pre-production') {
                                                pathImage = `${process.env.HostPreProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;// For Pred PROD server
                                            }
                                            else {
                                                //pathImage = `${process.env.HostLocal}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                                                pathImage = `${process.env.HostQA}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For QA server
                                            };
                                            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                                if (err) {
                                                    console.error(`[${context}] Error `, err.message);;
                                                    reject(err);
                                                }
                                                else {
                                                    var defaultImage = parseInt(charger.defaultImage, 10);
                                                    if (index === defaultImage) {
                                                        charger.defaultImage = pathImage;
                                                    };
                                                    charger.imageContent[index] = pathImage;
                                                    resolve(true);
                                                };
                                            });
                                        } else if (image == "") {

                                            let nameImage = chargerFound.imageContent[index].split('/');
                                            let path = `/usr/src/app/img/chargers/${nameImage[nameImage.length - 1]}`;
                                            fs.unlink(path, (err) => {
                                                if (err) {
                                                    console.error(`[${context}] Error `, err.message);;
                                                    //reject(err)
                                                    resolve(false);
                                                };
                                            });
                                            resolve(false);

                                        } else {

                                            resolve(true);

                                        };
                                    } else {
                                        resolve(true);
                                    };
                                });
                            })
                        ).then(async (response) => {

                            let validate = response.filter(element => { return element === false });

                            if (validate.length > 0) {

                                rearrangeImage(charger)
                                    .then(async (charger) => {

                                        if (!charger.defaultImage.includes('http://') && !charger.defaultImage.includes('https://') && charger.defaultImage !== undefined && charger.defaultImage !== "") {
                                            charger.defaultImage = charger.imageContent[charger.defaultImage];
                                        };
                                        const newValues = { $set: await verifyIfCoordinatesUpdate(charger) };
                                        updateCharger(query, newValues)
                                            .then((answers) => {
                                                if (answers) {
                                                    // updateImageStatistics(charger._id);
                                                    resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                                } else
                                                    //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                                                    resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                                reject(error.message);
                                            });

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][rearrangeImage][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                            }
                            else {

                                if (!charger.defaultImage.includes('http://') && !charger.defaultImage.includes('https://') && charger.defaultImage !== undefined && charger.defaultImage !== "") {
                                    charger.defaultImage = charger.imageContent[charger.defaultImage];
                                };
                                const newValues = { $set: await verifyIfCoordinatesUpdate(charger) };


                                updateCharger(query, newValues)
                                    .then((answers) => {
                                        if (answers) {
                                            // updateImageStatistics(charger._id);
                                            resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                        } else
                                            //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                                            resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                        reject(error.message);
                                    });

                            };

                        }).catch((error) => {
                            console.error(`[${context}][charger.imageContent.map][.catch] Error `, error.message);
                            reject(error.message);
                        });

                    };

                };

            });

        } else {

            const newValues = { $set: await verifyIfCoordinatesUpdate(charger) };
            updateCharger(query, newValues)
                .then((answers) => {
                    if (answers) {
                        // updateImageStatistics(charger._id);
                        resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                    } else
                        //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                        resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                })
                .catch((error) => {
                    console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                    reject(error);
                });

        };

    });

};

function upperCaseChargerConnectors() {
    var context = "Function upperCaseChargerConnectors";
    try {

        let query = {
            active: true,
            hasInfrastructure: true
        };

        chargerFind(query)
            .then(chargersFound => {
                // console.log("chargersFound", chargersFound.length);
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
                        updateCharger(query, newValues)
                            .then((answers) => {
                                if (answers)
                                    console.log("Update successfully");
                                else
                                    console.log("Update unsuccessfully");
                            })
                            .catch((error) => {
                                console.error(`[${context}][.catch] Error `, error.message);
                            });

                    });
                };

            })
            .catch(error => {
                console.error(`[${context}][chargerFind] Error `, error.message);
            });

    }
    catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function updatePublicChargers() {
    var context = "Function updatePublicChargers";
    try {

        let query = {
            active: true,
            hasInfrastructure: true,
            'accessType': process.env.ChargerAccessPublic
        };

        let newValues = { mapVisibility: true };

        Charger.updateMany(query, { $set: newValues }, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("Charger updated");
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function getChargerDetails(chargerFound, userId) {
    var context = "Function getChargerDetails";
    return new Promise(async (resolve, reject) => {

        try {

            chargerFound = JSON.parse(JSON.stringify(chargerFound));

            var query = {
                chargerId: chargerFound._id
            };

            if (chargerFound.listOfGroups.length > 0) {
                // let listOfGroups = await getGroupsCSUsers(chargerFound.listOfGroups);
                let listOfGroups = await getGroupsCSUsersListIds(chargerFound.listOfGroups);
                chargerFound.listOfGroups = listOfGroups;
            };

            // if (chargerFound.listOfFleets.length > 0) {
            //     let listOfFleets = await getFleetsGroup(chargerFound.listOfFleets);
            //     chargerFound.listOfFleets = listOfFleets;
            // };

            // let operator = await getOperators(chargerFound);
            // let bookings = await getBooking(chargerFound);
            // let POIs = await getPOIsByCharger(query, chargerFound.geometry, chargerFound.hwId);
            let fees = await getFees(chargerFound);


            // if (operator) {

            //     if (operator.entityName === undefined) {
            //         chargerFound.operator = operator.companyName;
            //     }
            //     else {
            //         chargerFound.operator = operator.entityName;
            //     };
            //     chargerFound.operatorContact = operator.contact;
            //     chargerFound.operatorEmail = operator.email;

            // }
            // else {

            //     chargerFound.operator = "";
            //     chargerFound.operatorContact = "";
            //     chargerFound.operatorEmail = "";

            // };

            const updatePlug = (plug) => {
                return new Promise(async (resolve, reject) => {

                    let tariff = await getTariffs(plug.tariff);
                    plug.canBeAutomaticallyBooked = false;

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

                    plug.tariff = tariff;

                    verifyNotifymeHistory(find)
                        .then((value) => {
                            if (!value) {
                                plug.canBeNotified = value;
                                resolve(true);
                            }
                            else {
                                plug.canBeNotified = value;
                                var query = {
                                    $and: [
                                        { plugId: plug.plugId },
                                        { userId: userId },
                                        { status: process.env.SessionStatusRunning }
                                    ]
                                }
                                ChargingSession.findOne(query, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][ChargingSession.findOne] Error `, err.message);;
                                        reject(err);
                                    }
                                    else {
                                        if (result) {
                                            plug.canBeNotified = false;
                                            resolve(true);
                                        }
                                        else {
                                            plug.canBeNotified = true;
                                            resolve(true);
                                        };
                                    };
                                });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][verifyNotifymeHistory][.catch] Error `, error.message);
                            reject(error);
                        });
                });
            };

            chargerFound.fees = fees;
            resolve(chargerFound);
            // Promise.all(
            //     chargerFound.plugs.map(plug => updatePlug(plug))
            // ).then((value) => {
            //     chargerFound.bookings = bookings;
            //     chargerFound.POIs = POIs;
            //     //chargerFound.feeds = feeds;
            //     chargerFound.fees = fees;
            //     resolve(chargerFound);
            // }).catch((error) => {
            //     console.error(`[${context}][map][.catch] Error `, error.message);
            //     resolve({});
            // });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve({});
        };

    });
};

function getNumberOfChargers(userId) {
    var context = "Function getNumberOfChargers";
    return new Promise((resolve, reject) => {

        let query = {
            createUser: userId,
            active: true,
            hasInfrastructure: true,
            operationalStatus: { $ne: process.env.OperationalStatusRemoved }
        };

        Charger.count(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                resolve(0);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getNumberOfSessions(userId) {
    var context = "Function getNumberOfSessions";
    return new Promise((resolve, reject) => {

        let query = {
            userId: userId,
            status: process.env.SessionStatusStopped
        };

        ChargingSession.count(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                resolve(0);
            }
            else {
                resolve(result);
            };
        });
    });
};

function updateHwIdOnQrCode(charger) {
    let context = "Function updateHwIdOnQrCode";

    if (charger.hwId) {

        let query = {
            _id: charger._id,
        };

        let fields = {
            plugs: 1
        };

        Charger.findOne(query, fields, (err, result) => {
            if (err) {

                console.error(`[${context}][findOne] Error `, err.message);

            }
            else {

                if (result) {
                    result.plugs.map(plug => {

                        query = {
                            qrCodeId: plug.qrCodeId
                        };

                        let newFields = {
                            $set: {
                                "qrCode.hwId": charger.hwId
                            }
                        };

                        QrCode.findOneAndUpdate(query, newFields, { new: true }, (err, response) => {
                            if (err) {

                                console.error(`[${context}][findOne] Error `, err.message);

                            }
                            else {

                                console.log("Qr code updated");
                            }
                        });

                    })
                };
            };
        });
    }

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

//addOperationalStatus()
function addOperationalStatus() {
    var context = "Function addOperationalStatus";

    Charger.updateMany({ hasInfrastructure: true, active: true }, { $set: { operationalStatus: process.env.OperationalStatusApproved } }, (err, results) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            // console.log("results", results);
        }
    });

    Charger.updateMany({ hasInfrastructure: false, active: false }, { $set: { operationalStatus: process.env.OperationalStatusRemoved } }, (err, results) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            // console.log("results", results);
        }
    });

};

async function getAllContracts(host, params) {
    const context = "Function getAllContracts";
    try {
        let resp = await axios.get(host, { params })
        if (resp.data) {
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getFleetsGroupIdtags(listOfFleets, contractsHost) {
    const context = "Function getFleetsGroupIdtags";
    try {
        let idTagsArray = []
        for (let fleet of listOfFleets) {
            let contractsQuery = {
                fleetId: fleet.fleetId,
                contractType: process.env.ContractTypeFleet
            }
            let allContracts = await getAllContracts(contractsHost, contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getUsersGroupIdtags(listOfGroups, contractsHost) {
    const context = "Function getUsersGroupIdtags";
    try {
        let listOfUsers = await getListOfUsersArray(listOfGroups)
        let idTags = await getListOfUsersIdTags(listOfUsers, contractsHost)
        return idTags
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getGroupOfUsers(host, params) {
    const context = "Function getGroupOfUsers";
    try {
        let resp = await axios.get(host, { params })
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function getListOfUsersArray(listOfGroups) {
    const context = "Function getListOfUsersArray";
    try {
        const groupIds = listOfGroups
            .map((group) =>
                ObjectId.isValid(group.groupId?.toString())
                    ? new ObjectId(group.groupId.toString())
                    : undefined
            )
            .filter(group => Boolean(group))
        const query = { "_id": { $in: groupIds } }

        const groupsResult = await findGroupCSUser(query);

        const listOfUsers = groupsResult.reduce((accm, group) => {
            if (!group?.listOfUsers?.length) {
                return accm;
            }
            return [
                ...accm,
                ...usersGroup.listOfUsers
            ]
        }, [])

        return listOfUsers;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error;
    }
}

async function getListOfUsersIdTags(listOfUsers, contractsHost) {
    const context = "Function getListOfUsersIdTags";
    try {
        let idTagsArray = []
        for (let user of listOfUsers) {
            let contractsQuery = {
                userId: user.userId,
                contractType: process.env.ContractTypeUser
            }
            let allContracts = await getAllContracts(contractsHost, contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

function getIdTags(allContracts, networkEnum, tokenType, tokenStatus) {
    const context = "Function getIdTags";
    try {
        let idTags = []
        for (let contract of allContracts) {
            let token = getSpecificToken(contract, networkEnum, tokenType)
            let idTagsArray = token ? retrieveIdTagsFromToken(token, tokenStatus) : []
            idTags.push(...idTagsArray)
        }
        return idTags
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

function getSpecificToken(contract, networkEnum, tokenType) {
    return contract.networks.find(network => network.network === networkEnum).tokens.find(token => token.tokenType === tokenType)
}

function retrieveIdTagsFromToken(token, status) {
    const context = "Function retrieveIdTagsFromToken";
    try {
        const idTagInfoStatus = {
            "active": "Accepted",
            "inactive": "Blocked",
            "toRequest": "Blocked",
        }
        if (token.status === status) {
            if (token.tokenType === process.env.AuthTypeRFID) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                if (token.idTagHexa) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexa, idTagInfoStatus[status]))
                }
                if (token.idTagHexaInv) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexaInv, idTagInfoStatus[status]))
                }
                return returnTokens
            } else if (token.tokenType === process.env.AuthTypeApp_User) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                return returnTokens
            }
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }

}

function formatIdTagToWhitelist(idTag, status) {
    return {
        idTag: idTag,
        idTagInfo: {
            status: status
        }
    }
}

function removeRepeatedIdTags(authorizationArray) {
    /**
        If eventually there're repeated idTags, we can't send them, else the charger will return an error
        when updating local authorization list
    */
    return authorizationArray.filter((obj, index, self) =>
        index === self.findIndex((t) => (
            t.idTag === obj.idTag
        ))
    )
}

//Function to find infrastructure using query
function findInfrastructure(query) {
    var context = "Funciton findInfrastructure";
    return new Promise((resolve, reject) => {
        Infrastructure.find(query, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err);
            } else {
                resolve(infrastructureFound);
            };
        });
    });
};

function findInfrastructureFields(query, fields) {
    var context = "Funciton findInfrastructureFields";
    return new Promise((resolve, reject) => {
        Infrastructure.find(query, fields, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err);
            } else {
                resolve(infrastructureFound);
            };
        });
    });
};

function getChargers(infrastructureFound) {
    var context = "Funciton getChargers";
    return new Promise(async (resolve, reject) => {
        var listChargers = [];
        const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
        const getChargers = (charger) => {
            return new Promise((resolve, reject) => {

                var query = {
                    _id: charger.chargerId,
                    hasInfrastructure: true
                };

                var fields = {
                    _id: 1,
                    geometry: 1,
                    accessType: 1,
                    active: 1,
                    status: 1,
                    chargingDistance: 1,
                    imageContent: 1,
                    allowRFID: 1,
                    parkingSessionAfterChargingSession: 1,
                    mapVisibility: 1,
                    hwId: 1,
                    name: 1,
                    address: 1,
                    infoPoints: 1,
                    energyManagementEnable: 1,
                    switchBoardId: 1,
                    "plugs.status": 1,
                    "plugs.plugId": 1,
                    "plugs.connectorType": 1,
                    "plugs.qrCodeId": 1,
                    "plugs.amperage": 1,
                    "plugs.voltage": 1,
                    "plugs.power": 1,
                    "plugs.active": 1,
                    heartbeat: 1,
                    model: 1,
                    vendor: 1,
                    manufacturer: 1,
                    offlineNotification: 1,
                    offlineEmailNotification: 1,
                    chargePointSerialNumber: 1,
                    firmwareVersion: 1,
                    iccid: 1,
                    imsi: 1,
                    operationalStatus: 1,
                    heartBeat: 1,
                    updatedAt: 1,
                    CPE: 1,
                    originalCoordinates: 1

                };

                Charger.findOne(query, fields, async (err, chargerFound) => {
                    if (err) {
                        console.error(`[${context}][findOne] Error `, err.message);
                        reject(err);
                    } else {
                        if (chargerFound) {
                            chargerFound = JSON.parse(JSON.stringify(chargerFound));
                            chargerFound.geometry = returnCoordinatesAccordingToFlag(chargerFound, searchCoordinatesFlagActive);
                            if (chargerFound.CPE) {
                                chargerFound.deliveryPoint = chargerFound.CPE
                                delete chargerFound.CPE
                            }
                            switch (chargerFound.status) {
                                case '10':
                                    chargerFound.status = 'AVAILABLE';
                                    break;
                                case '50':
                                    chargerFound.status = 'UNAVAILABLE';
                                    break;
                                default:
                                    chargerFound.status = 'UNKNOWN';
                                    break;
                            };

                            Promise.all(
                                chargerFound.plugs.map(plug => {
                                    return new Promise((resolve) => {
                                        switch (plug.status) {
                                            case '10':
                                                plug.status = 'AVAILABLE';
                                                break;
                                            case '20':
                                                plug.status = 'CHARGING';
                                                break;
                                            case '30':
                                                plug.status = 'RESERVED';
                                                break;
                                            case '40':
                                                plug.status = 'UNAVAILABLE';
                                                break;
                                            default:
                                                chargerFound.status = 'UNKNOWN';
                                                break;
                                        };
                                        resolve(true);

                                    });
                                })
                            ).then(() => {
                                chargerFound._id = charger._id;
                                // chargerFound.chargerId = charger.chargerId;
                                listChargers.push(chargerFound);
                                resolve(true);
                            })

                        }
                        else {
                            listChargers.push(charger);
                            resolve(true);
                        };
                    };
                });
            });
        };
        Promise.all(
            infrastructureFound.listChargers.map(charger => getChargers(charger))
        ).then(() => {
            infrastructureFound = JSON.parse(JSON.stringify(infrastructureFound));
            listChargers.sort((a, b) => (a.chargerId > b.chargerId) ? 1 : ((b.chargerId > a.chargerId) ? -1 : 0));
            infrastructureFound.listChargers = listChargers;
            resolve(infrastructureFound);
        }).catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
            reject(error);
        });
    });
};


function availabilityChargers(chargers, searchCoordinatesFlagActive = false) {
    var context = "Funciton availabilityChargers";
    return new Promise((resolve, reject) => {
        var listChargers = [];

        Promise.all(
            chargers.map(charger => {
                return new Promise((resolve, reject) => {
                    charger.geometry = returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive);


                    if (charger.availability.availabilityType === process.env.ChargerAvailabilityAlways) {

                        listChargers.push(charger);
                        resolve(true);

                    } else {

                        listChargers.push(charger);
                        resolve(true);

                    };

                });
            })
        ).then(() => {

            resolve(listChargers)

        }).catch((error) => {

            console.error(`[${context}][.catch] Error `, error.message);
            reject(error);

        });
    });
};

function compareChargers(otherChargers, publicChargers) {
    const context = "Funciton compareChargers";
    return new Promise((resolve, reject) => {

        if (publicChargers.length === 0) {
            resolve(otherChargers);
        } else {

            Promise.all(
                publicChargers.map(publicCharger => {
                    publicCharger = JSON.parse(JSON.stringify(publicCharger));
                    return new Promise((resolve) => {

                        // console.log("publicCharger", publicCharger.hwId)
                        let found = otherChargers.find(charger => {
                            // console.log("charger", charger.hwId)
                            charger = JSON.parse(JSON.stringify(charger));
                            return charger._id === publicCharger._id
                        });
                        if (found) {
                            resolve();
                        } else {
                            otherChargers.push(publicCharger);
                            resolve();
                        };

                    });
                })
            ).then(() => {
                resolve(otherChargers);
            }).catch((error) => {
                console.error(`[${context}][.catch] Error `, error.message);
                resolve(otherChargers);
            });
        };
    });
};

async function prioritizeIdTags(idTagsInfoArray, hwId) {
    const context = "Function prioritizeIdTags"
    try {
        let idTags = idTagsInfoArray.map(obj => obj.idTag)
        let query = [{
            "$match": {
                "idTag": {
                    "$in": idTags
                },
                "hwId": hwId
            }
        },
        {
            "$group": {
                "_id": {
                    "idTag": "$idTag"
                },
                "COUNT(*)": {
                    "$sum": 1
                }
            }
        },
        {
            "$project": {
                "idTag": "$_id.idTag",
                "count": "$COUNT(*)",
                "_id": 0
            }
        }
        ];

        let idTagsCount = await ChargingSession.aggregate(query)
        let sortedIdTags = idTagsCount.sort((a, b) => b.count - a.count).map(idTagCount => idTagsInfoArray.find(obj => obj.idTag === idTagCount.idTag))
        let inexistingIdTagsOnSessions = idTagsInfoArray.filter(obj => !sortedIdTags.find(sortedObj => sortedObj.idTag === obj.idTag))
        return [...sortedIdTags, ...inexistingIdTagsOnSessions]
    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
        return idTagsInfoArray
    }
}

//addClientName();
async function addClientName() {
    const context = "Function addClientName";

    try {

        let infra = await Infrastructure.updateMany({}, { $set: { clientName: "EVIO" } });
        let chargers = await Charger.updateMany({}, { $set: { clientName: "EVIO" } });

        // console.log("infra", infra);
        // console.log("chargers", chargers);

    }
    catch (error) {

        console.error(`[${context}] Error `, error.message);

    };

};

//updateImageHistory();
async function updateImageHistory() {
    const context = "Function updateImageHistory";

    Charger.find({ hasInfrastructure: true }, { _id: 1 }, (err, chargersFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };

        if (chargersFound.length > 0) {

            chargersFound.forEach(charger => {
                //console.log("charger", charger);
                // updateImageStatistics(charger._id)
            });

        };
    });

};
async function getChargersToOCM(req, res) {
    const context = "GET /locations"
    try {
        let query = {
            accessType: process.env.ChargerAccessPublic,
            mapVisibility: true,
            active: true,
            operationalStatus: "APPROVED",
        }

        let fields = {
            geometry: 1,
            status: 1,
            allowRFID: 1,
            hwId: 1,
            name: 1,
            address: 1,
            infoPoint: 1,
            "plugs._id": 1,
            "plugs.status": 1,
            "plugs.statusChangeDate": 1,
            "plugs.plugId": 1,
            "plugs.connectorType": 1,
            "plugs.amperage": 1,
            "plugs.voltage": 1,
            "plugs.active": 1,
            updatedAt: 1,
        };

        let allChargers = await Charger.find(query, fields).lean()
        let ocpiFormatChargers = allChargers.map(charger => evioToOCPIModel(charger))
        return res.status(200).send(ocpiFormatChargers);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
}

function evioToOCPIModel(charger) {
    const context = "Function evioToOCPIModel"
    try {

        let address = addressS.parseAddressOrCountryToString(charger.address)

        return {
            country_code: "PT", //ISO-3166 alpha-2 country code of the CPO that 'owns' this Location.
            party_id: "EVI", // CPO ID of the CPO that 'owns' this Location (following the ISO-15118 standard).
            id: charger.hwId,
            publish: true,
            name: charger.name,
            address: address,
            city: charger.address.city,
            postal_code: charger.address.zipCode,
            coordinates: {
                longitude: charger.geometry.coordinates[0],
                latitude: charger.geometry.coordinates[1],
            },
            time_zone: "Europe/Lisbon",
            last_updated: new Date(charger.updatedAt).toISOString(),
            operator: {
                name: "EVIO - Electrical Mobility",
                logo: {
                    "url": "https://filesapi.go-evio.com/logos/evio_logo.jpeg",
                    "thumbnail": "https://filesapi.go-evio.com/logos/evio_logo_thumb.jpeg",
                    "category": "NETWORK",
                    "type": "jpeg",
                    "width": 512,
                    "height": 512
                },
                website: "https://go-evio.com"
            },
            evses: charger.plugs.map(plug => buildEvsesObject(charger, plug)),
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function buildEvsesObject(charger, plug) {
    const context = "Function buildEvsesObject"
    try {
        return {
            uid: plug._id,
            status: charger.status === process.env.ChargePointStatusEVIO ? (plug.active ? statusMapper(plug.status) : "OUTOFORDER") : "OUTOFORDER",
            last_updated: new Date(charger.updatedAt).toISOString(),
            capabilities: charger.allowRFID ? ["RFID_READER", "REMOTE_START_STOP_CAPABLE"] : ["REMOTE_START_STOP_CAPABLE"],
            connectors: [
                {
                    id: `${plug._id}-0${plug.plugId}`,
                    standard: connectorTypeMapper(plug.connectorType.toUpperCase()),
                    format: plug.connectorFormat ? plug.connectorFormat : "SOCKET",
                    power_type: plug.powerType ? plug.powerType : "AC_3_PHASE",
                    max_voltage: plug.voltage,
                    max_amperage: plug.amperage,
                    last_updated: new Date(charger.updatedAt).toISOString(),
                }
            ],
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return {}
    }
}

function statusMapper(status) {
    const context = "Function statusMapper"
    try {
        switch (status) {
            case '10':
                return "AVAILABLE"
            case '20':
                return "CHARGING"
            case '30':
                return "RESERVED"
            case '40':
                return "OUTOFORDER"
            case '50':
                return "INOPERATIVE"
            default:
                return "UNKNOWN"
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return "UNKNOWN"
    }
}

function connectorTypeMapper(type) {
    const context = "Function connectorTypeMapper"
    try {
        switch (type) {
            case 'CCS 2':
                return "IEC_62196_T2_COMBO"
            case 'CHADEMO':
                return "CHADEMO"
            case 'TYPE 2':
                return "IEC_62196_T2"
            default:
                return "UNKNOWN"
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return "UNKNOWN"
    }
}

function chargerDefaultNetworks(hwId) {
    return [
        {
            name: process.env.NetworkEVIO,
            networkName: "server_evio_network",
            network: process.env.NetworkEVIO,
            status: process.env.ChargerNetworkStatusInactive,
            id: hwId,
            activationRequest: false,
            publish: true,

        },
        {
            name: process.env.NetworkMobiE,
            networkName: "server_mobie_network",
            network: process.env.NetworkMobiE,
            status: process.env.ChargerNetworkStatusInactive,
            id: "",
            activationRequest: false,
            publish: true,
        },
        {
            name: "server_international_network_1",
            networkName: "server_international_network_1",
            network: process.env.NetworkGireve,
            status: process.env.ChargerNetworkStatusInactive,
            id: "",
            activationRequest: false,
            publish: true,
        }
    ];
}

function removeDuplicates(listOfChargers, searchCoordinatesFlagActive = false) {
    const context = "Function removeDuplicates";
    const uniqueChargers = new Set();
    const filteredChargers = listOfChargers.filter(charger => {
        charger = JSON.parse(JSON.stringify(charger));
        const isDuplicate = uniqueChargers.has(charger._id);
        uniqueChargers.add(charger._id);
        return !isDuplicate;
    }).map(charger => {
        charger = JSON.parse(JSON.stringify(charger));
        return { ...charger, geometry: returnCoordinatesAccordingToFlag(charger, searchCoordinatesFlagActive) }
    });

    return filteredChargers;
}

async function changeAvailability(hwId, plugId, active) {
    const context = "Function changeAvailability";
    try {
        let body = {
            hwId,
            plugId,
            availability: active ? "Operative" : "Inoperative"
        }
        let host = process.env.HostOCPP16 + process.env.PathChangeAvailability
        let resp = await axios.post(host, body)
        if (resp.data) {
            console.log(`[${context}] changeAvailability success!`)
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function sendToSaveDataPlugStatusChange(dataPlugStatusChange) {
    const context = "Function sendToSaveDataPlugStatusChange";
    try {

        let data = dataPlugStatusChange;
        let host = process.env.HostConnectioStation + process.env.PathSaveDataPlugStatusChange;

        axios.post(host, data)
            .then((result) => {
                console.log(`[${context}] result`, result.data)
            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message);
            })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

//updateAddOperator()
async function updateAddOperator() {
    let context = "Function updateAddOperator";
    try {

        let query = {
            active: true,
            hasInfrastructure: true
        };

        let chargersFound = await Charger.find(query);

        if (chargersFound.length > 0) {


            for (let charger of chargersFound) {
                //chargersFound.forEach(async (charger) => {

                if (!charger.partyId) {

                    charger = JSON.parse(JSON.stringify(charger));

                    charger = await addOperatorEVIO(charger);

                    let query = {
                        _id: charger._id
                    }

                    let newValues = {
                        $set: charger
                    };


                    //console.log("newValues", newValues);

                    let chargerUpdated = await Charger.findOneAndUpdate(query, newValues, { new: true });

                    if (chargerUpdated) {
                        console.log("Charger Updated")
                    } else {
                        console.log("Charger not updated")
                    };

                }

            };

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await Charger.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ");
            };
        })

        await Charger.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ");
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

        // console.log("coutryCodes")
        // console.log(coutryCodes)

        // console.log("unicCountries")
        // console.log(unicCountries)

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

function getUserIDByToken(token) {
    const context = '[ chargers getUserIDByToken ]'
    return new Promise((resolve, reject) => {
        try {
            if (!token) {
                console.error(`${context} Error - Missing Input Data`);
                return reject('Missing Input Data');
            }
            const headers = {
                'token': token
            };

            axios.get(process.env.HostAuthorization + process.env.HostCheckAuth, { headers }).then(function (response) {
                resolve(response.data)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message ? error.message : error)
                return reject(error.message ? error.message : error)
            })

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return reject(error.message);
        }
    })
}

function getFleetsGroupListIds(groups) {
    const context = "Funciton getFleetsGroupListIds";
    return new Promise(async (resolve, reject) => {
        try {
            const host = process.env.HostEvs + process.env.PathGetFleetsByIdList;
            const listOfFleets = [];
            let data = {
                listOfFleetsIds: groups.map(group => group.fleetId)
            }
            let groupFleets = await axios.get(host, { data })
            groupFleets = groupFleets.data
            for (let newFleet of groupFleets) {
                let originalGroup = groups.find(og => og.fleetId === newFleet._id)
                newFleet._id = originalGroup?._id ?? newFleet._id;
                newFleet.fleetId = originalGroup?.fleetId ?? newFleet._id;
                newFleet.fleetName = originalGroup?.fleetName ?? newFleet.name;
                listOfFleets.push(newFleet);
            }
            resolve(listOfFleets);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(groups);
        }
    });
};

async function createTimeZones() {
    const context = "Function createTimeZones"
    try {

        const chargers = await Charger.find({ 'timeZone': { '$exists': false } }).lean()

        for (let i = 0; i != chargers.length; i++) {

            const timeZoneString = timeZone.getTimezoneFromCoordinates(chargers[i].geometry.coordinates)
            const newValues = { "$set": { "timeZone": timeZoneString } }

            const query = { _id: chargers[i]._id }

            await Charger.findOneAndUpdate(query, newValues)
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

export default module.exports = router;
