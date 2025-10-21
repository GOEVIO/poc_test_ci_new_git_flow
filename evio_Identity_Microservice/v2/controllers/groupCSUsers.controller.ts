import { Request, Response } from 'express';
import { getGroupCSUsersService } from '../services/groupCSUsers.service';
import Sentry from "@sentry/node";
import {errorResponse, ServerError} from "../../utils";

export const getGroupCSUsers = async (req: Request, res: Response) => {
    const context = 'GET /api/private/groupCSUsers';
    try {
        const userId = req.headers['userid'] as string;

        const result = await getGroupCSUsersService(userId);

        return res.status(200).json(result);
    } catch (error: any) {
        console.error(`[${context}] Error: ${error.message}`);
        Sentry.captureException(error);
        return errorResponse(res, ServerError(error.message, context), context);
    }
};
