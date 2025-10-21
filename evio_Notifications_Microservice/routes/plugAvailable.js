const express = require('express');
const router = express.Router();
var PlugAvailable = require('../models/plugAvailable');
require("dotenv-safe").load();

//========== POST ==========
//Create notification
//Deprecated
router.post('/api/private/notifications/plugAvailable', (req, res, next) => {
    var context = "POST /api/private/notifications/plugAvailable";
    try {
        const plugAvailable = new PlugAvailable(req.body);
        var userId = req.headers['userid'];
        plugAvailable.userId = userId;
        validateFields(plugAvailable, res);
        PlugAvailable.createPlugAvailable(plugAvailable, (err, result) => {
            if (err) {
                console.log(`[${context}][createPlugAvailable] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_notification_not_created', message: "Notification not created" });
                };
            };
        });
    } catch (ex) {
        console.log(`[${context}] Error `, ex.message);
        return res.status(500).send(ex.message);
    };
});

//========== PATCH ==========
//Edit notification
//Deprecated
router.patch('/api/private/notifications/plugAvailable', (req, res, next) => {
    var context = "POST /api/private/notifications/plugAvailable";
    try {
        var plugAvailable = req.body;
        var query = Object.assign(plugAvailable, { isToSend: false });
        PlugAvailable.find(query, (err, result) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result.length > 0) {
                    const changeIsToSent = (notification) => {
                        return new Promise((resolve, reject) => {
                            try {
                                notification.isToSend = true;
                                var newValues = { $set: notification };
                                var query = { _id: notification._id };
                                updatePlugAvailable(query, newValues)
                                    .then((value) => {
                                        resolve(true);
                                    })
                                    .catch(() => {
                                        resolve(false);
                                    });
                            } catch (error) {
                                console.log(`[${context}][function changeIsToSent] Error `, error.message);
                                reject(error);
                            };
                        });
                    };

                    Promise.all(
                        result.map(notification => changeIsToSent(notification))
                    )
                        .then((value) => {
                            return res.status(200).send(result);

                        })
                        .catch((error) => {
                            console.log(`[${context}][map] Error `, error.message);
                            return res.status(500).send(error.message);
                        })
                } else {
                    return res.status(200).send(result);
                };
            };
        });
    } catch (ex) {
        console.log(`[${context}] Error `, ex.message);
        return res.status(500).send(ex.message);
    };
});

//========== GET ==========
//Get to verify if the user has any active notifications
//Deprecated
router.get('/api/private/notifications/plugAvailable/notified', (req, res, next) => {
    var context = "GET /api/private/notifications/plugAvailable/notified";
    try {
        var data = req.body;
        var query = {
            $and: [
                { plugId: data.plugId },
                { userId: data.userId },
                { isToSend: false }
            ]
        };
        PlugAvailable.findOne(query, (err, result) => {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result)
                    return res.status(200).send(false);
                else
                    return res.status(200).send(true);
            };
        });
    } catch (ex) {
        console.log(`[${context}] Error `, ex.message);
        return res.status(500).send(ex.message);
    };
});

//========== FUNCTION ==========
//Function to validate fields received 
function validateFields(plugAvailable, res) {
    if (!plugAvailable)
        return res.status(400).send({ auth: false, code: 'server_data_required', message: 'Data required' });

    if (!plugAvailable.hwId)
        return res.status(400).send({ auth: false, code: 'server_hwid_required', message: 'Charger Hardware Id is required' });

    if (!plugAvailable.hwId)
        return res.status(400).send({ auth: false, code: 'server_plugId_required', message: 'Plug Id is required' });

    if (!plugAvailable.userId)
        return res.status(400).send({ auth: false, code: 'server_userId_required', message: 'User Id is required' });

};

function updatePlugAvailable(query, newValues) {
    var context = "Function updatePlugAvailable";
    return new Promise((resolve, reject) => {
        try {
            PlugAvailable.updatePlugAvailable(query, newValues, (err, result) => {
                if (err) {
                    console.log(`[${context}][updateCharger] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result) {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    };
                };
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
}

module.exports = router;