const axios = require('axios');
const parseLink = require('parse-link-header');
const Constants = require('../utils/constants');
const { upsertLocationsData, updateMissingLocationsToRemoved, mapBulkForLocationUpdate } = require('./locations/locationsService');
const { upsertTariffsData } = require('./tariffs/tariffsService');
const { TariffsRepository } = require('evio-library-ocpi');
const { bulkWriteChargers } = require('evio-library-chargers/dist').default;

/**
 * @description
 * This function will make multiple paginated GET requests to OCPI HUB, based on the X-Total-Count header.
 * It will upsert the data received from OCPI HUB to the database.
 * It will update the offset and host values in the data object.
 * If an error occurs, it will log the error and set the totalCount to -1, which will stop the while loop.
 *
 * @param {Object} data - Object with the following properties:
 * - host: The updated URL of the OCPI HUB to call.
 * - date_from: The date from which to get the data.
 * - date_to: The date to which to get the data.
 * - originalHost: The original URL of the OCPI HUB to call.
 * - token: The token to use for authentication.
 * - source: HUB code.
 * - countryCode: The country code to use for the request.
 * - partyId: The party id to use for the request.
 * - offset: The offset to use for the request.
 * - totalCount: The total count of elements in the repository.
 * - mode: The mode of the request. full or delta.
 * - elementsCount: The number of elements of each request.
 * - elements: The elements data info from the request.
 * - bulkUpdate: Function to bulk update chargers
 * - parseModuleData: Function to parse module data
 * - bulkMapping: Function to bulk map data (it can be locations, tariffs, cdrs, etc.)
 */
async function paginateOCPIData(data) {
    const context = 'Function paginateOCPIData';
    try {
        // Destructure parameter
        const { host, date_from, date_to, originalHost, token, countryCode, partyId, bulkUpdate, parseModuleData, bulkMapping} = data


        // Get data from OCPI
        const result = await axios.get(host, { headers: { 'Authorization': `Token ${token}` , 'ocpi-to-country-code' : countryCode , 'ocpi-to-party-id' : partyId } })

        bulkMapping && (data.mapping = await bulkMapping(result?.data?.data, data));
        // Upsert data from OCPI
        const updatePromises = result?.data?.data.map((element) => parseModuleData(element , data));
        const promisesResult = (await Promise.all(updatePromises)).filter(Boolean);
        promisesResult.length && await bulkUpdate(promisesResult);
        
        // Update values for next iteration
        const { "x-total-count": x_total_count, "x-limit": x_limit, "link": link } = result.headers;
        const parsedLink = parseLink(link);
        data.elementsCount += updatePromises.length;
        data.totalCount = x_total_count || 0;
        data.offset = Number(parsedLink?.next?.offset) || data.elementsCount;
        data.host = parsedLink?.next?.url || `${originalHost}?offset=${data.offset}&limit=${Number(x_limit)}${date_from ? `&date_from=${date_from}` : ''}${date_to ? `&date_to=${date_to}` : ''}`;

        console.log({ offset: data.offset, totalCount: data.totalCount, elementsCount: data.elementsCount, host: data.host});

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        // This stops the while loop
        data.totalCount = -1;
    }             
}


/**
 * Make multiple paginated GET requests to OCPI HUB and upsert the
 * obtained data.
 * @param {Object} data - An object containing the control variables.
 */
async function callService(data)  {
    // Make multiple paginated GET requests to OCPI HUB
    while (data.offset < data.totalCount) {
        // Get OCPI Data and upsert it
        await paginateOCPIData(data);
    }

}


/**
 * Builds a data object for making paginated OCPI service calls.
 *
 * @param {string} url - The original URL of the OCPI HUB.
 * @param {string} token - The authentication token for OCPI requests.
 * @param {string} source - The source HUB code.
 * @param {string} date_from - The start date for fetching data (optional).
 * @param {string} date_to - The end date for fetching data (optional).
 * @param {string} countryCode - The country code for the request (optional).
 * @param {string} partyId - The party ID for the request(optional).
 * @param {function} bulkUpdate - Function to bulk update chargers
 * @param {function} parseModuleData - Function to parse module data
 * @param {function} bulkMapping - Function to bulk map data
 * @returns {Object} - An object containing control variables for the OCPI service call,
 *                     including host, offset, totalCount, mode, and other metadata.
 */
function buildCallServiceData(url , token , source , date_from , date_to , countryCode , partyId, bulkUpdate, parseModuleData, bulkMapping) {
    return {
        originalHost: url,
        token: token,
        source: source,
        offset: Constants.ocpi.get.request.offset,
        totalCount: Constants.ocpi.get.request.totalCount,
        date_from: date_from,
        date_to: date_to,
        countryCode: countryCode,
        partyId: partyId,
        host: `${url}?offset=${Constants.ocpi.get.request.offset}&limit=${Constants.ocpi.get.request.limit}${date_from ? `&date_from=${date_from}` : ''}${date_to ? `&date_to=${date_to}` : ''}`,
        mode: ( date_from || date_to ) ? Constants.ocpi.get.mode.delta : Constants.ocpi.get.mode.full,
        elementsCount: 0,
        elements : [],
        bulkUpdate,
        parseModuleData,
        bulkMapping
    }
}


/**
 * Retrieves and processes OCPI location data from the specified OCPI HUB URL.
 *
 * This function builds the necessary data object for making OCPI service calls, fetches
 * location data from the OCPI HUB, and updates the locations in the local repository with the
 * fetched data. It also updates any locations that are missing in the HUB repository to a removed state.
 *
 * @param {string} url - The original URL of the OCPI HUB.
 * @param {string} token - The authentication token for OCPI requests.
 * @param {string} source - The source HUB code.
 * @param {string} date_from - The start date for fetching data (optional).
 * @param {string} date_to - The end date for fetching data (optional).
 * @param {string} countryCode - The country code for the request (optional).
 * @param {string} partyId - The party ID for the request (optional).
 * @returns {Promise<number>} - A promise that resolves to the total count of elements processed.
 */
async function updateLocationsFromHub(url , token , source , date_from , date_to , countryCode , partyId) {
    try {
      // Start date of process
      const start = new Date()   

      // Build input data to call service
      const data = buildCallServiceData(
        url, 
        token, 
        source, 
        date_from, 
        date_to, 
        countryCode, 
        partyId, 
        bulkWriteChargers, 
        upsertLocationsData,
        mapBulkForLocationUpdate,
    )
  
      // Fetch OCPI Locations data
      await callService(data)
  
      // Update locations that don't exist in HUB repository to removed
      await updateMissingLocationsToRemoved(start , data.totalCount, data.mode , data.source) 

      return data.elementsCount

    } catch (error) {
      console.log("[updateLocationsFromHub] Error: " , error.message);
      return 0
    } 
  
}

/**
 * Retrieves and processes OCPI Tariffs data from the specified OCPI HUB URL.
 *
 * This function builds the necessary data object for making OCPI service calls, fetches
 * Tariffs data from the OCPI HUB, and updates the Tariffs in the local repository with the
 * fetched data.
 *
 * @param {string} url - The original URL of the OCPI HUB.
 * @param {string} token - The authentication token for OCPI requests.
 * @param {string} source - The source HUB code.
 * @param {string} date_from - The start date for fetching data (optional).
 * @param {string} date_to - The end date for fetching data (optional).
 * @param {string} countryCode - The country code for the request (optional).
 * @param {string} partyId - The party ID for the request (optional).
 * @returns {Promise<number>} - A promise that resolves to the total count of elements processed.
 */
async function updateTariffsFromHub(url, token, source, date_from, date_to, countryCode, partyId) {
    try {
        // Build input data to call service
        const data = buildCallServiceData(
            url,
            token,
            source,
            date_from,
            date_to,
            countryCode,
            partyId,
            TariffsRepository.bulkWriteTariffs,
            upsertTariffsData,
        )
        // Fetch OCPI Tariffs data
        await callService(data)

        return data.elementsCount

    } catch (error) {
        console.log("[updateTariffsFromHub] Error: ", error.message);
        return 0
    }

}

module.exports = {
    updateLocationsFromHub,
    updateTariffsFromHub,
};