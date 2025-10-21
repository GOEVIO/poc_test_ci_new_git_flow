import { Router } from 'express';
import {
    listChargerImages,
    addImages,
    deleteImage,
    markDefaultImage,
} from './chargerImages.controller';
import { imageSizeValidator } from './imageSizeValidator.middleware';

const router = Router();

router.get('', listChargerImages);
router.post('', imageSizeValidator, addImages);
router.delete('', deleteImage);
router.patch('/default', markDefaultImage);

export default router;
