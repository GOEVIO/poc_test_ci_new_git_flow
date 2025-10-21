import { Request, Response } from 'express';
const { StatusCodes } = require('http-status-codes');

import UnsubscribeMarketingService from '../services/unsubscribeMarketing';

/**
 * Get user marketing preferences by hash
 * @route GET /api/public/users/unsubscribe/marketing/:hash
 * @param {string} hash - The hash of the user
 * @returns { clientName, email, language, licensePreferences } - The user marketing preferences
*/
const getMarketingPreferencesByHash = async (req: Request, res: Response) => {
    const context = `${req.method} ${req.path}`;
    const { hash } = req.params;
    
    if (!hash) {
        console.warn(`[${context}] Hash is required`);
        return res.status(StatusCodes.BAD_REQUEST).send({ message: 'Hash is required' });
    }

    const user = await UnsubscribeMarketingService.getMarketingPreferencesByHashService(hash);

    if (!user) {
        console.warn(`[${context}] User not found. hash: ${hash}`);
        return res.status(StatusCodes.NOT_FOUND).send({ code: 'user_or_clientName_not_found_unsubscribe', message: 'User or clientName is not able to do the unsubscribe' });
    }

    return res.status(StatusCodes.OK).send(user);
};

/** Patch user marketing preferences by hash
 * @route PATCH /api/public/users/unsubscribe/marketing/:hash
 * @param {string}  - The hash of the user
 * @headers {string} apikey - The apikey of the user
 * @body {object} licensePreferences - The user licenseServices, licenseProducts and licenseMarketing preferences
 * @return {object} licensePreferences - The user marketing preferences
 */
const updateMarketingPreferencesByHash = async (req: Request, res: Response) => {
    
    const context = `${req.method} ${req.path}`;
    const clientName = req.headers['clientname'] as string;
    const hash = req.params.hash;

    const { licensePreferences } = req.body;
    
    if (!hash) {
        console.warn(`[${context}] Hash is required`);
        return res.status(StatusCodes.BAD_REQUEST).send({ message: 'Hash is required' });
    }

    const updatedUser = await UnsubscribeMarketingService.updateMarketingPreferencesService({ hash, clientName, licensePreferences });

    if (!updatedUser) {
        console.warn(`[${context}] The user was not updated. hash: ${hash}`);
        return res.status(StatusCodes.NOT_FOUND).send({ code: 'user_or_clientName_not_found_unsubscribe', message: 'User or clientName is not able to do the unsubscribe' });
    }

    return res.status(StatusCodes.OK).send(updatedUser);
};

export default { getMarketingPreferencesByHash , updateMarketingPreferencesByHash };
