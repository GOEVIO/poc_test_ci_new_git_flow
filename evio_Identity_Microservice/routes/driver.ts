import { Router } from 'express';
import driversController from '../controllers/driver';

const router = Router();

// Add a user to driver pool
router.get('/api/private/drivers', driversController.getDrivers);

// Add a user to driver pool
router.put('/api/private/drivers', driversController.addNewDrivers);

export default router;
