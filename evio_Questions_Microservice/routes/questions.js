const express = require('express');
const router = express.Router();
const Questions = require('../controllers/questions');
const ErrorHandler = require('../controllers/errorHandler');
const fs = require('fs');
const https = require('https')
const path = require('path')
const axios = require('axios');


//========== POST ==========
//Create a question
router.post('/api/private/questions', (req, res, next) => {
    let context = "POST /api/private/questions";
    Questions.addQuestions(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Questions.addQuestions] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.post('/api/private/questions/hubject', (req, res, next) => {
    var context = "POST /api/private/questions/hubject";
    try {

        const rfId = req.body.rfId
        if (!rfId) {
            console.log(`[${context}] Error - No RFID Sent`);
            return res.status(400).send("No RFID Sent");
        }
        const data = {
            SessionID: "34b7510c-fe7c-4056-8b0c-0057969c5udse",
            OperatorID: "DE*ICE",
            // EvseID: "DE*ICE*E123456789*6",
            EvseID: "DE*ICE*E0000TEST*5",
            Identification: {
                RFIDMifareFamilyIdentification: {
                    UID: rfId
                }
            }
        }
        const host = "https://pre-oicp.go-evio.com:8443/api/oicp/charging/v21/operators/DE*ICE/authorize/start"
        let httpsAgent = new https.Agent({
            ca: fs.readFileSync(path.join(__dirname, "..", "certs", "Hubject_CA.crt"), 'utf8'),
            cert: fs.readFileSync(path.join(__dirname, "..", "certs", "HubjectSigned.pem"), 'utf8'),
            key: fs.readFileSync(path.join(__dirname, "..", "certs", "Server.key"), 'utf8'),
            maxVersion: "TLSv1.3",
            minVersion: "TLSv1.2",
            timeout: 10000,
            rejectUnauthorized: false
        })
        const requestTime = new Date()
        console.log(`${context} sending request...  `)
        axios.post(host, data, { httpsAgent }).then(function (result) {
            const responseTime = new Date() - requestTime
            console.log("---> time of response : ", responseTime)
            if (result?.data) return res.status(200).send({ "response": result.data, "requestTime": responseTime });
            else return res.status(500).send({ "response": result.data, "requestTime": responseTime });
        }).catch(function (err) {
            if (err.response?.data) {
                const responseTime = new Date() - requestTime
                console.log(`${context} Error 2: Message with status `, err.response.status)
                console.log("---> time of response : ", responseTime)
                return res.status(err.response.status).send({ "response": err.response.data, "requestTime": responseTime });
            } else {
                console.log(`${context} Error 3 - `, err.message)
                return res.status(500).send(err.response);
            }
        })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Patch to update or edit a question
router.patch('/api/private/questions', (req, res, next) => {
    let context = "PATCH /api/private/questions";
    Questions.updateQuestions(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Questions.updateQuestions] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== GET ==========
//Get questions 
router.get('/api/private/questions', (req, res, next) => {
    let context = "GET /api/private/questions";
    Questions.getQuestions(req)
        .then((result) => {
            console.log(`[${context}][Questions.updateQuestions] Result `, {result});
            return res.status(200).send(result);

        })
        .catch((error) => {

            console.log(`[${context}][Questions.getQuestions] Error `, error);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get questions public
router.get('/api/public/questions', async (req, res, next) => {
    let context = "GET /api/public/questions";
    Questions.getPublicQuestions(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Questions.getPublicQuestions] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

router.get('/api/private/questions/issues', (req, res, next) => {
    let context = "GET /api/private/questions/issues";
    Questions.getQuestionsIssues(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Questions.getQuestions] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== DELETE ==========
//Delete a question (Put it inactive)
router.delete('/api/private/questions', (req, res, next) => {
    let context = "DELETE /api/private/questions";
    Questions.removeQuestions(req, res)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][Questions.removeQuestions] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

module.exports = router;