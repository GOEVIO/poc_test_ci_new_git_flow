const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const NotificationsDefinition = require('../models/notificationsDefinition_old');
const notificationsJson = require('../models/notifications.json');

//========== POST ==========
//Create a new notifications definition
router.post('/api/private/notificationsDefinition', (req, res, next) => {
    var context = "POST /api/private/notificationsDefinition";
    try {

        var notificationsDefinition = new NotificationsDefinition();
        var body = req.body;
        var notificationsPref = {
            clientType: body.clientType,
            notifications: notificationsJson
        };
        notificationsDefinition.userId = body.userId;
        notificationsDefinition.notificationsPref.push(notificationsPref);

        notificationsDefinitionCreate(notificationsDefinition)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
router.get('/api/private/notificationsDefinition', (req, res, next) => {
    var context = "GET /api/private/notificationsDefinition";
    try {
        var received = req.body;
        var query = {
            userId: received.userId,
            notificationsPref: {
                $elemMatch: {
                    clientType: received.clientType
                }
            }
        };

        notificationsDefinitionFindOne(query)
            .then((notificationsDefinitionFound) => {
                if (notificationsDefinitionFound) {
                    var query = {
                        userId: received.userId,
                        notificationsPref: {
                            $elemMatch: {
                                clientType: received.clientType,
                                notifications: {
                                    $elemMatch: {
                                        nameOfNotification: received.nameOfNotification,
                                        actionsList: {
                                            $elemMatch: {
                                                action: received.action,
                                                enabled: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    };
                    notificationsDefinitionFindOne(query)
                        .then((result) => {
                            if (result) {
                                return res.status(200).send(true);
                            }
                            else {
                                return res.status(200).send(false);
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][notificationsDefinitionFindOne] Error `, error);
                            return res.status(500).send(error.message);
                        });
                }
                else {

                    var query = {
                        userId: received.userId
                    };

                    var notificationDef = {
                        notificationsPref: [
                            {
                                clientType: received.clientType,
                                notifications: notificationsJson
                            }
                        ]
                    };

                    var newValues = { $set: notificationDef };
                    notificationsDefinitionUpdate(query, newValues)
                        .then((result) => {
                            var query = {
                                userId: received.userId,
                                notificationsPref: {
                                    $elemMatch: {
                                        clientType: received.clientType,
                                        notifications: {
                                            $elemMatch: {
                                                nameOfNotification: received.nameOfNotification,
                                                actionsList: {
                                                    $elemMatch: {
                                                        action: received.action,
                                                        enabled: true
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            };
                            notificationsDefinitionFindOne(query)
                                .then((result) => {
                                    if (result) {
                                        return res.status(200).send(true);
                                    }
                                    else {
                                        return res.status(200).send(false);
                                    };
                                })
                                .catch((error) => {
                                    console.error(`[${context}][notificationsDefinitionFindOne] Error `, error);
                                    return res.status(500).send(error.message);
                                });
                        })
                        .catch((error) => {
                            console.error(`[${context}][notificationsDefinitionUpdate] Error `, error);
                            return res.status(500).send(error.message);
                        });
                };
            })
            .catch((error) => {
                console.error(`[${context}][notificationsDefinitionFindOne] Error `, error);
                return res.status(500).send(error.message);
            });
        //return res.status(200).send('OK');
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
router.delete('/api/private/notificationsDefinition', (req, res, next) => {
    var context = "DELETE /api/private/notificationsDefinition";
    try {

        var body = req.body;
        var query = {
            userId: body.userId
        };
        notificationsDefinitionRemove(query)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========

function notificationsDefinitionFindOne(query) {
    var context = "Function notificationsDefinitionFindOne";
    return new Promise((resolve, reject) => {
        NotificationsDefinition.findOne(query, (err, notificationsDefinitionFound) => {
            if (err) {
                console.error(`[${context}] Error `, err);
                reject(err);
            }
            else {
                resolve(notificationsDefinitionFound);
            };
        });
    });
};

function notificationsDefinitionCreate(notificationsDefinition) {
    var context = "Function notificationsDefinitionCreate";
    return new Promise((resolve, reject) => {
        NotificationsDefinition.createNotificationsDefinition(notificationsDefinition, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function notificationsDefinitionUpdate(query, newValues) {
    var context = "Function notificationsDefinitionUpdate";
    return new Promise((resolve, reject) => {
        NotificationsDefinition.updateNotificationsDefinition(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function notificationsDefinitionRemove(query) {
    var context = "Function notificationsDefinitionRemove";
    return new Promise((resolve, reject) => {
        NotificationsDefinition.removeNotificationsDefinition(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

//Run first time
router.post('/api/private/setupNotifications', (req, res, next) => {
    var context = "POST /api/private/setupNotifications";
    try {

        var host = process.env.HostUsers + process.env.PathUsers;

        axios.get(host, {})
            .then((result) => {
                var users = result.data;
                users.map(user => {
                    var query = {
                        userId: user._id
                    };
                    notificationsDefinitionFindOne(query)
                        .then((result) => {
                            if (!result) {

                                var notificationsDefinition = new NotificationsDefinition();
                                notificationsDefinition.userId = user._id;
                                notificationsDefinitionCreate(notificationsDefinition)
                                    .then((result) => {
                                        console.log("Result notifications definition created");
                                    })
                                    .catch((error) => {
                                        console.error(`[] Error`, error);
                                    });
                            };
                        })
                        .catch((error) => {
                            console.error(`[] Error`, error.response.data);
                        });
                });

            })
            .catch((error) => {
                console.error(`[] Error`, error);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    };
});

module.exports = router;