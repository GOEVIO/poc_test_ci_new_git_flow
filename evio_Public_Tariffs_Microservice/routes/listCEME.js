const express = require('express');
const router = express.Router();
const axios = require("axios");
var ListCEME = require('../models/listCEME');
var fs = require('fs');
var CEMEList = require('../models/CEME.json');
var TariffCEME = require('../models/tariffCEME');
var SchedulesCEME = require('../models/schedulesCEME');
require("dotenv-safe").load();


//========== POST ==========
//Endpoit to create a new CEME 
router.post('/api/private/listCEME', async (req, res, next) => {
    var context = "POST /api/private/listCEME";
    try {

        var listCEME = new ListCEME(req.body);
        if (listCEME.imageCEME === undefined) {
            listCEME.imageCEME = "";
        };
        if (listCEME.imageCard === undefined) {
            listCEME.imageCard = "";
        };
        if (listCEME.imageCEME.includes('base64')) {
            let imageCEME = await saveImageCeme(listCEME);
            listCEME.imageCEME = imageCEME;
        };
        if (listCEME.imageCard.includes('base64')) {
            let imageCard = await saveImageCard(listCEME);
            listCEME.imageCard = imageCard;
        };
        createListCEME(listCEME)
            .then((result) => {
                if (result)
                    return res.status(200).send(result);
                else
                    return res.status(400).send({ auth: false, code: 'server_CEME_not_created', message: "CEME not created" });
            })
            .catch((error) => {
                console.error(`[${context}][createListCEME] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/listCEME/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/listCEME/runFirstTime";
    try {

        runFirstTime();
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Endpoint to get all CEME operators
router.get('/api/private/listCEME', (req, res, next) => {
    var context = "GET /api/private/listCEME";
    try {
        ListCEME.find({}, (err, listCEME) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                //listCEME.sort((a, b) => (a.order > b.order) ? 1 : ((b.order > a.order) ? -1 : 0));
                listCEME = JSON.parse(JSON.stringify(listCEME));
                var newListCEME = [];
                Promise.all(
                    listCEME.map(ceme => {
                        return new Promise((resolve, reject) => {
                            var query = {
                                CEME: ceme.CEME,
                                visivel: true
                            };
                            tariffCEMEFind(query)
                                .then((tariffFound) => {
                                    getSchedules(tariffFound)
                                        .then((result) => {
                                            ceme = JSON.parse(JSON.stringify(ceme));

                                            if (result.length !== 0) {

                                                ceme.listPlans = result;
                                                newListCEME.push(ceme);
                                                resolve(true);

                                            }
                                            else {

                                                resolve(false);

                                            }
                                        })
                                        .catch((error => {
                                            console.error(`[${context}][getSchedules] Error `, error.message);
                                            reject(error);
                                        }));
                                })
                                .catch((error) => {
                                    console.error(`[${context}][tariffCEMEFind] Error `, error.message);
                                    reject(error);
                                });
                        });
                    })
                ).then(() => {
                    newListCEME.sort((a, b) => (a.order > b.order) ? 1 : ((b.order > a.order) ? -1 : 0));
                    return res.status(200).send(newListCEME);
                }).catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);
                });
                //return res.status(200).send(listCEME);
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Edit a CEME operator
router.patch('/api/private/listCEME', (req, res, next) => {
    var context = "PATCH /api/private/listCEME";
    try {
        var received = req.body;
        var query = {
            _id: received._id
        };
        listCEMEFindOne(query)
            .then(async (CEMEFound) => {
                if (CEMEFound) {
                    CEMEFound.CEME = received.CEME;
                    if (received.imageCEME.includes('base64')) {
                        let imageCEME = await saveImageCeme(received);
                        CEMEFound.imageCEME = imageCEME;
                    }
                    else if (received.imageCEME == "" && CEMEFound.imageCEME != "") {
                        CEMEFound.imageCEME = "";
                    };
                    if (received.imageCard.includes('base64')) {
                        let imageCard = await saveImageCard(received);
                        CEMEFound.imageCard = imageCard;
                    }
                    else if (received.imageCard == "" && CEMEFound.imageCard != "") {
                        CEMEFound.imageCard = "";
                    };
                    var newValue = { $set: CEMEFound };
                    listCEMEUpdate(query, newValue)
                        .then((result) => {
                            if (result) {
                                return res.status(200).send(CEMEFound);
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][listCEMEUpdate] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else
                    return res.status(400).send({ auth: false, code: 'server_CEME_not_found', message: 'CEME not found for given parameters' });
            })
            .catch((error) => {
                console.error(`[${context}][listCEMEFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete a CEME operator
router.delete('/api/private/listCEME', (req, res, next) => {
    var context = "DELETE /api/private/listCEME";
    try {
        var received = req.body;
        var query = {
            _id: received._id
        };
        ListCEME.removeListCEME(query, (err, result) => {
            if (err) {
                console.error(`[${context}][removeListCEME] Error `, err.message);
                reject(err);
            }
            else {
                if (result) {
                    return res.status(200).send({ auth: true, code: 'server_CEME_removed', message: "CEME successfully removed" });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_CEME_not_removed', message: "CEME unsuccessfully removed" });
                };
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========

function saveImageListCEME(CEME, action) {
    var context = "Function saveImageistCEME";
    return new Promise((resolve, reject) => {

        if (action === 'CEME') {
            var path = '/usr/src/app/img/contract/ceme/' + CEME.nameCEME + '.jpg';
            var base64Image = CEME.imageCEME.split(';base64,').pop();
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    if (process.env.NODE_ENV === 'production') {
                        CEME.imageCEME = process.env.HostProdContrac + 'ceme/' + CEME.nameCEME + '.jpg'; // For PROD server
                        resolve(CEME);
                    }
                    else if (process.env.NODE_ENV === 'pre-production') {
                        CEME.imageCEME = process.env.HostPreProdContrac + 'ceme/' + CEME.nameCEME + '.jpg'; // For PROD server
                        resolve(CEME);
                    }
                    else {
                        //CEME.imageCEME = process.env.HostLocalContract + 'ceme/'+CEME.nameCEME+'.jpg'; // For local host
                        CEME.imageCEME = process.env.HostQAContrac + 'ceme/' + CEME.nameCEME + '.jpg'; // For QA server
                        resolve(CEME);
                    };

                };
            });
        }
        else {
            var path = '/usr/src/app/img/contract/card/' + CEME.nameCard + '.jpg';
            var base64Image = CEME.imageCard.split(';base64,').pop();
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    if (process.env.NODE_ENV === 'production') {
                        CEME.imageCard = process.env.HostProdContrac + 'card/' + CEME.nameCard + '.jpg'; // For PROD server
                        resolve(CEME);
                    }
                    else if (process.env.NODE_ENV === 'pre-production') {
                        CEME.imageCard = process.env.HostPreProdContrac + 'card/' + CEME.nameCard + '.jpg'; // For PROD server
                        resolve(CEME);
                    }
                    else {
                        //CEME.imageCard = process.env.HostLocalContract + 'card/' + CEME.nameCard + '.jpg'; // For local host
                        CEME.imageCard = process.env.HostQAContrac + 'card/' + CEME.nameCard + '.jpg'; // For QA server
                        resolve(CEME);
                    };

                };
            });
        };
    });
};

function createListCEME(listContract) {
    var context = "Function createListCEME";
    return new Promise((resolve, reject) => {
        ListCEME.createListCEME(listContract, (err, result) => {
            if (err) {
                console.error(`[${context}][createListCEME] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function listCEMEFindOne(query) {
    var context = "Function listCEMEFindOne";
    return new Promise((resolve, reject) => {
        ListCEME.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][ ListCEME.findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function saveImageCeme(received) {
    var context = "Function saveImageCeme";
    return new Promise((resolve, reject) => {
        var path = '/usr/src/app/img/contract/ceme/ceme' + received.CEME + '.jpg';
        var base64Image = received.imageCEME.split(';base64,').pop();
        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                if (process.env.NODE_ENV === 'production') {
                    var imageCEME = process.env.HostProdContrac + 'ceme/ceme' + received.CEME + '.jpg'; // For PROD server
                    resolve(imageCEME);
                }
                else if (process.env.NODE_ENV === 'pre-production') {
                    var imageCEME = process.env.HostPreProdContrac + 'ceme/ceme' + received.CEME + '.jpg'; // For PROD server
                    resolve(imageCEME);
                }
                else {
                    //imageCEME = process.env.HostLocalContract + 'ceme/ceme' + received.CEME + '.jpg'; // For local host
                    var imageCEME = process.env.HostQAContrac + 'ceme/ceme' + received.CEME + '.jpg'; // For QA server
                    resolve(imageCEME);
                };
            };
        });
    });
};

function saveImageCard(received) {
    var context = "Function saveImageCard";
    return new Promise((resolve, reject) => {
        var path = '/usr/src/app/img/contract/card/card' + received.CEME + '.jpg';
        var base64Image = received.imageCard.split(';base64,').pop();
        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                if (process.env.NODE_ENV === 'production') {
                    var imageCard = process.env.HostProdContrac + 'card/card' + received.CEME + '.jpg'; // For PROD server
                    resolve(imageCard);
                }
                else if (process.env.NODE_ENV === 'pre-production') {
                    var imageCard = process.env.HostPreProdContrac + 'card/card' + received.CEME + '.jpg'; // For PROD server
                    resolve(imageCard);
                }
                else {
                    //imageCard = process.env.HostLocalContract + 'card/card' + received.CEME + '.jpg'; // For local host
                    var imageCard = process.env.HostQAContrac + 'card/card' + received.CEME + '.jpg'; // For QA server
                    resolve(imageCard);
                };
            };
        });
    });
};

function listCEMEUpdate(query, newValue) {
    var context = "Function saveImageCard";
    return new Promise((resolve, reject) => {
        ListCEME.updateListCEME(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}][updateListCEME] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function tariffCEMEFind(query) {
    var context = "Function tariffCEMEFind";
    return new Promise((resolve, reject) => {
        TariffCEME.find(query, (err, result) => {
            if (err) {
                console.error(`[${context}][TariffCEME.find] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getSchedules(tariffFound) {
    var context = "Function getSchedules";
    return new Promise((resolve, reject) => {
        var answer = [];
        Promise.all(
            tariffFound.map(tariff => {
                return new Promise((resolve, reject) => {
                    var query = {
                        country: tariff.country,
                        tariffType: tariff.tariffType,
                        cycleType: tariff.cycleType
                    };
                    //Remove out of empty tariff
                    /*if (tariff.tariffType === process.env.TariffTypeBiHour) {
                        tariff = JSON.parse(JSON.stringify(tariff));

                        tariff.tariff = tariff.tariff.filter(type => {
                            return type.tariffType === process.env.TariffEmpty;
                        });
                        

                    };*/
                    //console.log("tariff", tariff);
                    schedulesCEMEFindOne(query)
                        .then((result) => {

                            if (result.tariffType === process.env.TariffTypeBiHour) {
                                //Remove out of empty schedules
                                result = JSON.parse(JSON.stringify(result));
                                /*
                                result.schedules = result.schedules.filter(schedule => {
                                    return schedule.tariffType === process.env.TariffEmpty;
                                });
                                */
                                var newTariff = {
                                    plan: tariff,
                                    schedule: result
                                };
                                answer.push(newTariff);
                                resolve(true);
                            }
                            else {
                                var newTariff = {
                                    plan: tariff,
                                    schedule: result
                                };
                                answer.push(newTariff);
                                resolve(true);
                            }

                        })
                        .catch((error) => {
                            console.error(`[${context}] Error `, error.message);
                            reject(error);
                        });
                });
            })
        ).then(() => {
            resolve(answer);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        })
    });
};

function schedulesCEMEFindOne(query) {
    var context = "Function schedulesCEMEFindOne";
    return new Promise((resolve, reject) => {
        SchedulesCEME.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][SchedulesCEME.findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function runFirstTime() {
    CEMEList.map(async CEME => {

        let imageCEME = await saveImageCeme(CEME);
        let imageCard = await saveImageCard(CEME);

        //console.log("imageCEME",imageCEME);
        //console.log("imageCard",imageCard);

        let query = {
            CEME: CEME.CEME
        };

        let newValues = {
            $set: {
                imageCEME: imageCEME,
                imageCard: imageCard
            }
        };

        ListCEME.updateListCEME(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}][SchedulesCEME.findOne] Error `, err.message);
            }
            else {
                console.log(CEME.CEME, " updated");
            };
        });

    });
};


module.exports = router;