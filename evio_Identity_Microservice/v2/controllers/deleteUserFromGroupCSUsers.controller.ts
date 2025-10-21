import { Request, Response } from 'express';
import { deleteUserFromGroupCSUsersService } from '../services/deleteUserFromGroupCSUsers.service';
import Sentry from "@sentry/node";
import { errorResponse, ServerError } from '../../utils';

export const deleteUserFromGroupCSUsers = async (req: Request, res: Response) => {
    const context = 'PATCH /api/private/groupCSUsers';

    try {
        const userId = req.headers['userid'] as string;

        const result = await deleteUserFromGroupCSUsersService(req.body, userId);

        return res.status(result.status).send(result.data);
    } catch (error: any) {
        console.error(`[${context}] Unexpected error`, error.message);
        Sentry.captureException(error);
        return errorResponse(res, ServerError(error.message, context), context);
    }
};
