import * as Sentry from '@sentry/node';
import { AppConfigurationReadRepository } from 'evio-library-configs';

const getAppConfiguration = async (clientName: string) => {
    const context = 'ConfigsService.getAppConfiguration';
    try {
        const appConfiguration = await AppConfigurationReadRepository.getAppConfigurationsByClient(clientName);
        if (!appConfiguration) {
            throw new Error('The AppConfiguration with name ' + clientName + ' was not found.');
        }
        return appConfiguration;
    } catch (err) {
        console.error(`[${context}] Error `, err.message);
        Sentry.captureException(err);
        return null;
    }
}

export default {
    getAppConfiguration
};