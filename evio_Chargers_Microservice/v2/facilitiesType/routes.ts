import express, { Request, Response } from 'express';
import { FacilitiesTypeController } from './controller';
import {validateFacilitiesType} from "./validateFacility.middleware";

const router = express.Router();
const controller = new FacilitiesTypeController();

router.post('', validateFacilitiesType , (req: Request, res: Response) => controller.createFacilitiesType(req, res));
router.get('', (req: Request, res: Response) => controller.getFacilitiesTypes(req, res));

export default router;
