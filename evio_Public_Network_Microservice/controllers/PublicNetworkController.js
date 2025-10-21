const { captureException } = require('@sentry/node');
const Charger = require('../models/charger');
const EvseStatus = require('../utils/enums/evseEnums');
const ChargerEnums = require('../utils/enums/chargerEnums');
const Constants = require('../utils/constants');
const {isFlagChooseSearchCoordinatesActive, returnCoordinatesAccordingToFlagMap} = require('../helpers/handleCoordinates');
const HubjectAllowedUsers = require('../models/hubjectAllowedUsers');
const Commons = require("evio-library-commons").default;
const { Enums } = require('evio-library-commons').default;

function createPipeline(query, fields, distance, lng, lat, searchCoordinatesFlagActive = false) {
    const partyIdsToExclude = ['EPO', 'GFX'];
    /**
         * The EPO and GFX are the ids of international charging point operators. 
         * those operators are ignored by the query because they have some 
         * issues regarding their OCPI tariffs. As long as this is
         * not solved, this filter needs to stay in.
    */
    const queryWithExcludedIds = { ...query, partyId: { $nin: partyIdsToExclude }, countryCode: { $in: Constants.countriesAllowed } };
    return [        
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lng, lat],
                },
                distanceField: 'dist.calculated',
                maxDistance: distance,
                includeLocs: 'dist.location',
                spherical: true,
                key: searchCoordinatesFlagActive ? "geometry.coordinates" : "originalCoordinates.coordinates",
                query: queryWithExcludedIds
            },
        },
        {
            $project: fields,
        },
    ];
}
async function getChargers(query, fields, req, res) {
    const context = 'Function getChargers';
    try {
        const searchCoordinatesFlagActive = await isFlagChooseSearchCoordinatesActive();
        const distance = parseInt(req.query.distance);
        const lng = parseFloat(req.query.lng);
        const lat = parseFloat(req.query.lat);
        const userId = req.headers?.userid || '';

        const pipeline = createPipeline(query, fields, distance, lng, lat, searchCoordinatesFlagActive);
        const allowHubject = userId ? await HubjectAllowedUsers.isHubjectAllowedUser(userId) : false;
        if(!!allowHubject) {
            delete pipeline[0]['$geoNear'].query.countryCode;
        }
        
        const chargers = await Charger.aggregate(pipeline);
        return res.status(200).send(returnCoordinatesAccordingToFlagMap(chargers, searchCoordinatesFlagActive));
    } catch (error) {
        console.log(`[${context}][.then][find] Error `, error.message);
        captureException(error);
        return res.status(500).send(error.message);
    }
}


function buildFieldQuery(fieldName, name) {
    // This regex matches any string containing 'name', regardless of case or position.
    return name
        .split('|')
        .filter((elem) => elem.trim())
        .map((string) => {
            return { [fieldName]: { $regex: new RegExp('^' + `.*${string}.*`, 'i') } };
        });
}
function buildQueryForNameOrHardwareId(nameQuery, hwidQuery, clientName, countriesAllowed) {
    let query = {
        $and: [
            {
                plugs: {
                    $elemMatch: { subStatus: { $nin: [EvseStatus.planned, EvseStatus.removed] } },
                },
            },
            { $or: [{ $and: nameQuery }, { $and: hwidQuery }] },
            { $and: [{ partyId: { $ne: 'EPO' } }, { partyId: { $ne: 'GFX' } }] },
            { operationalStatus: ChargerEnums.operationalStatus.approved },
            {
                $or: [
                    { source: { $ne: ChargerEnums.network.mobie } },
                    { $and: [{ source: ChargerEnums.network.mobie }, { publish: true }] },
                ],
            },
            {countryCode: { $in: Constants.countriesAllowed } },
            clientName !== Constants.clients.evio.name ? { chargerType: { $ne: ChargerEnums.chargerType.tesla } } : {},
        ],
    };

    return query;
}


function createNameOrHardWareIdPipeline(query, countryCode, name) {
    const maxNumberOfAllowedChargers = 20;
    const nameRegExpStart = new RegExp(`^${name}.*`, 'i');
    const fields = { _id: 1, geometry: 1, address: 1, name: 1, hwId: 1, chargerType: 1, countryCode: 1 };

    let pipeline = [
        { $match: query },
        { $project: fields },
        {
            $addFields: {
                startsWithNameForQuery: { $regexMatch: { input: "$name", regex: nameRegExpStart } }
            }
        },
    ];

    if (countryCode) {
        pipeline.push(
            {
                $facet: {
                    matchingCountryCode: [
                        { $match: { countryCode: { $in: countryCode } } },
                        { $addFields: { isMatchingCountryCode: true } },
                        { $sort: {isMatchingCountryCode: -1,  startsWithNameForQuery: -1, name: 1 } }
                    ],
                    notMatchingCountryCode: [
                        { $match: { countryCode: { $nin: countryCode } } },
                        { $addFields: { isMatchingCountryCode: false } },
                        { $sort: {isMatchingCountryCode: -1,  startsWithNameForQuery: -1, name: 1 } }
                    ],
                },
            },
            {
                $project: {
                    chargers: {
                        $concatArrays: ['$matchingCountryCode', '$notMatchingCountryCode'],
                    },
                },
            },
            { $unwind: '$chargers' },
            { $sort: { 'chargers.isMatchingCountryCode': -1 } }
        );
    }

    pipeline.push(
        { $limit: maxNumberOfAllowedChargers },
    );

    return pipeline;
}

async function getChargersByNameOrHardwareId(req) {
    const context = 'Function getChargersByNameOrHardwareId';
    try {
        const { name, clientName, countryCode } = req.query;
        const query = buildQueryForNameOrHardwareId(
            buildFieldQuery('name', name),
            buildFieldQuery('hwId', name),
            clientName,
            countryCode
        );
        const chargersFound = await Charger.aggregate(createNameOrHardWareIdPipeline(query, countryCode, name));
        const chargers = chargersFound.map(charger => charger.chargers).filter(Boolean);
   
        return chargers;
    } catch (error) {
        captureException(error);
        console.error(`[${context}][.then][find] Error `, error.message);
        return [];
    }
}



function buildBaseQuery() {
    return {
        operationalStatus: process.env.OperationalStatusApproved,
        plugs: { $elemMatch: { subStatus: { $nin: [EvseStatus.planned, EvseStatus.removed] } } },
        $or: [{ source: { $ne: process.env.NetworkMobiE } }, { $and: [{ source: process.env.NetworkMobiE }, { publish: true }] }],
    };
}


function handleStations(req, query, tariffType, stations) {
    let networkAcessible = true;
    if (
        !stations.includes(process.env.StationsPublic) &&
        !stations.includes(process.env.StationsTesla)
    ) {
        networkAcessible = false;
    }

    if (
        stations.includes(process.env.StationsPublic) &&
        !stations.includes(process.env.StationsTesla)
    ) {
        query.chargerType = { $ne: '009' };
    } else if (
        !stations.includes(process.env.StationsPublic) &&
        stations.includes(process.env.StationsTesla)
    ) {
        query.chargerType = '009';
    }

    Object.assign(query, req.body);
    if (tariffType) {
        addTariffConditions(query, tariffType);
    }
    return networkAcessible;
}

function addTariffConditions(query, tariffType) {
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
            };
            break;
        case process.env.TARIFF_TYPE_TIME:
            if (!query.chargerType) {
                query.chargerType = { $ne: "009" };
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
            };
            break;
        default:
            return; // No additional conditions for other tariff types
    }
    Object.assign(query, temp); // Merge the new conditions into the existing query
}


async function handlePublicNetworkRequest(req, res, routeContext, isLimited = false) {
    const context = `${routeContext}`;
    try {
        const fields = isLimited ?  {
            _id: 1,
            plugs: {
                $map: {
                    input: "$plugs",
                    as: "plug",
                    in: {
                        status: "$$plug.status"
                    }
                }
            },
            chargerType: 1,
            status: 1,
            createUser: 1,
            name: 1,
            clientName: 1,
            geometry: 1,
            originalCoordinates: 1,
            partyId: 1,
        }: {
            _id: 1, hwId: 1, geometry: 1, status: 1, accessType: 1, address: 1, name: 1, originalCoordinates: 1,
            "plugs.subStatus": 1, "plugs.plugId": 1, "plugs.connectorType": 1, "plugs.status": 1,
            "plugs.statusChangeDate": 1, "plugs.power": 1, "plugs.amperage": 1, "plugs.voltage": 1,
            "plugs.tariffId": 1, "plugs.serviceCost": 1, "plugs.evseGroup": 1, "plugs.capabilities":1, rating: 1, imageContent: 1,
            chargerType: 1, defaultImage: 1, chargingDistance: 1, network: 1, partyId: 1, source: 1,
            evseGroup: 1, fees: 1, countryCode: 1, numberOfSessions: 1, voltageLevel: 1, updatedAt: 1
        };


        let query = buildBaseQuery();
        const { tariffType, stations } = req.body;
        delete req.body.tariffType; 
        delete req.body.stations; 

        if (stations) {
            const isNetworkAvailable = handleStations(req, query, tariffType, stations);
            if (!isNetworkAvailable) {
                return res.status(200).send([]);
            }
        } else if (tariffType) {
            addTariffConditions(query, tariffType);
        }
        
        Object.assign(query, req.body);
       
        return await getChargers(query, fields, req, res);
    } catch (error) {
        console.error(`[${context}] Error: ${error.message}`);
        captureException(error);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    }
}




module.exports = {
    getChargers,
    getChargersByNameOrHardwareId,
    buildFieldQuery,
    buildQueryForNameOrHardwareId,
    createNameOrHardWareIdPipeline,
    buildBaseQuery,
    handleStations,
    addTariffConditions,
    handlePublicNetworkRequest

};
