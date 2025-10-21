const ConnectorService = require('../../../services/locations/connectorService');
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');

const { StatusCodes } = require('http-status-codes');

module.exports = {
    /**
     * Patch function to update plug status from MobiE.
     * This handles the logic of updating the status of the EVSE connector.
     * The method caches the status information so that in future updates, if the data is identical, there is no need to send it to the queue again.
     */
    patch: async function (req, res) {
        const context = 'updatePlugStatus.patch function';
        console.log(`[${context}] Process started`);

        try {
            const token = req.headers.authorization.split(' ')[1];
            const locationId = req.params.locationId;
            const evse_uid = req.params.evse_uid;
            const ocpiVersion = req.params.version;

            // Validate request body
            const data = req.body;
            if (Utils.isEmptyObject(data)) {
                return res.status(StatusCodes.OK).send(Utils.response(null, 2001, "Invalid or missing parameters"));
            }

            data.subStatus = data.status;
            data.status = Utils.getMapping(data.status, 'plugStatus');

            const platform = await Utils.getPlatformInfo(token, ocpiVersion);
            data.source = platform.source;

            // Checks cache existence
            const cachedResult = await ConnectorService.getCachedPlugStatus(locationId, evse_uid);
            const { last_updated, ...newData } = data; 

            // Check if cached data is different from new data
            if (cachedResult && JSON.stringify(newData) === JSON.stringify(cachedResult[0].data)) {
                return res.status(StatusCodes.OK).send(Utils.response(null, 1000, "No update needed, status unchanged"));
            }

            // Send data to queue to update plug status - PublicNetwork
            const response = await axios.patch(`${global.publicNetworkUpdatePlugStatusProxy}/${locationId}/${evse_uid}`, data);

            if (response.status === StatusCodes.OK) {
                await ConnectorService.createCachePlugStatus(locationId, evse_uid, [{ locationId, evse_uid, data: { subStatus: data.subStatus, source: data.source, status: data.status } }]);
                return res.status(StatusCodes.OK).send(Utils.response(null, 1000, "Success"));
            } else {
                console.log(`[${context}] Generic client error - no response data`);
                return res.status(StatusCodes.OK).send(Utils.response(null, 2000, "Generic client error"));
            }
        } catch (e) {
            if (e.response && e.response.data) {
                console.log(`[${context}] Error in external service: `, e.response.data);
            } else {
                console.log(`[${context}] Error: `, e.message);
            }
            return res.status(StatusCodes.OK).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
};