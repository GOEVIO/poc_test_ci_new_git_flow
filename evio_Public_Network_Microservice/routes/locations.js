const locationsController = require('../controllers/locations');
const { Router } = require('express');
const router = Router();
const { validateFeatureFlag } = require('../utils/validations');

router.get('/evioapi/locations', validateFeatureFlag('charge-66') , locationsController.getLocations);

module.exports = router;