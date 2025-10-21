import { Request, Response } from 'express';
import { addUserFromGroupCSUsersService } from '../services/addUserFromGroupCSUsers.service';
import Sentry from "@sentry/node";
import {errorResponse, ServerError} from "../../utils";

export const addUserFromGroupCSUsers = async (req: Request, res: Response) => {
    const context = 'PUT /api/private/groupCSUsers';

    try {
        const userId = req.headers['userid'] as string;

        const response = await addUserFromGroupCSUsersService(req.body, userId);

        return res.status(response.status).send(response.data);
    } catch (error: any) {
        console.error(`[${context}] Unexpected error`, error.message);
        Sentry.captureException(error);
        return errorResponse(res, ServerError(error.message, context), context);
    }
};
