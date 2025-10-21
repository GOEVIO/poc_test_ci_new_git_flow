const express = require('express');
const router = express.Router();
const Customization = require('../controllers/customization');
const ErrorHandler = require('../controllers/errorHandler');

const { FileTransaction } = require('evio-library-language');

//========== POST ==========
router.post('/api/private/config/customization', (req, res, next) => {
    var context = "POST /api/private/config/customization";

    Customization.addCustomization(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Customization.addCustomization] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== PATCH ==========
router.patch('/api/private/config/customization', (req, res, next) => {
    var context = "PATCH /api/private/config/customization";

    Customization.editCustomization(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Customization.editCustomization] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
router.get('/api/private/config/customization', (req, res, next) => {
    const context = "GET /api/private/config/customization";

    const {language, component, clientname} = req.headers
    Customization.getCustomization(clientname)
        .then(async (result) => {
            console.log(`[${context}] result`, result);
            // retrieve language hash
            const hash = await FileTransaction.retriveFileTransactionAsHash({
                component : component ??  process.env.DEFAULT_COMPONENT, 
                language: language ?? process.env.DEFAULT_LANGUAGE
            });

            const cleanResult = result.toObject();
            const response = {
              ...cleanResult,
              language: hash
            };
            console.log(`[${context}] response`, response);
            return res.status(200).send(response);
        })
        .catch((error) => {
            console.error(`[${context}][Customization.getCustomization] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);
        });

});

//========== DELETE ==========
router.delete('/api/private/config/customization', (req, res, next) => {
    var context = "DELETE /api/private/config/customization";

    Customization.deleteCustomization(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Customization.getCustomization] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;