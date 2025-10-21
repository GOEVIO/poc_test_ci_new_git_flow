const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const FirebaseUserTokens = require('../models/FirebaseUserTokens');
const FirebasePublicUserToken = require('../models/FirebasePublicUserToken');
const Utils = require('../utils/Utils');
const { firebaseConnect } = require('../utils/firebase');


////////PRIVATE////////
router.post('/api/private/firebase/token', (req, res, next) => {
    var context = "POST /api/private/firebase/token";
    try {

        let userId;
        let client = req.headers.client.split("-");
        let token = req.body.token;
        let refreshToken = req.body.refreshToken;
        let clientType = client[0]

        console.log("clientType", clientType);
        if (!req.body.token) {
            return res.status(400).send({ code: 'token_missing', message: "Token missing" });
        }

        if (!req.body.userId) {
            userId = req.headers['userid'];
        }
        else {
            userId = req.body.userId;
        }

        if (req.body != null) {

            Utils.verifyUserTokens(userId)
                .then(() => {
                    FirebaseUserTokens.findOne({ userId: userId }, (error, firebaseToken) => {
                        if (error) {
                            console.error(`[${context}][.then][find] Error `, error.message);
                            return res.status(500).send({ code: 'notification_firebase_error', message: "Firebase notification error" });
                        }
                        else {

                            if (firebaseToken) {

                                let index = firebaseToken.tokenList.findIndex(item => item.token === token);
                                if (index > -1) {
                                    //Update token

                                    if (!req.body.refreshToken) {
                                        return res.status(400).send({ code: 'refresh_token_missing', message: "Refresh token missing" });
                                    }

                                    if (firebaseToken.tokenList[index].activeSubscriptions.length === 0) {
                                        firebaseToken.tokenList[index].token = refreshToken;
                                        let query = { _id: firebaseToken._id };
                                        updateUserToken(res, query, firebaseToken);
                                    }
                                    else {
                                        console.log("Entra");
                                        unsubscribeFromActiveTopics(firebaseToken.tokenList[index])
                                            .then((result) => {
                                                console.log("Unsubscribe");
                                                if (result) {
                                                    subscribeToActiveTopics(firebaseToken.tokenList[index], refreshToken)
                                                        .then((result) => {
                                                            console.log("Subscribe");
                                                            if (result) {
                                                                firebaseToken.tokenList[index].token = refreshToken;
                                                                let query = { _id: firebaseToken._id };
                                                                updateUserToken(res, query, firebaseToken);
                                                            }
                                                        })
                                                        .catch((error) => {
                                                            return res.status(400).send({ code: 'token_update_error', message: "Token update error" });
                                                        });
                                                }
                                            })
                                            .catch((error) => {
                                                return res.status(400).send({ code: 'token_update_error', message: "Token update error" });

                                            });
                                    }

                                }
                                else {
                                    //Add new token to user
                                    let element = {
                                        token: token,
                                        clientType: clientType
                                        //deviceId: deviceId
                                    };

                                    let activeSubscriptions = [];
                                    if (firebaseToken.tokenList.length != 0) {
                                        let activeSubs = firebaseToken.tokenList[0].activeSubscriptions;
                                        if (activeSubs.length !== 0) {

                                            var handle = new Promise((resolve, reject) => {
                                                const admin = firebaseConnect();
                                                activeSubs.forEach((topic, index, array) => {                                                    
                                                    admin.
                                                        messaging().
                                                        subscribeToTopic([token], topic)
                                                        .then((response) => {
                                                            console.log('Successfully subscribed to topic:', response);
                                                            activeSubscriptions.push(topic);
                                                            if (index === array.length - 1) resolve();
                                                        })
                                                        .catch(function (error) {
                                                            console.log('Error subscribed to topic:', error);
                                                            if (index === array.length - 1) resolve();
                                                        });
                                                });
                                            });

                                            handle.then(() => {
                                                element.activeSubscriptions = activeSubscriptions;
                                                firebaseToken.tokenList.push(element);
                                                let query = { _id: firebaseToken._id };
                                                updateUserToken(res, query, firebaseToken);
                                            });

                                        }
                                        else {
                                            firebaseToken.tokenList.push(element);
                                            let query = { _id: firebaseToken._id };
                                            updateUserToken(res, query, firebaseToken);
                                        }
                                    }
                                    else {
                                        firebaseToken.tokenList.push(element);
                                        let query = { _id: firebaseToken._id };
                                        updateUserToken(res, query, firebaseToken);
                                    }
                                }
                            }
                            else {

                                let element = {
                                    token: token,
                                    clientType: clientType
                                    //deviceId: deviceId
                                };

                                let new_firebaseToken = {
                                    userId: userId,
                                    tokenList: [element]
                                };
                                createUserToken(res, new_firebaseToken);
                            }

                        }
                    });
                }).catch((error) => {
                    console.log('Error updating token:', error.message);
                    return res.status(400).send({ code: 'token_creation_error', message: "Token creation error" });
                });

        } else {
            return res.status(400).send({ code: 'token_update_error', message: "Token update error" });
        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

const updateUserToken = ((res, query, firebaseToken) => {

    FirebaseUserTokens.updateFirebaseTokenUser(query, { $set: firebaseToken }, (error, doc) => {
        if (error) {
            return res.status(400).send({ code: 'token_update_error', message: "Token update error" });
        }
        else {
            if (doc != null) {
                return res.status(200).send({ code: 'token_update_success', message: "Token updated with success" });
            }
        }
    });

});

const createUserToken = ((res, newFirebaseToken) => {

    let firebaseToken = new FirebaseUserTokens(newFirebaseToken);

    FirebaseUserTokens.createFirebaseTokenUser(firebaseToken, (error, result) => {
        if (error) {
            return res.status(400).send({ code: 'token_update_error', message: "Token update error" });
        }
        else {
            if (result) {
                return res.status(200).send({ code: 'token_creation_success', message: "Token created with success" });
            }
        }
    });

});

const unsubscribeFromActiveTopics = ((tokenInfo) => {
    return new Promise((resolve, reject) => {

        let token = tokenInfo.token;
        let registrationTokens = [token];
        const admin = firebaseConnect();
        tokenInfo.activeSubscriptions.forEach(topic => {
            admin.
                messaging().
                unsubscribeFromTopic(registrationTokens, topic)
                .then((response) => {
                    console.log('Successfully unsubscribed from topic:', response);
                })
                .catch(function (error) {
                    console.log('Error unsubscribed from topic:', error);
                    reject(error);
                });
        });
        resolve(true);
    });
});

const subscribeToActiveTopics = ((tokenInfo, token) => {
    return new Promise((resolve, reject) => {

        let registrationTokens = [token];
        const admin = firebaseConnect();
        tokenInfo.activeSubscriptions.forEach(topic => {
            admin.
                messaging().
                subscribeToTopic(registrationTokens, topic)
                .then((response) => {
                    console.log('Successfully subscribed to topic:', response);
                })
                .catch(function (error) {
                    console.log('Error subscribed to topic:', error);
                    reject(error);
                });
        });
        resolve(true);
    });
});

////////PUBLIC////////
router.post('/api/public/firebase/token', (req, res, next) => {
    var context = "POST /api/public/firebase/token";
    try {

        if (!req.body.token) {
            return res.status(400).send({ code: 'token_missing', message: "Token missing" });
        }

        let token = req.body.token;

        FirebasePublicUserToken.findOne({ token: token }, (error, publicToken) => {
            if (error) {
                console.error(`[${context}][.then][find] Error `, error.message);
                return res.status(500).send({ code: 'notification_firebase_error', message: "Firebase notification error" });
            }
            else {

                if (!publicToken) {
                    let new_publicToken = {
                        token: req.body.token
                    };
                    createPublicUserToken(res, new_publicToken);
                }
                else {
                    return res.status(400).send({ code: 'token_already_exists', message: "Token already exists" });
                }

            }
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

const createPublicUserToken = ((res, newFirebaseToken) => {

    let firebaseToken = new FirebasePublicUserToken(newFirebaseToken);

    FirebasePublicUserToken.createFirebaseTokenUser(firebaseToken, (error, result) => {
        if (error) {
            return res.status(400).send({ code: 'token_update_error', message: "Token update error" });
        }
        else {
            if (result) {
                return res.status(200).send({ code: 'token_creation_success', message: "Token created with success" });
            }
        }
    });

});


module.exports = router;