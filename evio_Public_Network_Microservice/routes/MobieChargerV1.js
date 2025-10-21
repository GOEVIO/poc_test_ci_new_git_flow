const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const axios = require("axios");
const JsonFind = require('json-find');
const regex = /<U\+([0-9A-Z]{4})>/gm;
const subst = `\\u$1`;

const mappingMobie = require('../models/MappingMobie.json');
const jsonFile = JsonFind(mappingMobie);

const Charger = require('../models/charger');

//========== POST ==========
//Update Or create new or existing charger
router.post('/api/private/updateMobieChargersOLD', (req, res, next) => {
    var context = "POST /api/private/updateMobieChargers";
    try {

        let host = req.body.data.host;
        console.log(req.body.data.host);

        axios.get(host, {}, { timeout: 5000 })
            .then((result) => {

                for (let i = 0; i < result.data.length; i++) {
                    let charger = result.data[i];

                    updateOrCreateCharger(charger);

                    if (i == result.data.length - 1) {
                        return res.status(200).send({ code: 'chargers_update_success', message: "Chargers update success" });
                    }

                }

            });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update Or create new or existing charger
router.post('/api/private/updateMobieChargers', (req, res, next) => {

    var context = "POST /api/private/updateMobieChargers";
    try {

        var data = req.body;
        if (typeof data === 'undefined')
            return res.status(200).send(Utils.response(null, 2001, "Invalid or missing parameters"));

        for (let i = 0; i < data.length; i++) {
            let charger = data[i];

            updateOrCreateCharger(charger);

            if (i == data.length - 1) {
                return res.status(200).send({ code: 'chargers_update_success', message: "Chargers update success" });
            }

        }



    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//Obsoleto
router.get('/api/private/mobie', (req, res, next) => {
    var context = "GET /api/private/mobie";
    try {

        var query = {
            source: 'MobiE'
        };

        if (req.body) {
            Object.assign(query, req.body);
            Charger.find({
                'geometry': {
                    $near: {
                        $maxDistance: req.query.distance,
                        $geometry: {
                            type: "Point",
                            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                        }
                    }
                }
            }).find(query, (error, chargersFound) => {
                if (error) {
                    console.error(`[${context}][.then][find] Error`, error.message);
                    return res.status(500).send(error.message);
                } else {
                    return res.status(200).send(chargersFound);
                }
            });

        } else {

            Charger.find({
                'geometry': {
                    $near: {
                        $maxDistance: req.query.distance,
                        $geometry: {
                            type: "Point",
                            coordinates: [parseFloat(req.query.lng), parseFloat(req.query.lat)]
                        }
                    }
                }
            }, (error, chargersFound) => {
                if (error) {
                    console.error(`[${context}][.then][find] Error`, error.message);
                    return res.status(500).send(error.message);
                } else {
                    return res.status(200).send(chargersFound);
                }
            });

        }

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

//Usado para atualizar um charger ou um plug
router.post('/api/private/updateAsset', (req, res, next) => {
    var context = "GET /api/private/updateAsset";
    try {

        let body = req.body.data;

        //Atualizar charger porque não existe uid do EVSE
        if (body.uid == undefined) {

            let query = {
                hwId: body.hwId,
                source: 'MobiE'
            }

            let chargerInfo = {
                status: body.status
            }

            //update charger asset
            Charger.updateCharger(query, { $set: chargerInfo }, (err, doc) => {
                if (doc != null) {
                    console.log("Updated " + query.hwId);
                    return res.status(200).send();
                } else {
                    console.error(`[${context}][Charger.find] Error ` + '[Charger ' + query.hwId + ' not found]');
                    return res.status(500).send("Asset not found");
                }
            });

        }
        else { //Atualizar plug

            let query = {
                hwId: body.hwId,
                source: 'MobiE',
                'plugs.uid': body.uid
            }

            let plugInfo = {
                'plugs.$.status': body.status
            }

            //update plug asset
            Charger.updateCharger(query, { $set: plugInfo }, (err, doc) => {
                if (doc != null) {
                    console.log("Updated " + query.hwId + " plug " + body.uid);
                    return res.status(200).send();
                } else {
                    console.error(`[${context}][Charger.find] Error ` + '[Plug ' + body.uid + ' not found]');
                    return res.status(500).send("Asset not found");
                }
            });

        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


const updateOrCreateCharger = ((charger) => {
    return new Promise((resolve, reject) => {

        getPlugs(charger.evses, charger.id)
            .then((plugs) => {

                var name = "";
                if (typeof charger.name !== 'undefined') {
                    name = charger.name;
                }
                else {
                    name = charger.address.replace(regex, subst);
                }

                let chargerInfo = {
                    hwId: charger.id,
                    chargerType: process.env.ChargerTypeMobiE,
                    source: 'MobiE',
                    partyId: charger.party_id,
                    operatorID: charger.operator,
                    countryCode: charger.country_code,
                    cpoCountryCode: charger.country_code,
                    country: charger.country,
                    name: name,
                    address: {
                        street: charger.address.replace(regex, subst),
                        zipCode: charger.postal_code,
                        city: charger.city.replace(regex, subst)
                    },
                    parkingType: getMapping(charger.parking_type, "parkingType"),
                    geometry: {
                        type: "Point",
                        coordinates: [
                            charger.coordinates.longitude,
                            charger.coordinates.latitude
                        ]
                    },
                    availability: {
                        availabilityType: "Always"
                    },
                    status: getChargerStatus(charger.evses),
                    //imageContent: [],
                    //rating: 0,
                    plugs: plugs.sort((a, b) => (a.plugId > b.plugId) ? 1 : ((b.plugId > a.plugId) ? -1 : 0)),
                    network: 'MobiE',
                    stationIdentifier: charger.id,
                    voltageLevel: charger.mobie_voltage_level,
                    lastUpdated: charger.last_updated,
                    originalCoordinates: {
                        type: "Point",
                        coordinates: [
                            charger.coordinates.longitude,
                            charger.coordinates.latitude
                        ]
                    }
                }

                let query = {
                    source: 'MobiE',
                    hwId: charger.id
                };
                Charger.updateCharger(query, { $set: chargerInfo }, (err, doc) => {
                    if (doc != null) {
                        console.log("Updated " + chargerInfo.hwId);
                        resolve(true);
                    } else {
                        const new_charger = new Charger(chargerInfo);
                        Charger.createCharger(new_charger, (err, result) => {
                            if (result) {
                                console.log("Created " + chargerInfo.hwId);
                                resolve(true);
                            } else {
                                console.log("Not created");
                            }
                        })
                    }
                });

            });

    });
});

const getPlugs = ((evses, hwId) => {
    return new Promise(async (resolve, reject) => {

        let plugs = [];

        for (let evs of evses) {

            let uid = evs.uid;
            let evse_id = evs.evse_id;
            let status = evs.status;
            let plug = null;

            let connectors = evs.connectors;

            for (let connector of connectors) {
                plug = {
                    plugId: connector.id,
                    uid: uid,
                    evse_id: evse_id,
                    connectorFormat: connector.format,
                    connectorPowerType: connector.power_type,
                    connectorType: getMapping(connector.standard, "connectorType"),
                    voltage: connector.max_voltage,
                    amperage: connector.max_amperage,
                    status: getMapping(status, "plugStatus"),
                    termsAndConditions: connector.terms_and_conditions,
                    tariffId: connector.tariff_ids,
                    serviceCost: {
                        initialCost: '-1',
                        costByTime: [
                            { cost: '-1' }
                        ],
                        costByPower: {
                            cost: '-1'
                        }
                    },
                    lastUpdated: charger.last_updated
                }

                if (typeof connector.max_electric_power === 'undefined') {
                    if (connector.max_voltage != null && connector.max_amperage != null) {
                        if ((connector.max_voltage * connector.max_amperage) / 1000 > 0) {
                            plug.power = (connector.max_voltage * connector.max_amperage) / 1000;
                        } /*else {

                            plug.power = await axios.get(process.env.PathExternalMobieLocations) //This PathExternalMobieLocations has been discontinued
                                .then(result => {
                                    let chargerObj = result.data.find(element => element.id === hwId)
                                    let evseObj = chargerObj.evses.find(evse => evse.uid === uid)
                                    let connectorObj = evseObj.connectors.find(plug => plug.id === connector.id)
                                    return connectorObj.max_electric_power / 1000;

                                })
                                .catch((error) => {
                                    return 0
                                });

                        }*/
                    }
                }
                else {
                    if (connector.max_electric_power / 1000 > 0) {
                        plug.power = connector.max_electric_power / 1000;
                    } /*else {
                        plug.power = await axios.get(process.env.PathExternalMobieLocations)  //This PathExternalMobieLocations has been discontinued
                            .then(result => {
                                let chargerObj = result.data.find(element => element.id === hwId)
                                let evseObj = chargerObj.evses.find(evse => evse.uid === uid)
                                let connectorObj = evseObj.connectors.find(plug => plug.id === connector.id)
                                return connectorObj.max_electric_power / 1000;

                            })
                            .catch((error) => {
                                return 0
                            });
                    }*/
                }


            }
            plugs.push(plug);
        }
        resolve(plugs);
    });
});

const getMapping = ((data, mapping_type) => {

    let mapping_list = jsonFile[mapping_type];

    var value = Object.keys(mapping_list).find(key => mapping_list[key] === data.toString());
    if (value === undefined) {
        value = Object.keys(mapping_list).find(key => mapping_list[key].includes(data.toString()));
        if (value === undefined)
            value = "unknown";
    };

    return value;

});

const getChargerStatus = ((evses) => {

    chargerStatus = null;
    plugStatus = [];

    for (let evs of evses) {
        plugStatus.push(evs.status);
    }

    if (plugStatus.includes("AVAILABLE")) {
        return '10';
    }
    else {
        if (plugStatus.includes("UNKNOWN")
            || plugStatus.includes("OUTOFORDER")) {
            return '50';
        }
        else {
            return '20';
        }
    }

});



//var result = str.replace(regex, subst);


module.exports = router;