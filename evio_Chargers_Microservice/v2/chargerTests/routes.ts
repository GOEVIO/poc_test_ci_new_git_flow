import express, { Request, Response } from 'express';
import { ChargerTestController } from "./controller";


const router = express.Router()
const chargerTestController = new ChargerTestController();

router.post(
    '',
    (req: Request, res: Response) => chargerTestController.create(req, res)
);

router.get(
    '',
    (req: Request, res: Response) => chargerTestController.getAll(req, res)
);

router.get(
    '/:id',
    (req: Request, res: Response) => chargerTestController.getById(req, res)
);

router.put(
    '/:id',
    (req: Request, res: Response) => chargerTestController.update(req, res)
);

router.delete(
    '/:id',
    (req: Request, res: Response) => chargerTestController.delete(req, res)
);

export default router;
