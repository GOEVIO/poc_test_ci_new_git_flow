const express = require('express');
const router = express.Router();
const HostIssues = require('../controllers/hostIssues');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create a new issue to report to the charger owner
router.post('/', (req, res, next) => {
    let context = "POST /api/private/hostIssues";
    HostIssues.addHostIssues(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.addHostIssues] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PUT ==========

//========== PATCH ==========
//Update the status of the issue
router.patch('/', (req, res, next) => {
    let context = "PATCH /api/private/hostIssues";
    HostIssues.updateStatusIssues(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.updateStatusIssues] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== GET ==========
//Get all issues that were reported to me
router.get('/', (req, res, next) => {
    let context = "GET /api/private/hostIssues";
    HostIssues.getAllIssues(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getAllIssues] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues that were reported to me by charger
router.get('/byCharger', (req, res, next) => {
    let context = "GET /api/private/hostIssues/byCharger";
    HostIssues.getIssuesByCharger(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesByCharger] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get issue by id
router.get('/byId', (req, res, next) => {
    let context = "GET /api/private/hostIssues/byId";
    HostIssues.getIssuesById(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesById] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues that were reported to me using filters
router.get('/filter', (req, res, next) => {
    let context = "GET /api/private/hostIssues/filter";
    HostIssues.getIssuesByFilter(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesByFilter] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues reported by me
router.get('/reportedByMe', (req, res, next) => {
    let context = "GET /api/private/hostIssues/reportedByMe";
    HostIssues.getIssuesReportedByMe(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesReportedByMe] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues reported by me by charger
router.get('/reportedByMe/byCharger', (req, res, next) => {
    let context = "GET /api/private/hostIssues/reportedByMe/byCharger";
    HostIssues.getIssuesReportedByMeByCharger(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesReportedByMeByCharger] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues reported by me using filters
router.get('/reportedByMe/filter', (req, res, next) => {
    let context = "GET /api/private/hostIssues/reportedByMe/filter";
    HostIssues.getIssuesReportedByMeFilter(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesReportedByMeFilter] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

module.exports = router;