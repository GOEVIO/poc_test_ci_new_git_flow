const express = require('express');

const router = express.Router();
let Drivers = require('../models/drivers');
require("dotenv-safe").load();
const axios = require("axios");

//========== POST ==========
//Create a new pool drivers
router.post('/api/private/drivers', (req, res, next) => {
    let context = "POST /api/private/drivers";
    try {
        let userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        else {
            let drivers = new Drivers(req.body);
            drivers.userId = userId;
            drivers.clientName = clientName;
            Drivers.createDrivers(drivers, (err, result) => {
                if (err) {
                    console.error(`[${context}][createDrivers] Error `, err.message);
                    return res.status(500).send(err.message);
                } else {
                    if (result)
                        return res.status(200).send(result);
                    else
                        return res.status(400).send({ auth: false, code: 'server_drivers_not_created', message: "Drivers not created" });
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/drivers/runFirstTime', (req, res, next) => {
    let context = "POST /api/private/drivers/runFirstTime";
    try {
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Remove a user from driver pool
router.patch('/api/private/drivers_old', (req, res, next) => {
    const context = "PATCH /api/private/drivers_old";
    try {
        let userId = req.headers['userid'];
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        else {
            let received = req.body;
            let query = {
                $and: [
                    { _id: received._id },
                    { userId: userId }
                ]
            };
            Drivers.findOne(query, (err, driversFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                } else {
                    if (driversFound) {
                        if (received.drivers.length == 0) {
                            return res.status(400).send({ auth: false, code: 'server_no_drivers_to_remove', message: "No drivers to remove" });
                        }
                        else {
                            const removeDriver = (driver) => {
                                return new Promise((resolve, reject) => {
                                    let found = driversFound.poolOfDrivers.indexOf(driversFound.poolOfDrivers.find(element => {
                                        if (element.driverId) {

                                            return element.driverId === driver.driverId;

                                        }
                                        else {

                                            return element.mobile === driver.mobile && element.internationalPrefix === driver.internationalPrefix;

                                        };
                                    }));
                                    if (found >= 0) {

                                        //console.log("driversFound.poolOfDrivers[found]", driversFound.poolOfDrivers[found]);
                                        //console.log("driversFound.poolOfDrivers[found]", driver);

                                        if (driversFound.poolOfDrivers[found].mobile == driver.mobile && driversFound.poolOfDrivers[found].internationalPrefix == driver.internationalPrefix && driversFound.poolOfDrivers[found].driverId == driver.driverId) {

                                            driversFound.poolOfDrivers.splice(found, 1);
                                            removeDriverFromEVs(driver, userId)
                                                .then(() => {
                                                    resolve(true);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][removeDriverFromEVs] Error `, error.message);
                                                    reject(error);
                                                });
                                        } else if (driversFound.poolOfDrivers[found].driverId == driver.driverId) {
                                            driversFound.poolOfDrivers.splice(found, 1);
                                            removeDriverFromEVs(driver, userId)
                                                .then(() => {
                                                    resolve(true);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][removeDriverFromEVs] Error `, error.message);
                                                    reject(error);
                                                });
                                        } else {
                                            resolve(false);
                                        };
                                    }
                                    else {
                                        resolve(true);
                                    };
                                });
                            };
                            Promise.all(
                                received.drivers.map(driver => removeDriver(driver))
                            ).then(() => {
                                let newValues = { $set: driversFound };
                                Drivers.updateDrivers(query, newValues, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][updateDrivers] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    } else {
                                        if (result) {

                                            getDriversId(driversFound, userId)
                                                .then((driversFound) => {
                                                    return res.status(200).send(driversFound);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][getDriversId][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        } else
                                            return res.status(400).send({ auth: false, code: 'server_divers_unsuccessfully_removed', message: "Divers unsuccessfully removed" });
                                    }
                                });
                            });
                        }
                    } else {
                        return res.status(400).send({ auth: false, code: 'server_no_drivers', message: "No drivers for user" });
                    };
                };
            });

        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/drivers', async (req, res, next) => {
    const context = "PATCH /api/private/drivers";
    try {

        let userId = req.headers['userid'];
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });

        let received = req.body;

        let query = {
            $and: [
                { _id: received._id },
                { userId: userId }
            ]
        };

        //console.log("received", received);
        let driversFound = await Drivers.findOne(query);

        if (driversFound) {
            if (received.drivers.length === 0) {

                return res.status(400).send({ auth: false, code: 'server_no_drivers_to_remove', message: "No drivers to remove" });

            } else {

                Promise.all(
                    received.drivers.map(driver => {
                        return new Promise((resolve, reject) => {
                            let found = driversFound.poolOfDrivers.findIndex(element => {
                                if (element.driverId)
                                    return element.driverId === driver.driverId;
                                else
                                    return element.mobile === driver.mobile && element.internationalPrefix === driver.internationalPrefix;
                            });



                            if (found >= 0) {

                                if (driversFound.poolOfDrivers[found].mobile == driver.mobile && driversFound.poolOfDrivers[found].internationalPrefix == driver.internationalPrefix && driversFound.poolOfDrivers[found].driverId == driver.driverId) {
                                    console.log("1");
                                    driversFound.poolOfDrivers.splice(found, 1);
                                    removeDriverFromEVs(driver, userId)
                                        .then(() => {
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][removeDriverFromEVs] Error `, error.message);
                                            reject(error);
                                        });
                                } else if (driversFound.poolOfDrivers[found].mobile == driver.mobile && driversFound.poolOfDrivers[found].internationalPrefix == driver.internationalPrefix) {
                                    console.log("4");
                                    driversFound.poolOfDrivers.splice(found, 1);
                                    removeDriverFromEVs(driver, userId)
                                        .then(() => {
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][removeDriverFromEVs] Error `, error.message);
                                            reject(error);
                                        });
                                } else if (driversFound.poolOfDrivers[found].driverId == driver.driverId) {
                                    console.log("2");
                                    driversFound.poolOfDrivers.splice(found, 1);
                                    removeDriverFromEVs(driver, userId)
                                        .then(() => {
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][removeDriverFromEVs] Error `, error.message);
                                            reject(error);
                                        });
                                } else {
                                    console.log("3");
                                    resolve(false);
                                };

                            } else {
                                resolve(true);
                            };
                        });
                    })
                ).then(async () => {

                    let newValues = { $set: driversFound };
                    let result = await Drivers.findOneAndUpdate(query, newValues, { new: true });
                    if (result) {
                        return res.status(200).send(result);
                    } else
                        return res.status(400).send({ auth: false, code: 'server_divers_unsuccessfully_removed', message: "Divers unsuccessfully removed" });

                });
            };
        } else {

            return res.status(400).send({ auth: false, code: 'server_no_drivers', message: "No drivers for user" });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/drivers_new', (req, res, next) => {
    let context = "PATCH /api/private/drivers_new";
    try {

        let userId = req.headers['userid'];
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        else {
            let received = req.body;
            console.log("received", received);
            let query = {
                _id: received._id,
                userId: userId
            };

            Drivers.findOne(query, (err, driversFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {

                    console.log("driversFound", driversFound);
                    if (driversFound) {
                        if (received.drivers.length == 0) {
                            return res.status(400).send({ auth: false, code: 'server_no_drivers_to_remove', message: "No drivers to remove" });
                        }
                        else {
                            Promise.all(
                                received.drivers.map(driver => {
                                    return new Promise((resolve, reject) => {

                                    });
                                })
                            ).then(() => {

                            }).catch((error) => {

                            });
                        };
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_no_drivers', message: "No drivers for user" });
                    };

                };
            });
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========

//Function to verify if the user is registered
function verifyUsers(poolDrivers) {
    let context = "Function verifyUsers";
    return new Promise((resolve, reject) => {
        let result = {};
        try {
            let noId = poolDrivers.drivers.filter((driver) => {
                return driver._id == "";
            });
            let withId = poolDrivers.drivers.filter((driver) => {
                return driver._id != "";
            });
            if (withId.length != 0) {
                let idUndefined = withId.filter((driver) => {
                    return driver._id === undefined;
                });
                result.withId = withId.filter((driver) => {
                    return driver._id !== undefined;
                });
                result.noId = noId.concat(idUndefined);
                resolve(result);
            } else {
                result = {
                    noId: noId,
                    withId: []
                };
                resolve(result);
            };
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function removeDriverFromEVs(driver, userId) {
    const context = "Function removeDriverFromEVs";
    return new Promise((resolve, reject) => {
        try {

            let data = {
                userId: userId,
                mobile: driver.mobile,
                internationalPrefix: driver.internationalPrefix,
                driverId: driver.driverId
            };

            let host = process.env.HostEv + process.env.PathRemoveDriversAllEVs;

            axios.patch(host, data)
                .then((result) => {
                    console.log("Driver removed from EV");
                    resolve(true);
                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error `, error.message);
                    reject(error);
                })

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };

    });

};

module.exports = router;