const express = require('express');
const router = express.Router();
const TariffsTAR = require('../models/tariffTar');
var TARTariff = require('../models/tariffTar.json');
const TariffsTARHandler = require('../controllers/tariffTar');
require("dotenv-safe").load();

//========== POST ==========
//Create a new tariff TAR
router.post('/api/private/tariffTar', (req, res, next) => {
    var context = "POST /api/private/tariffTar";
    try {

        var tariffTar = new TariffsTAR(req.body);

        TariffsTAR.createTariffTAR(tariffTar, (err, result) => {

            if (err) {

                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                return res.status(200).send(result);

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.post('/api/private/tariffTar/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/tariffTar/runFirstTime";
    try {
        runFirstTime();
        return res.status(400).send("OK");
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.post('/api/private/tariffTar/job/checkSessions/forceRun', (req, res) => {
    const context = "POST /api/private/tariffTar/job/checkSessions/forceRun";
    TariffsTARHandler.forceJobTariffTarUpdate()
        .then(response => {
            console.log(response)
            return res.status(200).send(response);
        })
        .catch(error => {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        });
});

//========== PUT ==========

//========== PATCH ==========
//Edit a tariff TAR
router.patch('/api/private/tariffTar', (req, res, next) => {
    var context = "PATCH /api/private/tariffTar";
    try {

        var received = req.body;
        var query = {
            _id: received._id
        };
        delete received._id;
        var newValues = { $set: received };

        TariffsTAR.updateTariffTAR(query, newValues, (err, result) => {

            if (err) {

                console.error(`[${context}][TariffsTAR.updateTariffTAR] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                tariffTarFind({})
                    .then((result) => {

                        return res.status(200).send(result);

                    })
                    .catch((error) => {

                        console.error(`[${context}][tariffTarFind] Error `, error.message);
                        return res.status(500).send(error.message);

                    });

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.patch('/api/private/tariffTar/tariffTarUpdate/forceRun', (req, res) => {
    const context = "PATCH /api/private/tariffTar/tariffTarUpdate/forceRun";
    try {
        TariffsTARHandler.tariffTarUpdate()
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }

});
//========== GET ==========
//Get tariff TAR
router.get('/api/private/tariffTar', (req, res, next) => {
    var context = "GET /api/private/tariffTar";
    try {

        var query = {};
        if (req.query != undefined) {
            query = req.query;
            query.active = true
        }
        else {
            query = { active: true };
        };

        tariffTarFind(query)
            .then((tariffsTarFound) => {
                return res.status(200).send(tariffsTarFound);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete tariff TAR
router.delete('/api/private/tariffTar', (req, res, next) => {
    var context = "DELETE /api/private/tariffTar";
    try {

        var received = req.body;
        var query = {
            _id: received._id
        };

        TariffsTAR.removeTariffTAR(query, (err, result) => {

            if (err) {

                console.error(`[${context}][TariffsTAR.removeTariffTAR] Error `, err.message);
                return res.status(500).send(err.message);

            }
            else {

                if (result) {

                    tariffTarFind({})
                        .then((result) => {

                            return res.status(200).send(result);

                        })
                        .catch((error) => {

                            console.error(`[${context}][tariffTarFind] Error `, error.message);
                            return res.status(500).send(error.message);

                        });

                }
                else {

                    return res.status(400).send({ auth: false, code: 'server_TAR_not_deleted', message: "TAR not deleted" });

                };

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//========== FUNCTIONS ==========
function tariffTarFind(query) {
    var context = "Function tariffTarFind";
    return new Promise((resolve, reject) => {
        TariffsTAR.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function runFirstTime() {
    TARTariff.map(tarTariff => {
        var query = {
            tariffType: tarTariff.tariffType
        };
        var newValues = { $set: tarTariff }

        TariffsTAR.updateTariffTAR(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("Tariff tar updated");
            };
        });
    })
};

module.exports = router;