import express, { Router } from 'express';
import usersController from '../controllers/users';
import updateBillingProfileController from '../controllers/billingProfiles';

const router: Router = express.Router();

router.post('/api/private/users/request/change-email', usersController.requestChangeEmail);
router.patch('/api/private/users/confirm/change-email', usersController.confirmChangeEmail);
router.post('/api/private/users/resend/welcome-email', usersController.resendWelcomeEmail);

router.post('/api/private/billingProfile/request/change-email', updateBillingProfileController.requestChangeEmail);
router.patch('/api/private/billingProfile/confirm/change-email', updateBillingProfileController.confirmChangeEmail);

export default router;