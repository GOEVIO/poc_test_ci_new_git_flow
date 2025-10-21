const Session = require('../../models/sessions')
const CDRS = require('../../models/cdrs')
const calcSumSubUsageEnergy = require('../../functions/calcSumSubUsageEnergy')
const calcNumberOfDaysSessionDuration = require('../../functions/calcNumberOfDaysSessionDuration')
const Identity = require('evio-library-identity').default;

/**
 * Formats a CDR (Charge Detail Record) session by calculating and returning relevant session details.
 *
 * @param {Object} cdr - The CDR object containing details about the charging session.
 * @param {number} [cdr.total_energy=0] - The total energy consumed during the session (in kWh).
 * @param {Object} [cdr.mobie_cdr_extension] - An optional extension object containing additional CDR details.
 * @param {Array} [cdr.mobie_cdr_extension.subUsages] - An array of sub-usage objects for the session.
 * @param {Object} session - The session object containing start and end date-time information.
 * @param {string} [session.start_date_time] - The start date-time of the session (ISO 8601 format).
 * @param {string} [session.end_date_time] - The end date-time of the session (ISO 8601 format).
 * 
 * @returns {Object} An object containing formatted session details:
 * @returns {number} totalEnergy - The total energy consumed during the session (in kWh).
 * @returns {number} totalSubUsagesEnergy - The total energy consumed by sub-usages (in kWh).
 * @returns {number} diffKWh - The absolute difference between total energy and sub-usage energy (in kWh).
 * @returns {number} duration - The duration of the session in days.
 * @returns {string} startDate - The start date-time of the session (ISO 8601 format).
 * @returns {string} stopDate - The end date-time of the session (ISO 8601 format).
 */
const formatCDRSession = (cdr, session) => {
    const totalEnergy = cdr?.total_energy || 0;
    const totalSubUsagesEnergy = cdr?.mobie_cdr_extension?.subUsages ? calcSumSubUsageEnergy(cdr?.mobie_cdr_extension?.subUsages) : 0;
    const diffKWh = Math.abs(totalSubUsagesEnergy - totalEnergy);
    const startDate = session?.start_date_time;
    const stopDate = session?.end_date_time;
    const duration = calcNumberOfDaysSessionDuration(startDate, stopDate) || 0;
    return {totalEnergy, totalSubUsagesEnergy, diffKWh, duration, startDate, stopDate};
}

/**
 * Formats session data by mapping over a sessions map and combining it with data from a CDR map.
 *
 * @param {Map<string, Object>} sessionsMap - A map containing session objects, keyed by their IDs.
 * @param {Map<string, Object>} cdrMap - A map containing CDR (Charge Detail Record) objects, keyed by their IDs.
 * @returns {Array<Object>} An array of formatted session objects, each containing details such as energy usage, duration, and metadata.
 */
const formatSessions = (sessionsMap, cdrMap) => {
    return Array.from(sessionsMap.values()).map(session => {
        const {totalEnergy, totalSubUsagesEnergy, diffKWh, duration, startDate, stopDate} = formatCDRSession(cdrMap.get(session.cdrId), session);
        return {
            _id: session._id,
            status: session.status,
            cdrId: session.cdrId,
            sessionId: session.id,
            location: session.location_id,
            city: session?.address?.city,
            operator: session.party_id,
            startDate,
            stopDate,
            duration,
            totalEnergy,
            totalSubUsagesEnergy,
            diffKWh,
            createdAt: session.createdAt,
            reason: session.suspensionReason,
            finalPrices: session.finalPrices
        }
    });
};

/**
 * Asynchronously retrieves CDR (Charge Detail Record) data from the database based on the provided query and projection.
 * Returns an object containing a Map of CDRs, where the keys are the CDR IDs and the values are the corresponding CDR objects.
 *
 * @async
 * @function findCDRs
 * @param {Object} options - The options for the query.
 * @param {Object} [options.query={}] - The query object to filter the CDRs.
 * @param {Object} [options.projection={}] - The projection object to specify the fields to include or exclude.
 * @returns {Promise<Object>} An object containing a `cdrMap` property, which is a Map of CDRs keyed by their IDs.
 */
const findCDRs = async ({query = {}, projection = {}}) => {
    const cdrResult = {
        cdrMap: new Map()
    }

    const cdr = await CDRS.find(query, projection).lean();

    if(cdr.length) {
        cdrResult.cdrMap = new Map(cdr.map(cdr => [cdr.id, cdr]));
    }

    return cdrResult; 
};

/**
 * Finds sessions based on the provided query, projection, and options.
 *
 * @async
 * @function findSessions
 * @param {Object} params - The parameters for the query.
 * @param {Object} [params.query={}] - The query object to filter sessions.
 * @param {Object} [params.projection={}] - The projection object to specify returned fields.
 * @param {Object} [params.options={}] - Additional options for the query (e.g., pagination, sorting).
 * @returns {Promise<Object>} An object containing:
 *   - `sessionsMap` {Map<string, Object>} A map of sessions keyed by `cdrId`.
 *   - `sessionsCountTotal` {number} The total count of sessions matching the query.
 */
const findSessions = async ({query = {}, projection = {}, options = {}}) => {
    const sessionResult = {
        sessionsMap: new Map(),
        sessionsCountTotal: 0
    }

    const [sessions, sessionsCountTotal] = await Promise.all([
        Session.find(query, projection, options).lean(),
        Session.countDocuments(query)
    ]);

    if(sessions?.length) {
        sessionResult.sessionsMap = new Map(sessions.map(session => [session.cdrId, session]));
    }

    return {...sessionResult, sessionsCountTotal}; 
};

/**
 * Builds a query and projection object for retrieving Charge Detail Records (CDRs) 
 * based on the provided session map.
 *
 * @param {Map<string, Object>} sessionMap - A map where the keys represent CDR IDs.
 * @returns {{query: Object, projection: Object}} An object containing:
 *   - `query`: The MongoDB query object to filter CDRs by their IDs.
 *   - `projection`: The MongoDB projection object specifying the fields to include in the result.
 */
const buildQueryForCDRs = (sessionMap) => {
    const cdrIds = Array.from(sessionMap.keys());
    const query = {
        id: { $in: cdrIds }
    }
    const projection = {
        id: 1,
        "mobie_cdr_extension.subUsages.energia_ponta": 1,
        "mobie_cdr_extension.subUsages.energia_cheias": 1,
        "mobie_cdr_extension.subUsages.energia_vazio": 1,
        "mobie_cdr_extension.subUsages.energia_fora_vazio": 1,
        "mobie_cdr_extension.subUsages.energia_vazio_normal": 1,
        "mobie_cdr_extension.subUsages.energia_super_vazio": 1, 
        total_energy: 1,
    }

    return {query, projection};
}

/**
 * Retrieves a list of users based on the provided email and/or mobile number.
 *
 * @param {string} [email] - The email address to search for. Optional.
 * @param {string} [mobile] - The mobile number to search for. Optional.
 * @returns {Promise<Array>} A promise that resolves to an array of users matching the query. 
 *  Returns an empty array if no email or mobile is provided or no users are found.
 */
const getUsers = async (email, mobile) => {
    const queryToFindUser = {$or: []};
    if(email) queryToFindUser.$or.push({email});    
    if(mobile) queryToFindUser.$or.push({mobile});

    const users = await Identity.findUsersByQuery(queryToFindUser, {_id: 1}) || [];

    return users
}

/**
 * Builds a query object, options, and projection for fetching session data based on the provided request data.
 *
 * @async
 * @function buildQueryForSessions
 * @param {Object} requestData - The data used to build the query.
 * @param {string} requestData.status - The status of the sessions to filter.
 * @param {number|string} requestData.pageNumber - The current page number for pagination.
 * @param {number|string} requestData.limiteQuery - The number of records to fetch per page.
 * @param {string} [requestData.email] - The email of the user to filter sessions by.
 * @param {string} [requestData.mobile] - The mobile number of the user to filter sessions by.
 * @param {string} [requestData.startDate] - The start date for filtering sessions (ISO 8601 format).
 * @param {string} [requestData.stopDate] - The stop date for filtering sessions (ISO 8601 format).
 * @param {string} [requestData.invalidateReason] - The reason for invalidating sessions to filter by.
 * @returns {Promise<Object>} An object containing:
 *   - `query` {Object}: The MongoDB query object.
 *   - `options` {Object}: The pagination options (skip and limit).
 *   - `projection` {Object}: The fields to include in the query result.
 */
const buildQueryForSessions = async (requestData) => {
    const options = {
        skip: (Number(requestData.pageNumber) - 1) * Number(requestData.limiteQuery),
        limit: Number(requestData.limiteQuery)
    };

    const query = {
        status: {$in: requestData.status},
        $and:[
            { cdrId: { $exists: true } },
            { cdrId: { $ne: '-1' } }
        ]
        
    };

    if(requestData?.startDate) query.$and.push({ start_date_time: { $gte: requestData.startDate } })

    if(requestData?.stopDate) query.$and.push({ start_date_time: { $lte: requestData.stopDate } });

    if(requestData?.invalidateReason?.length) {
        query.suspensionReason = {$in: requestData.invalidateReason};
    }

    const projection = {
        _id: 1,
        status: 1,
        cdrId:1, 
        id: 1, 
        location_id: 1, 
        "address.city": 1, 
        party_id: 1, 
        start_date_time:1, 
        end_date_time: 1, 
        createdAt: 1, 
        suspensionReason: 1, 
        "finalPrices.cemePrice.excl_vat": 1,
        "finalPrices.cemePrice.incl__vat": 1,
        "finalPrices.opcPrice.excl_vat": 1, 
        "finalPrices.opcPrice.incl_vat": 1, 
        "finalPrices.totalPrice.excl_vat": 1, 
        "finalPrices.totalPrice.incl_vat": 1, 
        "finalPrices.iecPrice.excl_vat": 1, 
        "finalPrices.iecPrice.incl_vat": 1, 
        "finalPrices.vatPrice.vat": 1,
        "finalPrices.vatPrice.value": 1
    }

    return {query, options, projection};
}

/**
 * Service to retrieve sessions by status.
 *
 * @async
 * @function getSessionByStatusService
 * @param {Object} requestData - The request data containing filters and parameters for querying sessions.
 * @returns {Promise<Object>} An object containing the sessions and the total count.
 * @property {Array} sessions - The list of formatted sessions.
 * @property {number} count - The total count of sessions matching the query.
 */
const getSessionByStatusService = async (requestData) => {
    const sessionsQuery = await buildQueryForSessions(requestData);

    if(requestData?.email || requestData?.mobile){
        const users = await getUsers(requestData?.email, requestData?.mobile);
        if (!users?.length) return { sessions: [], count: 0 };
        sessionsQuery.query.userId = { $in: users };
    }

    const { sessionsMap, sessionsCountTotal } = await findSessions(sessionsQuery);
    if(!sessionsMap.size) return { sessions: [], count: sessionsCountTotal || 0};

    const cdrQuery = buildQueryForCDRs(sessionsMap);
    const { cdrMap } = await findCDRs(cdrQuery);

    const sessions = formatSessions(sessionsMap, cdrMap);

    return { sessions, count: sessionsCountTotal };
};

module.exports = {
    getSessionByStatusService,
};