import express, {Request, Response} from 'express'
import { validateChargerMiddleware } from './validationCharger.middleware';
import { deleteChargerController } from "./delete/controller";
import { getAllGroup } from "./controllers/allGroups.controller";
import {
    get,
    create,
    getChargerInfo,
    updateChargerInfo,
    updateAccess,
    getSharedChargers,
    getSharedChargerQRCode,
    getSharedChargerDetail,
    deleteSharedCharger,
} from "./controllers";
import { parsePagination } from '../shared/pagination.middleware'
import { parseGetChargersParamsSort } from './filter/middlewares/getChargersParamsSort.middleware';

const router = express.Router()

router.post(
    '',
    validateChargerMiddleware,
    (req: Request, res: Response) => create(req, res)
);

router.get('', parsePagination, parseGetChargersParamsSort, get);

router.delete('', deleteChargerController);

router.get(
    '/chargerInfo',
    (req: Request, res: Response) => getChargerInfo(req, res)
);

router.put(
    '/chargerInfo',
    (req: Request, res: Response) => updateChargerInfo(req, res)
);

router.patch(
    '/updateAccessType',
    (req: Request, res: Response) => updateAccess(req, res)
);


router.get('/allGroups', getAllGroup);

// SHARED CHARGERS
router.get(
    '/sharedchargers',
    (req: Request, res: Response) => getSharedChargers(req, res));

router.get(
    '/sharedchargers/qrcode',
    (req: Request, res: Response) => getSharedChargerQRCode(req, res)
);

router.get(
    '/sharedchargers/chargerdetail',
    (req: Request, res: Response) => getSharedChargerDetail(req, res)
);

router.delete(
    '/sharedchargers',
    (req: Request, res: Response) => deleteSharedCharger(req, res)
);

export default router

