import express, { Request, Response } from 'express';
import { ParkingTypeController } from './controller';
import {validateParkingType} from "./validateParking.middleware";

const router = express.Router();
const controller = new ParkingTypeController();

router.post('', validateParkingType ,(req: Request, res: Response) => controller.createParkingType(req, res));
router.get('', (req: Request, res: Response) => controller.getParkingTypes(req, res));

export default router;
