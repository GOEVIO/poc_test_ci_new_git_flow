const express = require('express');
const router = express.Router();
var AppVersions = require('../models/AppVersions');
require("dotenv-safe").load();

//========== POST ==========
//Create new code to app version
router.post('/api/private/appVersions', (req, res, next) => {
    var context = "POST /api/private/appVersions";
    try {

        const appVersions = new AppVersions(req.body);

        var query = {
            version: appVersions.version
        };

        AppVersions.findOne(query, (err, appVersionFound) => {
            if (err) {
                console.log(`[${context}][createAppVersions] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (appVersionFound) {
                    appVersionFound.code = appVersions.code;
                    var newValue = { $set: appVersionFound };
                    AppVersions.updateAppVersions(query, newValue, (err, result) => {
                        if (err) {
                            console.log(`[${context}][updateAppVersions] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (result) {
                                return res.status(200).send(result);
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_code_not_created', message: "Code not created" });
                            };
                        };
                    });
                }
                else {
                    AppVersions.createAppVersions(appVersions, (err, result) => {
                        if (err) {
                            console.log(`[${context}][createAppVersions] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (result) {
                                return res.status(200).send(result);
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_code_not_created', message: "Code not created" });
                            };
                        };
                    });
                };
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get codes from data base
router.get('/api/private/appVersions', (req, res, next) => {
    var context = "GET /api/private/appVersions";
    try {

        var query = req.query;

        AppVersions.find(query, (err, appVersionsFound) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(appVersionsFound);
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete code from data base
router.delete('/api/private/appVersions', (req, res, next) => {
    var context = "DELETE /api/private/appVersions";
    try {

        var query = req.body;

        AppVersions.findOneAndDelete(query, (err, result) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result)
                    return res.status(200).send({ auth: true, code: 'server_code_deleted', message: "Code deleted" });
                else
                    return res.status(400).send({ auth: true, code: 'server_code_not_deleted', message: "Code not deleted" });
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========


module.exports = router;