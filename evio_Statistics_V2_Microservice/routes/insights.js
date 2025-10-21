const express = require('express');
const router = express.Router();
const Insights = require("../handlers/insightsHandler");
const ErrorHandler = require("../handlers/errorHandler");
require("dotenv-safe").load();

//========== GET ==========
//Get insights 
router.get('/', (req, res, next) => {
    const context = "GET /api/private/insights_v2";
    try {

        let client = req.headers['client'];

        //console.log("client", client);

        if (client === process.env.ClientWeb) {

            Insights.getInsightsWeb(req, res)
                .then(result => {

                    return res.status(200).send(result);

                })
                .catch(error => {

                    console.error(`[${context}][Insights.getInsightsWeb] Error `, error.message);
                    ErrorHandler.ErrorHandler(error, res)

                });

        }
        else {
            //console.log("client", client);
            Insights.getInsightsApps(req, res)
                .then(result => {

                    return res.status(200).send(result);

                })
                .catch(error => {

                    console.error(`[${context}][Insights.getInsightsApps] Error `, error.message);
                    ErrorHandler.ErrorHandler(error, res)

                });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

router.get('/byEV', (req, res, next) => {
    var context = "GET /api/private/insights_v2/byEV";
    try {


        let client = req.headers['client'];

        if (client === process.env.ClientWeb) {

            Insights.getInsightsByEvWeb(req, res)
                .then(result => {

                    return res.status(200).send(result);

                })
                .catch(error => {

                    console.error(`[${context}][Insights.getInsightsByEvWeb] Error `, error.message);
                    ErrorHandler.ErrorHandler(error, res)

                });

        }
        else {

            Insights.getInsightsByEvApps(req, res)
                .then(result => {

                    return res.status(200).send(result);

                })
                .catch(error => {

                    console.error(`[${context}][Insights.getInsightsByEvApps] Error `, error.message);
                    ErrorHandler.ErrorHandler(error, res)

                });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

router.get('/byCharger', (req, res, next) => {
    var context = "GET /api/private/insights_v2/byCharger";
    try {

        Insights.getInsightsByCharger(req, res)
            .then(result => {

                return res.status(200).send(result);

            })
            .catch(error => {

                console.error(`[${context}][Insights.getInsightsByCharger] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res)

            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res)
    };
});

module.exports = router;