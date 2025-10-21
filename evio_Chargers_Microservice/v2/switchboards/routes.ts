import express, { Request, Response } from 'express';
import { SwitchBoardController } from './controller';

const router = express.Router();
const controller = new SwitchBoardController();

router.get('', (req: Request, res: Response) => controller.getSwitchBoard(req, res));

export default router;
