const axios = require('axios');
const { Enums } = require('evio-library-commons').default;

class PlatformClient {
    async call(endpoint, token, body, reject) {
        try {
            const response = await axios.post(endpoint, body, { headers: { 'Authorization': `Token ${token}` } });

            return response.data || response;
        } catch (error) {
            console.error(`Error during call to ${endpoint}:`, error);
            reject.setField('code', 'platform_client_error')
                .setField('internalLog', JSON.stringify(error))
                .setField('message', `Error during call to ${endpoint}: ${error.message}`)
                .setField('errorType', Enums.SessionFlowLogsErrorTypes.INTERNAL_ERROR)
            throw new Error();
        }
    }
};

module.exports = { PlatformClient };