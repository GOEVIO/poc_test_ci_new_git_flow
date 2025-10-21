const Utils = require('../../utils.js');
const Constants = require('../../utils/constants.js');
const { updatePublicChargers, findManyPublicChargersByHwId } = require('evio-library-chargers/dist').default;
const Commons = require("evio-library-commons").default;
const { TariffsService, LocationsService } = require('evio-library-ocpi');

/**
 * Upsert a location in the public network database
 * @param {Object} element Location information
 * @param {Object} data Object containing control variables
 * @returns {Promise<Object>} - Promise that resolves to the upsert operation for bulk write.
 */
async function upsertLocationsData(element , data) {

    try {
      
        // Add source to the location info
        element.source = data.source

        //  Check if the location is allowed to be updated or created
        // Since we're currently not rejecting the authorize of Gireve, we need all the locations
        // if (!isAllowedLocation(element)) return  

        const { protocolTariffs, operatorDefaultTariffs, chargers } = data.mapping
        const chargerInfo = await LocationsService.transformLocationToCharger(element, protocolTariffs, operatorDefaultTariffs, chargers.get(element.id))

        const query = {
            source: chargerInfo.source,
            hwId: chargerInfo.hwId,
        }

        // Return the upsert operation for bulk write
        return Utils.mongoUpsertOperation(query, chargerInfo)

    } catch (error) {
        console.error("[upsertLocationsData] Error:  " , error);
    }
}


/**
 * Updates the status of chargers to REMOVED if they are not present in the locations response from the OCPI server
 * @param {Date} start Date before which the chargers should have been updated
 * @param {number} totalCount Total count of elements in the locations response
 * @param {string} mode Get mode of the locations request
 * @param {string} source Source of the chargers
 */
async function updateMissingLocationsToRemoved(start, totalCount, mode , source) {
  if (mode === Constants.ocpi.get.mode.full && totalCount > 0) {
      try {
        // Update chargers accordingly
        await updateLocationsToRemoved(start, source);
          
      } catch (error) {
          console.error("[updateMissingLocationsToRemoved] Error while updating chargers:", error.message);
      }
  }

}

/**
 * Updates the status of a list of chargers to REMOVED
 * @param {Array<string>} hwIds Array of hwId of chargers to update
 * @param {string} source Source of the chargers
 */
async function updateLocationsToRemoved(start, source) {
  const query = { source, updatedAt: { $lt: start } };
  const data = { 
    status: Constants.chargers.status.unavailable, 
    subStatus: Constants.chargers.operationalStatus.removed, 
    operationalStatus: Constants.chargers.operationalStatus.removed 
  }

  await updatePublicChargers(query, data);
}
  
function isAllowedLocation(element) {
  try {
    const { country_code } = Utils.parsePartyIdCountryCode(element?.operator?.name)
    const countryCode = Utils.countryToCountryCode(element, element.country, country_code)
    return Commons.Constants.AllowedCountries.includes(countryCode);
  } catch (error) {
    console.error("[isAllowedLocation] Error: " , error.message)
    return true
  }
}

async function mapBulkForLocationUpdate(locations, {source}) {
  const { tariffIds, countryCodes, partyIds, hwIds } =
    extractLocationInfo(locations);
  const chargers = await mapBulkChargers(hwIds, source);
  const {
    protocolTariffs,
    operatorDefaultTariffs
  } = await TariffsService.bulkMapTariffs(tariffIds, partyIds, countryCodes)
  return {
    protocolTariffs,
    operatorDefaultTariffs,
    chargers
  }
}


async function mapBulkChargers(ids, source) {
  const projection = {
    hwId: 1,
    updatedCoordinates: 1,
    "plugs.status": 1,
    "plugs.statusChangeDate": 1,
    "plugs.plugId": 1,
  }
  const chargers = await findManyPublicChargersByHwId(ids, source, projection);   
  return new Map(chargers.map((charger) => [charger.hwId, charger]))
}

function extractLocationInfo(locations) {
  // This looks a bit verbose, but it's a simple and needed way to extract all information
  const tariffIds = new Set();
  const countryCodes = new Set();
  const partyIds = new Set();
  const hwIds = new Set();
  for (const location of locations) {
    const { party_id } = location.party_id
      ? location
      : Utils.parsePartyIdCountryCode(location?.operator?.name);
    partyIds.add(party_id);
    countryCodes.add(Commons.Constants.alpha3CountryMapper[location.country].countryCode);
    hwIds.add(location.id);
    if (!location.evses) continue;
    for (const evse of location.evses) {
      if (!evse.connectors) continue;
      for (const connector of evse.connectors) {
        if (Array.isArray(connector.tariff_ids)) {
          for (const id of connector.tariff_ids) {
            tariffIds.add(id);
          }
        } else if (typeof connector.tariff_id === "string") {
          tariffIds.add(connector.tariff_id);
        }
      }
    }
  }
  return {
    tariffIds: Array.from(tariffIds),
    countryCodes: Array.from(countryCodes),
    partyIds: Array.from(partyIds),
    hwIds: Array.from(hwIds),
  };
}

module.exports = {
    upsertLocationsData,
    updateMissingLocationsToRemoved,
    mapBulkForLocationUpdate
};