const express = require('express');
const router = express.Router();
var NotifymeHistory = require('../models/notifymeHistory');
require("dotenv-safe").load();

//========== POST ==========
//Create notification
router.post('/api/private/notifymeHistory', (req, res, next) => {
    var context = "POST /api/private/notifymeHistory";
    try {
        const notifymeHistory = new NotifymeHistory(req.body);
        var userId = req.headers['userid'];
        validateFields(notifymeHistory)
            .then(() => {
                var query = {
                    topic: notifymeHistory.topic,
                    chargerId: notifymeHistory.chargerId,
                    hwId: notifymeHistory.hwId,
                    plugId: notifymeHistory.plugId,
                    active: true
                };
                notifymeHistoryFindOne(query)
                    .then((notifymeHistoryFound) => {
                        if (notifymeHistoryFound) {
                            var newUserId = {
                                userId: userId
                            };
                            notifymeHistoryFound.listOfUsers.push(newUserId);
                            var newValue = { $set: notifymeHistoryFound };
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
                                    console.error(`[${context}][notifymeHistoryUpdate] Error`, error);
                                    return res.status(500).send(error);
                                });
                        }
                        else {
                            var newUserId = {
                                userId: userId
                            };
                            notifymeHistory.listOfUsers.push(newUserId);
                            notifymeHistoryCreate(notifymeHistory, res);
                        };
                    })
                    .catch((error) => {
                        console.error(`[${context}][notifymeHistoryFindOne] Error`, error);
                        return res.status(500).send(error);
                    });
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return res.status(500).send(error);
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
                            console.error(`[${context}][notifymeHistoryUpdate] Error`, error);
                            return res.status(500).send(error);
                        });

                }
                else {
                    return res.status(200).send({ auth: false, code: 'server_notification_not_found', message: "Notification not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][notifymeHistoryFindOne] Error`, error);
                return res.status(500).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return res.status(500).send(error);
    };
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

        else
            resolve(true);

    });
};

//Function to find one notifymeHistory
function notifymeHistoryFindOne(query) {
    var context = "Function notifymeHistoryFindOne";
    return new Promise((resolve, reject) => {
        NotifymeHistory.findOne(query, (error, notifymeHistoryFound) => {
            if (error) {
                console.error(`[${context}] Error`, error);
                reject(error);
            }
            else {
                resolve(notifymeHistoryFound);
            };
        });
    });
};

//Function to create a new entry on notifymeHistory 
function notifymeHistoryCreate(notifymeHistory, res) {
    var context = "Function notifymeHistoryCreate";
    NotifymeHistory.createNotifymeHistory(notifymeHistory, (error, result) => {
        if (error) {
            console.error(`[${context}] Error`, error);
            return res.status(500).send(error);
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
                console.error(`[${context}] Error`, error);
                reject(error);
            }
            else {
                resolve(result)
            };
        })
    });
};

module.exports = router;