import { Request, Response } from 'express';
// Utils
import { errorResponse } from '../utils/errorHandling';
// Services
import solarPVService from '../services/solarPVService';

const commonLog = '[ solarPVController ';

async function getExternalApi(req: Request, res: Response) {
    const context = `${commonLog} getExternalApi]`;
    try {
        const { userid: userId, id: solarPVId } = req.headers as { userid: string; id: string };
        const solarPvs = await solarPVService.getSolarPVs(userId, solarPVId);
        res.status(200).send(solarPVService.formatExternalAPISolarPVs(solarPvs));
    } catch (error) {
        if (!error.status) console.error(`${context} Error `, error.message);
        return errorResponse(res, error, context);
    }
}

export default { getExternalApi };
