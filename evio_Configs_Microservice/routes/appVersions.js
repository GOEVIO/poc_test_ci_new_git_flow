const express = require('express');
const router = express.Router();
const AppVersion = require('../controllers/appVersions');
const ErrorHandler = require('../controllers/errorHandler');

//========== POST ==========
//Create new codo to app version
router.post('/api/private/config/appVersions', (req, res, next) => {
    var context = "POST /api/private/config/appVersions";
    AppVersion.addAppVersion(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][AppVersion.addAppVersion] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});


//Create new codo to app version
router.post('/api/private/appVersions', (req, res, next) => {
    var context = "POST /api/private/appVersions";

    AppVersion.addAppVersion(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][AppVersion.addAppVersion] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//========== GET ==========
//Get app version code from db
router.get('/api/private/config/appVersions', (req, res, next) => {
    var context = "GET /api/private/config/appVersions";

    AppVersion.getAppVersion(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][AppVersion.getAppVersion] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });
});

//Get app version code from db
router.get('/api/private/appVersions', (req, res, next) => {
    var context = "GET /api/private/appVersions";

    AppVersion.getAppVersion(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][AppVersion.getAppVersion] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//========== DELETE ==========
//Get app version code from db
router.delete('/api/private/config/appVersions', (req, res, next) => {
    var context = "DELETE /api/private/config/appVersions";

    AppVersion.deleteAppVersion(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][AppVersion.deleteAppVersion] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

//Get app version code from db
router.delete('/api/private/appVersions', (req, res, next) => {
    var context = "DELETE /api/private/appVersions";

    AppVersion.deleteAppVersion(req)
        .then((result) => {

            return res.status(200).send(result);

        })
        .catch((error) => {

            console.error(`[${context}][AppVersion.deleteAppVersion] Error `, error.message);
            ErrorHandler.ErrorHandler(error, res);

        });

});

module.exports = router;