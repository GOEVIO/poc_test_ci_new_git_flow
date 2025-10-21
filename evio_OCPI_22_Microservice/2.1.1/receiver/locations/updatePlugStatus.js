
const ConnectorService = require('../../../services/locations/connectorService');
const Utils = require('../../../utils');
const global = require('../../../global');
const axios = require('axios');
const Config = require('../../../models/configs');

const { StatusCodes } = require('http-status-codes');

module.exports = {
    /**
     * Patch function to update plug status from Gireve.
     * This handles the logic of updating the status of the EVSE connector.
     * The method caches the status information so that in future updates, if the data is identical, there is no need to send it to the queue again.
     */
    patch: async function (req, res) {
        const context = 'updatePlugStatus.patch function';
        console.log(`[${context}] Process started`);

        const { locationId, evse_uid, country_code } = req.params;

        try {
            const { value: allowedCountries } = await Config.findOne({ config: 'allowedCountries' });

            if (!allowedCountries.includes(country_code)) {
                console.log(`[${context}] Success but not patched - Country code ${country_code} not allowed`);
                return res.status(StatusCodes.OK).send(Utils.response(null, 1000, "Success"));
            }

            // Get Token, sent previously to partner
            const token = req.headers.authorization.split(' ')[1];

            // Validate if sent data is valid JSON to process
            const data = req.body;
            data.subStatus = data.status;
            data.status = Utils.getMapping(data.status, 'plugStatus');
            if (Utils.isEmptyObject(data)) {
                console.log(`[${context}] Invalid or missing parameters`);
                return res.status(StatusCodes.OK).send(Utils.response(null, 2001, "Invalid or missing parameters"));
            }

            const ocpiVersion = req.params.version;

            const platform = await Utils.getPlatformInfo(token, ocpiVersion);
            const source = platform.source;
            data.source = source;

            try {
                // Checks cache existence
                const cachedResult = await ConnectorService.getCachedPlugStatus(locationId, evse_uid);
                const { last_updated, ...newData } = data;

                // Check if cached data is different from new data
                if (cachedResult && JSON.stringify(newData) === JSON.stringify(cachedResult[0].data)) {
                    return res.status(StatusCodes.OK).send(Utils.response(null, 1000, "No update needed, status unchanged"));
                }

                // Send data to queue to update plug status - PublicNetwork
                const response = await axios.patch(global.publicNetworkUpdatePlugStatusProxy + '/' + locationId + '/' + evse_uid, data, {});

                if (response.status === StatusCodes.OK) {
                    console.log(`[${context}] Successfully updated plug status`);
                    await ConnectorService.createCachePlugStatus(locationId, evse_uid, [{ locationId, evse_uid, data: { subStatus: data.subStatus, source: data.source, status: data.status } }]);
                    return res.status(StatusCodes.OK).send(Utils.response(null, 1000, "Success"));
                } else {
                    console.log(`[${context}] Generic client error - updatePlugStatus`);
                    return res.status(StatusCodes.OK).send(Utils.response(null, 2000, "Generic client error"));
                }
            } catch (e) {
                if (e.response && e.response.data && e.response.data.includes('not found')) {
                    console.log(`[${context}] Location or EVSE not found - ${e.response.data}`);
                    return res.status(StatusCodes.NOT_FOUND).send(Utils.response(null, 2000, "Location or EVSE not found"));
                }
                console.log(`[${context}] Generic client error - ${e.message}`);
                return res.status(StatusCodes.OK).send(Utils.response(null, 2000, "Generic client error"));
            }
        } catch (e) {
            console.log(`[${context}] Error: ${e.message}`);
            return res.status(StatusCodes.OK).send(Utils.response(null, 2000, "Generic client error"));
        }
    }
}