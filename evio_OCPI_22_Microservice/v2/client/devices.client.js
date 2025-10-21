const axios = require('axios');
const { APTServiceHost } = require('../configs/constants');
const { Enums } = require('evio-library-commons').default;

/**
 * Client for interacting with the APT Service API to retrieve charger data.
 *
 * @class
 */
class DevicesServiceClient {
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
            baseURL: APTServiceHost,
        });
    }

    async getTariffs(hwId, plugId, deviceType, reject) {
        try {
            const response = await this.client.get(`/api/private/apt/tariffs-plugs/${hwId}/${plugId}?device=${deviceType}`);
            if (!response?.data) {
                throw new Error(`${deviceType} tariffs not found`);
            }
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${deviceType} tariffs:`, error.message);
            reject.setField('code', `server_${deviceType.toLowerCase()}_tariffs_not_found`)
                .setField('internalLog', JSON.stringify(error))
                .setField('message', `Error during fetching ${deviceType} tariffs for charger ${hwId}: ${error.message} and plug ${plugId}`)
                .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR);
            throw new Error();
        }
    }
}

module.exports = { DevicesServiceClient };