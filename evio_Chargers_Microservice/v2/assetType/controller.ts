import { Request, Response } from 'express';
import AssetType, {IAssetType} from './model';
import Sentry from '@sentry/node';

export class AssetTypeController {
    public async createAssetType(req: Request, res: Response): Promise<Response> {
        try {
            const { vehicleType, description } = req.body;

            const existingType = await AssetType.findOne({ vehicleType });
            if (existingType) {
                return res.status(400).send({
                    auth: false,
                    code: 'server_error_vehicle_type_exists',
                    message: 'A vehicle with the given type already exists.'
                });
            }

            const assetType: IAssetType = new AssetType({ vehicleType, description });
            await assetType.save();

            return res.status(201).send(assetType);

        } catch (error: any) {
            console.error('[createAssetType] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }

    public async getAssetTypes(req: Request, res: Response): Promise<Response> {
        try {
            const { vehicleType, description } = req.query;
            const filter: any = {};

            if(vehicleType) filter.vehicleType = vehicleType;
            if(description) filter.description = description;

            const result = await AssetType.find(filter);

            return res.status(200).send(result);

        } catch (error: any) {
            console.error('[getAssetTypes] Error:', error);
            Sentry.captureException(error);
            return res.status(500).send({
                auth: false,
                code: 'internal_server_error',
                message: "Internal server error"
            });
        }
    }
}
