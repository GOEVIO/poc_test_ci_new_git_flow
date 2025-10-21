import { Request, Response } from 'express';
import { editGroupCSUsersService } from '../services/editGroupCSUsers.service';
import Sentry from "@sentry/node";
import { errorResponse, ServerError } from '../../utils';

export const editGroupCSUsers = async (req: Request, res: Response) => {
    const context = 'PATCH /api/private/groupCSUsers';

    try {
        const userId = req.headers['userid'] as string;

        const result = await editGroupCSUsersService(req.body, userId);

        return res.status(result.status).send(result.data);
    } catch (error: any) {
        console.error(`[POST /groupCSUsers] Unexpected error`, error.message);
        Sentry.captureException(error);
        return errorResponse(res, ServerError(error.message, context), context);
    }
};

