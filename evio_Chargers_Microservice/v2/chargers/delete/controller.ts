import { Request, Response } from 'express';
import { deleteCharger } from './service';

export const deleteChargerController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['userid'] as string;
        const charger = req.body;

        const result = await deleteCharger(userId, charger._id);

        return res.status(result.status).send(result.data);
    } catch (error: any) {
        console.error('Error deleting charger: ', error.message);
        return res.status(500).send({
            auth: false,
            code: 'internal_server_error',
            message: "Internal server error"
        });
    }
};
