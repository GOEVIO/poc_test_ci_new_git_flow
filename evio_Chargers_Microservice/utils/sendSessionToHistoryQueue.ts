import constants from './constants';
import mqConnection from 'evio-rabbitmq-connection/dist/src/rabbitmq-connection';
import { captureException } from '@sentry/node';

export const sendSessionToHistoryQueue = async (sessionId: string, from = '') => {
    const context = 'sendSessionToHistoryQueue ocpp';
    try {
        const message = {
            sessionId,
            origin: 'ocpp',
            from: `service charger - ${from}`,
        };
        await mqConnection.sendToQueue(constants.sessionHistoryV2RabbitmqQueue, message);
    } catch (error) {
        captureException(`${context} Error ${error}`);
        console.error(`${context}`, error);
    }
};

export const checkBeforeSendSessionToHistoryQueue = async (status: string): Promise<boolean> => {
    return ['70', '40'].includes(status);
};
