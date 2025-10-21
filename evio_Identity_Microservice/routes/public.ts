import { Router } from 'express';
import UnsubscribeMarketingController from '../controllers/unsubscribeMarketing';
import UsersController from '../controllers/users';

const router = Router();

router.get('/evioapi/users/unsubscribe/marketing/:hash', UnsubscribeMarketingController.getMarketingPreferencesByHash);
router.patch('/evioapi/users/unsubscribe/marketing/:hash', UnsubscribeMarketingController.updateMarketingPreferencesByHash);

router.patch('/evioapi/users/confirmChangeEmail', UsersController.confirmChangeEmailWithHash);

export default router;