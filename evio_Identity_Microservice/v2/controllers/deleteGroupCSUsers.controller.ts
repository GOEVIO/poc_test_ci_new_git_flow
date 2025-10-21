import { Request, Response } from 'express';
import { deleteGroupCSUsersService } from '../services/deleteGroupCSUsers.service';
import Sentry from "@sentry/node";
import { errorResponse, ServerError } from '../../utils';

export const deleteGroupCSUsers = async (req: Request, res: Response) => {
    const context = 'DELETE /api/private/groupCSUsers';

    try {
        const userId = req.headers['userid'] as string;

        const result = await deleteGroupCSUsersService(req.body, userId);

        return res.status(200).send(result);
    } catch (error: any) {
        console.error(`[${context}] Unexpected error`, error.message);
        Sentry.captureException(error);
        return errorResponse(res, ServerError(error.message, context), context);
    }
};
