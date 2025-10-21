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

module.exports = {
    startJobMonthlyBilling: function (req, res) {
        let context = "Function startJobMonthlyBilling";
        return new Promise((resolve, reject) => {
            var timer = "*/30 * * * *";

            if (req.body.timer)
                timer = req.body.timer;

            initJobMonthlyBilling(timer).then(() => {

                taskMonthlyBilling.start();
                console.log("Check Monthly Billing Job Started")

                resolve("Check Monthly Billing Job Started");

            }).catch((e) => {
                console.error(`[${context}] Error`, e.message);
                reject(e);

            });

        });
    },
    stopJobMonthlyBilling: function (req, res) {
        let context = "Function stopJobMonthlyBilling";
        return new Promise((resolve, reject) => {
            try {

                taskMonthlyBilling.stop();
                console.log("Check  Monthly Billing Job Stopped")
                resolve('Check  Monthly Billing Job Stopped');

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    statusJobMonthlyBilling: function (req, res) {
        let context = "Function statusJobMonthlyBilling";
        return new Promise((resolve, reject) => {
            try {

                var status = "Stopped";
                if (taskMonthlyBilling != undefined) {
                    status = taskMonthlyBilling.status;
                }

                resolve({ "Check  Monthly Billing Job Status": status });

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
    forceJobMonthlyBilling: function (req, res) {
        let context = "Function forceJobMonthlyBilling";
        return new Promise((resolve, reject) => {
            try {

                monthlyBilling();

                console.log("Check  Monthly Billing Job was executed")
                resolve("Check  Monthly Billing Job was executed");

            } catch (error) {

                console.error(`[${context}] Error`, error.message);
                reject(error);

            };

        });
    },
}

//========== FUNCTION ==========

var taskMonthlyBilling = null;

/*initJobMonthlyBilling('30 2 8 * *')
    .then(() => {
        taskMonthlyBilling.start();
        console.log("Check Monthly Billing Job Started")
    })
    .catch(error => {
        console.log("Error starting check Monthly Billing  Job: " + error.message)
    });*/

function initJobMonthlyBilling(timer) {
    return new Promise((resolve, reject) => {

        taskMonthlyBilling = cron.schedule(timer, () => {
            console.log('Running Job Check Monthly Billing: ' + new Date().toISOString());


            monthlyBilling();
        }, {
            scheduled: false
        });

        resolve();

    });
};

//monthlyBilling()
async function monthlyBilling() {
    var context = "Function monthlyBilling";
    try {

        let host = process.env.IdentityHost + process.env.PathUsersMonthlyBilling;

        axios.get(host)
            .then((result) => {
                if (result.data.length > 0) {
                    //TODO
                } else {
                    console.log("No monthly billing")
                }

            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message);
            })


    } catch (error) {
        console.error(`[${context}][] Error `, error.message);
    };
};