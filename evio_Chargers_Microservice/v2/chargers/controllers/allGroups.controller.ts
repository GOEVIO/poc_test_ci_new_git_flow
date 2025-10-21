import { Request, Response } from 'express';
import * as AllGroupsService from '../services/allGroups.service';
import * as Sentry from '@sentry/node';

export const getAllGroup = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['userid'] as string;
        if (!userId) {
            return res.status(400).json({ message: 'Missing userid header' });
        }

        const data = await AllGroupsService.fetchAllGroups(userId);

        res.status(200).json(data);
    } catch (error: any) {
        console.error(`[getAllGroups] ${error.message}`);
        Sentry.captureException(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
