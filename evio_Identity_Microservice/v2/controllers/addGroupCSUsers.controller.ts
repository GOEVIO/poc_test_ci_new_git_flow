import { Request, Response } from 'express';
import { addGroupCSUsersService } from '../services/addGroupCSUsers.service';
import Sentry from "@sentry/node";
import { errorResponse, ServerError } from '../../utils';

export const addGroupCSUsers = async (req: Request, res: Response) => {
    const context = 'POST /api/private/groupCSUsers';

    try {
        const createUser = req.headers['userid'] as string;
        const clientName = req.headers['clientname'] as string;

        const response = await addGroupCSUsersService(req.body, createUser, clientName);

        return res.status(response.status).send(response.data);
    } catch (error: any) {
        console.error(`[POST /groupCSUsers] Unexpected error`, error.message);
        Sentry.captureException(error);
        return errorResponse(res, ServerError(error.message, context), context);
    }
};
