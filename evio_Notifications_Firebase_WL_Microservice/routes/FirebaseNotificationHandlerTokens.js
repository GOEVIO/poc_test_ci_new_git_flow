const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const Utils = require('../utils/Utils');

const moment = require("moment");
const momentDurationFormatSetup = require("moment-duration-format");
momentDurationFormatSetup(moment);

const FirebaseUserTokens = require('../models/FirebaseUserTokens');

const { NotificationType, CodeTranslationsPushNotifications, retrieveBodyAndHeader, FirebasePush } = require('evio-library-notifications').default;

router.post('/api/private/firebase/start', async (req, res, next) => {
    var context = "POST /api/private/firebase/start";
    try {

        if (req.body == null) {
            return res.status(400).send({ code: 'subscription_to_topic_error2', message: "Topic subscription failed" });
        }

        let { _id, userId, hwId, plugId, totalPower, estimatedPrice, timeCharged, batteryCharged, instantPower } = req.body;
        if (!userId) {
            userId = req.headers['userid'];
        }

        const requiredParams = [
            { param: _id, code: 'sessionId_missing', message: "Missing sessionId" },
            { param: hwId, code: 'hwId_missing', message: "Missing hwId" },
            { param: plugId, code: 'plugId_missing', message: "Missing plugId" },
            { param: totalPower, code: 'totalPower_missing', message: "Missing totalPower" },
            { param: estimatedPrice, code: 'estimatedPrice_missing', message: "Missing estimatedPrice" },
            { param: timeCharged, code: 'timeCharged_missing', message: "Missing timeCharged" },
            { param: batteryCharged, code: 'batteryCharged_missing', message: "Missing batteryCharged" },
        ];

        const missingParam = requiredParams.find(param => param.param == undefined || param.param == null);

        if (missingParam) {
            return res.status(400).send({ code: missingParam.code, message: missingParam.message });
        }

        const tokensInfo = await Utils.getUserStoredTokens(userId, NotificationType.CHARGING_SESSION_START);
        if (tokensInfo.length === 0) {
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        const registrationTokens =  tokensInfo.map(tokenInfo => tokenInfo.token);
        const translation = await retrieveBodyAndHeader(userId, CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_START);
        if (translation.length === 0 || !translation) {
            return res.status(400).send({ code: 'server_translation_error', message: "Translation not found" });
        }

        const notification = {
            notificationType: NotificationType.CHARGING_SESSION_START,
            message: {
                userId,
                notification: {
                    title: translation.messageHeader,
                    body: ''
                },
                data: {
                    _id,
                    totalPower: totalPower.toString(),
                    estimatedPrice: estimatedPrice.toString(),
                    timeCharged: timeCharged.toString(),
                    batteryCharged: batteryCharged.toString(),
                    instantPower: instantPower.toString()
                }
            },
            sendTo: {
                type: "tokens",
                value: registrationTokens
            }
        };

        await FirebasePush.sendPushNotification(notification, translation.clientName);
        return res.status(200).send({ code: 'send_message_success', message: "Message sent" });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.post('/api/private/firebase/stop', async (req, res, next) => {
    const context = "POST /api/private/firebase/stop";
    try {
        if (req.body == null) {
            return res.status(400).send({ code: 'subscription_to_topic_error2', message: "Topic subscription failed" });
        }
        let { userId, hwId, plugId, _id, totalPower, estimatedPrice, timeCharged, batteryCharged, instantPower } = req.body;
        if (!userId) {
            userId = req.headers['userid'];
        }

        const requiredParams = [
            { param: userId, code: 'userId_missing', message: "Missing userId" },
            { param: hwId, code: 'hwId_missing', message: "Missing hwId" },
            { param: plugId, code: 'plugId_missing', message: "Missing plugId" },
            { param: _id, code: 'sessionId_missing', message: "Missing sessionId" },
            { param: totalPower, code: 'TotalPower_missing', message: "Missing totalPower" },
            { param: estimatedPrice, code: 'estimatedPrice_missing', message: "Missing estimatedPrice" },
            { param: timeCharged, code: 'timeCharged_missing', message: "Missing timeCharged" },
            { param: batteryCharged, code: 'batteryCharged_missing', message: "Missing batteryCharged" },
        ];

        const missingParam = requiredParams.find(param => param.param == undefined || param.param == null);

        if (missingParam) {
            return res.status(400).send({ code: missingParam.code, message: missingParam.message });
        }

        const tokensInfo = await Utils.getUserStoredTokens(userId, NotificationType.CHARGING_SESSION_STOP);

        if (tokensInfo.length === 0) {
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        const registrationTokens = tokensInfo.map(tokenInfo => tokenInfo.token);
        const translation = await retrieveBodyAndHeader(userId, estimatedPrice > 0 ? CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_STOP_WITH_PRICE : CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_STOP);
        if (translation.length === 0 || !translation) {
            return res.status(400).send({ code: 'server_translation_error', message: "Translation not found" });
        }
        
        const totalEnergy = totalPower > 0 ? Number((totalPower / 1000).toFixed(1)) : 0
        const totalTime = moment.duration(timeCharged, "seconds").format("h[h] m[m]")
        const body = translation.messageBody.replace('{{estimatedPrice}}', estimatedPrice).replace('{{totalEnergy}}', totalEnergy).replace('{{totalTime}}', totalTime)

        const notification = {
            notificationType: NotificationType.CHARGING_SESSION_STOP,
            message: {
                userId,
                notification: {
                    title: translation.messageHeader,
                    body,
                },
                data: {
                    _id,
                    totalPower: totalPower.toString(),
                    estimatedPrice: estimatedPrice.toString(),
                    timeCharged: timeCharged.toString(),
                    batteryCharged: batteryCharged.toString(),
                    instantPower: instantPower.toString()
                }
            },
            sendTo: {
                type: "tokens",
                value: registrationTokens
            }
        };

        await FirebasePush.sendPushNotification(notification, translation.clientName);
        return res.status(200).send({ code: 'send_message_success', message: "Message sent" });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.post('/api/private/firebase/data', async (req, res, next) => {
    const context = "POST /api/private/firebase/data";
    try {
        if (!req.body) {
            return res.status(400).send({ code: 'subscription_to_topic_error2', message: "Topic subscription failed" });
        }

        let { userId, _id, totalPower, instantPower, estimatedPrice, timeCharged, batteryCharged } = req.body;
        if (!userId) {
            userId = req.headers['userid'];
        }

        const requiredParams = [
            { param: userId, code: 'userId_missing', message: "Missing userId" },
            { param: _id, code: 'sessionId_missing', message: "Missing sessionId" },
            { param: totalPower, code: 'TotalPower_missing', message: "Missing totalPower" },
            { param: instantPower, code: 'instantPower_missing', message: "Missing instantPower" },
            { param: estimatedPrice, code: 'estimatedPrice_missing', message: "Missing estimatedPrice" },
            { param: timeCharged, code: 'timeCharged_missing', message: "Missing timeCharged" },
            { param: batteryCharged, code: 'batteryCharged_missing', message: "Missing batteryCharged" },
        ];

        const missingParam = requiredParams.find(param => param.param == undefined || param.param == null);

        if (missingParam) {
            return res.status(400).send({ code: missingParam.code, message: missingParam.message });
        }

        const tokensInfo = await Utils.getUserStoredTokens(userId, NotificationType.CHARGING_SESSION_DATA);
        if (tokensInfo.length === 0) {
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        const registrationTokens = tokensInfo.map(tokenInfo => tokenInfo.token);
        const translation = await retrieveBodyAndHeader(userId, estimatedPrice > 0 ? CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_DATA_WITH_PRICE : CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_DATA);

        const totalEnergy = (totalPower / 1000).toFixed(1);
        const totalTime = moment.duration(timeCharged, "seconds").format("h[h] m[m]");
        const body = translation.messageBody.replace('{{estimatedPrice}}', estimatedPrice).replace('{{totalEnergy}}', totalEnergy).replace('{{totalTime}}', totalTime)

        const notification = {
            notificationType: NotificationType.CHARGING_SESSION_DATA,
            message: {
                userId,
                notification: {
                    title: translation.messageHeader,
                    body
                },
                data: {
                    _id,
                    totalPower: totalPower.toString(),
                    instantPower: instantPower.toString(),
                    estimatedPrice: estimatedPrice.toString(),
                    timeCharged: timeCharged.toString(),
                    batteryCharged: batteryCharged.toString()
                }
            },
            sendTo: {
                type: "tokens",
                value: registrationTokens
            }
        };

        await FirebasePush.sendPushNotification(notification, translation.clientName);
        return res.status(200).send({ code: 'send_message_success', message: "Message sent" });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.post('/api/private/firebase/myChargers/start', async (req, res, next) => {
    var context = "POST /api/private/firebase/myChargers/start";
    try {
        if (!req.body) {
            return res.status(400).send({ code: 'subscription_to_topic_error2', message: "Topic subscription failed" });
        }

        let { userId, _id, hwId, plugId, totalPower, estimatedPrice, timeCharged, batteryCharged, instantPower } = req.body;        

        if (!userId) {
            userId = req.headers['userid'];
        }
        const requiredParams = [
            { param: userId, code: 'userId_missing', message: "Missing userId" },
            { param: _id, code: 'sessionId_missing', message: "Missing sessionId" },
            { param: hwId, code: 'hwId_missing', message: "Missing hwId" },
            { param: plugId, code: 'plugId_missing', message: "Missing plugId" },
            { param: totalPower, code: 'TotalPower_missing', message: "Missing totalPower" },
            { param: estimatedPrice, code: 'estimatedPrice_missing', message: "Missing estimatedPrice" },
            { param: timeCharged, code: 'timeCharged_missing', message: "Missing timeCharged" },
            { param: batteryCharged, code: 'batteryCharged_missing', message: "Missing batteryCharged" },
        ];

        const missingParam = requiredParams.find(param => param.param == undefined || param.param == null);

        if (missingParam) {
            return res.status(400).send({ code: missingParam.code, message: missingParam.message });
        }

        const tokensInfo = await Utils.getUserStoredTokens(userId, NotificationType.MY_CHARGERS_CHARGING_SESSION_START);
        if (tokensInfo.length === 0) {
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        const registrationTokens = tokensInfo.map(tokenInfo => tokenInfo.token);
        const translation = await retrieveBodyAndHeader(userId, CodeTranslationsPushNotifications.NOTIFICATION_MY_CHARGERS_CHARGING_SESSION_START);
        if (translation.length === 0 || !translation) {
            return res.status(400).send({ code: 'server_translation_error', message: "Translation not found" });
        }        

        const notification = {
            notificationType: NotificationType.MY_CHARGERS_CHARGING_SESSION_START,
            message: {
                userId,
                notification: {
                    title: translation.messageHeader,
                    body: ''
                },
                data: {
                    _id: _id,
                    totalPower: totalPower.toString(),
                    estimatedPrice: estimatedPrice.toString(),
                    timeCharged: timeCharged.toString(),
                    batteryCharged: batteryCharged.toString(),
                    instantPower: instantPower.toString()
                }
            },
            sendTo: {
                type: "tokens",
                value: registrationTokens
            }
        };

        await FirebasePush.sendPushNotification(notification, translation.clientName);
        return res.status(200).send({ code: 'send_message_success', message: "Message sent" });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.post('/api/private/firebase/myChargers/stop', async (req, res, next) => {
    const context = "POST /api/private/firebase/myChargers/stop";
    try {
        const { userId: bodyUserId, hwId, plugId, _id, totalPower, estimatedPrice, timeCharged, batteryCharged, instantPower } = req.body;

        const userId = bodyUserId || req.headers['userid'];
        const requiredFields = { hwId, plugId, _id, totalPower, estimatedPrice, timeCharged, batteryCharged };

        for (const [key, value] of Object.entries(requiredFields)) {
            if (value == null) {
                return res.status(400).send({ code: `${key}_missing`, message: `Missing ${key}` });
            }
        }

        const isValid = await Utils.verifyUserTokens(userId);
        if (!isValid) {
            return res.status(400).send({ code: 'subscription_to_topic_error', message: "Topic subscription failed" });
        }

        const tokensInfo = await Utils.getUserStoredTokens(userId, NotificationType.MY_CHARGERS_CHARGING_SESSION_STOP);
        if (!tokensInfo.length) {
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        const registrationTokens = tokensInfo.map(tokenInfo => tokenInfo.token);
        const translation = await retrieveBodyAndHeader(userId, CodeTranslationsPushNotifications.NOTIFICATION_MY_CHARGERS_CHARGING_SESSION_STOP)

        const notification = {
            notificationType: NotificationType.MY_CHARGERS_CHARGING_SESSION_STOP,
            message: {
                userId,
                notification: {
                    title: translation.messageHeader,
                    body: translation.messageBody.replace('{{timeCharged}}', moment.duration(timeCharged, "seconds").format("h[h] m[m]")).replace('{{totalPower}}', (totalPower / 1000).toFixed(2))
                },
                data: {
                    _id,
                    totalPower: totalPower.toString(),
                    estimatedPrice: estimatedPrice.toString(),
                    timeCharged: timeCharged.toString(),
                    batteryCharged: batteryCharged.toString(),
                    instantPower: instantPower.toString()
                }
            },
            sendTo: { type: "tokens", value: registrationTokens }
        };

        const messageResult = await FirebasePush.sendPushNotification(notification, translation.clientName);
        if (messageResult) {
            return res.status(200).send({ code: 'send_message_success', message: "Message sent" });
        } else {
            return res.status(400).send({ code: 'send_message_error', message: "Failed to send message" });
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});


router.post('/api/private/firebase/session/missingPayment', async (req, res, next) => {
    const context = "POST /api/private/firebase/session/missingPayment";

    try {
        const { userIdWillPay, usersToNotify } = req.body;

        if (!userIdWillPay || !usersToNotify) {
            const missingField = !userIdWillPay ? 'user_will_pay_missing' : 'users_to_notify_missing';
            const message = !userIdWillPay ? 'Missing userIdWillPay' : 'Missing usersToNotify';
            return res.status(400).send({ code: missingField, message });
        }

        const tokensInfo = await Utils.verifyUserTokens(userIdWillPay)
            .then(isValid => isValid ? Utils.getUserStoredTokens(userIdWillPay, NotificationType.CHARGING_SESSION_STOP_MISSING_PAYMENT) : [])
            .catch(error => {
                console.error(`[${context}][verifyUserTokens] Error `, error.message);
                return [];
            });

        if (tokensInfo.length > 0) {
            const registrationTokens = tokensInfo.map(tokenInfo => tokenInfo.token);
            const translation = await retrieveBodyAndHeader(userIdWillPay, CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_STOP_MISSING_PAYMENT_WALLET);
            if (translation.length === 0 || !translation) {
                return res.status(400).send({ code: 'server_translation_error', message: "Translation not found" });
            }
            const notification = {
                notificationType: NotificationType.CHARGING_SESSION_STOP_MISSING_PAYMENT,
                message: {
                    userId: userIdWillPay,
                    notification: {
                        title: translation.messageHeader,
                        body: translation.messageBody
                    },
                    data: {}
                },
                sendTo: { type: "tokens", value: registrationTokens }
            };

            const ownerMessage = FirebasePush.sendPushNotificationWarning(notification, translation.clientName)
                .then(result => result)
                .catch(error => {
                    console.error(`[${context}][sendMessageWarning] Error `, error.message);
                    return false;
                });

            const usersMessage = usersToNotify.length > 0
                ? SendMissingMessagesMessagesToMultipleUsers(context, usersToNotify)
                    .then(result => result)
                    .catch(error => {
                        console.error(`[${context}][SendMissingMessagesMessagesToMultipleUsers] Error `, error.message);
                        return false;
                    })
                : Promise.resolve(true);

            const [ownerSuccess] = await Promise.all([ownerMessage]);
            if (ownerSuccess && usersMessage) {
                return res.status(200).send({ code: 'send_message_success', message: "Message sent" });
            }
        } else {
            console.error(`[${context}][getUserStoredTokens] Empty token list`);
        }

        return res.status(400).send({ code: 'user_token_error', message: "User token validation failed" });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});


router.post('/api/private/firebase/session/sendNotificationToUser', async (req, res, next) => {
    const context = "POST /api/private/firebase/session/sendNotificationToUser";
    try {
        
        if (req.body == null) {
            return res.status(400).send({ code: 'subscription_to_topic_error2', message: "Topic subscription failed" });
        }

        let { userId, messageHeader, messageBody, notificationType, bypassNotificationSettings, dataValues } = req.body;
        if (!userId) {
            userId = req.headers['userid'];
        }

        const requiredParams = [
            { param: messageHeader, code: 'message_header_missing', message: "Missing message header" },
            { param: messageBody, code: 'message_body_missing', message: "Missing message body" },
            { param: notificationType, code: 'notification_type_missing', message: "Missing notification type" }
        ];

        const missingParam = requiredParams.find(param => param.param == undefined || param.param == null);

        if (missingParam) {
            return res.status(400).send({ code: missingParam.code, message: missingParam.message });
        }

        const tokensInfo = await Utils.getUserStoredTokens(userId, notificationType, bypassNotificationSettings);

        if (tokensInfo.length === 0) {
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        const registrationTokens = tokensInfo.map(tokenInfo => tokenInfo.token);

        const notification = {
            notificationType,
            message: {
                userId,
                notification: {
                    title: messageHeader,
                    body: messageBody
                },
                data: {...dataValues}
            },
            sendTo: {
                type: "tokens",
                value: registrationTokens
            }
        };

        await FirebasePush.sendPushNotificationWarning(notification);
        return res.status(200).send({ code: 'send_message_success', message: "Message sent" });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});


router.post('/api/private/firebase/sendNotificationToUsers', async (req, res, next) => {
    const context = "POST /api/private/firebase/sendNotificationToUsers";
    try {
        if (req.body == null) {
            return res.status(400).send({ code: 'subscription_to_topic_error2', message: "Topic subscription failed" });
        }

        let { messageHeader, messageBody, notificationType } = req.body;

        const userTokens = await FirebaseUserTokens.find({}, { tokenList: 1, userId: 1 }).lean();

        if (userTokens.length === 0) {
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        let registrationTokens = [];
        for (const userToken of userTokens) {
            if (!userToken.tokenList || userToken.tokenList.length === 0) {
                continue;
            }
            let clientTypesToNotity = await Utils.checkUserNotificationsSettings(userToken.userId, notificationType);
            for(const token of userToken.tokenList) {
                if (clientTypesToNotity.includes(token.clientType) &&!registrationTokens.includes(token.token)) {
                    registrationTokens.push(token.token);
                }
            }
        }

        if (registrationTokens.length === 0) {
            console.error(`[${context}][.sendMessageWarning] Empty token list`);
            return res.status(400).send({ code: 'empty_token_list', message: "Empty token list" });
        }

        const notification = {
            notificationType,
            message: {
                userId: "",
                notification: {
                    title: messageHeader,
                    body: messageBody
                },
                data: {}
            },
            sendTo: {
                type: "tokens",
                value: registrationTokens
            }
        };

        await FirebasePush.sendPushNotificationWarning(notification);
        return res.status(200).send({ code: 'send_message_success', message: "Message sent" });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});


router.patch('/api/private/firebase/firebaseUserTokens', async (req, res) => {
    const context = "PATCH /api/private/firebase/firebaseUserTokens";
    try {
        const received = req.body;
        const query = { userId: received.userId };
        const newValues = { $set: { tokenList: [] } };
        
        FirebaseUserTokens.updateFirebaseTokenUser(query, newValues, (err, result) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(result);
            };
        });
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        return res.status(500).send(error.message);
    }
});

async function SendMissingMessagesMessagesToMultipleUsers(context, usersToNotify) {
    for (const userId of usersToNotify) {
        const tokensInfoList = await Utils.getUserStoredTokens(userId, NotificationType.CHARGING_SESSION_STOP_MISSING_PAYMENT);
        if (tokensInfoList.length === 0) {
            console.error(`[${context}][getUserStoredTokens] Empty token list for user ${userId}`);
            continue;
        }
        const registrationTokens = tokensInfoList.map(tokenInfo => tokenInfo.token);
        const translation = await retrieveBodyAndHeader(userId, CodeTranslationsPushNotifications.NOTIFICATION_CHARGING_SESSION_STOP_MISSING_PAYMENT);
        if (translation.length === 0 || !translation) {
            console.error(`[${context}][retrieveBodyAndHeader] Translation not found for user ${userId}`);
            continue;
        }
        const notification = {
            notificationType: NotificationType.CHARGING_SESSION_STOP_MISSING_PAYMENT,
            message: {
                userId,
                notification: {
                    title: translation.messageHeader,
                    body: translation.messageBody
                },
                data: {}
            },
            sendTo: {
                type: "tokens",
                value: registrationTokens
            }
        };
        FirebasePush.sendPushNotificationWarning(notification, translation.clientName)
            .then(result => {
                if (result) {
                    console.log(`[${context}][sendPushNotificationWarning] Notification sent to user ${userId}`);
                    return true;
                } else {
                    console.error(`[${context}][sendPushNotificationWarning] Failed to send notification to user ${userId}`);
                    return false;
                }
            })
            .catch(error => {
                console.error(`[${context}][sendPushNotificationWarning] Error sending notification to user ${userId}: `, error.message);
                return false;
            });
    }
}



module.exports = router;