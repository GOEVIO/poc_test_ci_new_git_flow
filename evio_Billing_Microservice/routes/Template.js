const express = require('express');
const router = express.Router();
require("dotenv-safe").load();

const Template = require('../models/Template');

router.post('/api/private/createTemplate', (req, res, next) => {
    var context = "POST /api/private/createTemplate";
    try {

        if (!req.body.clientName) {
            return res.status(400).send({ code: 'clientName_missing', message: "Cliente name missing" });
        }

        if (!req.body.ceme) {
            return res.status(400).send({ code: 'ceme_missing', message: "CEME missing" });
        }

        if (!req.body.environment) {
            return res.status(400).send({ code: 'environment_missing', message: "Environment missing" });
        }

        if (!req.body.email) {
            return res.status(400).send({ code: 'email_missing', message: "Email missing" });
        }

        if (!req.body.token) {
            return res.status(400).send({ code: 'token_missing', message: "Token missing" });
        }

        let newTemplate = new Template(req.body);

        Template.createTemplate(newTemplate, (error, result) => {
            if (error) {
                console.log(`[${context}][createTemplate] Error `, error.message);
                reject(error);
            }
            else {
                if (result) {
                    console.log(`[${context}][createTemplate] Success`);
                    resolve(true);
                }
                else {
                    console.log(`[${context}][createTemplate] Error`);
                    reject(`[${context}][createTemplate] Error`);
                }
            }
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

module.exports = router;