const express = require('express');
const router = express.Router();
const axios = require("axios");
const User = require('../models/user');
const CEMETariff = require('../models/cemeTariff');
const Contract = require('../models/contracts')
//const cemeTariff = require('../models/cemeTariff');
require("dotenv-safe").load();
const { logger } = require('../utils/constants');

//========== POST ==========
//Endpoint to create a new CEME Tariff
router.post('/api/private/cemeTariff', (req, res, next) => {
    var context = "POST /api/private/cemeTariff";
    try {
        var userId = req.headers['userid'];
        if (!userId) {

            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: 'User id is required' });

        }
        else {
            var cemeTariff = new CEMETariff(req.body);
            cemeTariff.userId = userId;

            validateFields(cemeTariff)
                .then(() => {

                    CEMETariff.createCEMETariff(cemeTariff, (err, result) => {
                        if (err) {
                            console.log(`[${context}][createCEMETariff] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (result) {
                                result = JSON.parse(JSON.stringify(result));
                                if (result.tariff != undefined) {
                                    var params = {
                                        _id: result.tariff.planId
                                    };
                                    getTariffCEME(params)
                                        .then((tariffInfo) => {
                                            tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                                return tariff.power === result.tariff.power
                                            });
                                            result.tariffInfo = tariffInfo;
                                            return res.status(200).send(result);
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getTariffCEME] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                }
                                else {

                                    return res.status(200).send(result);

                                };
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_contract_not_created', message: "Contract not created" });
                            }
                        };
                    });

                })
                .catch((error) => {

                    return res.status(400).send(error);

                });

        };
    } catch (error) {

        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.post('/api/private/cemeTariff/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/cemeTariff/runFirstTime";
    try {
        
        return res.status(200).send("OK");
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Endpoint to get all CEME Tariff of given user
router.get('/api/private/cemeTariff', (req, res, next) => {
    var context = "GET /api/private/cemeTariff";
    try {

        var userId = req.headers['userid'];
        var query = {
            userId: userId,
            active: true,
            CEME:"EVIO"
        };
        
        cemeTariffFind(query)
            .then((cemeTariffFound) => {
                if (cemeTariffFound.length == 0)
                    return res.status(200).send(cemeTariffFound);
                else {
                    cemeTariffFound = JSON.parse(JSON.stringify(cemeTariffFound));
                    Promise.all(
                        cemeTariffFound.map(cemeTariff => {
                            return new Promise((resolve, reject) => {
                                cemeTariff.cards = cemeTariff.cards.filter(card => {
                                    return card.active == true;
                                });
                                if (cemeTariff.tariff !== undefined) {
                                    var params = {
                                        _id: cemeTariff.tariff.planId
                                    };
                                    getTariffCEME(params)
                                        .then((tariffInfo) => {
                                            if (Object.keys(tariffInfo).length != 0) {
                                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                                    return tariff.power === cemeTariff.tariff.power
                                                });
                                                cemeTariff.tariffInfo = tariffInfo;
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            };
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getTariffCEME] Error `, error.message);
                                            reject(error);
                                        });
                                }
                                else {
                                    cemeTariff.tariffInfo = {};
                                    resolve(true);
                                }
                            });
                        })
                    ).then(() => {

                        cemeTariffFound.sort((x, y) => { return x.default - y.default });
                        cemeTariffFound.reverse();
                        return res.status(200).send(cemeTariffFound);

                    });
                };
            })
            .catch((error) => {
                console.log(`[${context}][cemeTariffFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Endpoint to edit a CEME Tariff
router.patch('/api/private/cemeTariff', (req, res, next) => {
    var context = "PATCH /api/private/cemeTariff";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id,
            userId: userId
        };
        var newValue = { $set: received };

        cemeTariffUpdate(query, newValue)
            .then((result) => {
                if (result) {
                    cemeTariffFindOne(query)
                        .then((received) => {
                            var params = {
                                _id: received.tariff.planId
                            };
                            getTariffCEME(params)
                                .then((tariffInfo) => {
                                    tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                        return tariff.power === received.tariff.power
                                    });
                                    received.tariffInfo = tariffInfo;
                                    return res.status(200).send(received);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][getTariffCEME] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        })
                        .catch((error) => {
                            console.log(`[${context}][cemeTariffFindOne] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][cemeTariffUpdate] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to edit a CEME Tariff
router.post('/api/private/cemeTariff/allContracts', async (req, res, next) => {
    var context = "PATCH /api/private/cemeTariff/allContracts"; 
    try {
        var userId = req.body.userId;
        var planId = req.body.planId;


        if (!planId) return res.status(400).send({ auth: false, code: 'tarrif_id_required', message: "Tarrif id necessary" });

        const query = {
            userId: userId
        };

        let cemeTariff = await cemeTariffFindOne(query)

        if (!cemeTariff) return res.status(400).send({ auth: false, code: 'no_user', message: "No tarrif for user" });

        cemeTariff.tariff.planId = planId;

        const newValue = { "$set": { "tariff": cemeTariff.tariff } }

        await Promise.all([  cemeTariffUpdate(query, newValue),  contractsUpdate(query, newValue) ])
       

        return res.status(200).send(cemeTariff);

    } catch (error) {
        logger.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Set Default Ceme Tariff
router.patch('/api/private/cemeTariff/setDefault', (req, res, next) => {
    var context = "PATCH /api/private/cemeTariff/setDefault";
    try {

        var cemeTariff = req.body._id;
        var userId = req.headers['userid'];

        CEMETariff.markAllAsNotDefault(userId, (err, result) => {
            if (err) {
                console.log(`[${context}][markAllAsNotDefault] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {

                CEMETariff.markAsDefaultCEMETariff(cemeTariff, userId, (err, result) => {
                    if (err) {
                        console.log(`[${context}][markAsDefaultCEMETariff] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {

                        var query = {
                            userId: userId,
                            active: true
                        };
                        cemeTariffFind(query)
                            .then((cemeTariffFound) => {
                                if (cemeTariffFound.length == 0)
                                    return res.status(200).send(cemeTariffFound);
                                else {
                                    cemeTariffFound = JSON.parse(JSON.stringify(cemeTariffFound));
                                    Promise.all(
                                        cemeTariffFound.map(cemeTariff => {
                                            return new Promise((resolve, reject) => {
                                                cemeTariff.cards = cemeTariff.cards.filter(card => {
                                                    return card.active == true;
                                                });
                                                if (cemeTariff.tariff !== undefined) {
                                                    var params = {
                                                        _id: cemeTariff.tariff.planId
                                                    };
                                                    getTariffCEME(params)
                                                        .then((tariffInfo) => {
                                                            if (Object.keys(tariffInfo).length != 0) {
                                                                tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                                                    return tariff.power === cemeTariff.tariff.power
                                                                });
                                                                cemeTariff.tariffInfo = tariffInfo;
                                                                resolve(true);
                                                            }
                                                            else {
                                                                resolve(false);
                                                            };
                                                        })
                                                        .catch((error) => {
                                                            console.log(`[${context}][getTariffCEME] Error `, error.message);
                                                            reject(error);
                                                        });
                                                }
                                                else {
                                                    cemeTariff.tariffInfo = {};
                                                    resolve(true);
                                                }
                                            });
                                        })
                                    ).then(() => {
                                        cemeTariffFound.sort((x, y) => { return x.default - y.default });
                                        cemeTariffFound.reverse();
                                        return res.status(200).send(cemeTariffFound);
                                    });
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][cemeTariffFind] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    };
                });

            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========

//========== DELETE ==========
//Endpoint to remove a CEME Tariff
router.delete('/api/private/cemeTariff', (req, res, next) => {
    var context = "PATCH /api/private/cemeTariff";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id,
            userId: userId
        };
        cemeTariffDelete(query)
            .then((result) => {
                if (result) {
                    return res.status(200).send({ auth: true, code: 'server_cemeTariff_removed', message: "CEME Tariff successfully removed" });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_cemeTariff_not_removed', message: "CEME Tariff unsuccessfully removed" });
                };
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========
async function contractsUpdate(query, newValues) {
    await Contract.updateMany(query, newValues)
}
function validateFields(cemeTariff) {
    var context = "Function validateFields";
    return new Promise((resolve, reject) => {
        if (!cemeTariff)
            reject({ auth: false, code: 'server_ccemeTariff_required', message: 'Ceme Tariff data is required' });

        else if (!cemeTariff.CEME)
            reject({ auth: false, code: 'server_CEME_required', message: 'CEME name is required' });

        else if (Object.keys(cemeTariff.tariff).length == 0)
            reject({ auth: false, code: 'server_tariff_required', message: 'Tariff is required' });

        else if (!cemeTariff.tariff.planId)
            reject({ auth: false, code: 'server_planId_required', message: 'PlanId is required' });

        else if (!cemeTariff.tariff.power)
            reject({ auth: false, code: 'server_power_required', message: 'Power is required' });

        else
            resolve(true);
    });
};

function getTariffCEME(params) {
    var context = "Function getTariffCEME";
    return new Promise((resolve, reject) => {

        console.log(`[${context}] cemeTariffs `,params)

        var host = process.env.HostTariffCEME + process.env.PathTariffCEME;
        axios.get(host, { params })
            .then((result) => {

                if (Object.keys(result.data).length != 0 && result.data.schedule.tariffType === process.env.TariffTypeBiHour) {
                    //Remove out of empty schedules
                    result.data = JSON.parse(JSON.stringify(result.data));
                    /*result.data.schedule.schedules = result.data.schedule.schedules.filter(schedule => {
                        return schedule.tariffType === process.env.TariffEmpty;
                    });*/
                    resolve(result.data);
                }
                else {
                    resolve(result.data);
                }
                // resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}] cemeTariffs Error `, error.message);
                reject(error);
            });
    });
};

function cemeTariffFind(query) {
    var context = "Function cemeTariffFind";
    return new Promise((resolve, reject) => {
        CEMETariff.find(query, (err, cemeTariffFound) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err.message);
                reject(err);
            }
            else {
                resolve(cemeTariffFound);
            };
        });
    });
};

function cemeTariffDelete(query) {
    var context = "Function cemeTariffDelete";
    return new Promise((resolve, reject) => {
        CEMETariff.removeCEMETariff(query, (err, result) => {
            if (err) {
                console.log(`[${context}][removeCEMETariff] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function cemeTariffUpdate(query, newValue) {
    var context = "Function cemeTariffUpdate";
    return new Promise((resolve, reject) => {
        CEMETariff.updateCEMETariff(query, newValue, (err, result) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function cemeTariffFindOne(query) {
    var context = "Function cemeTariffFindOne";
    return new Promise((resolve, reject) => {
        CEMETariff.findOne(query, (err, cemeTariffFound) => {
            if (err) {
                console.log(`[${context}][findone] Error `, err.message);
                reject(err);
            }
            else {
                resolve(cemeTariffFound);
            };
        });
    });
};

module.exports = router;