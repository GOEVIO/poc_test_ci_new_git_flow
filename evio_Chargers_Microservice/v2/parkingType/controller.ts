import { Request, Response } from 'express';
import ParkingType, {IParkingType} from './model';
import Sentry from "@sentry/node";

export class ParkingTypeController {
    public async createParkingType(req: Request, res: Response): Promise<Response> {
        try {
            const { parkingType, description } = req.body;

            const existingType = await ParkingType.findOne({ parkingType });
            if (existingType) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_parking_type_already_exists',
                    message: 'A parking type with the given name already exists.'
                });
            }

            const result: IParkingType = new ParkingType({ parkingType, description });
            await result.save();

            return res.status(201).send(result);

        } catch (error) {
            console.error('[createParkingType] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async getParkingTypes(req: Request, res: Response): Promise<Response> {
        try {
            const { parkingType, description } = req.query;
            const filter: any = {};

            if(parkingType) filter.parkingType = parkingType;
            if(description) filter.description = description;

            const result = await ParkingType.find(filter);

            return res.status(200).send(result);

        } catch (error) {
            console.error('[getParkingTypes] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }
}
