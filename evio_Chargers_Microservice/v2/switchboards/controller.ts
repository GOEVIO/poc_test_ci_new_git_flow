import { Request, Response } from 'express';
import SwitchBoard from '../../models/switchBoards';
import Sentry from '@sentry/node';

export class SwitchBoardController {
    public async getSwitchBoard(req: Request, res: Response): Promise<Response> {
        try {
            const filter = Object.fromEntries(
                Object.entries(req.query).filter(([_, value]) => value !== undefined)
            );

            const switchBoards = await SwitchBoard.find(filter);

            return res.status(200).send(switchBoards);

        } catch (error) {
            console.error('[getSwitchBoard] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }
}
