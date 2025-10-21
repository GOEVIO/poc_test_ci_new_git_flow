import Sentry from '@sentry/node';
import { Request, Response } from 'express';

import { getChargersParamsFromQuery } from './service/getChargersParams.service';
import { getChargers } from './service/getChargers.service';

export async function get(req: Request, res: Response) {
    const userId = req.headers['userid'] as string;
    const params = getChargersParamsFromQuery(req.query);

    try {
        const result = await getChargers(userId, params);
        if (!result) {
            return res.status(200).send([]);
        }

        return res.status(200).send(result);
    } catch (error: any) {
        console.error(`[ChargerV2Controller getChargers] Error listing chargers:`, error?.message || error);
        Sentry.captureException(error);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }
}
