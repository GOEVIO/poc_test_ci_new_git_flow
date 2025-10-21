require("dotenv-safe").load();
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
const moment = require('moment');
const PeriodPayment = require('../models/periodPayments')
const SessionEVIOHandler = require("../handlers/sessionEVIOHandler");
const SessionOCPIHandler = require("../handlers/sessionOCPIHandler");


module.exports = {
    startJobPeriodPayments: function (req, res) {
        let context = "Function startJobPeriodPayments";
        return new Promise((resolve, reject) => {
            //var timer = "*/30 * * * *";

            //Runs at 22:00 every day 5 of each month
            let timer = req.body.timer;

            if (timer in taskPeriodPayments) {

                let paymentPeriods = taskPeriodPayments[timer].paymentPeriods
                initJobPeriodBilling(timer, paymentPeriods).then(() => {

                    taskPeriodPayments[timer]["job"].start();
                    console.log("Check Period Payment Job Started " + timer)

                    resolve("Check Period Payment Job Started " + timer);

                }).catch((e) => {

                    console.error(`[${context}] Error`, e.message);
                    reject(e);

                });

            } else {
                resolve("No current job corresponding that timer")
            }


        });
    },
    stopJobPeriodPayments: function (req, res) {
        let context = "Function stopJobPeriodPayments";
        return new Promise((resolve, reject) => {
            try {

                let timer = req.body.timer
                if (!timer) {
                    reject({ message: "Missing job timer to stop job" })
                } else {
                    taskPeriodPayments[timer]["job"].stop();
                    console.log("Check Period Payment Job Stopped " + timer)
                    resolve('Check Period Payment Job Stopped ' + timer);
                }

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    statusJobPeriodPayments: function (req, res) {
        let context = "Function statusJobPeriodPayments";
        return new Promise((resolve, reject) => {
            try {

                let statusArray = []

                for (let timer in taskPeriodPayments) {
                    var status = "Stopped";
                    if (taskPeriodPayments[timer]["job"] != undefined) {
                        status = taskPeriodPayments[timer]["job"].status;
                    }
                    statusArray.push({ timer, status })
                }

                resolve({ "Check Period Payment Job Status": statusArray });

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    forceJobPeriodPayments: function (req, res) {
        let context = "Function forceJobPeriodPayments";
        return new Promise((resolve, reject) => {
            try {

                let paymentPeriods = req.body.paymentPeriods ? req.body.paymentPeriods : []
                checkPaymentsPeriodic(paymentPeriods);

                console.log("Period Payment Job was executed")
                resolve("Period Payment Job was executed");

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    createJobPeriodPayment: function (req, res) {
        let context = "Function createJobPeriodPayment";
        return new Promise(async (resolve, reject) => {
            try {

                let { timer, paymentPeriods } = req.body

                if (!timer && !paymentPeriods) {
                    reject({ message: "Missing timer and paymentPeriods key" })
                } else if (!paymentPeriods) {
                    reject({ message: "Missing paymentPeriods key" })
                } else if (!timer) {
                    reject({ message: "Missing timer key" })
                } else {

                    let found = await PeriodPayment.findOne({ timer })

                    if (!found) {

                        let newPeriodPayment = new PeriodPayment({ timer, paymentPeriods });
                        await PeriodPayment.create(newPeriodPayment);
                        resolve(newPeriodPayment);

                    } else {

                        resolve("Job already exist with that timer")

                    }
                }

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };
        });
    },

}

//========== FUNCTION ==========

var taskPeriodPayments = {}

//startPeriodPaymentJobs();

async function startPeriodPaymentJobs() {
    var context = "Function startPeriodPaymentJobs";
    try {

        let allPeriodPayments = await PeriodPayment.find({});

        if (allPeriodPayments.length > 0) {

            for (let periodPayment of allPeriodPayments) {

                let paymentPeriods = periodPayment.paymentPeriods;
                let timer = periodPayment.timer;


                taskPeriodPayments[timer] = { paymentPeriods };

                initJobPeriodPayments(timer, paymentPeriods)
                    .then((timer) => {

                        taskPeriodPayments[timer]["job"].start();
                        console.log("Check Period Payment Job Started " + timer);

                    })
                    .catch(error => {

                        console.log("Error starting check Period Payment Job: " + error.message);

                    });
            };

        };
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
    };

};

function initJobPeriodPayments(timer, paymentPeriods) {
    return new Promise((resolve, reject) => {

        taskPeriodPayments[timer]["job"] = cron.schedule(timer, () => {

            console.log('Running Job Check Period Payment: ' + new Date().toISOString());
            checkPaymentsPeriodic(paymentPeriods);

        }, {
            scheduled: false
        });

        resolve(timer);

    });
};


var paymentPeriods = ["WEEKLY", "BI_WEEKLY"];
var paymentPeriods1 = ["AD_HOC"];

//checkPaymentsPeriodic(paymentPeriods)
//checkPaymentsPeriodic(paymentPeriods1)

function checkPaymentsPeriodic(paymentPeriods) {
    var context = "Function checkPaymentsPeriodic";

    let host = process.env.IdentityHost + process.env.PathGetPeriodicPayments;
    let data = {
        paymentPeriod: paymentPeriods
    };

    axios.get(host, { data })
        .then((response) => {

            let listOfUsers = response.data;
            console.log("listOfUsers", listOfUsers);

            if (listOfUsers.length > 0) {
                let newListOfUsers;
                //console.log("paymentPeriods.length", paymentPeriods.length);
                paymentPeriods.forEach(period => {
                    switch (period) {
                        case "MONTHLY":

                            newListOfUsers = listOfUsers.filter(user => {
                                return user.paymentPeriod === "MONTHLY"
                            })

                            paymentPeriod(newListOfUsers, "MONTHLY");

                            break;
                        case "BI_WEEKLY":

                            newListOfUsers = listOfUsers.filter(user => {
                                return user.paymentPeriod === "BI_WEEKLY"
                            })

                            paymentPeriod(newListOfUsers, "BI_WEEKLY");

                            break;
                        default:

                            newListOfUsers = listOfUsers.filter(user => {
                                return user.paymentPeriod === "WEEKLY"
                            })

                            paymentPeriod(newListOfUsers, "WEEKLY");

                            break;
                    }
                });
            }

        })
        .catch((error) => {

            console.error(`[${context}] Error `, error.message);

        });

};

function paymentPeriod(listOfUsers, paymentPeriod) {
    var context = "Function paymentPeriod";
    try {

        let dateNow = new Date();
        //console.log("dateNow", dateNow);
        listOfUsers.forEach(async (user) => {

            let sessionsEVIO = await SessionEVIOHandler.getSessionsPeriodic(user._id, dateNow, paymentPeriod);
            let sessionsOCPI = await SessionOCPIHandler.getSessionsPeriodic(user._id, dateNow, paymentPeriod);

            let totalSessions = sessionsOCPI.concat(sessionsEVIO);

            if (totalSessions.length > 0) {
                createPayment(totalSessions, user._id, paymentPeriod)
            };

        })

    } catch (error) {

    };
};

function createPayment(totalSessions, userId, paymentPeriod) {
    var context = "Function createPayment";

    var host = process.env.HostPayments + process.env.PathCreatePaymentsPeriodic;

    var listOfSessionsMonthly = [];
    var listOfHwIdPeriodic = [];
    var price = {
        excl_vat: 0,
        incl_vat: 0
    };

    Promise.all(
        totalSessions.map(session => {

            return new Promise((resolve) => {

                let hwId = {
                    hwId: session.hwId,
                    chargerType: session.chargerType
                };

                let sessionPeriod = {
                    sessionId: session._id,
                    chargerType: session.chargerType
                };

                listOfSessionsMonthly.push(sessionPeriod);
                listOfHwIdPeriodic.push(hwId);

                price.excl_vat += session.totalPrice.excl_vat;
                price.incl_vat += session.totalPrice.incl_vat;

                resolve();

            });

        })
    ).then(() => {

        let data = {
            userId: userId,
            listOfSessionsMonthly: listOfSessionsMonthly,
            listOfHwIdPeriodic: listOfHwIdPeriodic,
            paymentType: paymentPeriod,
            totalPrice: price,
            amount: {
                currency: "EUR",
                value: price.incl_vat
            }
        };

        axios.post(host, data)
            .then((response) => {

                //console.log("response", response.data)
                console.log(`Sessions sent for payment`);

            })
            .catch((error) => {

                console.error(`[${context}] [${host}] Error `, error.message);

            });

    }).catch((error) => {

        console.error(`[${context}] Error `, error.message);

    });

};