import express from 'express';
// Interfaces
import switchboardMiddleware from '../middleware/switchboardsMiddleware';
// Controllers
import switchboardController from '../controllers/switchboardsController';

const router = express.Router();

router.get('/api/private/chargers/switchboard/configs/:id', switchboardMiddleware.validateConfigSwitchboard, switchboardController.getConfigs);
router.patch('/api/private/chargers/switchboard/:id', switchboardMiddleware.validatePatchSwitchboard, switchboardController.patchSwitchboard);

export default router;
