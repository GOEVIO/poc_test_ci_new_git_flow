const EV = require('../models/ev');
const Fleet = require('../models/fleets');
const ExternalRequest = require('./externalRequestHandler');
const constants = require('../utils/constants');

module.exports = {
  userFleetsInfo: (userId) => {
    let context = 'Funciton userFleetsInfo';
    return new Promise(async (resolve, reject) => {
      try {
        let fleets = await getCreateUserFleets(userId);     

        let evs = await getFleetsEvs(fleets);

        let newListOfEvs = await ExternalRequest.getUserFleetsInfo(evs, userId);

        let listOfFleets = joinEvInfoToFleets(fleets, newListOfEvs);

        resolve(listOfFleets);
      } catch (error) {
        console.error(`[${context}] Error `, error.message);
        reject(error);
      }
    });
  },
  /**
   * This function returns the user's fleets info, paginated and filtered by provided params.
   * It also includes the total count of records and the metadata of the fleets.
   * @param {string} userId - The user id.
   * @param {Object} params - The parameters to filter and paginate the records.
   * @param {number} [params.page=1] - The page number.
   * @param {number} [params.limit=10] - The limit of records per page.
   * @param {string} [params.sortBy] - The field to sort the records.
   * @param {string} [params.sortOrder=desc] - The order of the sort (asc or desc).
   * @param {string} [params.inputText] - The text to search in the records.
   * @param {string[]} [params.fleetIds] - The list of fleet ids to filter the records.
   * @param {string} [params.brand] - The brand to filter the records.
   * @param {string} [params.licensePlate] - The license plate to filter the records.
   * @returns {Promise<Object>} - A promise that resolves with an object containing the records and the metadata.
   */
  userFleetsInfoV2: async (userId, params) => {
    const context = 'Function userFleetsInfoV2';
    try {
      const { page, limit, skip } = parsePagination(params);
      let options = {};
      const { fleetIds, sortBy, sortOrder, inputText, brand } = params;

      if (limit > 100) {
        throw new Error('limit must be between 1 and 100');
      }

      if (sortBy) {
        options.sort = { [sortBy]: sortOrder || 'desc' };
      }

      const additionalQuery = [];
      const fleetsMetadataP = getCreateUserFleets(userId);
      const fleetsP = fleetIds ? getFleetsIdsList(fleetIds) : fleetsMetadataP;

      const [fleetsMetadata, fleets] = await Promise.all([fleetsMetadataP, fleetsP]);
      let [evs, totalCount] = await Promise.all([
        getFleetsEvs(fleets, null, options, additionalQuery),
        countEVs(fleets, additionalQuery)
      ]);

      const newListOfEvs = await ExternalRequest.getUserFleetsInfo(evs, userId);
      let evsWithFleets = joinFleetInfoToEVs(fleets, newListOfEvs);

      const finalSortOrderRecords = await sortFinalOrderRecords({ records: evsWithFleets, sortBy, sortOrder, skip, limit, inputText, brand });      
      totalCount = finalSortOrderRecords.totalCount;
      
      const baseUrl = `/fleets?userId=${userId}`;
      let _metadata = buildMetadata({ page, limit, totalCount, baseUrl });
      _metadata.fleets = metadataFleets(fleetsMetadata || fleets) || [];
      _metadata.filters = await module.exports.totalFilters({ records: evsWithFleets }, fleetsMetadata || fleets);

      return { _metadata, records: finalSortOrderRecords.records };
    } catch (error) {
      console.error(`[${context}] Error`, error.message);
      throw error;
    }
  },
  fleetInfoById: (fleetId) => {
    let context = 'Funciton fleetInfoById';
    return new Promise(async (resolve, reject) => {
      try {
        let fleets = await getFleetById(fleetId);

        let evs = await getFleetsEvs(fleets);

        let newListOfEvs = await ExternalRequest.getUserFleetsInfo(evs);

        let listOfFleets = joinEvInfoToFleets(fleets, newListOfEvs);

        resolve(listOfFleets?.length ? listOfFleets[0] : []);
      } catch (error) {
        console.error(`[${context}] Error `, error.message);
        reject(error);
      }
    });
  },
  fleetsInfoListIds: (listOfFleetsIds) => {
    let context = 'Funciton fleetsInfoListIds';
    return new Promise(async (resolve, reject) => {
      try {
        let fleets = await getFleetsIdsList(listOfFleetsIds);

        let evs = await getFleetsEvs(fleets, {
          _id: 1,
          userId: 1,
          listOfGroupDrivers: 1,
          listOfDrivers: 1,
          fleet: 1,
        });

        let newListOfEvs = await ExternalRequest.getEvsDriversInfo(evs);

        let listOfFleets = joinEvInfoToFleets(fleets, newListOfEvs);

        resolve(listOfFleets);
      } catch (error) {
        console.error(`[${context}] Error `, error.message);
        reject(error);
      }
    });
  },
  /**
   * Returns an array of two objects, each containing a filter.
   * The first filter is for the fleets, the second for the assets.
   * Each filter contains a title and an array of values, each value being an object with a value and a total.
   * @param {Object} data - The object containing the records.
   * @param {Object[]} fleets - The array of fleets.
   * @returns {Promise<Object[]>} - A promise that resolves with an array of two filter objects.
   */
  totalFilters: async (data, fleets) => {
    let context = 'Function totalFilters';
    try {
      const records = (data && Array.isArray(data.records)) ? data.records : [];
      const fleetsArr = Array.isArray(fleets) ? fleets : [];

      // --- Fleets: group by fleet.name (skip items without a fleet name) ---
      const fleetCounts = new Map();
      for (const r of records) {
        const name = r?.fleet?.name;
        if (!name) continue;
        fleetCounts.set(name, (fleetCounts.get(name) ?? 0) + 1);
      }

      const fleetFilter = {
        title: 'fleets',
        values: fleetsArr.map((fleet) => ({ value: fleet.name, total: fleet.listEvs.length , id: fleet._id })),
      };

      // --- Assets: group by brand, but non TYPECARD/TYPEUSER => EV ---
      const brandCounts = new Map();
      for (const r of records) {
        let brand = r?.brand ?? 'Unknown';
        if (!constants.listTypesAssets.includes(brand)) {
          brand = 'EV';
        }
        brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
      }
      const assetFilter = {
        title: 'assets',
        values: Array.from(brandCounts, ([value, total]) => ({ value, total }))
      };

      return [fleetFilter, assetFilter];
    } catch (error) {
      console.error(`[${context}][count] Error `, error.message);
      throw new Error(error);
    }
  }
};

/**
 * Takes an array of fleet objects and returns an array of objects with only the `_id` and `name` properties.
 * Duplicates are removed based on the `_id` property, keeping only the first occurrence.
 * @param {Object[]} fleets - Array of fleet objects
 * @returns {Object[]} - Array of objects with `_id` and `name` properties
 */
function metadataFleets(fleets) {
    return fleets.map((fleet) => {
        return {
          _id: fleet ? fleet._id : null,
          name: fleet ? fleet.name : null,
        }
      })
      .filter((item) => item._id !== null) // Optional: Keep only items with fleet._id
      .reduce((acc, current) => {
        // Check if the _id is already in the accumulator
        const exists = acc.some((item) => String(item._id) === String(current._id));
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);    
}


/**
 * Sorts an array of records according to the sortBy and sortOrder parameters.
 * If inputText is provided, filters the records to only those that contain the inputText.
 * If brand is provided, filters the records to only those that match the brand.
 * @param {Object} data - The object containing the records, sortBy, sortOrder, skip, limit, inputText and brand.
 * @returns {Promise<Object>} - A promise that resolves with an object containing the totalCount and records.
 */
async function sortFinalOrderRecords(data) {
  let context = 'Function sortFinalOrderRecords';
  try {
    const { records, sortBy, sortOrder, skip, limit, inputText, brand } = data;

    const order = sortOrder === 'asc' ? 1 : -1;
    let sortedRecords = records.sort((a, b) => {
      switch (sortBy) {
        case 'totalDrivers':
          return (a.totalDrivers - b.totalDrivers) * order;
        case 'maxFastChargingPower':
          return ((Number(a.evInfo?.maxFastChargingPower) || 0) - (Number(b.evInfo?.maxFastChargingPower) || 0)) * order;
        case 'internalChargerPower':
          return ((Number(a.evInfo?.internalChargerPower) || 0) - (Number(b.evInfo?.internalChargerPower) || 0)) * order;
        case 'maxBatteryCapacity':
          return ((Number(a.evInfo?.maxBatteryCapacity) || 0) - (Number(b.evInfo?.maxBatteryCapacity) || 0)) * order;
        case 'range':
          return ((Number(a.evInfo?.range) || 0 ) - (Number(b.evInfo?.range) || 0)) * order;
        case 'listOfKMs':
          return (a.odometer - b.odometer) * order;
        case 'RFIDCard':
          const aP = a.contract?.cardPhysicalState ? 1 : 0;
          const bP = b.contract?.cardPhysicalState ? 1 : 0;
          return (aP - bP) * order;
        default:
          return 0
      }
    });

    console.log(`[${context}] Sorted ${sortedRecords.length} records `);
    sortedRecords = (typeof inputText === 'string' && inputText.trim() !== '') ? sortedRecords.filter(r => containsValue(r, inputText)) : sortedRecords;

    if (brand) {
      const brandArray = brand.split(',').map(b => b.trim());
      let finalsortedRecordsBrand = [];
      for (const b of brandArray) {
        finalsortedRecordsBrand.push(sortedRecords.filter(r => {
          if (b === 'EV' && !constants.listTypesAssets.includes(r.brand)) {
            return r;
          }else if (r.brand === b) {
            return r;
          }
        }));
      }
      // Flatten the array of arrays into a single array
      sortedRecords = finalsortedRecordsBrand.flat();
    }

    console.log(`[${context}] After filtering, ${sortedRecords.length} records remain `);
    return { totalCount: sortedRecords.length, records: sortedRecords.slice(skip, skip + limit) };
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    return { totalCount: 0, records: sortedRecords };
  }
}

async function getCreateUserFleets(userId) {
  let context = 'Function getCreateUserFleets';
  try {
    let query = {
      createUserId: userId,
    };
    return await queryFleets(query);
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}

async function getFleetsIdsList(listOfFleetsIds) {
  let context = 'Function getFleetsIdsList';
  try {

    let query = {
      _id: { $in: listOfFleetsIds.length ? listOfFleetsIds.split(',') : listOfFleetsIds },
    };
    return await queryFleets(query);
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}

async function getFleetById(fleetId) {
  let context = 'Function getFleetById';
  try {
    let query = {
      _id: fleetId,
    };
    return await queryFleets(query);
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}
async function queryFleets(query) {
  let context = 'Function queryFleets';
  try {
    return await Fleet.find(query).lean();
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}

async function getFleetsEvs(
  fleets,
  fields = null,
  options = {},
  additionalQuery = {},
) {
  let context = 'Function getFleetsEvs';
  try {
    let evIdList = fleets
      .map((fleet) => fleet.listEvs.map((ev) => ev.evId))
      .flat(1);

    let query = {
      _id: { $in: evIdList },
      ...additionalQuery,
    };

    return await queryEvs(query, fields, options);
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}

async function queryEvs(query, fields, options = {}) {
  let context = 'Function queryEvs';
  try {
    return await EV.find(query, fields, options).lean();
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}

function joinEvInfoToFleets(fleets, evs) {
  let context = 'Function joinEvInfoToFleets';
  try {
    let listOfFleets = [];
    for (let fleet of fleets) {
      const newFleet = {
        _id: fleet._id,
        name: fleet.name,
        sharedWithOPC: fleet.sharedWithOPC,
        shareEVData: fleet.shareEVData,
        imageContent: fleet.imageContent,
        createUserId: fleet.createUserId,
        acceptKMs: fleet.acceptKMs ? fleet.acceptKMs : false,
        updateKMs: fleet.updateKMs ? fleet.updateKMs : false,
        listEvs: fleet.listEvs.map((elem) => evToEvList(evs, elem)).filter(ev => ev !== null && ev !== undefined)
      };

      listOfFleets.push(newFleet);
    }
    return listOfFleets;
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}

function evToEvList(evs, elem) {
  let context = 'Function evToEvList';
  try {
    let foundEv = evs.find((ev) => ev._id === elem.evId);
    if (foundEv) {
      foundEv._id = elem._id;
      foundEv.listOfKMs ??= [];

      return foundEv;
    } 
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    return elem;
  }
}

async function countEVs(fleets, additionalQuery = {}) {
  let context = 'Function countEVs';
  try {
    let evIdList = fleets
      .map((fleet) => fleet.listEvs.map((ev) => ev.evId))
      .flat(1);
    let query = {
      _id: { $in: evIdList },
      ...additionalQuery,
    };
    return await EV.countDocuments(query);
  } catch (error) {
    console.error(`[${context}][count] Error `, error.message);
    throw new Error(error);
  }
}

function buildMetadata({ page, limit, totalCount, baseUrl }) {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    page,
    limit,
    page_count: totalPages,
    total_count: totalCount,
    links: {
      self: `${baseUrl}&page=${page}&limit=${limit}`,
      first: `${baseUrl}&page=0&limit=${limit}`,
      last: `${baseUrl}&page=${totalPages - 1}&limit=${limit}`,
      next:
        page < totalPages - 1
          ? `${baseUrl}&page=${page + 1}&limit=${limit}`
          : null,
      previous: page > 0 ? `${baseUrl}&page=${page - 1}&limit=${limit}` : null,
    },
  };
}

function buildAdditionalQuery(params, allowedFields = []) {
  const query = Object.fromEntries(
    allowedFields
      .filter((field) => params[field] != null)
      .map((field) => {
        if (field === 'brand' && params[field] === 'EV') {
          return [field, { $nin: ['TYPECARD', 'TYPEUSER'] }];
        }
        return [field, new RegExp(params[field], 'i')];
      })
  );
  return query;
}

function parsePagination(params) {
  const page = parseInt(params.page ?? 0, 10);
  const limit = parseInt(params.limit ?? 20, 10);
  return {
    page: isNaN(page) || page < 0 ? 0 : page,
    limit: isNaN(limit) ? 20 : limit,
    skip: (isNaN(page) || page < 0 ? 0 : page) * (isNaN(limit) ? 20 : limit),
  };
}

function joinFleetInfoToEVs(fleets, evs) {
  let context = 'Function joinFleetInfoToEVs';

  try {
    evs.map((ev) => {
      const newFleet = fleets.find((fleet) => String(fleet._id) === String(ev?.contract?.fleetId)) || null;

      if (newFleet) {
        ev.fleet = {
          _id: newFleet._id,
          name: newFleet.name,
          sharedWithOPC: newFleet.sharedWithOPC,
          shareEVData: newFleet.shareEVData,
          imageContent: newFleet.imageContent,
          createUserId: newFleet.createUserId,
          acceptKMs: newFleet.acceptKMs ? newFleet.acceptKMs : false,
          updateKMs: newFleet.updateKMs ? newFleet.updateKMs : false,
        };
      }

      ev.listOfKMs ??= [];
      ev.odometer = ev.listOfKMs[ev.listOfKMs.length - 1]?.kms || 0;
      const driverIds = [
        ...(ev.listOfDrivers?.map((d) => d._id) || []),
        ...(ev.listOfGroupDrivers?.flatMap(
          (group) => group.listOfDrivers?.map((d) => d._id) || [],
        ) || []),
      ];

      ev.totalDrivers = new Set(driverIds).size;
      ev.odometer = ev.listOfKMs.reduce((a, b) => Math.max(a, b.kms), 0);
      
      return ev;
    });

    return evs;
  } catch (error) {
    console.error(`[${context}][find] Error `, error.message);
    throw new Error(error);
  }
}


  /**
   * @function containsValue
   * @description Performs a deep search in node for a given value, ignoring case and diacritics.
   * @param {any} node The object to search in.
   * @param {any} needle The value to search for.
   * @returns {boolean} true if the value is found, false otherwise.
   * @example
   * const obj = { a: 1, b: 'hello', c: [{ d: ' world' }] };
   * containsValue(obj, 'hello'); // true
   * containsValue(obj, 'world'); // true
   * containsValue(obj, 'HELLO'); // true
   * containsValue(obj, 'WORLD'); // true
   * containsValue(obj, 'foo'); // false
   */

function containsValue(node, needle) {
  const norm = s => s?.normalize?.('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '';
  const n = norm(String(needle));
  const visit = v =>
    v == null ? false
    : (typeof v !== 'object' || v instanceof Date) ? norm(String(v)).includes(n)
    : Array.isArray(v) ? v.some(visit)
    : Object.values(v).some(visit);
  return visit(node);
}
