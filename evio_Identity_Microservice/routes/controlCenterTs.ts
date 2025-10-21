import { Router } from 'express';
import updateBillingProfileController from '../controllers/billingProfiles';
import toggle from 'evio-toggle';
import { StatusCodes } from 'http-status-codes';
const router = Router();

// ========== PATCH ==========
// Update User Billing Profile
router.patch('/api/private/controlCenter/billingProfile', async (req, res) => {
    const context = "POST /api/private/controlcenter/usersClients - Function createUserClients"
    
    const featureFlagEnabled = await toggle.isEnable('control_center_create_b2b_charge-56');
    if(!featureFlagEnabled) {
        console.log(`[${context}][FEATUREFLAG][control_center_create_b2b_charge-56]`)
        return res.status(StatusCodes.FORBIDDEN).send({ code: 'control_center_create_b2b_deactivated', message: "Control Center create B2B deactivated" });
    }

    updateBillingProfileController.updateBillingProfile(req, res, true);
});

export default router;