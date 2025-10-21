import { Request, Response } from 'express';
import { captureException } from '@sentry/node';
// Utils
import { errorResponse } from '../utils/errorHandling';
// Services
import publicGridServices from '../services/publicGridServices';
// Interface
import { IPutPublicGridExternalAPI } from '../interfaces/publicGridInterfaces';

const commonLog = '[ publicGridController ';

async function putExternalAPIMeters(req: Request, res: Response) {
    const context = `${commonLog} putExternalAPIMeters]`;
    try {
        const metersMeasurements: IPutPublicGridExternalAPI[] = req.body;
        const { userid: userId } = req.headers as { userid: string };
        for (const meter of metersMeasurements) {
            const updateMeterObject = publicGridServices.createExternalAPIUpdateObject(meter, userId);
            publicGridServices.CreateOrUpdatePublicGrid(meter.id, updateMeterObject, userId);
        }
        res.status(204).send();
    } catch (error) {
        if (!error.status) {
            console.error(`${context} Error `, error.message);
            captureException(error.message);
        }
        return errorResponse(res, error, context);
    }
}

export default { putExternalAPIMeters };
