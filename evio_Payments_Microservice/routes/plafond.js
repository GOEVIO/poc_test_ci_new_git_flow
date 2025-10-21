require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const Plafond = require('../models/plafond');
const Transactions = require('../models/transactions');
const Payments = require('../models/payments');
const axios = require("axios");
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
const { getCode, getName } = require('country-list');

let taskPlafond = null;
/*let plafonds = [
    {
        active: true,
        userIdWillPay: '5dcd7862b48b0d002c37e4e9',
        evId: '6166cc215d28f80020d7308c',
        ev: {
            brand: 'Mini',
            model: 'Cooper SE',
            imageContent: 'https://ev-database.org/img/auto/Mini_Electric/Mini_Electric-02@2x.jpg',
            licensePlate: 'cc-22-cc',
        },
        users: [],
        monthlyPlafond: {
            value: 150,
            currency: "EUR"
        },
        amount: {
            value: 150,
            currency: "EUR"
        },
        minimumChargingValue: 2.5,
        monthlyBalanceAddition: false,
        actionMinimumValue: 'NOTCHARGING'
    },
    {
        active: true,
        userIdWillPay: '5dcd7862b48b0d002c37e4e9',
        evId: '6166cc215d28f80020d7308c',
        ev: {
            brand: 'Mini',
            model: 'Cooper SE',
            imageContent: 'https://ev-database.org/img/auto/Mini_Electric/Mini_Electric-02@2x.jpg',
            licensePlate: 'cc-22-cc',
        },
        users: [],
        monthlyPlafond: {
            value: 150,
            currency: "EUR"
        },
        amount: {
            value: 150,
            currency: "EUR"
        },
        minimumChargingValue: 2.5,
        monthlyBalanceAddition: false,
        actionMinimumValue: 'NOTCHARGING'
    }
]*/

/*let plafondTransactionList = [
    {
        sessionId: '612fce95afbc8800120adc1b',
        chargerType: '004',
        source: 'MobiE',
        value: 12.52,
        currency: 'EUR',
        status: '40',
        notes: ''
    },
    {
        sessionId: '612fce95afbc8800120adc1b',
        chargerType: '004',
        source: 'MobiE',
        value: 73.12,
        currency: 'EUR',
        status: '40',
        notes: ''
    }
]*/

/*let evs = [
    {
        primaryEV: false,
        status: '10',
        hasFleet: true,
        usageNumber: 0,
        brand: 'Mini',
        model: 'Cooper SE',
        version: '',
        evType: 'car',
        imageContent: 'https://ev-database.org/img/auto/Mini_Electric/Mini_Electric-02@2x.jpg',
        fleet: '5ea054be3a9f9e002a9c3fc7',
        licensePlate: 'cc-22-cc',
        country: 'PT',
        otherInfo: '',
        sessions: [],
        listOfGroupDrivers: [],
        listOfDrivers: [],
        userId: '5dcd7862b48b0d002c37e4e9'
    },
    {
        primaryEV: false,
        status: '10',
        hasFleet: true,
        usageNumber: 0,
        brand: 'Mini',
        model: 'Cooper SE',
        version: '',
        evType: 'car',
        imageContent: 'https://ev-database.org/img/auto/Mini_Electric/Mini_Electric-02@2x.jpg',
        fleet: '5ea054be3a9f9e002a9c3fc7',
        licensePlate: 'cc-22-cc',
        country: 'PT',
        otherInfo: '',
        sessions: [],
        listOfGroupDrivers: [],
        listOfDrivers: [],
        userId: '5dcd7862b48b0d002c37e4e9'
    }
]


router.get('/api/private/plafond/evs', async (req, res, next) => {
    var context = "GET /api/private/plafond/evs";
    try {

        return res.status(200).send(evs);

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});*/

//========== POST ==========
//Create a ev plafond
router.post('/api/private/plafond', async (req, res, next) => {
    const context = "POST /api/private/plafond";
    try {

        let received = req.body;
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];

        let plafond = new Plafond(received);
        plafond.userId = userId
        plafond.clientName = clientName

        validatePlafondFields(plafond)
            .then(() => {

                plafondFindOne({ evId: plafond.evId, active: true })
                    .then((plafondFound) => {

                        if (plafondFound) {

                            return res.status(400).send({ auth: false, code: 'server_ev_already_have_plafond', message: "Ev already have a plafond assigned" });

                        } else {
                            plafond.amount = plafond.monthlyPlafond;

                            Plafond.createPlafond(plafond, (err, result) => {
                                if (err) {

                                    console.error(`[${context}] Error `, err.message);
                                    return res.status(500).send(err.message);

                                }
                                else {
                                    if (result) {

                                        //Atualizar o campo de plafond do ev
                                        addPlafondToEV(result)
                                            .then(() => {

                                                return res.status(200).send(result);

                                            })
                                            .catch((error) => {
                                                Plafond.removePlafond({ _id: result._id }, (err, response) => {
                                                    if (err) {
                                                        console.error(`[${context}] Error `, err.message);
                                                        return res.status(500).send(err.message);
                                                    } else {
                                                        if (error.response) {
                                                            return res.status(400).send(error.response.data);
                                                        } else {
                                                            console.error(`[${context}] Error `, error.message);
                                                            return res.status(500).send(error.message);
                                                        };

                                                    };
                                                });

                                            });

                                    }
                                    else {

                                        return res.status(400).send({ auth: false, code: 'server_plafond_not_created', message: "Plafond not created" });;

                                    }
                                }
                            });
                        }
                    })
                    .catch((error) => {
                        console.error(`[${context}] Error `, error.message);;
                        return res.status(500).send(error.message);

                    });


            })
            .catch((error) => {
                return res.status(400).send(error);
            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//Job Reset Plafond
router.post('/api/private/plafond/job/resetPlafond/startJob', (req, res) => {
    var context = "POST /api/private/resetPlafond/job/resetPlafond/startJob";
    var timer = "0 1 1 * *";

    if (req.body.timer)
        timer = req.body.timer;

    initResetPlafond(timer).then(() => {
        taskPlafond.start();
        console.log("Reset plafond Job Started")
        return res.status(200).send('Reset plafond Job Started');
    }).catch((e) => {
        return res.status(400).send(e);
    });

});

router.post('/api/private/plafond/job/resetPlafond/stopJob', (req, res) => {

    taskPlafond.stop();
    console.log("Reset plafond Job Stopped")
    return res.status(200).send('Reset plafond Job Stopped');

});

router.post('/api/private/plafond/job/resetPlafond/statusJob', (req, res) => {

    var status = "Stopped";
    if (taskPlafond != undefined) {
        status = taskPlafond.status;
    }

    return res.status(200).send({ "Reset plafond Job Status": status });
});

router.post('/api/private/plafond/job/resetPlafond/forceRun', (req, res) => {

    jobResetPlafond();

    console.log("Reset plafond Job Status was executed")
    return res.status(200).send("Reset plafond Job Status was executed");
});

router.post('/api/private/plafond/runFirstTime', async (req, res, next) => {
    var context = "POST /api/private/plafond/runFirstTime";
    try {
        updateAddressModel();

        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//========== PATCH ==========
//Edit an plafond
router.patch('/api/private/plafond', async (req, res, next) => {
    var context = "PATCH /api/private/plafond";
    try {

        var received = req.body;
        var userId = req.headers['userid'];

        var query = {
            _id: received.plafondId,
            userId: userId
        };

        if (!received.plafondId) {

            return res.status(400).send({ auth: false, code: 'server_plafondId_required', message: "Plafond Id is required." });

        };

        if (received.evId) {
            delete received.evId;
        };

        if (received.ev) {
            delete received.ev;
        };

        if (received.users) {
            delete received.users;
        };

        if (received.users) {
            delete received.groups;
        };


        Plafond.findOne(query, (err, plafondFound) => {
            if (err) {
                console.error(`[${context}][] Error `, err.message);;
                return res.status(500).send(err.message);
            };

            if (plafondFound) {

                getSessionsByEV(plafondFound.evId)
                    .then((response) => {

                        if (response) {

                            if (received.monthlyPlafond.value < plafondFound.monthlyPlafond.value) {

                                if (plafondFound.spentCurrentMonth.value < received.monthlyPlafond.value) {

                                    //received.amount.value = (received.monthlyPlafond.value - plafondFound.spentCurrentMonth.value);
                                    let amount = {
                                        value: (received.monthlyPlafond.value - plafondFound.spentCurrentMonth.value)
                                    };

                                    received.amount = amount;

                                    Plafond.findOneAndUpdate(query, { $set: received }, { new: true }, (err, newPlafond) => {

                                        if (err) {
                                            console.error(`[${context}][getSessionsByEV] Error `, err.message);;
                                            return res.status(500).send(err.message);
                                        };

                                        return res.status(200).send(newPlafond);

                                    });

                                } else {
                                    return res.status(400).send({ auth: false, code: 'server_monthlyPlafond_toLow', message: "Monthly Plafond value is to low." });
                                }

                            } else {

                                if (plafondFound.monthlyPlafond.value === plafondFound.amount.value) {

                                    received.amount = {
                                        value: received.monthlyPlafond.value,
                                        currency: received.monthlyPlafond.currency
                                    };

                                } else {
                                    received.amount = {
                                        value: (received.monthlyPlafond.value - plafondFound.spentCurrentMonth.value),
                                        currency: received.monthlyPlafond.currency
                                    };

                                }

                                Plafond.findOneAndUpdate(query, { $set: received }, { new: true }, (err, newPlafond) => {

                                    if (err) {
                                        console.error(`[${context}][getSessionsByEV] Error `, err.message);;
                                        return res.status(500).send(err.message);
                                    };

                                    return res.status(200).send(newPlafond);

                                });

                            };

                        } else {

                            return res.status(400).send({ auth: false, code: 'server_ev_sessions_update', message: "Cannot edit the plafond, ev in use." });

                        };

                    })
                    .catch((error) => {

                        console.error(`[${context}][getSessionsByEV] Error `, error.message);;
                        return res.status(500).send(error.message);

                    });


            } else {

                return res.status(400).send({ auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters." });

            };

        });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//Edit an ev
router.patch('/api/private/plafond/ev', async (req, res, next) => {
    var context = "PATCH /api/private/plafond/ev";
    try {
        let evId = req.body.evId;
        let ev = req.body.ev;

        let query = {
            evId: evId
        }

        let newValues = { $set: { ev: ev } };

        Plafond.updateMany(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(result);
            };
        });
    }
    catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//Update users
router.patch('/api/private/plafond/users', async (req, res, next) => {
    var context = "PATCH /api/private/plafond/users";
    try {

        let plafondId = req.body.plafondId;
        let users = req.body.users;

        if(!plafondId)
            return res.status(400).send({ auth: false, code: 'server_plafondId_required', message: "Plafond id is required" });

        if(!users)
            return res.status(400).send({ auth: false, code: 'server_users_required', message: "Users is required" });

        let query = {
            _id: plafondId
        }

        let newValues = { $set: { users: users } };

        await Plafond.updateMany(query, newValues)
                
        return res.status(200).send(result);

    }
    catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});


//========== PUT ============
//deprecated
/**
 * @deprecated Since version 2.2.0. Will be deleted in version 2.4.0. Use xxx instead.
 */
router.put('/api/private/plafond/changePlafondAmount', async (req, res, next) => {
    var context = "PUT /api/private/plafond/changeAmount";
    try {

        var received = req.body;

        if (!received._id) {
            var message = { auth: false, code: 'server_plafondId_required', message: "Plafond id is required" };
            return res.status(400).send(message);
        }

        var query = {
            _id: received._id
        };

        plafondFindOne(query)
            .then((plafondFound) => {
                if (plafondFound) {

                    //let plafond_amount = plafondFound.monthlyPlafond.value;
                    let current_amount = plafondFound.amount.value
                    let new_plafond_amount = received.monthlyPlafond.value

                    if (new_plafond_amount > current_amount) {

                        let updatePlafondAmount = {
                            $set: {
                                monthlyPlafond: {
                                    value: received.monthlyPlafond.value,
                                    currency: received.monthlyPlafond.currency,
                                }
                            }
                        }

                        console.log(updatePlafondAmount);

                        plafondUpdateOne(query, updatePlafondAmount)
                            .then((result) => {

                                if (result) {

                                    console.log(result);

                                    return res.status(200).send(result);

                                }
                                else {

                                    var message = { auth: false, code: 'server_plafond_not_updated', message: "Plafond not updated for given parameters" };
                                    return res.status(400).send(message);

                                }

                            })
                            .catch((error) => {

                                var message = { auth: false, code: 'server_plafond_not_updated', message: "Plafond could not be updated to given parameters" };
                                return res.status(400).send(message);

                            });

                    }
                    else {

                        var message = { auth: false, code: 'server_plafond_not_updated', message: "Plafond not found for given parameters" };
                        return res.status(400).send(message);

                    }

                }
                else {

                    var message = { auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters" };
                    return res.status(400).send(message);

                }

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);;
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//========== GET ============
//Get plafond by user
router.get('/api/private/plafond/byUser', async (req, res, next) => {
    var context = "GET /api/private/plafond/byUser";
    try {


        var userId = req.headers['userid'];

        var query = {
            userId: userId,
            active: true
        };

        plafondFind(query)
            .then((plafondFound) => {
                // if (plafondFound.leng) {
                if (plafondFound.length > 0) {

                    Promise.all(
                        plafondFound.map(plafond => {
                            return new Promise((resolve) => {

                                plafond.monthlyPlafond.value = parseFloat(plafond.monthlyPlafond.value.toFixed(2))
                                plafond.amount.value = parseFloat(plafond.amount.value.toFixed(2))
                                plafond.spentCurrentMonth.value = parseFloat(plafond.spentCurrentMonth.value.toFixed(2))
                                plafond.minimumChargingValue.value = parseFloat(plafond.minimumChargingValue.value.toFixed(2))

                                if (plafond.historyPlafondsValue.length > 0) {
                                    plafond.historyPlafondsValue.map(history => {
                                        history.monthlyPlafond.value = parseFloat(history.monthlyPlafond.value.toFixed(2));
                                        history.amount.value = parseFloat(history.amount.value.toFixed(2))
                                        history.spentCurrentMonth.value = parseFloat(history.spentCurrentMonth.value.toFixed(2))
                                    })
                                }

                                resolve();

                            });
                        })
                    ).then(() => {
                        return res.status(200).send(plafondFound);
                    })

                } else {
                    return res.status(200).send(plafondFound);
                }
                //return res.status(200).send(plafonds);
                /* }
                 else {
 
                     var message = { auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters" };
                     return res.status(400).send(message);
                     //return res.status(200).send(plafonds);
 
                 }*/
            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);;
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//Get plafond by id
router.get('/api/private/plafond/byId', async (req, res, next) => {
    var context = "GET /api/private/plafond/byId";
    try {

        var received = req.query;

        if (!received._id) {
            var message = { auth: false, code: 'server_plafondId_required', message: "Plafond id is required" };
            return res.status(400).send(message);
        }
        else {

            var query = {
                _id: received._id,
                active: true
            };

            plafondFindOne(query)
                .then((plafondFound) => {
                    if (plafondFound) {

                        return res.status(200).send(plafondFound);

                    }
                    else {

                        var message = { auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters" };
                        return res.status(400).send(message);

                    }
                })
                .catch((error) => {

                    console.error(`[${context}] Error `, error.message);;
                    return res.status(500).send(error.message);

                });

        }

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//Get plafond by EV
router.get('/api/private/plafond/byEv', async (req, res, next) => {
    var context = "GET /api/private/plafond/byEv";
    try {

        var received = req.query;

        if (!received.evId) {
            var message = { auth: false, code: 'server_evId_required', message: "EV id is required" };
            return res.status(400).send(message);
        }
        else {

            var query = {
                evId: received.evId,
                active: true
            };

            plafondFindOne(query)
                .then((plafondFound) => {
                    if (plafondFound) {

                        return res.status(200).send(plafondFound);

                    }
                    else {

                        var message = { auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters" };
                        return res.status(400).send(message);

                    }
                })
                .catch((error) => {

                    console.error(`[${context}] Error `, error.message);;
                    return res.status(500).send(error.message);

                });

        }

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/plafond/plafondToEV/:plafondId', async (req, res, next) => {
    var context = "GET /api/private/plafond/plafondToEV/:plafondId";
    try {

        var plafondId = req.params.plafondId;


        var query = {
            _id: plafondId,
            active: true
        };

        plafondFindOne(query)
            .then((plafondFound) => {

                return res.status(200).send(plafondFound);

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);;
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/plafond/plafondByEV/:evId', async (req, res, next) => {
    const context = "GET /api/private/plafond/plafondByEV/:evId";
    try {

        let evId = req.params.evId;

        let query = {
            evId: evId,
            active: true
        };

        plafondFindOne(query)
            .then((plafondFound) => {

                return res.status(200).send(plafondFound);

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);;
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//Get transactions on plafond by monthly
router.get('/api/private/plafond/ev/transactions', async (req, res, next) => {
    var context = "GET /api/private/plafond/ev/transactions";
    try {

        var received = req.query;

        var query = {
            _id: received.plafondId,
            active: true
        };
        plafondFindOne(query)
            .then((plafondFound) => {

                let response = {
                    amount: plafondFound.amount,
                    monthlyPlafond: plafondFound.monthlyPlafond,
                    spentCurrentMonth: plafondFound.spentCurrentMonth,
                    transactionsList: []
                };
                //console.log("plafondFound.transactionsList.length", plafondFound.transactionsList.length)

                if (plafondFound.transactionsList.length > 0) {
                    Promise.all(
                        plafondFound.transactionsList.map(transaction => {
                            return new Promise((resolve, reject) => {

                                let date = received.date.split('-');

                                let year = Number(date[0]);
                                let month = Number(date[1]);
                                let startYear;
                                let startMonth;
                                let endYear;
                                let endMonth;

                                if (month === 12) {

                                    startYear = year
                                    endYear = year + 1;
                                    startMonth = month;
                                    endMonth = "01";

                                } else {



                                    if (month < 10) {

                                        if (month === 9) {

                                            startYear = year
                                            endYear = year;
                                            startMonth = `0${month}`;
                                            endMonth = `${month + 1}`;

                                        } else {

                                            startYear = year
                                            endYear = year;
                                            startMonth = `0${month}`;
                                            endMonth = `0${month + 1}`;

                                        };

                                    } else {

                                        startYear = year
                                        endYear = year;
                                        startMonth = month;
                                        endMonth = month + 1;

                                    };

                                };

                                let startDate = new Date(`${startYear}-${startMonth}-01T00:00:00.000Z`);
                                let endDate = new Date(`${endYear}-${endMonth}-01T00:00:00.000Z`);

                                //console.log("startDate", startDate);
                                //console.log("endDate", endDate);

                                if (transaction.stopDate >= startDate && transaction.stopDate < endDate) {

                                    response.transactionsList.push(transaction);
                                    resolve(true);

                                } else {

                                    resolve(false);

                                };

                            })
                        })
                    ).then(() => {

                        return res.status(200).send(response);

                    }).catch((error) => {

                        console.error(`[${context}] Error `, error.message);;
                        return res.status(500).send(error.message);

                    });

                } else {

                    return res.status(200).send(response);

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);;
                return res.status(500).send(error.message);

            });


    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//========== DELETE =========
//Delete a plafond
router.delete('/api/private/plafond_old', async (req, res, next) => {
    var context = "DELETE /api/private/plafond";
    try {

        var received = req.query;

        if (!received._id) {

            var message = { auth: false, code: 'server_plafondId_required', message: "Plafond id is required" };
            return res.status(400).send(message);

        }
        else {

            var query = {
                _id: received._id
            };

            plafondFindOne(query)
                .then((plafondFound) => {
                    if (plafondFound) {

                        console.log(plafondFound);

                        if (plafondFound.monthlyPlafond.value >= plafondFound.amount.value) {

                            Plafond.removePlafond(query, (err, result) => {
                                if (err) {

                                    console.error(`[${context}] Error `, err.message);
                                    return res.status(500).send(err.message);

                                }
                                else {

                                    var message = { auth: true, code: "server_plafond_deleted", message: "Plafond deleted" };
                                    return res.status(200).send(message);

                                }
                            });

                        }
                        else {

                            var message = { auth: false, code: 'server_plafond_invalid_remove', message: "Plafond is not in a valid state to be removed" };
                            return res.status(400).send(message);

                        }

                    }
                    else {

                        var message = { auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters" };
                        return res.status(400).send(message);

                    }
                })
                .catch((error) => {

                    console.error(`[${context}] Error `, error.message);;
                    return res.status(500).send(error.message);

                });

        }

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

router.delete('/api/private/plafond', async (req, res, next) => {
    var context = "DELETE /api/private/plafond";
    try {

        var received = req.body;
        var userId = req.headers['userid'];

        if (!received.plafondId) {

            var message = { auth: false, code: 'server_plafondId_required', message: "Plafond id is required" };
            return res.status(400).send(message);

        };

        var query = {
            _id: received.plafondId,
            userId: userId
        };

        plafondFindOne(query)
            .then((plafondFound) => {
                if (plafondFound) {

                    getSessionsByEV(plafondFound.evId)
                        .then((response) => {

                            if (response) {

                                removePlafondFromEV(plafondFound.evId)
                                    .then((newResponse) => {

                                        if (newResponse) {

                                            if (plafondFound.transactionsList.length > 0 || plafondFound.pendingTransactionsList.length > 0) {

                                                Plafond.updatePlafond(query, { active: false }, (err, result) => {
                                                    if (err) {

                                                        console.error(`[${context}][getSessionsByEV] Error `, err.message);;
                                                        return res.status(500).send(err.message);

                                                    };

                                                    return res.status(200).send({ auth: false, code: 'server_plafond_delete', message: "Plafond successfully removed." });

                                                });

                                            } else {

                                                Plafond.removePlafond(query, (err, result) => {
                                                    if (err) {

                                                        console.error(`[${context}][getSessionsByEV] Error `, err.message);;
                                                        return res.status(500).send(err.message);

                                                    };

                                                    return res.status(200).send({ auth: false, code: 'server_plafond_delete', message: "Plafond successfully removed." });

                                                });

                                            };

                                        } else {

                                            return res.status(400).send({ auth: false, code: 'server_plafond_not_delete', message: "Plafond removed unsuccessfully." });

                                        };

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][removePlafondFromEV] Error `, error.message);;
                                        return res.status(500).send(error.message);

                                    });

                            } else {

                                return res.status(400).send({ auth: false, code: 'server_ev_sessions_delete', message: "Cannot remove the plafond, ev in use." });

                            };

                        })
                        .catch((error) => {

                            console.error(`[${context}][getSessionsByEV] Error `, error.message);;
                            return res.status(500).send(error.message);

                        });

                }
                else {

                    var message = { auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters" };
                    return res.status(400).send(message);

                }
            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);;
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

router.delete('/api/private/plafond/byEVId', async (req, res, next) => {
    var context = "DELETE /api/private/plafond/byEVId";
    try {

        var received = req.body;

        var query = {
            _id: received.evId
        };

        plafondFindOne(query)
            .then((plafondFound) => {
                if (plafondFound) {

                    if (plafondFound.transactionsList.length > 0 || plafondFound.pendingTransactionsList.length > 0) {

                        Plafond.updatePlafond(query, { active: false }, (err, result) => {
                            if (err) {

                                console.error(`[${context}][getSessionsByEV] Error `, err.message);;
                                return res.status(500).send(err.message);

                            };

                            return res.status(200).send({ auth: false, code: 'server_plafond_delete', message: "Plafond successfully removed." });

                        });

                    } else {

                        Plafond.removePlafond(query, (err, result) => {
                            if (err) {

                                console.error(`[${context}][getSessionsByEV] Error `, err.message);;
                                return res.status(500).send(err.message);

                            };

                            return res.status(200).send({ auth: false, code: 'server_plafond_delete', message: "Plafond successfully removed." });

                        });

                    };

                }
                else {

                    var message = { auth: false, code: 'server_plafond_not_found', message: "Plafond not found for given parameters" };
                    return res.status(400).send(message);

                }
            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);;
                return res.status(500).send(error.message);

            });

    } catch (error) {

        console.error(`[${context}] Error `, error.message);;
        return res.status(500).send(error.message);

    };
});

//========== FUNCTIONS =========
function validatePlafondFields(plafond) {
    return new Promise((resolve, reject) => {
        if (!plafond)
            reject({ auth: false, code: 'server_plafond_data_required', message: "Plafond data required" });
        /*else if (!plafond.userIdWillPay)
            reject({ auth: false, code: 'server_plafond_userIdWillPay_required', message: "Plafond userId will pay required" });*/
        else if (!plafond.evId)
            reject({ auth: false, code: 'server_plafond_evId_required', message: "Plafond EV id required" });
        else if (!plafond.ev)
            reject({ auth: false, code: 'server_plafond_ev_required', message: "Plafond EV data required" });
        else if (!plafond.monthlyPlafond.value)
            reject({ auth: false, code: 'server_plafond_monthly_value_required', message: "Plafond monthly value required" });
        else
            resolve(true);
    });
}

function plafondFindOne(query) {
    var context = "Function plafondFindOne";
    return new Promise((resolve, reject) => {

        Plafond.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });

    });
}

function plafondFind_old(query) {
    var context = "Function plafondFind";
    return new Promise((resolve, reject) => {

        Plafond.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });

    });
}

function plafondFind(query) {
    var context = "Function plafondFind";
    return new Promise((resolve, reject) => {

        let pipeline = [
            {
                "$match": query
            },
            {
                "$project": {
                    "_id": 1,
                    "active": 1,
                    "userId": 1,
                    "userIdWillPay": 1,
                    "evId": 1,
                    "ev": 1,
                    "users": 1,
                    "groups": 1,
                    "monthlyPlafond.currency": 1,
                    "amount.currency": 1,
                    "spentCurrentMonth.currency": 1,
                    "minimumChargingValue.currency": 1,
                    "monthlyPlafond.value": { $round: ["$monthlyPlafond.value", 2] },
                    "amount.value": { $round: ["$amount.value", 2] },
                    "spentCurrentMonth.value": { $round: ["$spentCurrentMonth.value", 2] },
                    "minimumChargingValue.value": { $round: ["$minimumChargingValue.value", 2] },
                    "transactionsList": 1,
                    "monthlyBalanceAddition": 1,
                    "includingInternalCharging": 1,
                    "actionMinimumValue": 1,
                    "pendingTransactionsList": 1,
                    "historyPlafondsValue": 1
                }
            }
        ];


        Plafond.aggregate(pipeline, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });

    });
}

function plafondUpdateOne(query, newValues) {
    var context = "Function plafondUpdateOne";
    return new Promise((resolve, reject) => {

        Plafond.updatePlafond(query, newValues, (err, result) => {

            if (err) {
                console.error(`[${context}][plafondUpdateOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            }

        });

    });
}

function addPlafondToEV(plafond) {
    var context = "Function addPlafondToEV";
    return new Promise((resolve, reject) => {

        let data = {

            plafondId: plafond._id,
            evId: plafond.evId

        };

        let host = process.env.EVsHost + process.env.PathAddPlafondEV;

        axios.patch(host, data)
            .then((result) => {
                resolve(true);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });

    });
};

function removePlafondFromEV(evId) {
    var context = "Function removePlafondFromEV";
    return new Promise(async (resolve, reject) => {

        let data = {

            evId: evId

        };

        let host = process.env.EVsHost + process.env.PathRemocePlafondFromEV;
        axios.patch(host, data)
            .then((result) => {
                resolve(true);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });

    });
};

function getSessionsByEV(evId) {
    var context = "Function getSessionsByEV";
    return new Promise(async (resolve, reject) => {

        let sessionsEVIO = await getActiveSessionEVIOByEV(evId);
        let sessionsOCPI = await getActiveSessionOCPIByEV(evId);

        let sessions = sessionsEVIO.concat(sessionsOCPI);

        if (sessions.length === 0) {
            resolve(true)
        } else {
            resolve(false);
        };

    });
};

function getActiveSessionEVIOByEV(evId) {
    var context = "Function getActiveSessionEVIOByEV";
    return new Promise(async (resolve, reject) => {

        let host = process.env.HostCharger + process.env.PathActiveSessionsByEV + '/' + evId;
        axios.get(host)
            .then((result) => {
                resolve(result.data);
            })
            .catch(error => {
                console.error(`[${context}] Error `, error.message);
                resolve([]);
            })
    });
};

function getActiveSessionOCPIByEV(evId) {
    var context = "Function getActiveSessionOCPIByEV";
    return new Promise(async (resolve, reject) => {

        let host = process.env.HostOcpi + process.env.PathActiveSessionsByEV + '/' + evId;
        axios.get(host)
            .then((result) => {
                resolve(result.data);
            })
            .catch(error => {
                console.error(`[${context}] Error `, error.message);
                resolve([]);
            })
    });
};

//jobResetPlafond()
initResetPlafond('0 1 1 * *')
    .then(() => {
        taskPlafond.start();
        console.log("Reset Plafond Job Started")
    })
    .catch(error => {
        console.log("Error starting reset plafond Job: " + error.message)
    });

function initResetPlafond(timer) {
    return new Promise((resolve, reject) => {

        taskPlafond = cron.schedule(timer, () => {
            console.log('Running Job reset plafond: ' + new Date().toISOString());


            jobResetPlafond();

        }, {
            scheduled: false
        });

        resolve();

    });
};

//jobResetPlafond()
function jobResetPlafond() {
    const context = "Function jobResetPlafond";

    Plafond.find({}, (err, plafondsFound) => {

        if (err) {
            console.error(`[${context}] Error `, err.message);
        };


        if (plafondsFound.length > 0) {


            let dateNow = new Date();
            let dayLater = new Date(dateNow);
            dayLater.setDate(dateNow.getDate() - 28)
            let month = dayLater.getMonth() + 1;
            let year = dayLater.getFullYear();

            plafondsFound.map(plafond => {

                let newValues;
                let listTransactions = [];
                let totalMonth = 0;
                
                let historyPlafondsValue = {
                    dateSaves: dateNow,
                    monthlyPlafond: {
                        value: parseFloat(plafond.monthlyPlafond.value.toFixed(2)),
                        currency: plafond.monthlyPlafond.currency
                    },
                    amount: {
                        value: parseFloat(plafond.amount.value.toFixed(2)),
                        currency: plafond.amount.currency
                    },
                    spentCurrentMonth: {
                        value: parseFloat(plafond.spentCurrentMonth.value.toFixed(2)),
                        currency: plafond.spentCurrentMonth.currency
                    },
                    month: month,
                    year: year
                };

                plafond.historyPlafondsValue.push(historyPlafondsValue)

                if (plafond.monthlyBalanceAddition) {

                    if (plafond.pendingTransactionsList.length > 0) {

                        Promise.all(
                            plafond.pendingTransactionsList.map(transaction => {
                                return new Promise(async (resolve, reject) => {
                                    totalMonth += transaction.amount.value;
                                    let transactionUpdated = await transactionsUpdateFilter({ _id: transaction.transactionId }, { $set: { status: process.env.TransactionStatusPaidOut } });
                                    let paymentUpdated = await paymentUpdateFilter({ _id: transaction.paymentId }, { $set: { status: process.env.PaymentStatusPaidOut } });
                                    transaction.status = process.env.TransactionStatusPaidOut;
                                    listTransactions.push(transaction);
                                    resolve(true);
                                });
                            })
                        ).then(() => {

                            //console.log("totalMonth", totalMonth);
                            //console.log("listTransactions", listTransactions);
                            //console.log("plafond", plafond.transactionsList);

                            plafond.transactionsList = plafond.transactionsList.concat(listTransactions);
                            //console.log("plafond 1", plafond.transactionsList);

                            newValues = {
                                transactionsList: plafond.transactionsList,
                                pendingTransactionsList: [],
                                amount: {
                                    value: ((plafond.monthlyPlafond.value + plafond.amount.value) - totalMonth),
                                    currency: "EUR"
                                },
                                spentCurrentMonth: {
                                    value: totalMonth,
                                    currency: "EUR"
                                },
                                historyPlafondsValue: plafond.historyPlafondsValue,
                                extraSessionTaken: false
                            };

                            //console.log("newValues", newValues);

                            Plafond.findOneAndUpdate({ _id: plafond._id }, { $set: newValues }, { new: true }, (err, plafoundUpdated) => {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                };

                                if (plafoundUpdated) {
                                    console.log("Plafond updated")
                                } else {
                                    console.log("Plafond not updated")
                                };

                            });

                        }).catch(error => {
                            console.error(`[${context}] Error `, error.message);
                        });
                    } else {



                        newValues = {
                            amount: {
                                value: (plafond.monthlyPlafond.value + plafond.amount.value),
                                currency: "EUR"
                            },
                            spentCurrentMonth: {
                                value: 0,
                                currency: "EUR"
                            },
                            historyPlafondsValue: plafond.historyPlafondsValue,
                            extraSessionTaken: false
                        };

                        //console.log("newValues", newValues);

                        Plafond.findOneAndUpdate({ _id: plafond._id }, { $set: newValues }, { new: true }, (err, plafoundUpdated) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                            };

                            if (plafoundUpdated) {
                                console.log("Plafond updated")
                            } else {
                                console.log("Plafond not updated")
                            };

                        });
                    };

                } else {

                    if (plafond.pendingTransactionsList.length > 0) {


                        Promise.all(
                            plafond.pendingTransactionsList.map(transaction => {
                                return new Promise(async (resolve, reject) => {
                                    totalMonth += transaction.amount.value;
                                    let transactionUpdated = await transactionsUpdateFilter({ _id: transaction.transactionId }, { $set: { status: process.env.TransactionStatusPaidOut } });
                                    let paymentUpdated = await paymentUpdateFilter({ _id: transaction.paymentId }, { $set: { status: process.env.PaymentStatusPaidOut } });
                                    transaction.status = process.env.TransactionStatusPaidOut;
                                    listTransactions.push(transaction);
                                    resolve(true);
                                });
                            })
                        ).then(() => {

                            //console.log("totalMonth", totalMonth);
                            //console.log("listTransactions", listTransactions);
                            //console.log("plafond", plafond.transactionsList);

                            plafond.transactionsList = plafond.transactionsList.concat(listTransactions);
                            //console.log("plafond 1", plafond.transactionsList);

                            newValues = {
                                transactionsList: plafond.transactionsList,
                                pendingTransactionsList: [],
                                amount: {
                                    value: (plafond.monthlyPlafond.value - totalMonth),
                                    currency: "EUR"
                                },
                                spentCurrentMonth: {
                                    value: totalMonth,
                                    currency: "EUR"
                                },
                                historyPlafondsValue: plafond.historyPlafondsValue,
                                extraSessionTaken: false
                            };

                            //console.log("newValues", newValues);

                            Plafond.findOneAndUpdate({ _id: plafond._id }, { $set: newValues }, { new: true }, (err, plafoundUpdated) => {
                                if (err) {
                                    console.error(`[${context}] Error `, err.message);
                                };

                                if (plafoundUpdated) {
                                    console.log("Plafond updated")
                                } else {
                                    console.log("Plafond not updated")
                                };

                            });

                        }).catch(error => {
                            console.error(`[${context}] Error `, error.message);
                        });

                    } else {

                        newValues = {
                            amount: {
                                value: plafond.monthlyPlafond.value,
                                currency: "EUR"
                            },
                            spentCurrentMonth: {
                                value: 0,
                                currency: "EUR"
                            },
                            historyPlafondsValue: plafond.historyPlafondsValue,
                            extraSessionTaken: false
                        };

                        //console.log("newValues", newValues);

                        Plafond.findOneAndUpdate({ _id: plafond._id }, { $set: newValues }, { new: true }, (err, plafoundUpdated) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                            };

                            if (plafoundUpdated) {
                                console.log("Plafond updated")
                            } else {
                                console.log("Plafond not updated")
                            };

                        });
                    };

                };

            });

        };

    });

};

function transactionsUpdateFilter(query, newValues) {
    var context = "Function transactionsUpdateFilter";
    return new Promise((resolve, reject) => {

        Transactions.findOneAndUpdate(query, newValues, { new: true }, (err, result) => {

            if (err) {
                console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };

        });

    });
};

function paymentUpdateFilter(query, newValues) {
    var context = "Function paymentUpdateFilter";
    return new Promise((resolve, reject) => {
        Payments.findOneAndUpdate(query, newValues, { new: true }, (err, result) => {
            if (err) {
                console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await Plafond.updateMany({ 'pendingTransactionsList.charger.address': { '$exists': true } }, [{ $set: { 'pendingTransactionsList.charger.street': "$pendingTransactionsList.charger.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result pendingTransactionsList.charger.address to pendingTransactionsList.charger.street: ", result);
            };
        })

        await Plafond.updateMany({ 'pendingTransactionsList.charger.postCode': { '$exists': true } }, [{ $set: { 'pendingTransactionsList.charger.zipCode': "$pendingTransactionsList.charger.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result pendingTransactionsList.charger.postCode to pendingTransactionsList.charger.zipCode: ", result);
            };
        })

        let plafonds = await Plafond.find({ 'pendingTransactionsList.charger.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != plafonds.length; i++) {
            if (plafonds[i].address)
                if (plafonds[i].address.country)
                    if (unicCountries.indexOf(plafonds[i].address.country) == -1) {
                        unicCountries.push(plafonds[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        console.log("coutryCodes")
        console.log(coutryCodes)

        console.log("unicCountries")
        console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await Plafond.updateMany({ 'pendingTransactionsList.charger.country': unicCountries[i] }, [{ $set: { 'pendingTransactionsList.charger.countryCode': coutryCodes[i] } }], (err, result) => {
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