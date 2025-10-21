const toggle = require('evio-toggle').default;
const { verifyStations, queryCreation } = require('../utils/utils');
const { createErrorResponse } = require('../utils/errorUtils');
const { ChargerSubStatus, PlugStatus } = require('../utils/enums/enumPlugs');
const { StationsEnum } = require("../utils/enums/enumStations");
const { ConnectorTypesEnum } = require('../utils/enums/enumConnectorTypes');
const Constants = require("../utils/constants");

function validateRequestBody(req, res) {
    if (!req.body || Object.keys(req.body).length === 0) {
        res.status(400).json({
            auth: false,
            code: `server_body_required`,
            message: `Body is required`,
        });
        return false;
    }
    return true;
}

function checkTariffTypeValidity(tariffType, res) {
    const acceptedTariffTypes = ['time', 'power'];
    const validationTariffType = acceptedTariffTypes.includes(tariffType);
    if (!validationTariffType) {
        res.status(400).json({
            auth: false,
            code: `server_invalid_tariff_type`,
            message: `Invalid tariff type.`,
        });
        return false;
    }
    return true;
}



function validateConnectorType(connectorType) {
    const acceptedConnectorTypes = Object.values(ConnectorTypesEnum).map((connector) => connector.mainConnectorType);
    if (!connectorType || connectorType.length === 0) {
        return true;
    }
    return connectorType.every((type) => acceptedConnectorTypes.includes(type));
}



function validateChargersToCompare(chargersToCompare, response) {
    if (!chargersToCompare || chargersToCompare.length === 0) {
        createErrorResponse(response, 'server_chargers_to_compare_required', 'chargersToCompare is required');
        return false;
    }

    if (chargersToCompare.length > 10) {
        createErrorResponse(
            response,
            'server_chargers_to_compare_max_length',
            'chargersToCompare maximum length is 10'
        );
        return false;
    }

    for (const charger of chargersToCompare) {
        if (!charger.chargerId || !charger.plugPriceId) {
            createErrorResponse(
                response,
                'server_chargers_to_compare_invalid',
                'chargersToCompare should have chargerId and plugPriceId'
            );
            return false;
        }
    }
    return true;
}

async function createDataForFiltering(filter, userId, clientName) {
    let data = queryCreation(filter, true);
    let dataPublic = queryCreation(filter, true);

    if (filter.stations.length > 0) {
        let result = verifyStations(filter, userId, clientName);
        data = { ...data, ...result.data, stations: filter.stations };
        dataPublic = { ...dataPublic, ...result.dataPublic, stations: filter.stations };
    }

    return { data, dataPublic };
}

function addFilterToQuery(tariffType, onlyOnline, onlyAvailable, query) {
    if (tariffType) {
        query.tariffType = tariffType;

    }
    if (onlyAvailable) {
        query.plugs['$elemMatch'] = { ...query.plugs['$elemMatch'], status: PlugStatus.AVAILABLE, subStatus: { $nin: [ChargerSubStatus.PLANNED, ChargerSubStatus.REMOVED, ChargerSubStatus.INOPERATIVE, ChargerSubStatus.OUTOFORDER] } }; //Do the query with status eq 10.
    }
    if (onlyOnline) {
        query.status = { $nin: [PlugStatus.OFFLINE, PlugStatus.UNAVAILABLE] };
        //We are doing the query with the filter 40 because 50 does not exist for plugs.
        query.plugs['$elemMatch'] = { ...query.plugs['$elemMatch'], status: { $ne: PlugStatus.UNAVAILABLE}, subStatus: { $nin: [ChargerSubStatus.PLANNED, ChargerSubStatus.REMOVED, ChargerSubStatus.INOPERATIVE, ChargerSubStatus.OUTOFORDER] } }; 
    }
    if(!onlyOnline && !onlyAvailable){
        query.plugs['$elemMatch'] = { ...query.plugs['$elemMatch'], subStatus: { $nin: [ChargerSubStatus.PLANNED, ChargerSubStatus.REMOVED, ChargerSubStatus.INOPERATIVE, ChargerSubStatus.OUTOFORDER] } };
    }
 
    return query;
}
function checkRatingValidity(rating, res) {
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
        res.status(400).json({
            auth: false,
            code: 'server_invalid_rating',
            message: 'Invalid rating. Rating should be an integer between 0 and 5.',
        });
        return false;
    }
    return true;
}
function filterChargersByConnectorType(allChargers, desiredConnectorType) {
    let filteredChargers = allChargers;
    if (desiredConnectorType) {
        filteredChargers = allChargers.map((eachCharger) => {
            eachCharger.plugs = eachCharger.plugs.filter((eachPlug) => desiredConnectorType.includes(eachPlug.connectorType));
            return eachCharger;
        })
    }
    return filteredChargers;
}

function filterTeslaStations(stations) {
    return stations && Array.isArray(stations) && stations.includes(StationsEnum.tesla)
        ? stations.filter(station => station !== StationsEnum.tesla)
        : stations;
}

function excludeTeslaChargers(stations, dataPublic) {
    if (!stations || stations.length === 0) {
        dataPublic.chargerType = { $ne: Constants.networks.tesla.chargerType };
    }
    return dataPublic;
}

function standardiseConnectorType(connectorType) {
    for (const { mainConnectorType, secondaryConnectorType } of Object.values(ConnectorTypesEnum)) {
        if (mainConnectorType === connectorType || (secondaryConnectorType && secondaryConnectorType.includes(connectorType))) {
            return mainConnectorType;
        }
    }
    return connectorType;
}

function getSecondaryConnectorTypes(mainConnectorType) {
    const connector = Object.values(ConnectorTypesEnum).find(connector => connector.mainConnectorType === mainConnectorType);
    return connector ? [mainConnectorType, ...(connector.secondaryConnectorType || [])] : [mainConnectorType];
}

module.exports = {
    validateConnectorType,
    validateRequestBody,
    validateChargersToCompare,
    checkTariffTypeValidity,
    createDataForFiltering,
    addFilterToQuery,
    checkRatingValidity,
    filterChargersByConnectorType,
    filterTeslaStations,
    excludeTeslaChargers,
    standardiseConnectorType,
    getSecondaryConnectorTypes
};