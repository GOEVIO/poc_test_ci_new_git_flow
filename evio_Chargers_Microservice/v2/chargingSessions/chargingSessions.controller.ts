import { Request, Response } from 'express';
import { ChargingSessionService } from './chargingSessions.service';
import * as Sentry from "@sentry/node";

export const getActiveSessionsForMyChargers = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['userid'] as string;
        if (!userId) return res.status(400).json({ message: 'User ID is required in headers.' });

        const sessions = await ChargingSessionService.getActiveSessions(userId);

        return res.status(200).json({ sessions });
    } catch (error) {
        console.error(`[Controller] Error fetching sessions:`, error);
        Sentry.captureException(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
