require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const OperatorHandler = require('../controllers/operator');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create a new Operator
router.post('/api/private/chargers/operator', async (req, res, next) => {
    let context = "POST /api/private/operator";
    try {

        let response = await OperatorHandler.addOperator(req)
        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

//========== PATCH ==========
//Update Operators
router.patch('/api/private/chargers/operator', async (req, res, next) => {
    let context = "PATCH /api/private/operator";
    try {

        let response = await OperatorHandler.updateOperator(req)
        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

//========== GET ==========
//Get Operators
router.get('/api/private/chargers/operator', async (req, res, next) => {
    let context = "GET /api/private/operator";
    try {

        let response = await OperatorHandler.getOperator(req)
        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

//========== DELETE ==========
//Remove Operators
router.delete('/api/private/chargers/operator', async (req, res, next) => {
    let context = "DELETE /api/private/operator";
    try {

        let response = await OperatorHandler.deleteOperator(req)
        return res.status(200).send(response);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

module.exports = router;