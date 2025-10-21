import { Request, Response } from 'express';
import FacilitiesType, {IFacilitiesType} from './model';
import Sentry from "@sentry/node";
import AssetType from "../assetType/model";

export class FacilitiesTypeController {
    public async createFacilitiesType(req: Request, res: Response): Promise<Response> {
        try {
            const { locationType, description } = req.body;

            const existingType = await FacilitiesType.findOne({ locationType });
            if (existingType) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_location_type_already_exists',
                    message: 'The location type already exists.'
                });
            }

            const facilitiesType: IFacilitiesType = new FacilitiesType({ locationType, description });
            await facilitiesType.save();

            return res.status(201).send(facilitiesType);

        } catch (error: any) {
            console.error('[createFacilitiesType] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async getFacilitiesTypes(req: Request, res: Response): Promise<Response> {
        try {
            const { locationType, description } = req.query;
            const filter: any = {};

            if(locationType) filter.locationType = locationType;
            if(description) filter.description = description;

            const result = await FacilitiesType.find(filter);

            return res.status(200).send(result);

        } catch (error) {
            console.error('[getFacilitiesTypes] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }
}
