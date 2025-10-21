import express from 'express';
// middleware
import solarPVMiddleware from '../middleware/solarPVMiddleware';
// Controller
import solarPVController from '../controllers/solarPVController';

const router = express.Router();
router.get('/evioapi/solar', solarPVMiddleware.validateGetExternalAPI, solarPVController.getExternalApi);

export default router;