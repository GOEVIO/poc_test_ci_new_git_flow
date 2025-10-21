const express = require('express');
const router = express.Router();
const EVIOIssues = require('../controllers/evioIssues');
const ErrorHandler = require('../controllers/errorHandler');


//========== POST ==========
//Create a new issue EVIO
router.post('/', (req, res, next) => {
    let context = "POST /api/private/evioIssues";
    EVIOIssues.addEvioIssues(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.addEvioIssues] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== PUT ==========

//========== PATCH ==========
//Update the status of the issue
router.patch('/', (req, res, next) => {
    let context = "PATCH /api/private/evioIssues";
    EVIOIssues.updateStatusIssues(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.updateStatusIssues] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== GET ==========
//Get all issues
router.get('/', (req, res, next) => {
    let context = "GET /api/private/evioIssues";
    EVIOIssues.getAllIssues(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getAllIssues] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues by charger
router.get('/byCharger', (req, res, next) => {
    var context = "GET /api/private/evioIssues/byCharger";
    EVIOIssues.getIssuesByCharger(req, res)
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
    let context = "GET /api/private/evioIssues/byId";
    EVIOIssues.getIssuesById(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesById] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues using filters
router.get('/filter', (req, res, next) => {
    let context = "GET /api/private/evioIssues/filter";
    EVIOIssues.getIssuesByFilter(req, res)
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
    let context = "GET /api/private/evioIssues/reportedByMe";
    EVIOIssues.getIssuesReportedByMe(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesReportedByMe] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues reported by me using filters
router.get('/reportedByMe/filter', (req, res, next) => {
    let context = "GET /api/private/evioIssues/reportedByMe/filter";
    EVIOIssues.getIssuesReportedByMeFilter(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesReportedByMeFilter] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get all issues reported by me by charger
router.get('/reportedByMe/byCharger', (req, res, next) => {
    let context = "GET /api/private/evioIssues/reportedByMe/byCharger";
    EVIOIssues.getIssuesReportedByMeByCharger(req, res)
        .then(response => {

            return res.status(200).send(response);

        })
        .catch(error => {

            console.error(`[${context}][EVIOIssues.getIssuesReportedByMeByCharger] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});


module.exports = router;