import express from 'express';
import multer from 'multer';
// Controllers
import chargerModelsController from '../controllers/chargerModels';
// Middlewares
import chargerModelsMiddleware from '../middleware/chargerModelsMiddleware';
//Services
import chargerModelsService from '../services/importChargerModelFromExcel';


const router = express.Router();

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//========== POST ==========
//Create new charger model
router.post('/api/private/chargers/chargerModels', chargerModelsMiddleware.validateCreateChargerModel, chargerModelsController.createNewModel);

// Import Excel files
router.post('/api/private/chargers/chargerModels/import-excel', upload.array('excelFiles'), chargerModelsService.importExcel);


// ========== GET ==========
router.get('/api/private/chargers/chargerModels/groupByBrand', chargerModelsController.getChargerModelsGroupByBrand);


//========== PATCH ==========
//Edit charger model
router.patch('/api/private/chargers/chargerModels/:_id', chargerModelsMiddleware.validateUpdateChargerModel, chargerModelsController.updateChargerModel);


export default router;
