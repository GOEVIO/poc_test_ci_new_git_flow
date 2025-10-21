const express = require('express');
const router = express.Router();
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
const ChargingSession = require('../models/chargingSession');
const moment = require('moment');

const notificationsHost = 'http://notifications:3008';
const firebaseNotification = `${notificationsHost}/api/private/firebase/session/missingPayment`;

const notificationsFirebaseWLProxy = 'http://notifications-firebase-wl:3032';
const firebaseWLNotification = `${notificationsFirebaseWLProxy}/api/private/firebase/session/missingPayment`;

//if (process.env.NODE_ENV === 'production') {
/*cron.schedule('* * * * *', () => {
    console.log('running every minute');

    let query = {
        status: process.env.SessionStatusRunning,
        paymentMethod: process.env.PaymentMethodWallet
    };

    ChargingSession.find(query, (err, sessions) => {
        if (err) {
            console.log("No chargers found");
        }
        else {
            if (sessions.length === 0) {
                console.log("No active sessions at this moment");
            }
            else {
                let userSessionsList = createUserWillPayMap(sessions);

                userSessionsList.forEach(user => {

                    let leftPayAmount = user.walletAmount - user.estimatedPay;

                    if (leftPayAmount < 1) {
                        //processa paragem de sessão de carregamento
                        //para a sessão cujo start date é maior (ou seja, a que foi iniciada primeiro)

                        var longestChargingSession = checkLongestChargingSession(user.sessions);

                        var reason = {
                            reasonCode: 'other',
                            reasonText: 'Total price reached'
                        };

                        console.log("Auto stopping charging session " + longestChargingSession._id);

                        autoStopChargingSession(longestChargingSession, reason);
                    }
                    else {
                        let notificationValueLimit = Math.pow(2, user.sessions.length);

                        if (leftPayAmount <= notificationValueLimit) {

                            //check if notification was already sent
                            if (!user.sessions[0].paymentNotificationStatus) {

                                //utilizadore a notificar
                                let usersToNotify = checkUserIdToNotification(user.userIdWillPay, user.sessions);
                                //console.log(usersToNotify);

                                //envia notificação
                                var body = {
                                    userIdWillPay: user.userIdWillPay,
                                    usersToNotify: usersToNotify
                                }

                                axios.post(firebaseNotification, body)
                                    .then((response) => {
                                        if (response) {
                                            //faz update ao user para indicar que foi enviado notificação 
                                            updateSessionsAfterUserNotification(user.userIdWillPay);
                                        }
                                    })
                                    .catch((error) => {
                                        console.log("[Failed to send notification] " + error)
                                    });

                            }

                        }

                    }

                });

            }
        }
    });

});*/
//}

router.get('/api/private/chargingSession/checkMissingPayment', (req, res, next) => {
    var context = "POST /api/private/chargingSession/checkMissingPayment";
    try {

        let query = {
            status: process.env.SessionStatusRunning,
            $or: [
                { paymentMethod: process.env.PaymentMethodWallet },
                { paymentMethod: process.env.PaymentMethodUnknown },
                { paymentMethod: process.env.PaymentMethodUnknownPayments },
                { plafondId: { $exists: true, $ne: '-1' } },
            ]
        };

        ChargingSession.find(query, (err, sessions) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (sessions.length === 0) {
                    return res.status(200).send([]);
                }
                else {
                    return res.status(200).send(sessions);
                }
            }
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/chargingSession/chargingSessionNotificationUpdate', (req, res, next) => {
    var context = "POST /api/private/chargingSession/chargingSessionNotificationUpdate";
    try {

        let userIdWillPay = req.body.userIdWillPay;

        updateSessionsAfterUserNotification(userIdWillPay)
            .then(() => {
                return res.status(200).send();
            })
            .catch((err) => {
                return res.status(400).send();
            })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

function createUserWillPayMap(sessions) {

    var userWillPayArray = [];

    sessions.forEach(session => {

        let index = userWillPayArray.findIndex(x => x.userIdWillPay == session.userIdWillPay);

        if (index !== -1) {
            let element = userWillPayArray[index];
            element.sessions.push(session);
            element.estimatedPay += session.estimatedPrice;
        }
        else {
            let userWillPayInfo = {
                userIdWillPay: session.userIdWillPay,
                sessions: [session],
                estimatedPay: session.estimatedPrice,
                walletAmount: session.walletAmount
            }
            userWillPayArray.push(userWillPayInfo);
        }
    });

    return userWillPayArray;
}

function checkLongestChargingSession(sessions) {

    let longestSession = null;
    let longestSessionTimeMin = 0;

    let now = new Date(moment.utc());

    sessions.forEach(session => {

        let startDate = new Date(session.startDate);

        let diff = now.getTime() - startDate.getTime();
        let diff_minutes = Math.round(diff / 60000);

        if (diff_minutes > longestSessionTimeMin) {
            longestSession = session;
            longestSessionTimeMin = diff_minutes;
        }

    });

    //console.log("L1: " + longestSession._id);
    //console.log("L2: " + longestSessionTimeMin);

    return longestSession;
}

function checkUserIdToNotification(userWillPay, sessions) {

    let ids = [];

    sessions.forEach(session => {
        let index = ids.findIndex(x => x == session.userId);
        if (index === -1) {
            if (session.userId != userWillPay) {
                ids.push(session.userId);
            }
        }
    });

    return ids;
}

function updateSessionsAfterUserNotification(userIdWillPay) {
    var context = "Function updateSessionsAfterUserNotification";
    return new Promise((resolve, reject) => {

        var query = {
            $and: [
                { userIdWillPay: userIdWillPay },
                { paymentMethod: process.env.PaymentMethodWallet },
                {
                    $or: [
                        {
                            status: process.env.SessionStatusRunning
                        },
                        {
                            status: process.env.SessionStatusInPause
                        }
                    ]
                }
            ]
        };

        var newNotificationSent = {
            $set: {
                "paymentNotificationStatus": true
            }
        };

        ChargingSession.updateMany(query, newNotificationSent, (err, result) => {
            if (err) {
                console.error(`[${context}][updateSessionsAfterUserNotification] Error `, err.message);
                //console.log(err.message);
                reject(err);
            }
            else {
                if (result) {
                    console.log("Sessions updated successfully");
                    resolve();
                }
                else {
                    console.log("Sessions not updated successfully");
                    resolve();
                }
            }
        });

    });
}

function autoStopChargingSession(chargingSessionFound, reason) {
    var context = "Funciton autoStopChargingSession";
    try {
        const host = process.env.HostConnectioStation + process.env.PathConnectioStation;

        var body = {
            _id: chargingSessionFound._id,
            chargerId: chargingSessionFound.hwId,
            plugId: chargingSessionFound.plugId,
            evId: chargingSessionFound.evId,
            userId: chargingSessionFound.userId,
            estimatedPrice: chargingSessionFound.estimatedPrice,
            idTag: chargingSessionFound.idTag,
            stopReason: reason,
            action: process.env.ActionStop,
            chargerType: chargingSessionFound.chargerType
        };

        axios.post(host, body)
            .then((result) => {
                if (result.data) {
                    console.log(`[${context}][axios.post] Result `, result.data);
                }
                else {
                    console.error(`[${context}][axios.post] Error`);
                };
            })
            .catch((error) => {
                console.error(`[${context}][axios.post] Error `, error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error`, error);
    };
};

cron.schedule('0 5 * * *', () => { 
    updateSessionsToFailed(36)
});

router.post('/api/private/chargingSession/forceSessionsToFailed', (req, res, next) => {
    var context = "POST /api/private/chargingSession/forceSessionsToFailed";
    try {
        let lastHours = req.body.lastHours > 0 ? req.body.lastHours : 36
        updateSessionsToFailed(lastHours)
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

async function updateSessionsToFailed(lastHours) {
    const context = "Function updateSessionsToFailed"
    try {
        console.log("Querying sessions in the last " + lastHours + " hours")
        let currentDate = new Date().toISOString();
        let expiringLimitDate = moment.utc(currentDate).add(-lastHours, "hours").format()
        let query = {
            $or: [
                {
                    $and: [
                        { status: process.env.SessionStatusRunning },
                        {
                            $or: [
                                {
                                    $and: [
                                        { startDate: { "$exists": true } },
                                        { startDate: { $lte: expiringLimitDate } }
                                    ]
                                },
                                {
                                    $and: [
                                        { startDate: { "$exists": false } },
                                        { createdAt: { $lte: new Date(expiringLimitDate) } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    $and: [
                        { status: process.env.SessionStatusToStop },
                        {
                            $or: [
                                {
                                    $and: [
                                        { startDate: { "$exists": true } },
                                        { startDate: { $lte: expiringLimitDate } }
                                    ]
                                },
                                {
                                    $and: [
                                        { startDate: { "$exists": false } },
                                        { createdAt: { $lte: new Date(expiringLimitDate) } }
                                    ]
                                }
                            ]
                        }
                    ]
                },
            ]
        }

        let fields = {
            _id: 1
        }
        let sessionsToExpire = await ChargingSession.find(query, fields).lean()
        for (let session of sessionsToExpire) {
            await ChargingSession.findOneAndUpdate({ _id: session._id }, { $set : { status: process.env.SessionStatusFailed , notes : "Session invalidated because it was running for too long" } } , {useFindAndModify: false})
        }
        return sessionsToExpire
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return [];
    }
}


//Call billing 
function sessionsInvoiceStatusFalse() {
    const context = "Function sessionsInvoiceStatusFalse";

    let query = {
        "totalPrice.incl_vat": { $exists: true, $gt: 0 },
        invoiceStatus: false,
        paymentStatus: process.env.ChargingSessionPaymentStatusPaid,
        billingPeriod: process.env.BillingPeriodAdHoc,
        $or: [
            { invoiceId: { $exists: true, $eq: "" } },
            { invoiceId: { $exists: false } },
        ]
    };

    ChargingSession.find(query, {_id: 1}, (err, result) => {
        if (err) {
            console.error(`[] Error `, err.message);
        }
        else {

            //console.log("result", result);
            if (result.length > 0) {

                let host = process.env.HostPayments + process.env.PathToCreateBilling;

                let data = result;

                //console.log("data", data);

                axios.patch(host, data)
                    .then((result) => {

                        console.log("Invoice requested");

                    })
                    .catch((error) => {
                        if (error.response) {
                            console.error(`[${context}] [${host}] [400] Error `, error.response.data);
                        } else
                            console.error(`[${context}] [${host}] [500] Error `, error.message);
                    });

            }

        };
    });

};

router.post('/api/private/chargingSession/sessionsInvoiceStatusFalse', (req, res, next) => {
    const context = "POST /api/private/chargingSession/sessionsInvoiceStatusFalse";
    try {
        sessionsInvoiceStatusFalse()
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

module.exports = router;