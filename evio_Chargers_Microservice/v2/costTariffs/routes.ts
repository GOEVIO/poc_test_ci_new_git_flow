import express, { Request, Response } from 'express';
import { CostTariffsController } from './controller';
import { validateCostTariffs } from "./validateCostTariffs.middleware";

const router = express.Router();
const controller = new CostTariffsController();

router.post('', validateCostTariffs ,(req: Request, res: Response) => controller.createCostTariff(req, res));
router.get('', (req: Request, res: Response) => controller.getCostTariff(req, res));
router.patch('', validateCostTariffs, (req: Request, res: Response) => controller.updateCostTariff(req, res));
router.delete('', (req: Request, res: Response) => controller.removeCostTariff(req, res));

export default router;
