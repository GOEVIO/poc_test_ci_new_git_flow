import { Router } from 'express';
import updateBillingProfileController from '../controllers/billingProfiles';
const router = Router();

// ========== PATCH ==========
// Update User Billing Profile
router.patch('/api/private/billingProfile', (req, res) => {
    updateBillingProfileController.updateBillingProfile(req, res, false);
});

router.patch('/api/private/billingProfile/updateName', updateBillingProfileController.updateBillingProfileName);

router.get('/api/private/billingProfile/tin-classification', updateBillingProfileController.getTinClassification);
export default router;
