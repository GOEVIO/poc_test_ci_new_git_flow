const assetController = require('../controllers/assets');
const { Router } = require('express');
const router = Router();
const { createAssetSchema , updateNetworkAssetSchema , deleteAssetSchema , updateAssetSchema } = require('../schemas/asset');
const { validateFeatureFlag , dataValidation} = require('../utils/validationUtils');
const Constants = require('../utils/constants');


router.get('/evioapi/assets', validateFeatureFlag('charge-61') , assetController.getAssets);



// Endpoint to activate or deactivate an asset network
router.put(
    '/evioapi/assets/network/:id', 
    validateFeatureFlag('charge-64'), 
    dataValidation(updateNetworkAssetSchema, Constants.errorResponses.assets.activateNetwork.code, Constants.errorResponses.assets.activateNetwork.message), 
    assetController.changeNetworkStatus
);


// Endpoint to create a new asset
router.post(
    '/evioapi/assets', 
    validateFeatureFlag('charge-224'), 
    dataValidation(createAssetSchema, Constants.errorResponses.assets.create.code, Constants.errorResponses.assets.create.message), 
    assetController.createAsset
);


// Endpoint to delete an asset
router.delete(
    '/evioapi/assets/:id', 
    validateFeatureFlag('charge-65'), 
    dataValidation(deleteAssetSchema, Constants.errorResponses.assets.delete.code, Constants.errorResponses.assets.delete.message), 
    assetController.deleteAsset
);


// Endpoint to update an asset
router.put(
    '/evioapi/assets/:id', 
    validateFeatureFlag('charge-63'), 
    dataValidation(updateAssetSchema, Constants.errorResponses.assets.update.code, Constants.errorResponses.assets.update.message), 
    assetController.updateAsset
);

module.exports = router;
