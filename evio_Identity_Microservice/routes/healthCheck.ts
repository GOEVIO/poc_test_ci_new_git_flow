import { Router, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import HealthCheckController, { HealthCheckResponse } from '../controllers/healthCheck';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
    try {
        const controller: HealthCheckController = new HealthCheckController();
        const response: HealthCheckResponse = await controller.getData();

        return res.status(StatusCodes.OK).send(response);
    } catch (error: any) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ message: 'Unable to perform the operation' });
    }
});

export default router;
