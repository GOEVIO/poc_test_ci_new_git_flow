import express from 'express';

// controllers
import locationsController from '../controllers/locationsControllers';
// middleware
import locationsMiddleware from '../middleware/locationsMiddleware';

const router = express.Router();

//========== POST ==========
// create new location
router.post('/api/private/chargers/locations', locationsMiddleware.validateCreateLocation, locationsController.createNewLocation);

//========== PATCH ==========
router.patch('/api/private/chargers/locations/:id', locationsMiddleware.validateUpdateLocation, locationsController.updateNewLocation);


export default router;
