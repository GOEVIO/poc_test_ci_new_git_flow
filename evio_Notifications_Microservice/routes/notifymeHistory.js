const express = require('express');
const router = express.Router();
const axios = require('axios');
const Sentry = require('@sentry/node');
var NotifymeHistory = require('../models/notifymeHistory');
require("dotenv-safe").load();

//========== POST ==========
//Create notification
router.post('/api/private/notifymeHistory', (req, res, next) => {
    let context = "POST /api/private/notifymeHistory";
    try {
        const notifymeHistory = new NotifymeHistory(req.body);
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        validateFields(notifymeHistory)
            .then(() => {
                let query = {
                    topic: notifymeHistory.topic,
                    chargerId: notifymeHistory.chargerId,
                    hwId: notifymeHistory.hwId,
                    plugId: notifymeHistory.plugId,
                    chargerType: notifymeHistory.chargerType,
                    active: true
                };
                notifymeHistoryFindOne(query)
                    .then((notifymeHistoryFound) => {
                        if (notifymeHistoryFound) {
                            let newUserId = {
                                userId: userId,
                                clientName: clientName
                            };
                            notifymeHistoryFound.listOfUsers.push(newUserId);
                            let newValue = { $set: notifymeHistoryFound };
                            query = {
                                _id: notifymeHistoryFound._id
                            };
                            notifymeHistoryUpdate(query, newValue)
                                .then((result) => {
                                    if (result) {
                                        return res.status(200).send({ auth: true, code: 'server_notification_created', message: "Notification created" });
                                    }
                                    else {
                                        return res.status(400).send({ auth: false, code: 'server_notification_not_created', message: "Notification not created" });
                                    };
                                })
                                .catch((error) => {
                                    console.error(`[${context}][notifymeHistoryUpdate] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            let newUserId = {
                                userId: userId,
                                clientName: clientName
                            };
                            notifymeHistory.listOfUsers.push(newUserId);
                            notifymeHistoryCreate(notifymeHistory, res);
                        };
                    })
                    .catch((error) => {
                        console.error(`[${context}][notifymeHistoryFindOne] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.delete('/api/private/notifymeHistory', async (req, res, next) => {
    let context = "DELETE /api/private/notifymeHistory";
    try {
        const notifymeHistory = new NotifymeHistory(req.body);
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        await validateFields(notifymeHistory);

        let query = {
            topic: notifymeHistory.topic,
            chargerId: notifymeHistory.chargerId,
            hwId: notifymeHistory.hwId,
            plugId: notifymeHistory.plugId,
            chargerType: notifymeHistory.chargerType,
            active: true
        };

        let notifymeHistoryFound = await notifymeHistoryFindOne(query);

        if (!notifymeHistoryFound) {
            return res.status(400).send({ auth: false, code: 'server_notification_not_found', message: "Notification not found" });
        }

        let userIndex = notifymeHistoryFound.listOfUsers.findIndex(user => user.userId === userId && user.clientName === clientName);

        if (userIndex === -1) {
            return res.status(400).send({ auth: false, code: 'server_notification_not_found', message: "Notification not found" });
        }

        notifymeHistoryFound.listOfUsers.splice(userIndex, 1);
        let newValue = { $set: notifymeHistoryFound };
        query = {
            _id: notifymeHistoryFound._id
        };

        let result = await notifymeHistoryUpdate(query, newValue);

        if (!result) {
            return res.status(400).send({ auth: false, code: 'server_notification_not_deleted', message: "Notification not deleted" });
        }

        return res.status(200).send({ auth: true, code: 'server_notification_deleted', message: "Notification deleted" });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        next(error);
    };
});

//========== PATCH ==========
//Edit notification
router.patch('/api/private/notifymeHistory', (req, res, next) => {
    var context = "PATCH /api/private/notifymeHistory";
    try {

        var query = req.body;
        query.active = true;

        notifymeHistoryFindOne(query)
            .then((notifymeHistoryFound) => {
                if (notifymeHistoryFound) {
                    //TODO
                    /*
                        It remains to do the placement at the entrance of the notifications table and only then do the update on notifymeHistory
                    */
                    notifymeHistoryFound.active = false
                    var newValue = { $set: notifymeHistoryFound };
                    query = {
                        _id: notifymeHistoryFound._id
                    };
                    notifymeHistoryUpdate(query, newValue)
                        .then((result) => {
                            if (result) {
                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][notifymeHistoryUpdate] Error `, error.message);
                            return res.status(500).send(error.message);
                        });

                }
                else {
                    return res.status(200).send({ auth: false, code: 'server_notification_not_found', message: "Notification not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][notifymeHistoryFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/verifyNotifymeHistory', (req, res, next) => {
    var context = "GET /api/private/verifyNotifymeHistory";

    try {
        var query = req.body;
        notifymeHistoryFindOne(query)
            .then(notifymeHistoryFound => {
                if (notifymeHistoryFound) {
                    return res.status(200).send(false);

                } else {
                    return res.status(200).send(true);
                }
            })
            .catch(error => {
                console.error(`[${context}][notifymeHistoryFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            })


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/notifymeHistoryFindOne', (req, res, next) => {
    var context = "GET /api/private/notifymeHistoryFindOne";

    try {
        var query = req.body;
        console.log("query", query);
        notifymeHistoryFindOne(query)
            .then(notifymeHistoryFound => {
                console.log("notifymeHistoryFound", notifymeHistoryFound)
                return res.status(200).send(notifymeHistoryFound);
            })
            .catch(error => {
                console.error(`[${context}][notifymeHistoryFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            })


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.post('/api/private/verifyNotifymeHistoryBulk', async (req, res, next) => {
    const context = "POST /api/private/verifyNotifymeHistoryBulk";

    try {
        let queries = req.body.queries;
        if (!Array.isArray(queries) ) {
            queries = [queries];
        }
        if (queries.length === 0) {
            return res.status(200).send([]);
        }

        const query = { $or: queries };
        const results = await notifymeHistoryFindMany(query);


        return res.status(200).send(results);
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        Sentry.captureException(err);
        return res.status(500).send(error.message);
    }
});

router.get('/api/private/notifymeHistoryList', (req, res, next) => {
    var context = "GET /api/private/notifymeHistoryList";

    const userId = req.headers['userid'];

    try {
        let query = {
            active: true,
            listOfUsers: {
                $elemMatch: {
                    userId: userId,
                }
            }
        }
        notifymeHistoryFind(query)
            .then(notifymeHistoryFound => {
                if (notifymeHistoryFound.length > 0) {
                    Promise.all(notifymeHistoryFound.map(async (notifymeHistoryI, notifyIndex) => {
                        let publicNetworkChargerType = process.env.PublicNetworkChargerType;
                        publicNetworkChargerType = publicNetworkChargerType.split(',');
                        let found = publicNetworkChargerType.find(type => {
                            return type === notifymeHistoryI.chargerType;
                        });
                        let chargersEndpoint;

                        if (found) {
                            chargersEndpoint = process.env.PublicNetworkHost + process.env.PathGetPublicNetworkCharger
                        } else {
                            chargersEndpoint = process.env.ChargerHost + process.env.PathGetChargerById
                        }
                        let queryCharger = {
                            hwId: notifymeHistoryI.hwId,
                            chargerType: notifymeHistoryI.chargerType
                        };

                        return getCharger(chargersEndpoint, queryCharger)
                            .then(chargerFound => {
                                if (chargerFound.length > 0) {
                                    chargerFound = chargerFound[0]
                                }

                                return {
                                    _id: notifymeHistoryI._id,
                                    active: notifymeHistoryI.active,
                                    chargerId: notifymeHistoryI.chargerId,
                                    hwId: notifymeHistoryI.hwId,
                                    plugId: notifymeHistoryI.plugId,
                                    topic: notifymeHistoryI.topic,
                                    chargerType: notifymeHistoryI.chargerType,
                                    listOfUsers: notifymeHistoryI.listOfUsers,
                                    address: chargerFound.address,
                                    name: chargerFound.name,
                                    imageContent: chargerFound.imageContent
                                }
                            })
                            .catch(error => {
                                console.error(`[${context}][getCharger] Error `, error.message);
                                return res.status(500).send(error.message);
                            })
                    }))
                        .then(result => {
                            return res.status(200).send(result);
                        })
                        .catch(error => {
                            console.error(`[${context}][promise.all] Error `, error.message);
                            return res.status(500).send(error.message);
                        })


                } else {
                    return res.status(200).send([]);
                }
            })
            .catch(error => {
                console.error(`[${context}][notifymeHistoryFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            })


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/notifymeHistoryUpdate', (req, res, next) => {
    var context = "GET /api/private/notifymeHistoryUpdate";

    try {
        var query = {
            _id: req.body._id
        }
        var newValue = { $set: req.body }
        notifymeHistoryUpdate(query, newValue)
            .then(result => {
                return res.status(200).send(result);
            })
            .catch(error => {
                console.error(`[${context}][notifymeHistoryUpdate] Error `, error.message);
                return res.status(500).send(error.message);
            })


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

router.patch('/api/private/notifymeRemoveUser', (req, res, next) => {
    var context = "PATCH /api/private/notifymeRemoveUser";

    const userId = req.headers['userid'];

    try {
        let query = {
            hwId: req.body.hwId,
            plugId: req.body.plugId,
            active: true,
        }
        notifymeHistoryFindOne(query)
            .then((notifymeHistoryFound) => {
                if (notifymeHistoryFound) {
                    let usersList = notifymeHistoryFound.listOfUsers
                    notifymeHistoryFound.listOfUsers = usersList.filter(e => e !== usersList.find(element => element.userId == userId))
                    var newValue = { $set: notifymeHistoryFound }
                    notifymeHistoryUpdate(query, newValue)
                        .then(async result => {
                            let myResult = await notifymeHistoryFindOne(query)
                            return res.status(200).send(myResult);
                        })
                        .catch(error => {
                            console.error(`[${context}][notifymeHistoryUpdate] Error `, error.message);
                            return res.status(500).send(error.message);
                        })
                } else {
                    return res.status(200).send({ auth: false, code: 'server_notification_not_found', message: "Notification not found for given parameters" });
                }
            })
            .catch((error) => {
                console.error(`[${context}][notifymeHistoryFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});

//========== FUNCTION ==========
//Function to validate fields received 
function validateFields(notifymeHistory) {
    return new Promise((resolve, reject) => {
        if (!notifymeHistory)
            reject({ auth: false, code: 'server_data_required', message: 'Data required' });

        else if (!notifymeHistory.topic)
            reject({ auth: false, code: 'server_topic_required', message: 'Topic is required' });

        else if (!notifymeHistory.chargerId)
            reject({ auth: false, code: 'server_charger_id_required', message: 'Charger id is required' });

        else if (!notifymeHistory.hwId)
            reject({ auth: false, code: 'server_hwid_required', message: 'Charger Hardware Id is required' });

        else if (!notifymeHistory.plugId)
            reject({ auth: false, code: 'server_plugId_required', message: 'Plug Id is required' });

        else if (!notifymeHistory.chargerType)
            reject({ auth: false, code: 'server_chargerType_required', message: 'Charger type is required' });

        else
            resolve(true);

    });
};

function notifymeHistoryFind(query) {
    var context = "Function notifymeHistoryFind";
    return new Promise((resolve, reject) => {
        NotifymeHistory.find(query, (error, notifymeHistoryFound) => {
            if (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
            else {
                resolve(notifymeHistoryFound);
            };
        });
    });
};

//Function to find one notifymeHistory
function notifymeHistoryFindOne(query) {
    var context = "Function notifymeHistoryFindOne";
    return new Promise((resolve, reject) => {
        NotifymeHistory.findOne(query, (error, notifymeHistoryFound) => {
            if (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
            else {
                resolve(notifymeHistoryFound);
            };
        });
    });
};

async function notifymeHistoryFindMany(query) {
    const context = "Function notifymeHistoryFindMany";
    try {
        const notifymeHistoryFound = await NotifymeHistory.find(query);
        return notifymeHistoryFound;
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
}


//Function to create a new entry on notifymeHistory 
function notifymeHistoryCreate(notifymeHistory, res) {
    var context = "Function notifymeHistoryCreate";
    NotifymeHistory.createNotifymeHistory(notifymeHistory, (error, result) => {
        if (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        }
        else {
            if (result) {
                return res.status(200).send({ auth: true, code: 'server_notification_created', message: "Notification created" });
            }
            else {
                return res.status(400).send({ auth: false, code: 'server_notification_not_created', message: "Notification not created" });
            };
        };
    });
};

//Function to update a notifymeHistory
function notifymeHistoryUpdate(query, newValue) {
    var context = "Function notifymeHistoryUpdate";
    return new Promise((resolve, reject) => {
        NotifymeHistory.updateNotifymeHistory(query, newValue, (error, result) => {
            if (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
            else {
                resolve(result)
            };
        })
    });
};

function getCharger(chargerProxy, params) {
    var context = "Function getCharger";
    return new Promise((resolve, reject) => {
        try {
            axios.get(chargerProxy, { params })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    reject(error);
                    //reject(error);
                });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
            //reject(error);
        };
    });
};

module.exports = router;