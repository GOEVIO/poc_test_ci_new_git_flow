import { Router } from 'express';
import authController from '../controllers/authentication';

const router = Router();

router.post([
    '/api/authenticate/',
    '/api/opManagement/authenticate',
    '/evioapi/authenticate/'
], authController.authenticate);

router.post('/api/caetanoGo/authenticate/', authController.authenticateCaetanoGo);

router.patch('/api/caetanoGo/authenticate/', authController.authenticateCaetanoGo);

router.post('/api/hyundai/authenticate/', authController.authenticateHyundai);

router.get('/api/checkauth/', authController.checkauth);

router.get('/api/token/userID', authController.getUserIdByToken);

router.get('/api/private/getCachedRules', authController.getCachedRules);

router.patch('/api/private/logout', authController.logout);

router.post('/api/validTokens', authController.saveNewToken);

router.patch('/api/validTokens', authController.finishAllSessions);

router.patch('/api/validTokens/disableToken', authController.disableToken);

router.patch('/api/validTokens/rules', authController.regenerateRules);

router.patch('/api/validTokens/revokeCachedRules', authController.revokeCachedRules);

export default router;
