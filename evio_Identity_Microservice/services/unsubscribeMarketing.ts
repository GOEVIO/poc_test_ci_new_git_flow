import User from '../models/user';
import AppConfigurationService from '../services/configsService';
import * as Sentry from '@sentry/node';

interface ILicensePreferences {
    licenseServices?: boolean;
    licenseProducts?: boolean;
    licenseMarketing?: boolean;
}

interface IMarketingPreferences {
    hash: string;
    clientName: string;
    licensePreferences: ILicensePreferences;
}

const getUserByHash = async (hash: string) => {
    const context = 'UnsubscribeMarketingService getUserByHash';

    const userFound = await User.findOne({ 'unsubscribedLink.hash': hash });

    if (!userFound) {
        console.warn(`[${context}]: User not found for hash ${hash}`);
        return;
    }

    if (!userFound.active) {
        console.warn(`[${context}]: User is not active. hash ${hash}`);
        return;
    }

    return userFound;
};

const getClientLicensePreferences = async (clientName: string) => {
    const context = 'UnsubscribeMarketingService getClientLicensePreferences';
    const appConfig =
        await AppConfigurationService.getAppConfiguration(clientName);

    if (!appConfig) {
        return;
    }

    if (!appConfig.marketingAndPromotionNotifications) {
        console.warn(
            `[${context}]: marketingAndPromotionNotifications not found for client ${clientName}.`
        );
        return;
    }

    const {
        licenseServiceEnabled,
        licenseProductEnabled,
        licenseMarketingEnabled,
    } = appConfig.marketingAndPromotionNotifications;

    if (
        !licenseServiceEnabled &&
        !licenseProductEnabled &&
        !licenseMarketingEnabled
    ) {
        console.warn(
            `[${context}]: No license found for client ${clientName}.`
        );
        return;
    }

    return appConfig.marketingAndPromotionNotifications;
};

const getMarketingPreferencesByHashService = async (hash: string) => {
    const context = 'getMarketingPreferencesByHash';
    try {
        const userFound = await getUserByHash(hash);

        if (!userFound) {
            return;
        }

        const {
            licenseMarketing,
            licenseProducts,
            licenseServices,
            language,
            email,
            clientName,
        } = userFound;

        if (!clientName) {
            console.warn(
                `[${context}]: The clientName ${clientName} not found. hash: ${hash} user: ${userFound._id}`
            );
            return;
        }

        const appConfigFound = await getClientLicensePreferences(clientName);

        if (!appConfigFound) {
            console.error(
                `[${context}]: AppConfiguration not found for client ${clientName}`
            );
            return;
        }

        const licensePreferences = {
            ...(appConfigFound.licenseServiceEnabled && { licenseServices }),
            ...(appConfigFound.licenseProductEnabled && { licenseProducts }),
            ...(appConfigFound.licenseMarketingEnabled && { licenseMarketing }),
        };

        return {
            licensePreferences,
            language,
            clientName,
            email,
        };
    } catch (error) {
        console.error(`[${context}]: `, error.message);
        Sentry.captureMessage(error);
    }
};

const updateMarketingPreferencesService = async ({
    hash,
    clientName,
    licensePreferences,
}: IMarketingPreferences) => {
    const context = 'updateMarketingPreferences';
    try {
        const { licenseServices, licenseProducts, licenseMarketing } =
            licensePreferences;

        const userFound = await getUserByHash(hash);

        if (!userFound) {
            return;
        }

        if (userFound.clientName !== clientName) {
            console.warn(
                `[${context}]: The clientName does not match. hash: ${hash} userFoundClientName: ${userFound.clientName} clientName: ${clientName} `
            );
            return;
        }

        const appConfigFound = await getClientLicensePreferences(
            userFound.clientName
        );

        if (!appConfigFound) {
            return;
        }

        const {
            licenseServiceEnabled,
            licenseProductEnabled,
            licenseMarketingEnabled,
        } = appConfigFound;

        userFound.licenseMarketing = licenseMarketingEnabled
            ? licenseMarketing
            : false;
        userFound.licenseProducts = licenseProductEnabled
            ? licenseProducts
            : false;
        userFound.licenseServices = licenseServiceEnabled
            ? licenseServices
            : false;

        await userFound.save();

        return licensePreferences;
    } catch (error) {
        console.error(`[${context}]:`, error.message);
        Sentry.captureMessage(error);
    }
};

export default {
    getMarketingPreferencesByHashService,
    updateMarketingPreferencesService,
};
