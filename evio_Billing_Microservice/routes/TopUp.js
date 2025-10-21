const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
var moment = require('moment');
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

const TopUp = require('../models/TopUp');
const Utils = require('../utils/Utils');

var identityProxy = 'http://identity:3003';
const billingProfileProxy = `${identityProxy}/api/private/billingProfile`;

router.post('/api/private/createTopUpEmail', async (req, res, next) => {
    var context = "POST /api/private/createTopUpEmail";
    try {

        if (!req.body.headers) {
            console.log("req.body.headers", req.body.headers)
            return res.status(400).send({ code: 'headers_missing', message: "Headers missing" });
        }

        if (!req.body.headers.userId) {
            console.log("req.body.headers.userId", req.body.headers.userId)
            return res.status(400).send({ code: 'userId_missing', message: "UserId missing" });
        }

        if (!req.body.payment) {
            console.log("req.body.payment", req.body.payment)
            return res.status(400).send({ code: 'payment_missing', message: "Payment value missing" });
        }

        let topup = {
            transactionId: req.body.transactionId,
            payment: req.body.payment,
            currency: req.body.currency,
            userId: req.body.headers.userId,
            clientName: req.body.headers.clientName,
            type: "topup",
            status: '20'
        }

        let topUpFOund = await TopUp.findOne({ transactionId: topup.transactionId })

        if (topUpFOund) {
            console.log("topUpFOund", topUpFOund)
            return res.status(200).send({ code: 'top_up_creation_success', message: "Top Up invoice created with success" });
        } else {
            console.log("topup", topup)
            createTopUp(topup)
                .then((result) => {

                    if (result) {
                        console.log("Top Up invoice created with success");
                        return res.status(200).send({ code: 'top_up_creation_success', message: "Top Up invoice created with success" });
                    }
                    else {
                        console.log("Top Up invoice creation failed");
                        return res.status(200).send({ code: 'top_up_creation_failed', message: "Top Up invoice creation failed" });
                    }

                }).catch((error) => {
                    console.error(`[${context}][.then][find] Error `, error.message);
                    return res.status(400).send({ auth: false, code: 'create_invoice_failed', message: "Failed to create invoice" });
                });
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

function createTopUp(newInvoice) {
    var context = "FUNCTION createInvoice";
    return new Promise((resolve, reject) => {

        let invoice = new TopUp(newInvoice);

        TopUp.createTopUp(invoice, (error, result) => {
            if (error) {
                console.log(`[${context}][createTopUp] Error `, error.message);
                reject(error);
            }
            else {
                if (result) {
                    console.log(`[${context}][createTopUp] Success`);
                    resolve(true);
                }
                else {
                    console.log(`[${context}][createTopUp] Error`);
                    reject(`[${context}][createTopUp] Error`);
                }
            }
        });

    });
}

/*function updateOrCreateTopUp(paymentId, topupInfo) {
    return new Promise((resolve, reject) => {
        var context = "FUNCTION updateOrCreateTopUp";

        let query = {
            paymentId: paymentId,
            status: process.env.failedStatus
        };

        TopUp.updateTopUp(query, { $set: topupInfo }, (err, doc) => {
            if (err) {
                console.log(`[${context}][updateOrCreateTopUp] Error `, error.message);
                reject(error);
            } else {
                if (doc != null) {
                    console.log(`[${context}][updateOrCreateTopUp] Updated Top Up`);
                    resolve(true);
                }
                else {
                    let topUp = new TopUp(topupInfo);

                    TopUp.createTopUp(topUp, (error, result) => {
                        if (error) {
                            console.log(`[${context}][updateOrCreateTopUp] Error `, error.message);
                            reject(error);
                        }
                        else {
                            if (result) {
                                console.log(`[${context}][updateOrCreateTopUp] Success`);
                                resolve(true);
                            }
                        }
                    });
                }
            }
        });

    });
}*/

cron.schedule('*/15 * * * *', () => {
    var context = "FUNCTION checkTopUps";

    let query = {
        type: "topup",
        status: '20'
    };

    TopUp.find(query, (err, topups) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
            //reject(err);
        }
        else {
            if (topups.length === 0) {
                console.log("Topups to process not found");
            } else {

                for (let i = 0; i < topups.length; i++) {
                    let topup = topups[i];

                    //get user email from billing data
                    let params = {
                        userId: topup.userId
                    }

                    axios.get(billingProfileProxy, { params: params })
                        .then((profileFound) => {
                            let billingData = profileFound.data;
                            //let clientName = 
                            Utils.sendTopUpEmail(billingData, topup, i);
                        })
                        .catch((error) => {
                            console.error(`[${context}][.then][find] Error `, error.message);
                        });

                }
            }
        }
    });

});

module.exports = router;