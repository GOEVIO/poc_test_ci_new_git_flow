import { Router } from 'express';
import { getTariff, updateTariff } from './tariffs.controller';

const router = Router();

router.get('', getTariff);
router.patch('', updateTariff);

export default router;
