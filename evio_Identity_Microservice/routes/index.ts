import { Router } from 'express';
import usersRoute from './user';
import rulesRoute from './rules';
import driversRoute from './driver';
import healthCheckRoute from './healthCheck';
import billingProfilesRoutes from './billingProfiles';
import controlCenterRoutes from './controlCenterTs';
import contractsRoutes from './contract';
import ldapBackup from './ldapBackup';
import changeEmailRoutes from './changeEmail';
import publicRoute from './public';
// Middleware
import usersMiddleware from '../middlewares/users';

const router: Router = Router();

router.use(publicRoute);
router.use(controlCenterRoutes);
router.use(changeEmailRoutes);
router.use(usersMiddleware.validateUserRequest, contractsRoutes);
router.use(usersMiddleware.validateUserRequest, usersRoute);
router.use(rulesRoute);
router.use(billingProfilesRoutes);
router.use(driversRoute);
router.use('/api/private/healthCheck', healthCheckRoute);
router.post('/api/private/ldapbackup', ldapBackup);

export default router;
