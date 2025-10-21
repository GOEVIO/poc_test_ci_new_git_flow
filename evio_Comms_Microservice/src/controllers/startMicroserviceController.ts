import axios from 'axios';
import EXTERNALENDPOINT from '../configuration/externalEndpoints';
import MICROSERVICE from '../configuration/microservice';
import { captureException } from '@sentry/node';
import utils from '../utils/utils';

const commonLog = ' [startMicroService ';

async function sendStartOffline(): Promise<boolean> {
    const context = `${commonLog} sendStartOffline ]`;
    let failRequest = 0;
    const host = `${EXTERNALENDPOINT.CHARGERS_HOST}${EXTERNALENDPOINT.CHARGER_UPDATE_OFFLINE_START}`;
    while (true) {
        try {
            const response = await axios.post(host, {});
            if (response?.status === 204) return true;

            failRequest++;
            console.error(`${context} Error - Charger microservice is not responding as expected`);
            captureException(new Error(`Charger microservice is not responding as expected, with status: ${response?.status}`));
            await utils.sleep(MICROSERVICE.DELAY_START_REQUEST);
        } catch (error) {
            console.error(`${context} Error - `, error instanceof Error ? error.message : error);
            if (failRequest >= MICROSERVICE.START_REQUEST_FAIL_ATTEMPTS_TO_REPORT) {
                captureException(new Error(' FAIL to communicate with charger Microservice, check if it is running..'));
                failRequest = 0;
            }
            await utils.sleep(MICROSERVICE.DELAY_START_REQUEST);
        }
    }
}

export default {
    sendStartOffline,
};
