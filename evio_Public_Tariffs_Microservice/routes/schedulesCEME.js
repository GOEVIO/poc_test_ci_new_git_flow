const express = require('express');
const router = express.Router();
const axios = require("axios");
var SchedulesCEME = require('../models/schedulesCEME');
var CEMESchedules = require('../models/schedulesCEME.json')
require("dotenv-safe").load();


//========== POST ==========
//Endpoit to create a new SchedulesCEME
router.post('/api/private/schedulesCEME', async (req, res, next) => {
    var context = "POST /api/private/schedulesCEME";
    try {
        var schedulesCEME = new SchedulesCEME(req.body);
        createSchedulesCEME(schedulesCEME)
            .then((result) => {
                if (result)
                    return res.status(200).send(result);
                else
                    return res.status(400).send({ auth: false, code: 'server_schedules_CEME_not_created', message: "Schedules CEME not created" });
            })
            .catch((error) => {
                console.error(`[${context}][createSchedulesCEME] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/schedulesCEME/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/schedulesCEME/runFirstTime";
    try {

        runFirstTime();
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Edit a Schedules CEME
router.patch('/api/private/schedulesCEME', (req, res, next) => {
    var context = "PATCH /api/private/schedulesCEME";
    try {
        var received = req.body;

        if (received._id === undefined) {
            return res.status(400).send({ auth: false, code: 'server_schedules_CEME_id_required', message: "Schedules CEME id required" });
        }
        else {
            var query = {
                _id: received._id
            };
            var newValue = { $set: received };
            schedulesCEMEUpdate(query, newValue)
                .then((result) => {
                    if (result) {
                        return res.status(200).send(result);
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][schedulesCEMEUpdate] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete a Schedules CEME
router.delete('/api/private/schedulesCEME', (req, res, next) => {
    var context = "DELETE /api/private/schedulesCEME";
    try {
        var received = req.body;
        if (received._id === undefined) {
            return res.status(400).send({ auth: false, code: 'server_schedules_CEME_id_required', message: "Schedules CEME id required" });
        }
        else {
            var query = {
                _id: received._id
            };
            SchedulesCEME.removeSchedulesCEME(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][removeSchedulesCEME] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result) {
                        return res.status(200).send({ auth: true, code: 'server_schedules_CEME_removed', message: "Schedules CEME successfully removed" });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_schedules_CEME_not_removed', message: "Schedules CEME unsuccessfully removed" });
                    };
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get a Schedules CEME
router.get('/api/private/schedulesCEME', (req, res, next) => {
    var context = "GET /api/private/schedulesCEME";
    try {
        var query = req.query;
        schedulesCEMEFind(query)
            .then((schedulesFound) => {
                return res.status(200).send(schedulesFound);
            })
            .catch((error) => {
                console.error(`[${context}][schedulesCEMEFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTIONS ==========
function createSchedulesCEME(schedulesCEME) {
    var context = "Function createSchedulesCEME";
    return new Promise((resolve, reject) => {
        SchedulesCEME.createSchedulesCEME(schedulesCEME, (err, result) => {
            if (err) {
                console.error(`[${context}][createSchedulesCEME] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function schedulesCEMEUpdate(query, newValue) {
    var context = "Function schedulesCEMEUpdate";
    return new Promise((resolve, reject) => {
        SchedulesCEME.updateSchedulesCEME(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}][updateSchedulesCEME] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        })
    });
};

function schedulesCEMEFind(query) {
    var context = "Function schedulesCEMEFind";
    return new Promise((resolve, reject) => {
        SchedulesCEME.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][SchedulesCEME.find] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function runFirstTime() {
    CEMESchedules.map(CEME => {

        let query = {
            country: CEME.country,
            tariffType: CEME.tariffType,
            cycleType: CEME.cycleType
        };

        let newValues = { $set: CEME };

        SchedulesCEME.updateSchedulesCEME(query, newValues, (err, result) => {
            if (err) {
                console.error(`[] Error `, err.message);

            }
            else {
                console.log("Schedule Updated");
            };
        });

    });
};

module.exports = router;