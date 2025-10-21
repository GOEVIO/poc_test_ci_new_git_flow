import { Router } from 'express';
import { getActiveSessionsForMyChargers } from './chargingSessions.controller';

const router = Router();

router.get('', getActiveSessionsForMyChargers);

export default router;
