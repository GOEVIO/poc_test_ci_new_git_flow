const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const Utils = require('../utils/Utils');

var FirebaseUserTokens = require('../models/FirebaseUserTokens');
const { FirebasePush } = require('evio-library-notifications').default;

router.post('/api/private/notifyUsers', (req, res, next) => {
    var context = "POST /api/private/notifyUsers";
    try {

        if (!req.body.notificationType) { //group or all
            return res.status(400).send({ code: 'missing_notification_type', message: "Notification type is missing" });
        }

        if (!req.body.header) {
            return res.status(400).send({ code: 'missing_header', message: "Header is missing" });
        }

        if (!req.body.message) {
            return res.status(400).send({ code: 'missing_message', message: "Message is missing" });
        }

        let params = {
            notificationType: req.body.notificationType
        }

        var host = process.env.IdentityHost + process.env.PathGetUsersToNotify;

        axios.get(host, { params })
            .then((result) => {
                let userIds = result.data;
                if (userIds) {
                    if (userIds.length !== 0) {

                        let promises = [];
                        let totalSuccess = 0;
                        let totalFailed = 0;

                        //handle notifications in batchs of 20
                        let chunk = 20;
                        for (let i = 0, j = userIds.length; i < j; i += chunk) {
                            let arrayChunk = userIds.slice(i, i + chunk);

                            promises.push(new Promise((resolve, reject) => {

                                setTimeout(() => {

                                    let query = {
                                        $or: []
                                    };

                                    arrayChunk.forEach(id => {
                                        query.$or.push({ "userId": id._id });
                                    });

                                    let fields = {
                                        tokenList: 1,
                                        userId: 1
                                    }

                                    let registrationTokens = [];

                                    FirebaseUserTokens.find(query, fields, (err, results) => {
                                        if (err) {
                                            console.error(`[${context}] Error `, err.message);
                                            reject(false);
                                        }
                                        else {
                                            if (results.length > 0) {

                                                let handle = new Promise(async (resolve, reject) => {

                                                    for (let index = 0; index < results.length; index++) {
                                                        const result = results[index];

                                                        if (result.tokenList.length > 0) {

                                                            let notification = "NEWS";
                                                            let clientTypesToNotity = await Utils.checkUserNotificationsSettings(result.userId, notification);

                                                            //console.log(clientTypesToNotity);

                                                            for (let index2 = 0; index2 < result.tokenList.length; index2++) {
                                                                const token = result.tokenList[index2];

                                                                //console.log(token);

                                                                if (clientTypesToNotity.includes(token.clientType)) {
                                                                    if (!registrationTokens.includes(token.token)) {
                                                                        registrationTokens.push(token.token);
                                                                    }
                                                                }
                                                            }

                                                        }
                                                        if (index == results.length - 1) {
                                                            resolve();
                                                        }
                                                    }

                                                });

                                                //send notification to firebase
                                                handle.then(() => {

                                                    //console.log(registrationTokens);

                                                    let notification = {
                                                        notificationType: "NEWS" /*"CHARGING_SESSION_OWNER_MISSING_PAYMENT"*/,
                                                        message: {
                                                            userId: "",
                                                            notification: {
                                                                title: req.body.header,
                                                                body: req.body.message
                                                            },
                                                            data: {}
                                                        },
                                                        sendTo: {
                                                            type: "tokens",
                                                            value: registrationTokens
                                                        }
                                                    }

                                                    if (registrationTokens.length !== 0) {
                                                        FirebasePush.sendPushNotificationWarning(notification)
                                                            .then((result) => {
                                                                if (result) {
                                                                    totalSuccess += result.successCount;
                                                                    console.log("[Total messages sent]: " + totalSuccess);
                                                                    totalFailed += result.failureCount;
                                                                    console.log("[Total failed messages]: " + totalFailed);

                                                                    resolve(true);
                                                                } else {
                                                                    console.log("[Error] Failed to send notifications");
                                                                    reject(false);
                                                                }
                                                            })
                                                            .catch((error) => {
                                                                console.error(`[${context}][.sendMessageWarning] Error `, error.message);
                                                                reject(false);
                                                            });
                                                    }
                                                    else {
                                                        console.error(`[${context}][.sendMessageWarning] Empty token list`);
                                                        reject(false);
                                                    }

                                                });

                                            }
                                            else {
                                                console.log("No tokens to process");
                                                reject(false);
                                            }
                                        }
                                    });

                                }, i * 5 * 1000);

                            }));

                        }

                        Promise.allSettled(promises)
                            .then(() => {
                                return res.status(200).send("Notifications processed");
                            })
                            .catch(() => {
                                return res.status(400).send("Failed");
                            });

                    }
                    else {
                        return res.status(400).send({ code: 'failed_to_retrieve_users', message: "Failed" });
                    }
                }
                else {
                    return res.status(400).send({ code: 'failed_to_retrieve_users', message: "Failed" });
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send({ code: 'failed_to_process', message: "Failed" });
            });

    } catch (error) {
        console.log(`[${context}] Error`, error);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/notifyUsersByMail', (req, res, next) => {
    var context = "POST /api/private/notifyUsersByMail";
    try {

        var host = process.env.IdentityHost + process.env.PathGetUsersToNotifyByMail;
        var emailHost = process.env.HostNotifications + process.env.PathNotificationsSendEmail;
        let data = req.body
        
        axios.get(host, {data})
            .then((result) => {

                let users = result.data;

                let promises = [];

                let total = users.length;

                for (let index = 0; index < users.length; index++) {
                    const user = users[index];

                    promises.push(new Promise((resolve, reject) => {

                        setTimeout(() => {
                            console.log((index + 1) + "/" + total);
                            var mailOptions = {
                                to: user.email,
                                message: {
                                    emailSubject: 'EVIO - ' + req.body.messageSubject,
                                    emailTitle: req.body.messageTitle,
                                    emailHeader: req.body.messageHeader + " " + user.name + ",",
                                    emailBody: req.body.messageBody,
                                    emailFooter: req.body.messageFooter,
                                },
                                type: "globalNotification"
                            };

                            let headers = {
                                clientname: user.clientName
                            }

                            axios.post(emailHost, { mailOptions },{headers})
                                .then((result) => {
                                    if (result)
                                        resolve();
                                    else
                                        reject("email sent unsuccessfully!");
                                })
                                .catch((error) => {
                                    if (error.response) {
                                        console.error(`[${context}][.catch] Error `, error.response.data);
                                        reject(error);
                                    }
                                    else {
                                        console.error(`[${context}][.catch] Error `, error.message);
                                        reject(error);
                                    };
                                });

                        }, index * 5 * 1000);

                    }));

                }

                Promise.allSettled(promises)
                    .then(() => {
                        return res.status(200).send("Notifications processed");
                    })
                    .catch(() => {
                        return res.status(400).send("Failed");
                    });

            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send({ code: 'failed_to_process', message: "Failed" });
            });

    } catch (error) {
        console.log(`[${context}] Error`, error);
        return res.status(500).send(error.message);
    };
});

module.exports = router;