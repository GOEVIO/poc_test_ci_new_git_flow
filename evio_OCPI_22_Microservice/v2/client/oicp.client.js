const axios = require('axios');
const { OICPServiceHost } = require('../configs/constants');

/**
 * OICPClient is responsible for communicating with the OICP (Open InterCharge Protocol) service.
 * It initializes an Axios HTTP client with a predefined base URL and provides methods to interact
 * with remote charging operations, such as starting a charging session.
 *
 * @class OICPClient
 * @example
 * const client = new OICPClient();
 * const result = await client.sendStart(session);
 */
class OICPClient {
    /**
     * Creates an instance of OICPClient.
     * Initializes the Axios client with a predefined baseURL.
     */
    constructor() {
        /**
         * Axios instance configured for the public network.
         * @type {import('axios').AxiosInstance}
         */
        this.client = axios.create({
            baseURL: OICPServiceHost,
        });
    }

    /**
     * Sends a remote start request for a charging session to the OICP backend.
     *
     * @async
     * @param {Object} session - The session object containing charging session details.
     * @param {Object} session.cdr_token - The CDR token object.
     * @param {string} session.cdr_token.contract_id - The contract ID associated with the session.
     * @param {string} session.evse_uid - The unique identifier of the EVSE.
     * @param {string} session._id - The unique identifier of the session.
     * @returns {Promise<{status: boolean, message: string, sessionId?: string}>} Result of the remote start request.
     */
    async sendStart(session) {
        try {
            const body = {
                contractId: session.cdr_token.contract_id,
                evseId: session.evse_uid,
                sessionId: session._id
            }
            const resp = await this.client.post('/charging/remote/start', body);

            if (resp.data.success){
                return { status: true, message: resp.data.description || "success", sessionId: resp.data.sessionId }
            } else return { status: false, message: resp.data.description || "Fail without indication of why, should not happen!" }


        } catch (error) {
            console.log("Error - Fail catch the Start Hubject Remote ", error.message)
            return { status: false, message: error.message }
        }
    }
}

module.exports = { OICPClient };