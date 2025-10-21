const express = require('express');
const router = express.Router();
const axios = require("axios");
const RoamingPlan = require('../models/roamingPlan');
const { response } = require('express');
require("dotenv-safe").load();

//========== POST ==========
//Endpoit to add a new roamingPlan Tariff
router.post('/api/private/roamingPlanTariff', async (req, res, next) => {
    var context = "POST /api/private/roamingPlanTariff";
    try {
        var received = req.body;
        if (!received.roamingType) {
            return res.status(400).send({ auth: false, code: 'server_roaming_type_required', message: "Roaming Type is required" });
        }

        if (!received.tariffs) {
            return res.status(400).send({ auth: false, code: 'server_tariffs_required', message: "Tariffs is required" });
        }

        if (!missingTariffsParams(received.tariffs)) {
            return res.status(400).send({ auth: false, code: 'server_tariffs_required', message: "Missing parameters in tariffs" });
        }

        let roamingType = received.roamingType
        let query = {
            roamingType
        }

        let tariffs = received.tariffs
        roamingPlanFind(query)
            .then(response => {

                if (response) {
                    Promise.all(
                        tariffs.map(tariffElement => insertRoamingPlanTariff(tariffElement, response, roamingType))
                    )
                        .then(result => {
                            return res.status(200).send({ auth: false, code: 'server_updated_successfully', message: "Server updated successfully" });
                        })
                        .catch(error => {
                            console.error(`[${context}][createRoamingPlan] Error `, error.message);
                            return res.status(500).send(error.message);
                        })
                } else {
                    // Condition where roaming plan doesn't exist yet
                    let roamingPlan = new RoamingPlan({
                        roamingType,
                        tariffs,
                    })

                    createRoamingPlan(roamingPlan)
                        .then((result) => {
                            if (result)
                                return res.status(200).send(result);
                            else
                                return res.status(400).send({ auth: false, code: 'server_roaming_plan_not_created', message: "Roaming Plan not created" });
                        })
                        .catch((error) => {
                            console.error(`[${context}][createRoamingPlan] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
            })
            .catch(err => {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Endpoit to get a specific roamingPlan Tariff
router.get('/api/private/roamingPlanTariff', async (req, res, next) => {
    var context = "GET /api/private/roamingPlanTariff";
    try {
        var received = req.query;
        if (!received.roamingType) {
            return res.status(400).send({ auth: false, code: 'server_roaming_type_required', message: "Roaming Type is required" });
        }

        // if (!received.country) {
        //     return res.status(400).send({ auth: false, code: 'server_country_required', message: "country is required" });
        // }
        // if (!received.region) {
        //     return res.status(400).send({ auth: false, code: 'server_region_required', message: "region is required" });
        // }
        // if (!received.partyId) {
        //     return res.status(400).send({ auth: false, code: 'server_partyId_required', message: "partyId is required" });
        // }
        // if (!received.evseGroup) {
        //     return res.status(400).send({ auth: false, code: 'server_evseGroup_required', message: "evseGroup is required" });
        // }
        let query = {
            roamingType: received.roamingType
        }
        roamingPlanFind(query)
            .then(response => {

                if (response) {
                    let roamingTariff = response.tariffs.find(tariff => tariffConditions(tariff, received.country, received.region, received.partyId, received.evseGroup))
                    if (roamingTariff) {
                        return res.status(200).send(roamingTariff);
                    } else {
                        /* 
                            TODO : Review this. 
                            I'm returning a default tariff in the scenario where the tariff in a specific country/region doesn't exist. But that probably won't 
                            happen because when we sign contract with a CPO we get its chargers and tariffs.
                        */
                        roamingTariff = response.tariffs.find(tariff => tariffConditions(tariff, "DF", "DF", "EVI", "EVIOGroup"))

                        let defaultTariff = roamingTariff ? roamingTariff : {
                            "tariff": [
                                {
                                    "type": "flat",
                                    "uom": "un",
                                    "price": 0.8
                                },
                                {
                                    "type": "time",
                                    "uom": "min",
                                    "price": 0.01
                                },
                                {
                                    "type": "energy",
                                    "uom": "kWh",
                                    "price": 0.55
                                }
                            ],
                            "country": "DF",
                            "region": "DF",
                            "currency": "EUR",
                            "partyId": "EVI",
                            "evseGroup" : "EVIOGroup"
                        }
                        return res.status(200).send(defaultTariff);
                    }
                } else {
                    return res.status(400).send({ auth: false, code: 'server_roaming_plan_not_found', message: "Roaming Plan not found" });
                }
            })
            .catch(err => {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoit to get a specific roamingPlan Tariff
router.get('/api/private/roamingPlanTariff/byRoamingType', async (req, res, next) => {
    var context = "GET /api/private/roamingPlanTariff/byRoamingType";
    try {

        let query = req.query;
        let fields = {}
        if (Object.keys(req.body).length > 0) {
            fields = req.body
        };

        RoamingPlan.find(query, fields, (err, roamingPlansFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send(roamingPlansFound);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTIONS ==========
function insertRoamingPlanTariff(tariffElement, response, roamingType) {
    var context = "Function insertRoamingPlanTariff";
    return new Promise((resolve, reject) => {
        let country = tariffElement.country
        let region = tariffElement.region
        let currency = tariffElement.currency
        let partyId = tariffElement.partyId
        let tariff = tariffElement.tariff
        let evseGroup = tariffElement.evseGroup

        if (!country) {
            reject({ auth: false, code: 'server_country_required', message: "Country is required" })
        }

        if (!region) {
            reject({ auth: false, code: 'server_region_required', message: "Region is required" })
        }

        if (!currency) {
            reject({ auth: false, code: 'server_currency_required', message: "Currency is required" })
        }

        if (!partyId) {
            reject({ auth: false, code: 'server_partyId_required', message: "PartyId is required" })
        }

        if (!tariff) {
            reject({ auth: false, code: 'server_tariff_required', message: "Tariff is required" })
        }

        if (!evseGroup) {
            reject({ auth: false, code: 'server_evseGroup_required', message: "EVSE Group is required" })
        }

        let roamingTariff = response.tariffs.find(tariff => tariffConditions(tariff, country, region, partyId , evseGroup))
        let tariffIndex = response.tariffs.findIndex(tariff => tariffConditions(tariff, country, region, partyId, evseGroup))
        if (roamingTariff) {
            // Condition where roaming plan exists and tariff sent also exists, so we update it with the new tariff
            response.tariffs[tariffIndex] = {
                country,
                region,
                currency,
                partyId,
                evseGroup,
                tariff
            }
            let query = {
                roamingType,
            }

            var newValues = {
                $set: {
                    'tariffs': response.tariffs
                }
            };
            roamingPlanUpdate(query, newValues)
                .then((result) => {
                    if (result) {
                        resolve(true);
                    }
                    else {
                        console.log("Didn't update")
                        resolve(true);
                    };
                })
                .catch((error) => {
                    reject(error)
                });

        } else {
            // Condition where roaming plan exists but tariff is new. Push it to tariffs array

            let query = {
                roamingType
            }

            var newValues = {
                $push: {
                    tariffs: {
                        country,
                        region,
                        currency,
                        partyId,
                        evseGroup,
                        tariff
                    }
                }
            };

            roamingPlanUpdate(query, newValues)
                .then((result) => {
                    if (result) {
                        resolve(true);
                    }
                    else {
                        console.log("Didn't update")
                        resolve(true);
                    };
                })
                .catch((error) => {
                    reject(error)
                });

        }
    });
};

function missingTariffsParams(tariffs) {
    return tariffs.every(tariff => (tariff.country && tariff.region && tariff.partyId && tariff.evseGroup))
}

function tariffConditions(tariff, country, region, partyId , evseGroup) {
    return (tariff.country === country && tariff.region === region && tariff.partyId === partyId && tariff.evseGroup === evseGroup);
};

function createRoamingPlan(roamingPlan) {
    var context = "Function createRoamingPlan";
    return new Promise((resolve, reject) => {
        RoamingPlan.createRoamingPlan(roamingPlan, (err, result) => {
            if (err) {
                console.error(`[${context}][createRoamingPlan] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function roamingPlanUpdate(query, newValue) {
    var context = "Function createroamingPlan";
    return new Promise((resolve, reject) => {
        RoamingPlan.updateRoamingPlan(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}][updateRoamingPlan] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function roamingPlanFind(query) {
    var context = "Function roamingPlanFind";
    return new Promise((resolve, reject) => {
        RoamingPlan.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][RoamingPlan.find] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};


module.exports = router;