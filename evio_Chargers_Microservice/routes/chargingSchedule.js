const express = require('express');
const router = express.Router();
const ChargingSchedule = require('../models/chargingSchedule');
const Charger = require('../models/charger');
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const axios = require("axios");
const { getCode, getName } = require('country-list');

//========== POST ==========
//Create Charging Schedule
router.post('/api/private/chargingSchedule', (req, res, next) => {
    var context = "POST /api/private/chargingSchedule";
    try {

        const chargingSchedule = new ChargingSchedule(req.body);
        var createUser = req.headers['userid'];
        chargingSchedule.userId = createUser;

        validateFields(chargingSchedule, res);

        ChargingSchedule.createChargingSchedule(chargingSchedule, (err, result) => {
            if (err) {
                console.error(`[${context}][createChargingSchedule] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {
                    return res.status(200).send({ auth: true, code: 'server_schedule_created', message: "Schedule created" });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_schedule', message: "Schedule not created" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/chargingSchedule/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/chargingSchedule/runFirstTime";
    try {

        updateAddressModel();
        
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Job Charging Schedule
router.post('/api/private/chargingSchedule/job/chargingSchedule/startJob', (req, res) => {
    var context = "POST /api/private/chargingSchedule/job/chargingSchedule/startJob";
    var timer = "*/1 * * * *";

    if (req.body.timer)
        timer = req.body.timer;

    initChargingSchedule(timer).then(() => {

        taskChargingSchedule.start();
        console.log("Charging Schedule Job Started")
        return res.status(200).send('Charging Schedule Job Started');

    }).catch((e) => {

        return res.status(400).send(e);

    });

});

router.post('/api/private/chargingSchedule/job/chargingSchedule/stopJob', (req, res) => {
    var context = "POST /api/private/chargingSchedule/job/chargingSchedule/stopJob";

    taskChargingSchedule.stop();
    console.log("Charging Schedule Job  Stopped")
    return res.status(200).send('Charging Schedule Job  Stopped');

});

router.post('/api/private/chargingSchedule/job/chargingSchedule/statusJob', (req, res) => {
    var context = "POST /api/private/chargingSchedule/job/chargingSchedule/statusJob";

    var status = "Stopped";
    if (taskChargingSchedule != undefined) {
        status = taskChargingSchedule.status;
    }

    return res.status(200).send({ "Charging Schedule Job  Status": status });

});

router.post('/api/private/chargingSchedule/job/chargingSchedule/forceRun', (req, res) => {
    var context = "POST /api/private/chargingSchedule/job/chargingSchedule/forceRun";

    chargingSchedule();

    console.log("Charging Schedule Job was executed")
    return res.status(200).send("Charging Schedule Job was executed");

});

//========== GET ==========
//Get all schedules of a particular user by userId
router.get('/api/private/chargingSchedule', (req, res, next) => {
    var context = "GET /api/private/chargingSchedule";
    try {

        var userId = req.headers['userid'];

        var query = {
            userId: userId
        };

        ChargingSchedule.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (Object.keys(result).length != 0) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_no_schedules_user', message: "No schedules for the user" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========
//Update or change a schedule by id of schedule
router.put('/api/private/chargingSchedule', (req, res, next) => {
    var context = "PUT /api/private/chargingSchedule";
    try {
        var userId = req.headers['userid'];
        var schedule = req.body;
        schedule.userId = userId;
        if (!schedule._id) {
            //throw new Error("Schedule data is required");
        };
        validateFields(schedule, res);

        var query = {
            _id: schedule._id
        };

        ChargingSchedule.updateChargingSchedule(query, schedule, (err, result) => {
            if (err) {
                console.error(`[${context}][updateChargingSchedule] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {
                    return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                }
                else {
                    return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete schedules by id of schedule
router.delete('/api/private/chargingSchedule', (req, res, next) => {
    var context = "DELETE /api/private/chargingSchedule";
    try {

        var userId = req.headers['userid'];
        var schedules = req.body;

        if (schedules._id === undefined) {
            var query = {
                userId: userId
            };
        }
        else {
            var query = schedules;
        };

        ChargingSchedule.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (Object.keys(result).length != 0) {

                    var toDeleteSchedules = [];
                    var inUseSchedules = [];

                    const schedulesDelete = (schedule) => {
                        return new Promise((resolve, reject) => {

                            var date = new Date();

                            if (schedule.scheduleStartDate <= date && schedule.scheduleStopDate >= date) {
                                inUseSchedules.push(schedule._id);
                                resolve(true);
                            }
                            else {
                                toDeleteSchedules.push(schedule._id);
                                resolve(true);
                            };
                        });
                    };
                    Promise.all(
                        result.map(schedule => schedulesDelete(schedule))
                    )
                        .then((value) => {
                            var params = {
                                _id: toDeleteSchedules
                            };
                            ChargingSchedule.removeChargingSchedule(params, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][removeChargingSchedule] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    if (result) {
                                        if (inUseSchedules.length !== 0) {
                                            return res.status(200).send({ auth: true, code: 'server_schedules_use', message: "Some schedules have not been deleted because they are in use." });
                                        }
                                        else {
                                            return res.status(200).send({ auth: true, code: 'server_successfully_deleted', message: "Schedules successfully deleted." });
                                        };
                                    }
                                    else {
                                        return res.status(400).send({ auth: false, code: 'server_unsuccessfully_deleted', message: "Schedules unsuccessfully deleted." });
                                    };
                                };
                            });
                        })
                        .catch((error) => {
                            console.error(`[${context}][schedulesDelete][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_schedules_not_found', message: "Schedules not found for given parameters" })
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== job to check if there is any schedule ==========

var taskChargingSchedule = null;

initChargingSchedule('*/1 * * * *')
    .then(() => {
        taskChargingSchedule.start();
        console.log("Charging Schedule Job Started")
    })
    .catch(error => {
        console.log("Error starting charging schedule Job: " + error.message)
    });

/*cron.schedule('*//*1 * * * *', () => {
    chargingSchedule()
});*/

function initChargingSchedule(timer) {
    return new Promise((resolve, reject) => {

        taskChargingSchedule = cron.schedule(timer, () => {
            console.log('Running Job Charging Schedule: ' + new Date().toISOString());

            chargingSchedule();

        }, {

            scheduled: false

        });

        resolve();

    });
};

function validateFields(schedule, res) {
    if (!schedule) {
        return res.status(400).send({ auth: false, code: 'server_schedule_data_required', message: "Schedule data is required" });
        //throw new Error("Schedule data is required");
    };
    if (!schedule.hwId) {
        return res.status(400).send({ auth: false, code: 'server_hwid_required', message: "Hardware Id is required" });
        //throw new Error("Hardware Id is required");
    };
    if (!schedule.plugId) {
        return res.status(400).send({ auth: false, code: 'server_plug_id_required', message: "Plug Id is required" });
        //throw new Error("Plug Id is required");
    };
    if (!schedule.evId) {
        return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Electric vehicle Id is required" });
        //throw new Error("Electric vehicle Id is required");
    };
    if (!schedule.scheduleStartDate) {
        return res.status(400).send({ auth: false, code: 'server_start_date_required', message: "Start date is required" });
        //throw new Error("Start date is required");
    };
    if (!schedule.scheduleStopDate) {
        return res.status(400).send({ auth: false, code: 'server_stop_date_required', message: "Stop date is required" });
        //throw new Error("Stop date is required");
    };
};

function chargingSchedule() {
    const context = "Funciton chargingSchedule";
    const host = process.env.HostConnectioStation + process.env.PathConnectioStation;

    //Query to verify if there is any charging to Stop
    let dateNow = new Date();

    let year = dateNow.getFullYear();
    let month = dateNow.getMonth();
    let day = dateNow.getDate();
    let hour = dateNow.getHours();
    let minutes = dateNow.getMinutes();

    if (day < 10) {
        day = "0" + day
    }

    if (month + 1 < 10) {
        month += 1
        month = "0" + month
    }

    if (hour < 10) {
        hour = "0" + hour
    }

    if (minutes < 10) {
        minutes = "0" + minutes
    }

    let startDate = `${year}-${month}-${day}T${hour}:${minutes}:00.000Z`
    let endDate = `${year}-${month}-${day}T${hour}:${minutes}:59.000Z`

    // console.log("startDate", startDate);
    // console.log("endDate", endDate);

    let query = {

        $and: [

            { scheduleStopDate: { $gte: Date(startDate) } },
            { scheduleStopDate: { $lte: Date(endDate) } }

        ]

    };

    ChargingSchedule.find(query, (err, result) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
            //return res.status(500).send(err.message);
        }
        else {

            // console.log("Stop", result.length);

            if (result.length > 0) {

                const stopCharging = (toStop) => {
                    return new Promise((resolve, reject) => {
                        let body = {
                            chargerId: toStop.hwId,
                            plugId: toStop.plugId,
                            evId: toStop.evId,
                            userId: toStop.userId,
                            sessionPrice: "0",
                            action: process.env.ActionStop,
                            chargerType: toStop.chargerType
                        };

                        axios.post(host, body)
                            .then((result) => {
                                resolve(result.data);
                            }).catch((error) => {
                                console.error(`[${context}][stopCharging] Error `, error.message);
                                reject(error);
                            });
                    });
                };

                Promise.all(
                    result.map(toStop => stopCharging(toStop))
                ).then((result) => {
                    console.log("Result to Stop");
                }).catch((error) => {
                    console.log("Error to Stop", error.message);
                });
            }
            else {
                console.log("No charging schedules to stop.");
            };
        };
    });

    //Query to verify if there is any charging to Start
    query = {

        $and: [

            { scheduleStartDate: { $gte: Date(startDate) } },
            { scheduleStartDate: { $lte: Date(endDate) } }

        ]

    };

    ChargingSchedule.find(query, (err, result) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
            //return res.status(500).send(err.message);
        }
        else {

            // console.log("Start", result.length);

            if (result.length > 0) {

                const startCharging = (toStart) => {
                    return new Promise((resolve, reject) => {


                        let body = {

                            chargerId: toStart.hwId,
                            plugId: toStart.plugId,
                            evId: toStart.evId,
                            userId: toStart.userId,
                            action: process.env.ActionStart,
                            idTag: toStart.idTag,
                            tariffId: toStart.tariffId,
                            fees: toStart.fees,
                            chargerType: toStart.chargerType,
                            address: toStart.address,

                        };

                        axios.post(host, body)
                            .then((result) => {
                                resolve(result.data);
                            }).catch((error) => {
                                console.error(`[${context}][startCharging] Error `, error.message);
                                reject(error);
                            });

                    });
                };

                Promise.all(
                    result.map(toStart => startCharging(toStart))
                ).then((result) => {
                    console.log("Result to Start");
                }).catch((error) => {
                    console.log("Error to Start", error.message);
                });
            }
            else {
                console.log("No charging schedules to start.")
            };
        };
    });
};

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await ChargingSchedule.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ");
            };
        })

        await ChargingSchedule.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ");
            };
        })

        let chargingSchedules = await ChargingSchedule.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != chargingSchedules.length; i++) {
            if (chargingSchedules[i].address)
                if (chargingSchedules[i].address.country)
                    if (unicCountries.indexOf(chargingSchedules[i].address.country) == -1) {
                        unicCountries.push(chargingSchedules[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        // console.log("coutryCodes")
        // console.log(coutryCodes)

        // console.log("unicCountries")
        // console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await ChargingSchedule.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

module.exports = router;