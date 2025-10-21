const express = require('express');
const router = express.Router();
const axios = require("axios");
const TariffCEME = require('../models/tariffCEME');
const CEMETariff = require('../models/tariffCEME.json');
const SchedulesCEME = require('../models/schedulesCEME');
const TariffsTAR = require('../models/tariffTar');
const ListCEME = require('../models/listCEME');
const RoamingPlan = require('../models/roamingPlan');
const ErrorHandler = require('../controllers/errorHandler');
const TariffCEMEHandler = require('../controllers/tariffCemeHandler');
const moment = require('moment');
const toggle = require('evio-toggle').default;
const { StatusCodes } = require('http-status-codes');

require("dotenv-safe").load();

//========== POST ==========
//Endpoit to create a new tariffCEME
router.post('/api/private/tariffCEME', async (req, res, next) => {
    var context = "POST /api/private/tariffCEME";
    try {
        var tariffCEME = new TariffCEME(req.body);
        createTariffCEME(tariffCEME)
            .then((result) => {
                if (result)
                    return res.status(200).send(result);
                else
                    return res.status(400).send({ auth: false, code: 'server_tariff_CEME_not_created', message: "Tariff CEME not created" });
            })
            .catch((error) => {
                console.error(`[${context}][createTariffCEME] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/tariffCEME/tariffsHistory', async (req, res, next) => {
    var context = "POST /api/private/tariffCEME/tariffsHistory";
    try {
        addTariffsHistory(req.body, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/tariffCEME/defaultTariffsHistory', async (req, res, next) => {
    var context = "POST /api/private/tariffCEME/defaultTariffsHistory";
    try {
        await createTariffsHistory()
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/tariffCEME/voltageLevelTariffs', async (req, res, next) => {
    var context = "POST /api/private/tariffCEME/voltageLevelTariffs";
    try {
        await voltageLevelTariffs()
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/tariffCEME/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/tariffCEME/runFirstTime";
    try {
        //runFirstTime();
        putAllTariffsVisivel()
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
//========== PATCH ==========
//Edit a tariff CEME
router.patch('/api/private/tariffCEME_old', (req, res, next) => {
    var context = "PATCH /api/private/tariffCEME_old";
    try {
        var received = req.body;

        if (received._id === undefined) {
            return res.status(400).send({ auth: false, code: 'server_tariff_CEME_id_required', message: "Tariff CEME id required" });
        }
        else {
            var query = {
                _id: received._id
            };
            var newValue = { $set: received };
            tariffCEMEUpdate(query, newValue)
                .then((result) => {
                    if (result) {
                        return res.status(200).send(result);
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][tariffCEMEUpdate] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/tariffCEME', async (req, res, next) => {
    let context = "PATCH /api/private/tariffCEME";
    try {
        let response = await TariffCEMEHandler.updateCeme(req);
        return res.status(200).send(response);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error);
    };
});

router.patch('/api/private/tariffCEME/tariffsHistory', async (req, res, next) => {
    var context = "POST /api/private/tariffCEME/tariffsHistory";
    try {
        updateTariffsHistory(req.body, res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Edit a tariff CEME add/edit EGME
router.patch('/api/private/tariffCEME/tariffEGME', (req, res, next) => {
    var context = "PATCH /api/private/tariffCEME/tariffEGME";
    try {
        var received = req.body;
        if (!received.tariffEGME) {
            return res.status(400).send({ auth: false, code: 'server_tariff_EGME_required', message: "Tariff EGME is required" });
        }
        else {

            let query = {};
            let newValue = { $set: received };

            TariffCEME.updateMany(query, newValue, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {

                    if (result.n > 0) {
                        return res.status(200).send({ auth: true, code: 'server_tariff_EGME_updated', message: "Tariff EGME updated" });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_tariff_EGME_not_updated', message: "Tariff EGME not updated" });
                    };

                };
            });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.patch('/api/private/tariffCEME/getTariddInfo', (req, res, next) => {
    let context = "PATCH /api/private/tariffCEME/getTariddInfo";
    TariffCEMEHandler.getTariffInbfo(req)
        .then((response) => {
            return res.status(200).send(response);
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
            ErrorHandler.ErrorHandler(error);
        });
});

router.patch('/api/private/tariffCEME/tariffCEMEUpdate/forceRun', async (req, res, next) => {
    var context = "PATCH /api/private/tariffCEME/tariffCEMEUpdate/forceRun";
    try {
        const promotional = req.query.promotional == '1' ? true : false;
        TariffCEMEHandler.tariffCEMEUpdate(promotional);
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
});
//========== DELETE ==========
//Delete a tariff CEME
router.delete('/api/private/tariffCEME', (req, res, next) => {
    var context = "DELETE /api/private/tariffCEME";
    try {
        var received = req.body;
        if (received._id === undefined) {
            return res.status(400).send({ auth: false, code: 'server_tariff_CEME_id_required', message: "Tariff CEME id required" });
        }
        else {
            var query = {
                _id: received._id
            };
            TariffCEME.removeTariffCEME(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][removeTariffCEME] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result) {
                        return res.status(200).send({ auth: true, code: 'server_tariff_CEME_removed', message: "Tariff CEME successfully removed" });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_tariff_CEME_not_removed', message: "Tariff CEME unsuccessfully removed" });
                    };
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get a tariff CEME
router.get('/api/private/tariffCEME', (req, res, next) => {
    var context = "GET /api/private/tariffCEME";
    try {
        var query = req.query;
        tariffCEMEFind(query)
            .then((tariffFound) => {
                return res.status(200).send(tariffFound);
            })
            .catch((error) => {
                console.error(`[${context}][tariffCEMEFind] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get a tariff CEME
router.get('/api/private/tariffCEME/withProject', async (req, res, next) => { 
    var context = "GET /api/private/tariffCEME/withProject";
    try {
        const featureFlagEnabled = await toggle.isEnable('control_center_create_b2b_charge-56');        
        if(!featureFlagEnabled) {
            console.log(`[${context}][FEATUREFLAG][control_center_create_b2b_charge-56]`)
            return res.status(StatusCodes.FORBIDDEN).send({ code: 'control_center_create_b2b_deactivated', message: "Control Center create B2B deactivated" });
        }

        const query = JSON.parse(req.query?.match)
        const project = JSON.parse(req.query?.project)
        tariffCEMEFindWithProject(query, project)
            .then((tariffFound) => {
                return res.status(200).send(tariffFound);
            })
            .catch((error) => {
                console.error(`[${context}][tariffCEMEFind] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get tariff CEME by CEME
router.get('/api/private/tariffCEME/CEME', (req, res, next) => {
    var context = "GET /api/private/tariffCEME/CEME";
    try {

        var query = req.query;

        tariffCEMEFind(query)
            .then((tariffFound) => {
                getSchedules(tariffFound)
                    .then((result) => {
                        //console.log("result", result);
                        return res.status(200).send(result);
                    })
                    .catch((error => {
                        console.error(`[${context}][getSchedules] Error `, error.message);
                        return res.status(500).send(error.message);
                    }));

            })
            .catch((error) => {
                console.error(`[${context}][tariffCEMEFind] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get tariff CEME by id
router.get('/api/private/tariffCEME/byId', (req, res, next) => {
    var context = "GET /api/private/tariffCEME/byId";
    try {

        let query = req.query;

        //console.log("query", query);
        tariffCEMEFindOne(query)
            .then(async (tariffFound) => {

                //console.log("tariffFound", tariffFound);

                if (tariffFound) {

                    let querySchedules = {
                        country: tariffFound.country,
                        tariffType: tariffFound.tariffType,
                        cycleType: tariffFound.cycleType
                    };

                    let queryTar = {
                        country: tariffFound.country,
                        tariffType: tariffFound.tariffType,
                        active: true
                    };

                    let scheduleFound = await schedulesCEMEFindOne(querySchedules);
                    let tarFound = await tarFindOne(queryTar);
                    let CEME = await listCEMEFindOne(query);

                    let newTariff;

                    if (CEME) {
                        newTariff = {
                            CEME: CEME,
                            plan: tariffFound,
                            schedule: scheduleFound,
                            tar: tarFound
                        };
                    }
                    else {
                        newTariff = {
                            plan: tariffFound,
                            schedule: scheduleFound,
                            tar: tarFound
                        };
                    };

                    return res.status(200).send(newTariff);

                }
                else {
                    return res.status(200).send({});
                }
            })
            .catch((error) => {
                console.error(`[${context}][tariffCEMEFind] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/tariffCEME/CEMELandingPage', async (req, res, next) => {
    var context = "GET /api/private/tariffCEME/CEMELandingPage";
    try {

        var received = req.query;

        let tariffFound = await tariffCEMEFindOne({ planName: received.planName });

        let fields = {
            _id: 1,
            roamingType: 1,
            tariffs: 1
        };

        let roamingPlansFound = await RoamingPlan.find({ roamingType: received.roamingType }, fields);

        if (tariffFound) {

            let querySchedules = {
                country: tariffFound.country,
                tariffType: tariffFound.tariffType,
                cycleType: tariffFound.cycleType
            };

            let queryTar = {
                country: tariffFound.country,
                tariffType: tariffFound.tariffType,
                active: true
            };

            let scheduleFound = await schedulesCEMEFindOne(querySchedules);
            let tarFound = await tarFindOne(queryTar);
            //let CEME = await listCEMEFindOne({ planName: received.planName });

            //let newTariff;

            /*if (CEME) {
                newTariff = {
                    CEME: CEME,
                    plan: tariffFound,
                    schedule: scheduleFound,
                    tar: tarFound,
                    tariffRoamingInfo: roamingPlansFound
                };
            }
            else {*/
            let newTariff = {
                plan: tariffFound,
                schedule: scheduleFound,
                tar: tarFound,
                tariffRoamingInfo: roamingPlansFound
            };
            //};

            return res.status(200).send(newTariff);

        }
        else {
            return res.status(200).send({});
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/tariffCEME/landingPage', (req, res, next) => {
    var context = "GET /api/private/tariffCEME/landingPage";
    try {

        var contractsFound = req.body.contractsFound;
        var paymentMethods = req.body.paymentMethods;

        //console.log("contractsFound", contractsFound);
        //console.log("paymentMethods", paymentMethods);

        Promise.all(
            contractsFound.map(contract => {
                return new Promise(async (resolve, reject) => {

                    var netWorkIndex = contract.networks.indexOf(contract.networks.find(netWork => {
                        return netWork.network === process.env.NetworkMobiE;
                    }));

                    if (netWorkIndex >= 0) {

                        if (contract.networks[netWorkIndex].paymentMethod != "" && contract.networks[netWorkIndex].paymentMethod != undefined) {

                            var paymentMethodInfo = paymentMethods.find(payment => {

                                return payment.id === contract.networks[netWorkIndex].paymentMethod;

                            });

                            if (paymentMethodInfo) {

                                contract.networks[netWorkIndex].paymentMethodInfo = paymentMethodInfo;

                            }
                            else {

                                contract.networks[netWorkIndex].paymentMethodInfo = {};

                            };

                        } else {

                            contract.networks[netWorkIndex].paymentMethodInfo = {};

                        };

                    };

                    if (contract.tariff !== undefined) {

                        var query = {
                            _id: contract.tariff.planId
                        };

                        let tariffInfo = await getTariffCEME(query);

                        let tariffRoamingInfo = await getTariffCEMERoaming(contract.tariffRoaming);

                        contract.tariffRoamingInfo = tariffRoamingInfo;

                        if (Object.keys(tariffInfo).length != 0) {

                            tariffInfo.plan.tariff = tariffInfo.plan.tariff.filter(tariff => {
                                return tariff.power === contract.tariff.power
                            });

                            contract.tariffInfo = tariffInfo;

                            resolve(true);

                        } else {

                            resolve(false);

                        };

                    } else {

                        contract.tariffInfo = {};
                        resolve(true);

                    };

                });
            })
        ).then(() => {

            contractsFound.sort((x, y) => { return x.default - y.default });
            contractsFound.reverse();
            return res.status(200).send(contractsFound);

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get("/api/private/tariffCemeAndTAR", (req, res, next) => {
	var context = "GET /api/private/tariffCemeAndTAR";
	try {
		let query = req.query;

		if (query._id) {
			tariffCEMEFindOne({ _id: query._id })
				.then(async (tariffFound) => {
					if (tariffFound) {
						let querySchedules = {
							country: tariffFound.country,
							tariffType: tariffFound.tariffType,
							cycleType: tariffFound.cycleType,
						};

						let queryTar = {
							country: tariffFound.country,
							tariffType: tariffFound.tariffType,
							active: true,
						};

						if (query.timeZone) {
							queryTar.timeZone = query.timeZone;
						}

						let scheduleFound = await schedulesCEMEFindOne(querySchedules);
						let tarFound = await tarFindOne(queryTar);

						if (!tarFound) {
							tarFound = await tarFindOne({
								country: "PT",
								tariffType: tariffFound.tariffType,
								active: true,
							});
						}

						let newTariff = {
							tariffCEME: tariffFound,
							TAR_Schedule: scheduleFound,
							tariffTAR: tarFound,
						};

						return res.status(200).send(newTariff);
					} else {
						return res.status(200).send({});
					}
				})
				.catch((error) => {
					console.error(`[${context}][tariffCEMEFind] Error `, error.message);
					return res.status(500).send(error.message);
				});
		} else {
			if (query.CEME || query.planName) {
				let queryCEME = query.planName ? { planName: query.planName } : { CEME: query.CEME };
				tariffCEMEFindOne(queryCEME)
					.then(async (tariffFound) => {
						if (tariffFound) {
							let querySchedules = {
								country: tariffFound.country,
								tariffType: tariffFound.tariffType,
								cycleType: tariffFound.cycleType,
							};

							let queryTar = {
								country: tariffFound.country,
								tariffType: tariffFound.tariffType,
								active: true,
							};

							if (query.timeZone) {
								queryTar.timeZone = query.timeZone;
							}

							let scheduleFound = await schedulesCEMEFindOne(querySchedules);
							let tarFound = await tarFindOne(queryTar);

							if (!tarFound) {
								tarFound = await tarFindOne({
									country: "PT",
									tariffType: tariffFound.tariffType,
									active: true,
								});
							}

							let newTariff = {
								tariffCEME: tariffFound,
								TAR_Schedule: scheduleFound,
								tariffTAR: tarFound,
							};

							return res.status(200).send(newTariff);
						} else {
							return res.status(200).send({});
						}
					})
					.catch((error) => {
						console.error(`[${context}][tariffCEMEFind] Error `, error.message);
						return res.status(500).send(error.message);
					});
			} else {
				return res.status(200).send({});
			}
		}
	} catch (error) {
		console.error(`[${context}] Error `, error.message);
		return res.status(500).send(error.message);
	}
});

//========== FUNCTIONS ==========
function createTariffCEME(tariffCEME) {
    var context = "Function createTariffCEME";
    return new Promise((resolve, reject) => {
        TariffCEME.createTariffCEME(tariffCEME, (err, result) => {
            if (err) {
                console.error(`[${context}][createTariffCEME] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function tariffCEMEUpdate(query, newValue) {
    var context = "Function createTariffCEME";
    return new Promise((resolve, reject) => {
        TariffCEME.updateTariffCEME(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}][updateTariffCEME] Error `, err.message);
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

function tariffCEMEFindWithProject(query, project) {
    var context = "Function tariffCEMEFind";
    return new Promise((resolve, reject) => {
        TariffCEME.find(query, project, (err, result) => {
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
                    schedulesCEMEFindOne(query)
                        .then((result) => {
                            var newTariff;
                            if (result) {
                                newTariff = {
                                    plan: tariff,
                                    schedule: result
                                }
                            } else {
                                newTariff = {
                                    plan: tariff
                                }
                            };

                            answer.push(newTariff);
                            resolve(true);

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

function tariffCEMEFindOne(query) {
    var context = "Function tariffCEMEFindOne";
    return new Promise((resolve, reject) => {
        TariffCEME.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][TariffCEME.findOne] Error `, err.message);
                reject(err);
            }
            else {
                                resolve(result);
            };
        });
    });
};

function tarFindOne(query) {
    var context = "Function tarFindOne";
    return new Promise((resolve, reject) => {
        TariffsTAR.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][TariffsTAR.findOne] Error `, err.message);
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
                console.error(`[${context}][listCEMEFindOne.findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function runFirstTime() {

    CEMETariff.map(ceme => {

        var query = {
            CEME: ceme.CEME,
            tariffType: ceme.tariffType,
            cycleType: ceme.cycleType,
            planName: ceme.planName
        };

        var newValues = { $set: ceme };

        TariffCEME.updateTariffCEME(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("Tariff CEME updated");
            };
        });
    })
};

async function createTariffsHistory() {
    const context = "Function createTariffsHistory";

    try {
        let cemePlans = await TariffCEME.find({ tariffsHistory: { $exists: false } }).lean()
        for (let ceme of cemePlans) {
            let tariff = ceme.tariff
            let startDate = moment.utc().format()
            let stopDate = moment.utc(startDate).add(100, 'years').format()
            let tariffsHistory = {
                startDate,
                stopDate,
                tariff,
            }
            await TariffCEME.updateOne({ _id: ceme._id }, { $set: { tariffsHistory } })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function voltageLevelTariffs() {
    const context = "Function voltageLevelTariffs";

    try {
        let cemePlans = await TariffCEME.find({ CEME: "EVIO" }).lean()
        for (let ceme of cemePlans) {
            let tariff = ceme.tariff
            if (!tariff.find(elem => elem.voltageLevel === process.env.voltageLevelMT)) {
                let tariffsToAdd = [
                    {
                        ...tariff[0],
                        tariffType: process.env.TariffTypeEmpty,
                        voltageLevel: "BTE"
                    },
                    {
                        ...tariff[0],
                        tariffType: process.env.TariffTypeOutEmpty,
                        voltageLevel: "BTE"
                    },
                    {
                        ...tariff[0],
                        tariffType: process.env.TariffTypeEmpty,
                        voltageLevel: process.env.voltageLevelMT
                    },
                    {
                        ...tariff[0],
                        tariffType: process.env.TariffTypeOutEmpty,
                        voltageLevel: process.env.voltageLevelMT
                    },
                ]
                await TariffCEME.updateOne({ _id: ceme._id }, { $push: { tariff: { $each: tariffsToAdd } } })
            }
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    }
}

async function addTariffsHistory(body, res) {
    const context = "Function addTariffsHistory";

    try {
        let cemePlan = await TariffCEME.findOne({ _id: body._id })
        if (cemePlan) {
            let tariffHistory = body.tariffHistory
            if (!tariffHistory || !tariffHistory.startDate || !tariffHistory.stopDate || !tariffHistory.tariff || tariffHistory.tariff.length === 0) {
                return res.status(400).send({ auth: false, code: '', message: "tariffHistory object malformed" });
            }
            cemePlan.tariffsHistory.push(tariffHistory)
            cemePlan.save()
            return res.status(200).send({ auth: true, code: '', message: "Added tariff to tariffHistory" });

        } else {
            return res.status(400).send({ auth: false, code: '', message: "No tariffCEME found" });

        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    }
}

async function updateTariffsHistory(body, res) {
    const context = "Function updateTariffsHistory";

    try {

        if (!body._id) {
            return res.status(400).send({ auth: false, code: '', message: "Missing tariffCEME _id" });
        }

        if (!body.tariffsHistoryId) {
            return res.status(400).send({ auth: false, code: '', message: "Missing tariffsHistoryId" });
        }

        let newValues = {
            '$set': {
            }
        }
        if (body.startDate) {
            newValues['$set']['tariffsHistory.$.startDate'] = body.startDate
        }
        if (body.stopDate) {
            newValues['$set']['tariffsHistory.$.stopDate'] = body.stopDate
        }
        if (body.tariff) {
            newValues['$set']['tariffsHistory.$.tariff'] = body.tariff
        }

        let cemePlan = await TariffCEME.findOneAndUpdate({ '_id': body._id, 'tariffsHistory._id': body.tariffsHistoryId }, newValues, { new: true })
        if (cemePlan) {
            return res.status(200).send({ auth: true, code: '', message: "Updated tariffHistory" });
        } else {
            return res.status(400).send({ auth: false, code: '', message: "Failed to update tariffHistory" });

        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    }
}

function putAllTariffsVisivel() {
    TariffCEME.updateMany({}, { $set: { visivel: true } }, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        }
        else {
            console.log("Tariff CEME updated");
        };
    });
};

function getTariffCEME(query) {
    var context = "Function getTariffCEME";
    return new Promise((resolve, reject) => {

        tariffCEMEFindOne(query)
            .then(async (tariffFound) => {

                if (tariffFound) {

                    let querySchedules = {
                        country: tariffFound.country,
                        tariffType: tariffFound.tariffType,
                        cycleType: tariffFound.cycleType
                    };

                    let queryTar = {
                        country: tariffFound.country,
                        tariffType: tariffFound.tariffType,
                        active: true
                    };

                    let scheduleFound = await schedulesCEMEFindOne(querySchedules);
                    let tarFound = await tarFindOne(queryTar);
                    let CEME = await listCEMEFindOne(query);

                    let newTariff;

                    if (CEME) {
                        newTariff = {
                            CEME: CEME,
                            plan: tariffFound,
                            schedule: scheduleFound,
                            tar: tarFound
                        };
                    }
                    else {
                        newTariff = {
                            plan: tariffFound,
                            schedule: scheduleFound,
                            tar: tarFound
                        };
                    };

                    resolve(newTariff);

                } else {

                    resolve({});

                };
            })
            .catch((error) => {

                console.error(`[${context}][tariffCEMEFind] Error `, error.message);
                resolve({});

            });

    });
};

function getTariffCEMERoaming(tariffRoaming) {
    var context = "Function getTariffCEMERoaming";
    return new Promise(async (resolve, reject) => {
        //console.log("tariffRoaming", tariffRoaming);

        let plansId = [];

        await tariffRoaming.forEach(tariff => {
            plansId.push(tariff.planId);
        });

        let query = {
            _id: plansId
        };

        tariffCEMEFind(query)
            .then((tariffFound) => {
                getSchedules(tariffFound)
                    .then((result) => {

                        //console.log("result", result);
                        resolve(result);

                    })
                    .catch((error => {

                        console.error(`[${context}][getSchedules] Error `, error.message);
                        resolve([]);

                    }));

            })
            .catch((error) => {

                console.error(`[${context}][tariffCEMEFind] Error `, error.message);
                resolve([]);

            });

    });
};

module.exports = router;