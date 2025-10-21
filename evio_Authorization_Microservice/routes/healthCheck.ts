import { Router } from 'express';
const router = Router();
import controllerHealthCheck from '../controllers/healthCheck';

router.get('/api/private/healthCheck', controllerHealthCheck.checkHealth);
export default router;