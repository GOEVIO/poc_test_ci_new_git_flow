const axios = require('axios');
const { HostChargers } = require('../configs/constants');
const {SessionFlowLogsErrorTypes} = require('../configs/constants')
class ChargerClient {
    constructor() {
        this.client = axios.create({
            baseURL: HostChargers,
        });
    }

    async createSession(body, reject) {
        try {
            const chargingSession = await this.client.post('/api/private/chargingSession/start', body);
            return chargingSession.data;
        } catch (error) {
            console.log("Error - Fail send start session ", error.message)
            if (error.response) {
                reject.setField('message', error.response.data.message)
                    .setField('errorType', SessionFlowLogsErrorTypes.INTERNAL_ERROR)
                    .setField('stage', "sendStartSessionToChargers")
                    .setField('statusCode', 500);
                throw new Error();
            } else {
                reject.setField('message', error.message)
                    .setField('errorType', SessionFlowLogsErrorTypes.INTERNAL_ERROR)
                    .setField('stage', "sendStartSessionToChargers")
                    .setField('statusCode', 500);
                throw new Error();
            }
        }
    }

    async updateSession(body, reject) {
        try {
            await this.client.patch('/api/private/chargingSession', { body });
        } catch (error) {
            console.log(`Error - Fail update session with status ${body.status}`, error.message)
            if (error.response) {
                reject.setField('message', error.response.data.message)
                    .setField('errorType', SessionFlowLogsErrorTypes.INTERNAL_ERROR)
                    .setField('stage', "updateSessionInChargers")
                    .setField('statusCode', 500);
                throw new Error();
            } else {
                reject.setField('message', error.message)
                    .setField('errorType', SessionFlowLogsErrorTypes.INTERNAL_ERROR)
                    .setField('stage', "updateSessionInChargers")
                    .setField('statusCode', 500);
                throw new Error();
            }
        }
    }
}

module.exports = { ChargerClient };