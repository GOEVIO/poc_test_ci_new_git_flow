import express, { Router } from 'express';
import usersController from '../controllers/users';
import usersMiddleware, { isDisposableEmail } from '../middlewares/users';

const router: Router = express.Router();

// Get users by client name
router.get('/api/private/users/byClientName', usersController.getUsersByClientName);

// Send new temporary password to a user
router.use('/api/private/users/resetPassword/:userId', usersMiddleware.resetUserPasswordValidation);
router.post('/api/private/users/resetPassword/:userId', usersController.resetUserPassword);

// New unified route to create users
router.use('/api/private/users/:clientType', usersMiddleware.userValidation);
router.post('/api/private/users/:clientType', isDisposableEmail, usersController.createUser);
router.patch('/api/private/users/:userId', isDisposableEmail, usersController.patchUser);

router.delete('/api/private/user/deleteUser', usersController.deleteUser);
router.patch('/api/private/user/revertRequestDeleteAccount', usersController.revertRequestDeleteAccount);
router.patch('/api/private/user/anonymizeUserData', usersController.anonymizeUserData);
router.post('/api/private/user/processAfter30DaysDeleteAccount', usersController.processAfter30DaysDeleteAccount);

// New route to update users preferences for language
router.patch('/api/private/user/preferences/language', usersController.updateLanguagePreference);

export default router;
