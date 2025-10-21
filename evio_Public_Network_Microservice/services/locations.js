const { BadRequest } = require('../utils/errorHandling');
const Constants = require('../utils/constants');
const Charger = require('../models/charger');
const { getVisibleNetworks } = require('evio-library-identity').default;
const Commons = require("evio-library-commons").default;

// Helper function to validate and sanitize query parameters
function validateAndSanitizeParameters(query) {

    // Validation of fields
    if (query.countryCode && ( typeof query.countryCode !== 'string' || !Commons.Constants.AllowedCountries.includes(query.countryCode)) ) throw BadRequest(`Invalid countryCode. Allowed countries: ${Commons.Constants.AllowedCountries}`);
    if (query.id && typeof query.id !== 'string') throw BadRequest('Invalid id');
    if (query.startDate && !validISODate(query.startDate)) throw BadRequest('Invalid startDate');
    if (query.endDate && !validISODate(query.endDate)) throw BadRequest('Invalid endDate');
    

    // Sanitization of fields
    // Default page to 1
    const page = Math.max(parseInt(query.page) || Constants.locations.pagination.defaultPage, Constants.locations.pagination.defaultPage); 

    // Default limit to 10 and maximum to 100
    const limit = Math.min(
        Math.max(parseInt(query.limit) || Constants.locations.pagination.defaultLimit, Constants.locations.pagination.defaultLimit), 
        Constants.locations.pagination.maximumLimit); 

    return {
        page,
        limit,
        startDate : query.startDate,
        endDate : query.endDate,
        id: query.id,
        countryCode: query.countryCode
    };
}


// Function to generate full URL for pagination links
function generatePageUrl(req, page, limit , params) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    return `${baseUrl}?page=${page}&limit=${limit}${buildQueryString(params)}`;
}


function validISODate(date) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
    return isoDateRegex.test(date);
}



async function paginateLocations(query, fields, skip, limit, sort = { lastUpdated: 1 }) {
    return await Charger.find(query) // Apply the query
        .select(fields)              // Specify the fields to return
        .sort(sort)                  // Apply the sort
        .skip(skip)                  // Skip the documents for pagination
        .limit(limit)                // Limit the number of documents returned
        .lean();                     // Lean the result
}

async function getPublicChargers(parameters , visibleNetworks) {
    const {page, limit, id , countryCode , startDate  , endDate } = parameters

    const query = {
        $and: [
         { operationalStatus: Constants.operationalStatus.approved},
         { plugs: { $elemMatch: { subStatus: { $nin: [Constants.evseStatus.planned, Constants.evseStatus.removed, Constants.evseStatus.unknown] } } }},
         { $or : buildSourcesRegex(visibleNetworks) },
         id ? {hwId: id} : {},
         countryCode ? {"address.countryCode": countryCode} : {"address.countryCode": {$in : Commons.Constants.AllowedCountries}},
         startDate ? {lastUpdated: { $gte: startDate }} : {},
         endDate ? {lastUpdated: { $lte: endDate }} : {},   
        ]
    }


    const fields = {
        _id : 0,
        network: "$source",
        country_code: "$cpoCountryCode",
        party_id : "$partyId",
        id : "$hwId",
        name  : 1,
        address : 1,
        coordinates: "$geometry.coordinates",
        parkingType: 1,
        timeZone: 1,
        "plugs.plugId": 1,
        "plugs.serviceCost.elements": 1,
        "plugs.subStatus": 1,
        "plugs.connectorFormat": 1,
        "plugs.connectorPowerType": 1,
        "plugs.connectorType": 1,
        "plugs.voltage": 1,
        "plugs.amperage": 1,
        "plugs.power": 1,
        lastUpdated: 1
    }

    // For each page, we skip "limit" documents
    const skip = (page - 1) * limit;


    // I'm using limit + 1 so that I don't have to check if there is a next page based on the total number of documents
    return await paginateLocations(query, fields , skip, limit + 1)
}


function buildSourcesRegex(visibleNetworks) {
    // Build case-insensitive regex patterns for each network
    return visibleNetworks.map(network => {
        return network === Constants.networks.mobie
        ? { 
            $and: [
              { source: { $regex: `^${network}$`, $options: 'i' } },
              { publish: true },
            ],
          }
        : { source: { $regex: `^${network}$`, $options: 'i' } }
    });
}

function buildChargersResponse(chargers) {
    return chargers.map(charger => {
      return {
        ...charger,
        plugs: charger.plugs.map(buildPlugResponse)
    };
    });
}

function buildPlugResponse(plug) {
  const elements = plug.serviceCost.elements
  const status = plug.subStatus
  delete plug.serviceCost
  delete plug.subStatus
    return {
        ...plug,
        elements,
        status,
    };
}

function buildMetadata(req , nResults , parameters ) { 
 
    // Generate nextPage and previousPage URLs
    const nextPage = nResults > parameters.limit ? generatePageUrl(req, parameters.page +1, parameters.limit , parameters)  : null;
    const previousPage = parameters.page > 1 ? generatePageUrl(req, parameters.page -1, parameters.limit , parameters)  : null;
    return {
        nextPage,
        previousPage
    }
}

function buildQueryString(params) {
    const queryParams = Object.entries(params)
      .filter(([key, value]) => queryValuesFilter(key , value))
      .map(([key, value]) => queryValuesMap(key , value))
      .join("&");
  
    return queryParams ? `&${queryParams}` : "";
  }
  
function queryValuesFilter(key , value) {
    return ( value !== null && value !== undefined ) && key !== "page" && key !== "limit"
}

function queryValuesMap(key , value) {
    return `${key}=${value}`
}




async function getLocations(req) {
    const userId = req.headers['userid'];
    const parameters = validateAndSanitizeParameters(req.query)

    // Get the locations networks each user can see 
    const visibleNetworks = await getVisibleNetworks(userId , "locations");

    // Get public locations according to the sent parameters
    const locations = await getPublicChargers(parameters , visibleNetworks);

    /*
        If there are more locations than the limit, we remove the last one.
        We're doing this to avoid countig all the documents to know if there is a next page
    */
    const limitLocations = locations.length > parameters.limit ? locations.slice(0, -1) : locations;

    // The locations with the right plugs format
    const data = await buildChargersResponse(limitLocations)

    // Useful info to easily paginate all the results
    const metadata = buildMetadata(req , locations.length , parameters);
    
    return {
        metadata,
        data
    };
    
}   


module.exports = {
    getLocations
};