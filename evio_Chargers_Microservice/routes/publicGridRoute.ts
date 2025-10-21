import express from 'express';
// middleware
import publicGridMiddleware from '../middleware/publicGridMiddleware';
// Controller
import publicGridController from '../controllers/publicGridController';

const router = express.Router();
router.put('/evioapi/meter/energy', publicGridMiddleware.validatePutExternalAPI, publicGridController.putExternalAPIMeters);

export default router;
