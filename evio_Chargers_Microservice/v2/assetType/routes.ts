import express, { Request, Response } from 'express';
import { AssetTypeController } from './controller';
import {validateAssetType} from "./validateAsset.middleware";

const router = express.Router();
const controller = new AssetTypeController();

router.post('', validateAssetType, (req: Request, res: Response) => controller.createAssetType(req, res));
router.get('', (req: Request, res: Response) => controller.getAssetTypes(req, res));

export default router;
