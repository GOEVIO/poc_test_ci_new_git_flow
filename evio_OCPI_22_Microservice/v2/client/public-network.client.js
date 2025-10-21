const axios = require('axios');
const { publicNetworkHost } = require('../configs/constants');
const { Enums } = require('evio-library-commons').default;

/**
 * Client for interacting with the Public Network API to retrieve charger data.
 *
 * @class
 */
class PublicNetworkClient {
    /**
     * Creates an instance of PublicNetworkClient.
     * Initializes the Axios client with a predefined baseURL.
     */
    constructor() {
        /**
         * Axios instance configured for the public network.
         * @type {import('axios').AxiosInstance}
         */
        this.client = axios.create({
            baseURL: publicNetworkHost,
        });
    }

    /**
     * Fetches a charger object by its hardware ID (hwId).
     *
     * @async
     * @param {string} hwId - The hardware ID of the charger to fetch.
     * @param {Object} reject - An instance of a custom error handler (e.g. SendRejectResponse).
     * @param {Function} reject.throw - A function to throw the error with custom context.
     * @returns {Promise<Object>} - The charger object if found.
     * @throwError Will use `reject.throw` if the charger is not found or request fails.
     */
    async getChargerByHwId(hwId, reject) {
        try {
            const response = await this.client.get(`/api/private/chargers/${hwId}`);
            if (!response?.data) {
                throw new Error(`Charger with hwId ${hwId} not found`);
            }
            return response.data;
        } catch (error) {
            console.error(`Error fetching charger by hwId ${hwId}:`, error.message);
            reject.setField('code', 'server_charger_id_not_found')
                .setField('internalLog', JSON.stringify(error))
                .setField('message', `Error during fetching charger ${hwId}: ${error.message}`)
                .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR);
            throw new Error();
        }
    }
}

module.exports = { PublicNetworkClient };