import express, { Router } from 'express';
import contractsController from '../controllers/contract';
import usersMiddleware from '../middlewares/users';

const router: Router = express.Router();
// New endpoint for new webclient
router.use(
    '/api/private/users/contracts/deactivate/:userId',
    usersMiddleware.deactivateContractsValidation
);
router.patch(
    '/api/private/users/contracts/deactivate/:userId',
    contractsController.deactivateContracts
);

router.use(
    '/api/private/users/contracts/activate/:userId',
    usersMiddleware.activateContractValidation
);
router.patch(
    '/api/private/users/contracts/activate/:userId',
    contractsController.activateContract
);

router.patch(
    '/api/private/contracts/requestPhysicalCard',
    contractsController.requestPhysicalCard
)

router.patch(
    '/api/private/contracts/switchBlockCard',
    contractsController.switchBlockCard
);

export default router;