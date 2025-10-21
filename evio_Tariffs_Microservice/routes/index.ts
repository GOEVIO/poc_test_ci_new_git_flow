import { Router } from 'express';
// Routes
import purchaseTariff from './purchaseTariff'
import salesTariff from './salesTariff';
import tariffTesla from './tariffTesla';

const router: Router = Router();
router.use(purchaseTariff)
router.use(salesTariff);
router.use(tariffTesla);

export default router;
