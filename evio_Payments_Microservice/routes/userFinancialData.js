const express = require('express');
const router = express.Router();
const userFinancialDataController = require('../controllers/userFinancialDataController');
// Middleware
const userMiddleware = require('../middlewares/users');  

router.get('/api/private/payment/wallet',  userMiddleware.validateUserRequest, userFinancialDataController.getUserFinancialData);

module.exports = router;