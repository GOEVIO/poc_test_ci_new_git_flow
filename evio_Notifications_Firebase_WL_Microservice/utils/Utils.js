const { response } = require('express');
const FirebaseTokenUser = require('../models/FirebaseUserTokens');
const axios = require("axios");
const { firebaseConnect } = require('./firebase');


var Utils = {

    verifyRegistrationToken: function (token) {
        const admin = firebaseConnect();
        return admin.messaging().send({
            token: token
        }, true);
    },

    verifyUserTokens: function (userId) {
        return new Promise((resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, (error, firebaseToken) => {
                if (error) {
                    reject(error);
                }
                else {
                    if (firebaseToken) {

                        if (firebaseToken.tokenList.length === 0) {
                            resolve(true);
                        }
                        else {
                            for (let i = firebaseToken.tokenList.length - 1; i >= 0; i--) {
                                let element = firebaseToken.tokenList[i];
                                console.log("Token: " + element.token);
                                console.log("Client Type: " + element.clientType);

                                this.verifyRegistrationToken(element.token)
                                    .then(result => {
                                        console.log("VALID - ", element.clientType);

                                        if (i - 1 < 0) {
                                            let query = { _id: firebaseToken._id };
                                            FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                                                if (error) {
                                                    resolve(false);
                                                }
                                                else {
                                                    if (doc != null) {
                                                        resolve(true);
                                                    }
                                                }
                                            });
                                        }

                                    })
                                    .catch(err => {
                                        console.log("NOTVALID - ", element.clientType);
                                        firebaseToken.tokenList.splice(i, 1);

                                        if (i - 1 < 0) {
                                            let query = { _id: firebaseToken._id };
                                            FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                                                if (error) {
                                                    resolve(false);
                                                }
                                                else {
                                                    if (doc != null) {
                                                        resolve(true);
                                                    }
                                                }
                                            });
                                        }

                                    });
                            }
                        }

                    }
                    else {
                        resolve(true);
                    }
                }
            });

        });

    },

    addTopicToActiveTopics: function (userId, topic, tokens) {
        return new Promise((resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, (error, firebaseToken) => {
                if (error) {
                    console.error(`[][.then][find] Error `, error.message);
                    reject(error);
                }
                else {
                    if (firebaseToken) {

                        tokens.forEach(element => {
                            let index = firebaseToken.tokenList.findIndex(item => item.token === element.token);
                            if (index > -1) {
                                if (!firebaseToken.tokenList[index].activeSubscriptions.includes(topic)) {
                                    firebaseToken.tokenList[index].activeSubscriptions.push(topic);
                                }
                            }
                        });

                        let query = { _id: firebaseToken._id };
                        FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                            if (error) {
                                resolve(false);
                            }
                            else {
                                if (doc != null) {
                                    resolve(true);
                                }
                            }
                        });

                    }
                    else {
                        resolve(false);
                    }
                }
            });

        });
    },

    removeTopicFromActiveTopics: function (userId, topic, tokens) {
        return new Promise((resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, (error, firebaseToken) => {
                if (error) {
                    console.error(`[][.then][find] Error `, error.message);
                    reject(error);
                }
                else {
                    if (firebaseToken) {

                        tokens.forEach(element => {
                            let index = firebaseToken.tokenList.findIndex(item => item.token === element.token);
                            if (index > -1) {
                                let removeIndex = firebaseToken.tokenList[index].activeSubscriptions.indexOf(topic);
                                if (removeIndex > -1) {
                                    firebaseToken.tokenList[index].activeSubscriptions.splice(removeIndex, 1);
                                }
                            }
                        });

                        let query = { _id: firebaseToken._id };
                        FirebaseTokenUser.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
                            if (error) {
                                resolve(false);
                            }
                            else {
                                if (doc != null) {
                                    resolve(true);
                                }
                            }
                        });

                    }
                    else {
                        resolve(false);
                    }
                }
            });

        });
    },

    subscribeToTopic: function (res, admin, tokensInfo, topic, userId) {
        return new Promise((resolve, reject) => {

            let registrationTokens = [];
            tokensInfo.map(tokenInfo => {
                registrationTokens.push(tokenInfo.token);
            });

            console.log("registrationTokens", registrationTokens);
            admin.
                messaging().
                subscribeToTopic(registrationTokens, topic)
                .then((response) => {
                    // See the MessagingTopicManagementResponse reference documentation
                    // for the contents of response.
                    if (response.errors.length !== 0) {
                        console.log('Failed subscription to topic:', response);
                    } else {
                        console.log('Successfully subscribed to topic:', response);
                    }

                    this.addTopicToActiveTopics(userId, topic, tokensInfo)
                        .then((result) => {

                            if (result) {
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            }

                        }).catch((error) => {
                            return res.status(400).send(error);
                        });


                })
                .catch(function (error) {
                    console.log('Error subscribing to topic:', error);
                    return res.status(400).send({ code: 'subscription_to_topic_error', message: "Topic subscription failed" });
                });

        });

    },

    unsubscribeFromTopic: function (res, admin, tokensInfo, topic, userId) {
        return new Promise((resolve, reject) => {

            let registrationTokens = [];
            tokensInfo.map(tokenInfo => {
                registrationTokens.push(tokenInfo.token);
            });

            admin.
                messaging().
                unsubscribeFromTopic(registrationTokens, topic)
                .then((response) => {
                    // See the MessagingTopicManagementResponse reference documentation
                    // for the contents of response.
                    if (response.errors.length !== 0) {
                        console.log('Failed unsubscribed from topic:', response);
                    } else {
                        console.log('Successfully unsubscribed from topic:', response);
                    }

                    this.removeTopicFromActiveTopics(userId, topic, tokensInfo)
                        .then((result) => {

                            if (result) {
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            }

                        }).catch((error) => {
                            return res.status(400).send(error);
                        });

                    //return res.status(200).send({ code: 'subscription_to_topic_success', message: "Topic subscription successful" });
                })
                .catch(function (error) {
                    console.log('Error subscribing to topic:', error);
                    return res.status(400).send({ code: 'subscription_to_topic_error', message: "Topic subscription failed" });
                });

        });

    },

    getUserStoredTokens: function (userId, notificationType, bypassNotificationSettings = false) {
        return new Promise((resolve, reject) => {

            FirebaseTokenUser.findOne({ userId: userId }, async (error, firebaseToken) => {
                if (error) {
                    reject(error);
                }
                else {
                    //console.log("firebaseToken", firebaseToken);
                    if (firebaseToken) {
                        let tokenList = [];

                        const clientTypesToNotity = bypassNotificationSettings ? ["android","iOS","BackOffice"] : await this.checkUserNotificationsSettings(userId, notificationType);

                        console.log("clientTypesToNotity", clientTypesToNotity);
                        firebaseToken.tokenList.forEach(element => {
                            if (clientTypesToNotity.includes(element.clientType)) {
                                let token = {
                                    token: element.token
                                }
                                tokenList.push(token);
                            }
                        });

                        resolve(tokenList);
                    }
                    else {
                        resolve([]);
                    }
                }
            });

        });
    },

    checkUserNotificationsSettings: function (userId, notificationType) {
        return new Promise((resolve, reject) => {

            var host = process.env.ConfigsHost + process.env.PathCheckNotificationSettings;

            let params = {
                userId: userId,
                notificationType: notificationType
            }

            axios.get(host, { params })
                .then((result) => {
                    if (result) {
                        let clientTypesToNotity = result.data;
                        resolve(clientTypesToNotity);
                    } else {
                        resolve([]);
                    }
                })
                .catch((error) => {
                    console.error("No settings for the user", error);
                    resolve([]);
                });

        });
    }

}





module.exports = Utils;