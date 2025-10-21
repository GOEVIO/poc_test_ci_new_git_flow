import express, { Request, Response } from 'express';

import deviceController from '../controllers/deviceController';
const router = express.Router();

router.post('/api/private/device/setpoints', deviceController.setPointByDevice);

export default router;
