const express = require('express');
const router = express.Router();
const axios = require("axios");
var Charger = require('../models/charger');
const Infrastructure = require('../models/infrastructure');
const ChargingSession = require('../models/chargingSession');
const QrCode = require('../models/qrCode');
const ManagementPOIs = require('../models/managementPOIs');
const fs = require('fs');
require("dotenv-safe").load();
const request = require('request')
const { getOperators } = require('../utils/getOperators')

// =============================== CHARGERS =============================== //
//========== POST ==========
//Create a new Charger
router.post('/api/private/controlCenter/charger', (req, res, next) => {
    var context = "POST /api/private/controlCenter/charger";
    try {
        const charger = new Charger(req.body);
        var createUser = req.headers['userid'];
        var clientName = req.headers['clientname'];
        var ownerId = req.headers['ownerid'];
        charger.createUser = createUser;
        charger.createdBy = ownerId;
        charger.operatorId = ownerId;
        charger.infrastructure = req.body.infrastructureId;
        charger.networks = chargerDefaultNetworks(charger.hwId)
        charger.availability = {
            availabilityType: process.env.ChargerAvailabilityAlways
        };
        charger.clientName = clientName;
        if ((charger.defaultImage === undefined) || (charger.defaultImage === "")) {
            charger.defaultImage = "0";
        };

        if (charger.chargerType === process.env.EVIOBoxType || charger.chargerType === process.env.SonOFFType)
            charger.operationalStatus = process.env.OperationalStatusApproved;
        else
            charger.operationalStatus = process.env.OperationalStatusWaitingAproval;

        charger.active = true
        //if(charger.chargerType)
        validateFieldsCharger(charger)
            .then(() => {
                if ((req.body.imageContent != undefined) && (req.body.imageContent.length > 0)) {
                    saveImageContentCharger(charger)
                        .then((value) => {
                            createCharger(charger, res);
                        })
                        .catch((error) => {
                            console.error(`[${context}][saveImageContentCharger][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    createCharger(charger, res);
                };
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
router.get('/api/private/controlCenter/charger/ocpi', async (req, res, next) => {
    let context = "GET /api/private/controlCenter/charger/ocpi";
    try {
        let {network , date_from , date_to , party_id , country_code} = req.query
        // console.log(req.body)
        let query = {
            networks : { 
                "$elemMatch" : { 
                    network,
                    party_id,
                    country_code,
                    activationRequest : true, 
                    status : process.env.ChargerNetworkStatusActive, 
                }
            }
        }
        
        if (date_from != "" && date_to != "") {
            query = { 
                ...query,
                $and: [
                    { updatedAt: { $gte: date_from} },
                    { updatedAt: { $lte: date_to } }
                ]
            };
        } else if (date_from != "") {
            query = { 
                ...query,
                updatedAt: { $gte: date_from }
            };
        } else if (date_to != "") {
            query = { 
                ...query,
                updatedAt: { $lte: date_to }
            };
        }

        let foundChargers = await Charger.find(query).lean()
        if (foundChargers) {
            return res.status(200).send(foundChargers);
        } else {
            return res.status(200).send([]);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/controlCenter/charger/ocpi/location', async (req, res, next) => {
    const context = "GET /api/private/controlCenter/charger/ocpi/location";
    try {
        const { network, party_id, country_code, locationId, date_from, date_to } = req.query
        // console.log(req.body)
        const query = {
            operationalStatus : process.env.OperationalStatusApproved,
            networks : { 
                "$elemMatch" : { 
                    network,
                    party_id,
                    country_code,
                    activationRequest : true, 
                    status : process.env.ChargerNetworkStatusActive, 
                    id : locationId,
                }
            }
        }

        if (date_from != "" && date_to != "") {
            query["$and"] = [
                { updatedAt: { $gte: date_from} },
                { updatedAt: { $lte: date_to } }
            ]
        } else if (date_from != "") {
            query.updatedAt = { $gte: date_from }
        } else if (date_to != "") {
            query.updatedAt = { $lte: date_to }
        }
        
        const foundCharger = await Charger.findOne(query).lean()
        if (foundCharger) {
            return res.status(200).send(foundCharger)
        } else {
            return res.status(200).send({})
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//Get charger details for private use
router.get('/api/private/controlCenter/charger/details', (req, res, next) => {
    var context = "GET /api/private/controlCenter/charger/details";
    try {

        var queryParameters = req.query;
        var userId = queryParameters.userId;

        let query = {
            _id : queryParameters.chargerId,
            active: true,
            hasInfrastructure: true,
            operationalStatus: { $ne: process.env.OperationalStatusRemoved },
        }

        chargerFindOne(query)
            .then(async (chargerFound) => {
                if (chargerFound) {
                    chargerFound = JSON.parse(JSON.stringify(chargerFound));

                    var query = {
                        chargerId: chargerFound._id
                    };

                    const { operator, operatorContact, operatorEmail } = await getOperators(chargerFound);
                        
                    chargerFound.operatorContact = operatorContact;
                    chargerFound.operatorEmail = operatorEmail;
                    chargerFound.operator = operator;

                    return res.status(200).send({...chargerFound , chargerId :chargerFound._id });
                }
                else {
                    return res.status(400).send({ auth: true, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };

            })
            .catch((error) => {

                console.error(`[${context}][chargerFindOne] Error `, error.message);
                return res.status(500).send(error.message);

            });


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all charger by operational status
router.get('/api/private/controlCenter/charger/plugs', async (req, res, next) => {
    let context = "GET /api/private/controlCenter/charger/plugs";
    try {
        let query = {
            _id : req.query.chargerId,
            active: true,
            hasInfrastructure: true,
            operationalStatus: { $ne: process.env.OperationalStatusRemoved },
        }
        // console.log(req.body)
        let foundPlugs = await Charger.findOne(query, {plugs : 1}).lean()
        if (foundPlugs) {
            return res.status(200).send(foundPlugs.plugs);
        } else {
            return res.status(400).send([]);
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/controlCenter/charger/:hwId', async (req, res, next) => {
    const context = "GET /api/private/controlCenter/charger/:hwId";
    try {
        const hwId = req.params.hwId
        const foundCharger = await Charger.findOne({ hwId, operationalStatus : process.env.OperationalStatusApproved }).lean()
        if (foundCharger) {
            return res.status(200).send(foundCharger)
        } else {
            return res.status(200).send({})
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//========== PATCH ==========
router.patch('/api/private/controlCenter/charger/operatorIdByHwId', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/charger/operatorIdByHwId";
    try {
        let {hwId , operatorId} = req.body
        // console.log(req.body)
        let updatedCharger = await Charger.findOneAndUpdate({hwId} , {$set : {operatorId}} , {new : true})
        return res.status(200).send(updatedCharger);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/operatorIdByInfrastructure', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/charger/operatorIdByInfrastructure";
    try {
        let {infrastructure , operatorId} = req.body
        // console.log(req.body)
        let updatedCharger = await Charger.updateMany({infrastructure} , {$set : {operatorId}})
        return res.status(200).send(updatedCharger);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/addNetworks', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/charger/addNetworks";
    try {
        let query = req.body
        // console.log(req.body)
        let allChargers = await Charger.find(query).lean()
        addNetworks(allChargers,res)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/networkActivation', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/charger/networkActivation";
    try {
        let {chargerId , network , activationRequest , status , ownerId , party_id , country_code} = req.body
        let foundCharger = await Charger.findOne({_id : chargerId } , {plugs : 1})
        if (foundCharger && foundCharger.plugs.length > 0) {
            let newValues = {$set : {"networks.$.status" : status}}
            if (activationRequest !== null && activationRequest !== undefined) {
                newValues["$set"]["networks.$.activationRequest"] = activationRequest 
            }

            if (party_id !== null && party_id !== undefined) {
                newValues["$set"]["networks.$.party_id"] = party_id 
            }

            if (country_code !== null && country_code !== undefined) {
                newValues["$set"]["networks.$.country_code"] = country_code 
            }

            let updatedCharger = await Charger.findOneAndUpdate({_id : chargerId , operatorId : ownerId , "networks.network" : network } , newValues , {new : true})
            return res.status(200).send(updatedCharger);
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger not valid to activate network' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/networkActivationMany', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/charger/networkActivationMany";
    try {
        let {chargerIds , network , activationRequest , status , ownerId} = req.body
        let newValues = {$set : {"networks.$.status" : status}}
        if (activationRequest !== null && activationRequest !== undefined) {
            newValues["$set"]["networks.$.activationRequest"] = activationRequest 
        }
        let query = {
            $and : [
                {_id : {$in : chargerIds} }, 
                { operatorId : ownerId }, 
                { networks : {$elemMatch : { network : network , activationRequest : {$ne : activationRequest}} }},
            ]
        }

        if (network !== process.env.NetworkEVIO) {
            query["$and"].push({"plugs.0" : {$exists : true}})
            query["$and"].push({ accessType : process.env.ChargerAccessPublic })
        }
        let updatedCharger = await Charger.updateMany(query , newValues)
        if (updatedCharger) {
            return res.status(200).send(updatedCharger);
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Chargers not valid to activate network' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/networkId', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/charger/networkId";
    try {
        let { id , chargerId , network} = req.body
        let foundCharger = await Charger.findOne({_id : chargerId } , {plugs : 1})
        if (foundCharger && foundCharger.plugs.length > 0) {
            let newValues = {$set : {"networks.$.id" : id}}
            let updatedCharger = await Charger.findOneAndUpdate({_id : chargerId , "networks.network" : network } , newValues , {new : true})
            return res.status(200).send(updatedCharger);
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger not valid to activate network' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/files', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/charger/files";
    try {
        let {  chargerId , fileId} = req.body

        let removeValues = {
            '$pull': {
                'files' : { _id : fileId}
            }
        }
        let updatedCharger = await Charger.findOneAndUpdate({_id : chargerId ,"files._id" : fileId} , removeValues , {new : true})
        if (updatedCharger) {
            return res.status(200).send(updatedCharger);
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger not found' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/controlCenter/charger/files', async (req, res) => {
    var context = "POST /api/private/controlCenter/charger/files";
    try {
        let {  chargerId , content , name , type } = req.body
        let foundCharger = await Charger.findOne({_id : chargerId })
        if (foundCharger) {
            let lastUpdated = new Date().toISOString()
            foundCharger.files.push({content , name , type , lastUpdated})
            foundCharger.save()
            return res.status(200).send(foundCharger);
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger not found' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/controlCenter/charger/diagnostics', async (req, res) => {
    var context = "POST /api/private/controlCenter/charger/diagnostics";
    try {
        let {  hwId , content  } = req.body
        let foundCharger = await Charger.findOne({hwId})
        if (foundCharger) {
            let lastUpdated = new Date().toISOString()
            foundCharger.diagnostics.push({content , lastUpdated})
            foundCharger.save()
            return res.status(200).send(foundCharger);
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger not found' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
//Patch for update a charger
/*
    Use to update:
    - name;
    - parkingType;
*/
router.patch('/api/private/controlCenter/charger', (req, res, next) => {
    var context = "PATCH /api/private/controlCenter/chargers";
    try {

        var charger = req.body;
        var userId = req.headers['userid'];
        let clientName = req.headers['clientname'];
        let operatorId = req.headers['ownerid'];
        let chargerId = charger.chargerId;

        if (charger.hwId) {

            let query = {
                hwId: charger.hwId,
                _id: { $ne: chargerId },
                hasInfrastructure: true
            };

            Charger.find(query, (err, result) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                if (result.length > 0) {
                    return res.status(400).send({ auth: false, code: "server_hwId_already_use", message: "HwId already in use by another charger." });
                } else {
                    makeUpdateOnChargers(charger, operatorId)
                        .then(async response => {
                            if (response.auth) {
                                if (clientName === "EVIO") {
                                    return res.status(200).send(response);
                                } else {
                                    let chargerFound = await Charger.findOne({ _id: chargerId });
                                    return res.status(200).send(chargerFound);
                                };
                            } else
                                return res.status(400).send(response);
                        })
                        .catch(error => {
                            if (error.response) {
                                console.error(`[${context}][makeUpdateOnChargers][400] Error `, error.response.data.message);
                                return res.status(400).send(error.response.data.message);
                            }
                            else {
                                console.error(`[${context}][makeUpdateOnChargers][500] Error `, error.message);
                                return res.status(500).send(error.message);
                            }
                        });
                };
            });

        } else {

            makeUpdateOnChargers(charger, operatorId)
                .then(async response => {
                    if (response.auth) {
                        if (clientName === "EVIO") {
                            return res.status(200).send(response);
                        } else {
                            let chargerFound = await Charger.findOne({ _id: chargerId });
                            return res.status(200).send(chargerFound);
                        };
                    } else
                        return res.status(400).send(response);
                })
                .catch(error => {
                    if (error.response) {
                        console.error(`[${context}][makeUpdateOnChargers][400] Error `, error.response.data.message);
                        return res.status(400).send(error.response.data.message);
                    }
                    else {
                        console.error(`[${context}][makeUpdateOnChargers][500] Error `, error.message);
                        return res.status(500).send(error.message);
                    }
                });

        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//patch to config plugs
router.patch('/api/private/controlCenter/charger/configPlugs', async (req, res, next) => {
    var context = "PATCH /api/private/controlCenter/charger/configPlugs";
    try {
        let { chargerId,plugId , active } = req.body

        let query = {
            _id: chargerId,
            active: true,
            hasInfrastructure: true,
            "plugs.plugId": plugId
        };

        let newValue = {
            $set: {
            }
        };
        Object.keys(req.body).forEach( value => {
            if (value !== 'chargerId') {
                newValue['$set'][`plugs.$.${value}`] = req.body[value]
            }
        })


        let updatedCharger = await Charger.findOneAndUpdate(query , newValue , {new : true}).lean()
        if (updatedCharger) {
            changeAvailability(updatedCharger.hwId , plugId , active)
            return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
        } else {
            return res.status(400).send({ auth: false, code: 'server_plug_not_updated', message: "Charger not in a valid state to be updated" });
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/operatorInfo', async (req, res, next) => {
    var context = "PATCH /api/private/controlCenter/charger/operatorInfo";
    try {
        let updatedChargers = await Charger.updateMany({operatorId : req.body.operatorId} , { $set : req.body} , {new : true}).lean()
        return res.status(200).send(updatedChargers);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/charger/tariffId', async (req, res, next) => {
    var context = "PATCH /api/private/controlCenter/charger/tariffId";
    try {
        let { tariffId , chargerId , plugs , network } = req.body
        let foundCharger = await Charger.findOne({_id : chargerId}).lean()
        if (foundCharger) {
            return res.status(200).send(await updateTariffId(foundCharger , plugs , tariffId , network));
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger not found' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========


router.put('/api/private/controlCenter/charger/files', async (req, res) => {
    var context = "PUT /api/private/controlCenter/charger/files";
    try {
        let {  chargerId , content , name , type , fileId} = req.body

        let newValues = {
            '$set': {
                'files.$.content': content,
                'files.$.name': name,
                'files.$.type': type,
                'files.$.lastUpdated': new Date().toISOString(),
            }
        }
        let updatedCharger = await Charger.findOneAndUpdate({_id : chargerId ,"files._id" : fileId} , newValues , {new : true})
        if (updatedCharger) {
            return res.status(200).send(updatedCharger);
        } else {
            return res.status(400).send({ auth: false, code: '', message: 'Charger not found' })
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});









// =============================== INFRASTRUCTURES =============================== //

// ========= GET ==========
//Get my infrastructures insights
router.get('/api/private/controlCenter/infrastructure/myInfrastructure', (req, res, next) => {
    var context = "GET /api/private/controlCenter/infrastructure/myInfrastructure";
    try {
        var userId = req.query.userId
        var infrastructureId = req.query.infrastructureId
        var chargerId = req.query.chargerId
        var query = {
            $and : [
                { createUserId: userId },
                infrastructureId ? { _id: infrastructureId } : {},
            ]
        };
        // if (infrastructureId) {
        //     query._id = infrastructureId
        // }

        findInfrastructure(query)
            .then((infrastructureFound) => {
                if (infrastructureFound.length === 0)
                    return res.status(200).send(infrastructureFound);
                else {
                    var newInfrastructureFound = [];
                    Promise.all(
                        infrastructureFound.map(infrastructure => {
                            return new Promise((resolve, reject) => {
                                getChargers(infrastructure , chargerId)
                                    .then((infrastructure) => {
                                        infrastructure.infrastructureId = infrastructure._id
                                        newInfrastructureFound.push(infrastructure);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                        reject(error);
                                    });
                            });
                        })
                    ).then((result) => {
                        newInfrastructureFound.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
                        return res.status(200).send(newInfrastructureFound);
                    }).catch((error) => {
                        console.error(`[${context}][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findInfrastructure][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//Get my infrastructures insights
router.get('/api/private/controlCenter/infrastructure', async (req, res) => {
    var context = "GET /api/private/controlCenter/infrastructure";
    try {
        var infrastructureId = req.query.infrastructureId
        var query = {
            _id: infrastructureId
        };
        let foundInfrastructure = await Infrastructure.findOne(query).lean()
        return res.status(200).send({
            address : foundInfrastructure.address, 
            name : foundInfrastructure.name, 
            CPE : foundInfrastructure.CPE, 
            imageContent : foundInfrastructure.imageContent, 
            nTotalChargers : foundInfrastructure.listChargers.length , 
            infrastructureId : foundInfrastructure._id,
            ownerId : foundInfrastructure.operatorId,
            userId : foundInfrastructure.createUserId,
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

//========== POST ==========
//Create infrastructure
router.post('/api/private/controlCenter/infrastructure', (req, res, next) => {
    var context = "POST /api/private/controlCenter/infrastructure";
    try {
        const infrastructure = new Infrastructure(req.body);
        var createUser = req.headers['userid'];
        var clientName = req.headers['clientname'];
        var ownerId = req.headers['ownerid'];
        if (req.body.imageContent === undefined) {
            infrastructure.imageContent = "";
        };
        infrastructure.createUserId = createUser;
        infrastructure.createdBy = ownerId;
        infrastructure.operatorId = ownerId;
        infrastructure.clientName = clientName;
        validateFieldsInfrastructure(infrastructure)
            .then(() => {
                if (infrastructure.imageContent !== "") {
                    saveImageContentInfrastructure(infrastructure)
                        .then((infrastructure) => {
                            createInfrastructure(infrastructure, res);
                        })
                        .catch((error) => {
                            console.error(`[${context}][saveImageContentInfrastructure][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    createInfrastructure(infrastructure, res);
                };
            })
            .catch((error) => {
                return res.status(400).send(error);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Update a infrastructure
router.patch('/api/private/controlCenter/infrastructure', (req, res) => {
    var context = "PATCH /api/private/controlCenter/infrastructure";
    try {
        var received = req.body;
        var query = {
            _id: received.infrastructureId
        };
        findOneInfrastructure(query)
            .then((infrastructureFound) => {

                if (infrastructureFound) {
                    infrastructureFound.name = received.name;
                    infrastructureFound.address = received.address ? received.address : infrastructureFound.address
                    infrastructureFound.CPE = received.CPE ? received.CPE : infrastructureFound.CPE;

                    if ((received.imageContent == "") && (infrastructureFound.imageContent != "")) {

                        unlinkImage(infrastructureFound)
                            .then((result) => {

                                infrastructureFound.imageContent = "";
                                var newValues = { $set: infrastructureFound };
                                updateInfrastructure(newValues, query)
                                    .then((result) => {
                                        if (result) {
                                            return res.status(200).send(infrastructureFound);
                                            // getChargers(infrastructureFound)
                                            //     .then((infrastructureFound) => {
                                            //         return res.status(200).send(infrastructureFound);
                                            //     })
                                            //     .catch((error) => {
                                            //         console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                            //         return res.status(500).send(error.message);
                                            //     });
                                        } else
                                            return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateInfrastructure][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            })
                            .catch((error) => {
                                console.error(`[${context}][unlinkImage][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    } else if (received.imageContent !== null && received.imageContent !== undefined && received.imageContent.includes('base64')) {

                        unlinkImage(infrastructureFound)
                            .then((result) => {

                                saveImageContentInfrastructure(received)
                                    .then((received) => {

                                        infrastructureFound.imageContent = received.imageContent;
                                        var newValues = { $set: infrastructureFound };
                                        updateInfrastructure(newValues, query)
                                            .then((result) => {
                                                if (result) {
                                                    return res.status(200).send(infrastructureFound);
                                                    // getChargers(infrastructureFound)
                                                    //     .then((infrastructureFound) => {
                                                    //         return res.status(200).send(infrastructureFound);
                                                    //     })
                                                    //     .catch((error) => {
                                                    //         console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                                    //         return res.status(500).send(error.message);
                                                    //     });
                                                } else {
                                                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                }
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][updateInfrastructure][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][saveImageContentInfrastructure][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                            })
                            .catch((error) => {
                                console.error(`[${context}][unlinkImage][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    } else {

                        var newValues = { $set: infrastructureFound };
                        updateInfrastructure(newValues, query)
                            .then((result) => {
                                if (result) {
                                    return res.status(200).send(infrastructureFound);
                                    // getChargers(infrastructureFound)
                                    //     .then((infrastructureFound) => {
                                    //         return res.status(200).send(infrastructureFound);
                                    //     })
                                    //     .catch((error) => {
                                    //         console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                    //         return res.status(500).send(error.message);
                                    //     });
                                } else
                                    return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                            })
                            .catch((error) => {
                                console.error(`[${context}][updateInfrastructure][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    };
                } else {
                    return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findOneInfrastructure][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/controlCenter/infrastructure/operatorId', async (req, res) => {
    var context = "PATCH /api/private/controlCenter/infrastructure/operatorId";
    try {
        let {infrastructureId , operatorId} = req.body
        // console.log(req.body)
        let updatedInfrastructure = await Infrastructure.findOneAndUpdate({_id : infrastructureId} , {$set : {operatorId}})
        return res.status(200).send(updatedInfrastructure);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//remove an infrastructure
router.delete('/api/private/controlCenter/infrastructure', (req, res, next) => {
    var context = "DELETE /api/private/controlCenter/infrastructure";
    try {

        var infrastructures = req.body;

        var query = {
            _id: infrastructures.infrastructureId
        };

        removeChargerInfrastructure(infrastructures)
            .then((value) => {

                Infrastructure.findOne(query, (err, infrastructureFound) => {
                    if (err) {
                        console.error(`[${context}][findOne] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (infrastructureFound) {
                            if (infrastructureFound.imageContent == "" || infrastructureFound.imageContent == undefined) {

                                Infrastructure.removeInfrastructure(query, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][removeInfrastructure] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        if (result) {
                                            return res.status(200).send({ auth: true, code: 'server_infrastructure_group_removed', message: "Infrastructure group removed" });
                                        } else {
                                            return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });
                                        };
                                    };
                                });
    
                            }
                            else {
    
                                unlinkImage(infrastructureFound)
                                    .then(() => {
    
                                        Infrastructure.removeInfrastructure(query, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}][removeInfrastructure] Error `, err.message);
                                                return res.status(500).send(err.message);
                                            }
                                            else {
                                                if (result) {
                                                    return res.status(200).send({ auth: true, code: 'server_infrastructure_group_removed', message: "Infrastructure group removed" });
                                                } else {
                                                    return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });
                                                };
                                            };
                                        });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][unlinkImage] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
    
                            };
                        } else {
                            return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });
                        };
                    };
                });

            })
            .catch((error) => {
                if (error.auth != undefined) {
                    return res.status(400).send(error);
                }
                else {
                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);
                };
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Delete a charger
router.delete('/api/private/controlCenter/charger', async (req, res, next) => {
    var context = "DELETE /api/private/controlCenter/chargers";
    try {

        var charger = req.body;

        var query = {
            _id: charger.chargerId,
            hasInfrastructure: true
        };

        let chargerFound = await chargerFindOne(query);

        var queryHwId = {
            hwId: chargerFound.hwId
        };

        var queryChargerId = {
            chargerId: chargerFound._id
        };

        let sessionsOfTheCharger = await chargingSessionFind(queryHwId);

        if (chargerFound) {

            var found = chargerFound.plugs.filter(plug => {
                return plug.status == process.env.PlugsStatusInUse;
            });

            if (found.length != 0) {

                return res.status(400).send({ auth: false, code: 'server_charger_in_use', message: "Charger has not been deleted, charger in use" });

            }
            else {

                if (chargerFound.infrastructure != "") {

                    var infra = {
                        _id: chargerFound.infrastructure,
                        chargerId: chargerFound._id
                    };

                    removeFromInfra(infra);

                };

                if (chargerFound.chargerType === '002') {
                    var host = process.env.HostSonOff + process.env.PathRemoveSonOff;
                    var data = {
                        hwId: chargerFound.hwId
                    };
                    axios.post(host, data);
                }

                if (chargerFound.chargerType === '007') {

                    var host = process.env.HostEVIOBox + process.env.PathRemoveEVIOBOx;
                    var data = {
                        hwId: chargerFound.hwId
                    };
                    axios.post(host, data);
                }

                removeQrCode(chargerFound);
                deleteChargerFromFavorite(queryChargerId);
                managementPOIsDelete(queryHwId);
                changeNetworkStatus(chargerFound)

                if (sessionsOfTheCharger.length > 0) {

                    var chargerToDelete = {

                        active: false,
                        infrastructure: "",
                        hasInfrastructure: false,
                        status: process.env.ChargePointStatusEVIOFaulted,
                        operationalStatus: process.env.OperationalStatusRemoved,
                        networks: chargerFound.networks

                    };
                    var newValues = { $set: chargerToDelete };
                    updateCharger(query, newValues)
                        .then((result) => {

                            if (result) {

                                return res.status(200).send({ auth: true, code: 'server_successfully_removed', message: "Charger successfully removed" });

                            }
                            else {

                                return res.status(400).send({ auth: false, code: 'server_unsuccessfully_removed', message: "Charger unsuccessfully removed" });

                            };
                        })
                        .catch((error) => {

                            return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });

                        });
                }
                else {

                    Charger.removeCharger(query, (error, result) => {
                        if (error) {

                            console.error(`[${context}] Error `, error.message);
                            return res.status(500).send(error.message);

                        }
                        else {

                            if (result) {

                                return res.status(200).send({ auth: true, code: 'server_successfully_removed', message: "Charger successfully removed" });

                            }
                            else {

                                return res.status(400).send({ auth: false, code: 'server_unsuccessfully_removed', message: "Charger unsuccessfully removed" });

                            };

                        };

                    });

                };

            };

        }
        else {

            return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });

        };

    } catch (error) {

        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});



// =============================== CHARGING SESSIONS =============================== //

router.get('/api/private/controlCenter/chargingsessions', async (req, res) => {
    var context = "GET /api/private/controlCenter/chargingsessions";
    try {
        let query = req.query
        let foundSessions = await ChargingSession.find(query).lean()
        return res.status(200).send(foundSessions);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/controlCenter/chargingsessions/ocpi', async (req, res) => {
    var context = "GET /api/private/controlCenter/chargingsessions/ocpi";
    try {
        let {network , date_from , date_to , party_id , country_code} = req.query
        // console.log(req.body)
        let query = {
            $and : [
                { network },
                { party_id },
                { country_code },
                { createdWay : { $ne : process.env.createdWayOcpiOfflineUnknown} },
            ]
        }
        
        if (date_from != "" && date_to != "") {
            query["$and"].push(
                {
                    $and: [
                        { updatedAt: { $gte: new Date(date_from)} },
                        { updatedAt: { $lte: new Date(date_to) } }
                    ]
                }
            )
        } else if (date_from != "") {
            query["$and"].push(
                {
                    updatedAt: { $gte: new Date(date_from) }
                }
            )
        } else if (date_to != "") {
            query["$and"].push(
                {
                    updatedAt: { $lte: new Date(date_to) }
                }
            )
        }

        console.log(JSON.stringify(query))

        const pipeline = [
            {
                "$match": query
            },
            {
                "$project": {
                    "country_code": "$country_code",
                    "party_id": "$party_id",
                    "ocpiId": "$ocpiId",
                    "startDate": "$startDate",
                    "stopDate": "$stopDate",
                    "totalPower": { $divide: ["$totalPower", 1000] },
                    "cdr_token": "$cdr_token",
                    "auth_method": "$auth_method",
                    "authorization_reference": "$authorization_reference",
                    "location_id": "$location_id",
                    "evse_uid": "$evse_uid",
                    "connector_id": "$connector_id",
                    "currency": "$currency",
                    "status": "$status",
                    "updatedAt": "$updatedAt",
                    "_id": 0
                }
            }
        ];

        const foundSessions = await ChargingSession.aggregate(pipeline);
        
        // let foundSessions = await ChargingSession.find(query).lean()
        return res.status(200).send(foundSessions);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.get('/api/private/controlCenter/chargingsessions/ocpi/session', async (req, res) => {
    var context = "GET /api/private/controlCenter/chargingsessions/ocpi/session";
    try {
        let {network ,party_id , country_code , ocpiId , date_from , date_to } = req.query
        // console.log(req.body)
        let query = {
            network,
            party_id,
            country_code,
            ocpiId,
            createdWay : { $ne : process.env.createdWayOcpiOfflineUnknown},
        }

        if (date_from != "" && date_to != "") {
            query = { 
                ...query,
                $and: [
                    { updatedAt: { $gte: date_from} },
                    { updatedAt: { $lte: date_to } }
                ]
            };
        } else if (date_from != "") {
            query = { 
                ...query,
                updatedAt: { $gte: date_from }
            };
        } else if (date_to != "") {
            query = { 
                ...query,
                updatedAt: { $lte: date_to }
            };
        }
        console.log("query" ,JSON.stringify(query))
        let foundSession = await ChargingSession.findOne(query).lean()
        console.log("foundSession" , JSON.stringify(foundSession))
        if (foundSession) {
            return res.status(200).send(foundSession)
        } else {
            return res.status(200).send({})
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});

router.patch('/api/private/controlCenter/chargingsessions/ocpi', async (req, res) => {
    var context = "GET /api/private/controlCenter/chargingsessions/ocpi";
    try {
        let {network ,party_id , country_code , ocpiId , cdrId } = req.body
        // console.log(req.body)
        let query = {
            network,
            party_id,
            country_code,
            ocpiId,
            createdWay : { $ne : process.env.createdWayOcpiOfflineUnknown},
        }

        let foundSession = await ChargingSession.findOneAndUpdate(query , {$set : {cdrId}} , {new : true}).lean()
        if (foundSession) {
            return res.status(200).send(foundSession)
        } else {
            return res.status(200).send(null)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);

    };
});
//========== FUNCTION ==========
//Function to validate fields received 
function validateFieldsInfrastructure(infrastructure) {
    return new Promise((resolve, reject) => {
        if (!infrastructure)
            reject({ auth: false, code: 'server_infrastructure_data_required', message: 'Infrastructure data required' });
        else if (!infrastructure.name)
            reject({ auth: false, code: 'server_nfrastructure_name_required', message: 'Infrastructure name is required' });
        else if (!infrastructure.createUserId)
            reject({ auth: false, code: 'server_user_id_required', message: 'User id is required' });
        else
            resolve(true);
    });
};

//Function to find one infrastructure using query
function findOneInfrastructure(query) {
    var context = "Funciton findOneInfrastructure";
    return new Promise((resolve, reject) => {
        Infrastructure.findOne(query, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            } else {
                resolve(infrastructureFound);
            };
        });
    });
};

//Function to save image on file
function saveImageContentInfrastructure(infrastructure) {
    var context = "Function saveImageContentInfrastructure";
    return new Promise((resolve, reject) => {

        var dateNow = Date.now();
        var path = `/usr/src/app/img/infrastructures/${infrastructure._id}_${dateNow}.jpg`;
        var pathImage = '';
        var base64Image = infrastructure.imageContent.split(';base64,').pop();

        if (process.env.NODE_ENV === 'production') {
            pathImage = `${process.env.HostProd}infrastructures/${infrastructure._id}_${dateNow}.jpg`; // For PROD server
        }
        else if (process.env.NODE_ENV === 'pre-production') {
            pathImage = `${process.env.HostPreProd}infrastructures/${infrastructure._id}_${dateNow}.jpg`; // For PROD server
        }
        else {
            //pathImage = `${process.env.HostLocal}infrastructures/${infrastructure._id}_${dateNow}.jpg`;  // For local host
            pathImage = `${process.env.HostQA}infrastructures/${infrastructure._id}_${dateNow}.jpg`; // For QA server
        };

        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err)
            }
            else {
                infrastructure.imageContent = pathImage;
                resolve(infrastructure);
            };
        });
    });
};


//Function to delete an image
function unlinkImage(infrastructure) {
    var context = "Function unlinkImage";
    return new Promise((resolve, reject) => {

        var name = infrastructure.imageContent.split('/');

        var path = `/usr/src/app/img/infrastructures/${name[name.length - 1]}`;

        fs.unlink(path, (err, result) => {
            if (err) {
                console.error(`[${context}] [fs.unlink]Error `, err.message);
                //reject(err);
                resolve();
            }
            else {
                resolve(result);
            };
        });
    });
};

//Function to update an infrastructure
function updateInfrastructure(newValues, query) {
    var context = "Funciton updateInfrastructure";
    return new Promise((resolve, reject) => {
        try {
            Infrastructure.updateInfrastructure(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateInfrastructure] Error `, err.message);
                    reject(err);
                } else {
                    if (result)
                        resolve(true);
                    else
                        resolve(false);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to create an infrastructure
function createInfrastructure(infrastructure, res) {
    var context = "Funciton createInfrastructure";
    Infrastructure.createInfrastructure(infrastructure, (err, result) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
            return res.status(500).send(err.message);
        }
        else {
            if (result)
                return res.status(200).send(result);
            else
                return res.status(400).send({ auth: false, code: 'server_infrastructure_not_created', message: 'Infrastructure not created' });
        };
    });
};

async function addNetworks(allChargers,res) {
    const context = "Function addNetworks"
    try {
        let usersData = await Promise.all(allChargers.map(async (charger) => await defaultNetworks(charger)))
        return res.status(200).send(usersData);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send([]);
    }
}

async function defaultNetworks(charger) {
    const context = "Function defaultNetworks"
    try {
        let networks = [
            {
                name: process.env.NetworkEVIO,
                networkName: "server_evio_network",
                network: process.env.NetworkEVIO,
                status: process.env.ChargerNetworkStatusActive,
                id: charger.hwId,
                activationRequest : true,
                publish : true,
            },
            {
                name: process.env.NetworkMobiE,
                networkName: "server_mobie_network",
                network: process.env.NetworkMobiE,
                status: process.env.ChargerNetworkStatusInactive,
                id: "",
                activationRequest : false,
                publish : true,
            },
            {
                name: "server_international_network_1",
                networkName: "server_international_network_1",
                network: process.env.NetworkGireve,
                status: process.env.ChargerNetworkStatusInactive,
                id: "",
                activationRequest : false,
                publish : true,
            }
        ];
        return await Charger.findOneAndUpdate({hwId : charger.hwId} , {$set : {networks}} , {new : true})
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function chargerDefaultNetworks(hwId) {
    return [
        {
            name: process.env.NetworkEVIO,
            networkName: "server_evio_network",
            network: process.env.NetworkEVIO,
            status: process.env.ChargerNetworkStatusInactive,
            id: hwId,
            activationRequest : false,
            publish : true,
        },
        {
            name: process.env.NetworkMobiE,
            networkName: "server_mobie_network",
            network: process.env.NetworkMobiE,
            status: process.env.ChargerNetworkStatusInactive,
            id: "",
            activationRequest : false,
            publish : true,
        },
        {
            name: "server_international_network_1",
            networkName: "server_international_network_1",
            network: process.env.NetworkGireve,
            status: process.env.ChargerNetworkStatusInactive,
            id: "",
            activationRequest : false,
            publish : true,
        }
    ];
}

function findInfrastructure(query) {
    var context = "Funciton findInfrastructure";
    return new Promise((resolve, reject) => {
        let fields = {
            listChargers : 1,
            _id : 1,
            name : 1,
            imageContent : 1,
        }
        Infrastructure.find(query, fields , (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err);
            } else {
                resolve(infrastructureFound);
            };
        });
    });
};

//Function to get charger
function getChargers(infrastructureFound , chargerId) {
    var context = "Funciton getChargers";
    return new Promise((resolve, reject) => {
        var listChargers = [];
        const getChargers = (charger , chargerId) => {
            return new Promise((resolve, reject) => {
                if (chargerId) {
                    if (chargerId === charger.chargerId) {
                        var query = {
                            _id: charger.chargerId,
                            hasInfrastructure: true
                        };
                        let fields = {
                            _id : 1 ,
                            name : 1,
                            hwId : 1,
                            networks : 1,
                            "address.city" : 1,
                            "plugs.plugId" : 1,
                            "plugs.status" : 1,
                            "plugs.connectorType" : 1,
                            "plugs.powerType" : 1,
                            "plugs.tariffIds" : 1,
                        }
                        Charger.findOne(query, fields , async (err, chargerFound) => {
                            if (err) {
                                console.error(`[${context}][findOne] Error `, err.message);
                                reject(err);
                            } else {
                                if (chargerFound) {
                                    chargerFound = JSON.parse(JSON.stringify(chargerFound));
                                    chargerFound._id = charger._id;
                                    chargerFound.chargerId = charger.chargerId;
                                    chargerFound.nTotalPlugs = chargerFound.plugs.length;
                                    listChargers.push(chargerFound);
                                    resolve(true);
                                }
                                else {
                                    listChargers.push(charger);
                                    resolve(true);
                                };
                            };
                        });
                    } else {
                        resolve(true);
                    }
                } else {
                    var query = {
                        _id: charger.chargerId,
                        hasInfrastructure: true
                    };
                    let fields = {
                        _id : 1 ,
                        name : 1,
                        hwId : 1,
                        networks : 1,
                        "address.city" : 1,
                        "plugs.plugId" : 1,
                        "plugs.status" : 1,
                        "plugs.connectorType" : 1,
                        "plugs.powerType" : 1,
                        "plugs.tariffIds" : 1,
                    }
                    Charger.findOne(query, fields , async (err, chargerFound) => {
                        if (err) {
                            console.error(`[${context}][findOne] Error `, err.message);
                            reject(err);
                        } else {
                            if (chargerFound) {
                                chargerFound = JSON.parse(JSON.stringify(chargerFound));
                                chargerFound._id = charger._id;
                                chargerFound.chargerId = charger.chargerId;
                                chargerFound.nTotalPlugs = chargerFound.plugs.length;
                                listChargers.push(chargerFound);
                                resolve(true);
                            }
                            else {
                                listChargers.push(charger);
                                resolve(true);
                            };
                        };
                    });
                }
            });
        };
        Promise.all(
            infrastructureFound.listChargers.map(charger => getChargers(charger , chargerId))
        ).then(() => {
            infrastructureFound = JSON.parse(JSON.stringify(infrastructureFound));
            listChargers.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
            infrastructureFound.listChargers = listChargers;
            infrastructureFound.nTotalChargers = listChargers.length;
            resolve(infrastructureFound);
        }).catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
            reject(error);
        });
    });
};

//function to get list of groups to a charger
function getListOfGroups(chargerFound) {
    var context = "Funciton getListOfGroups";
    return new Promise((resolve, reject) => {
        var host = process.env.HostUser + process.env.PathGetGroupCSUsersById;
        var listOfGroups = []
        Promise.all(
            chargerFound.listOfGroups.map(group => {
                return new Promise((resolve, reject) => {
                    var data = {
                        _id: group.groupId
                    };
                    axios.get(host, { data })
                        .then((values) => {
                            var newGroup = JSON.parse(JSON.stringify(values.data));
                            newGroup._id = group._id;
                            newGroup.groupId = group.groupId;
                            listOfGroups.push(newGroup);
                            resolve(true);
                        })
                        .catch((error) => {
                            console.error(`[${context}][axios.get][.catch] Error `, error.message);
                            reject(error);
                        });
                });
            })
        ).then(() => {
            chargerFound.listOfGroups = listOfGroups;
            resolve(chargerFound);
        }).catch((error) => {
            console.error(`[${context}][Promise.all][.catch] Error `, error.message);
            reject(error);
        });
    });
};

function getFees(charger) {
    return new Promise(async (resolve, reject) => {

        let countryCode;
        let postalCode;

        if (charger.address != undefined) {
            if (charger.address.country) {
                if (charger.address.country === 'Portugal' || charger.address.country === '') {
                    countryCode = 'PT';
                }
                else {
                    countryCode = charger.address.country;
                }
            }
            else {
                countryCode = 'PT';
            }

            if (charger.address.zipCode !== undefined && charger.address.zipCode !== "") {
                let result = charger.address.zipCode.split("-");
                if (result.length > 1) {
                    postalCode = result[0];
                }
                else {
                    postalCode = '';
                }
            }
            else {
                postalCode = '';
            }
        }
        else {
            countryCode = 'PT';
        }

        var params = {
            countryCode: countryCode,
            postalCode: postalCode
        }

        let host = process.env.HostConfigs + process.env.PathConfigFees;

        axios.get(host, { params })
            .then((fees) => {
                if (fees.data) {
                    //console.log(fees.data);
                    resolve(fees.data);
                }
                else {
                    resolve(false);
                }
            })
            .catch((error) => {
                console.log("[Error] " + error);
                resolve(false);
            });

    });
};

function getTariffPlug(chargerFound) {
    var context = "Funciton getTariffPlug";
    return new Promise((resolve, reject) => {
        chargerFound = JSON.parse(JSON.stringify(chargerFound));
        const getTariffPlug = (plug) => {
            return new Promise((resolve, reject) => {
                if (plug.tariff.length != 0) {
                    Promise.all(
                        plug.tariff.map(tariff => {
                            return new Promise((resolve, reject) => {
                                if ((tariff.tariffId == undefined) || (tariff.tariffId == "")) {
                                    if ((tariff.groupName == process.env.ChargerAccessPublic) || (tariff.groupName == process.env.ChargerAccessPrivate) || (tariff.groupName == process.env.ChargerAccessFreeCharge)) {
                                        resolve(true);
                                    }
                                    else {
                                        var host = process.env.HostUser + process.env.PathGetGroupCSUsersById;
                                        var data = {
                                            _id: tariff.groupId
                                        };
                                        axios.get(host, { data })
                                            .then((value) => {
                                                var groupCSUsers = JSON.parse(JSON.stringify(value.data));
                                                tariff.imageContent = groupCSUsers.imageContent;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    };
                                }
                                else {
                                    if (tariff.groupName == process.env.ChargerAccessPrivate || tariff.groupName == process.env.ChargerAccessFreeCharge) {
                                        resolve(true);
                                    }
                                    else if (tariff.groupName == process.env.ChargerAccessPublic) {

                                        var host = process.env.HostTariffs + process.env.PathGetTariff;
                                        var data = {
                                            _id: tariff.tariffId
                                        };
                                        axios.get(host, { data })
                                            .then((value) => {
                                                var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                tariff.name = tariffFound.name;
                                                tariff.tariffType = tariffFound.tariffType;
                                                tariff.tariff = tariffFound.tariff;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    }
                                    else {
                                        var host = process.env.HostUser + process.env.PathGetGroupCSUsersById;
                                        var data = {
                                            _id: tariff.groupId
                                        };
                                        axios.get(host, { data })
                                            .then((value) => {
                                                var groupCSUsers = JSON.parse(JSON.stringify(value.data));
                                                tariff.imageContent = groupCSUsers.imageContent;
                                                var host = process.env.HostTariffs + process.env.PathGetTariff;
                                                var data = {
                                                    _id: tariff.tariffId
                                                };
                                                axios.get(host, { data })
                                                    .then((value) => {
                                                        var tariffFound = JSON.parse(JSON.stringify(value.data));
                                                        tariff.name = tariffFound.name;
                                                        tariff.tariffType = tariffFound.tariffType;
                                                        tariff.tariff = tariffFound.tariff;
                                                        resolve(true);
                                                    })
                                                    .catch((error) => {
                                                        console.error(`[${context}][axios.get] Error `, error.message);
                                                        reject(error);
                                                    });
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][axios.get] Error `, error.message);
                                                reject(error);
                                            });
                                    };
                                };
                            });
                        })
                    ).then(() => {
                        resolve(true);
                    }).catch((error) => {
                        console.error(`[${context}] Promise.all] Error `, error.message);
                        reject(error);
                    })
                }
                else {
                    resolve(true);
                };
            });
        };
        Promise.all(
            chargerFound.plugs.map(plug => getTariffPlug(plug))
        ).then((result) => {
            resolve(chargerFound);
        }).catch((error) => {
            console.error(`[${context}] Promise.all] Error `, error.message);
            reject(error);
        });
    });
};

function removeChargerInfrastructure(infrastructures) {
    var context = "Funciton removeChargerInfrastructure";
    return new Promise(async (resolve, reject) => {
        try {
            var query = {
                infrastructure: infrastructures.infrastructureId
            };

            let chargersFound = await chargerFind(query);

            if (chargersFound.length == 0) {
                resolve(true);
            }
            else {

                let found = chargersFound.filter(charger => {
                    return charger.plugs.find(plug => {
                        return plug.status == process.env.PlugsStatusInUse;
                    });
                });

                if (found.length > 0) {

                    reject({ auth: false, code: 'server_infrastructure_in_use', message: "Infrastructure cannot be removed, chargers in use" });

                }
                else {

                    Promise.all(
                        chargersFound.map(chargerFound => {

                            return new Promise(async (resolve, reject) => {

                                var query = {
                                    _id: chargerFound._id
                                };

                                var queryHwId = {
                                    hwId: chargerFound.hwId
                                };

                                var queryChargerId = {
                                    chargerId: chargerFound._id
                                };

                                let sessionsOfTheCharger = await chargingSessionFind(queryHwId);

                                removeQrCode(chargerFound);
                                deleteChargerFromFavorite(queryChargerId);
                                managementPOIsDelete(queryHwId);

                                if (sessionsOfTheCharger.length > 0) {

                                    var newValues = {
                                        $set: {
                                            active: false,
                                            infrastructure: "",
                                            hasInfrastructure: false,
                                            status: process.env.ChargePointStatusEVIOFaulted,
                                            operationalStatus: process.env.OperationalStatusRemoved
                                        }
                                    };

                                    updateCharger(query, newValues)
                                        .then((result) => {
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}] Error `, error.message);
                                            reject(error);
                                        });
                                }
                                else {

                                    Charger.removeCharger(query, (error, result) => {
                                        if (error) {
                                            console.error(`[${context}] Error `, error.message);
                                            reject(error);
                                        }
                                        else {
                                            resolve(true);
                                        };
                                    });
                                };

                            });

                        })
                    ).then((result) => {
                        resolve(true);
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        reject(error);
                    });
                };

            };

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function chargerFind(query) {
    var context = "Funciton chargerFind";
    return new Promise((resolve, reject) => {
        Charger.find(query, (err, chargersFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(chargersFound);
            };
        });
    });
};

function chargingSessionFind(query) {
    var context = "Function chargingSessionFind";
    return new Promise((resolve, reject) => {

        ChargingSession.find(query, (error, chargingSessionFounds) => {

            if (error) {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            }
            else {

                resolve(chargingSessionFounds);

            };

        });

    });
};

function removeQrCode(chargerFound) {
    var context = "Function removeQrCode";

    chargerFound.plugs.map(plug => {

        if (plug.qrCodeId != undefined) {
            var query = {
                qrCodeId: plug.qrCodeId
            };

            QrCode.findOne(query, (err, qrCodeFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                }
                else {

                    if ((chargerFound.chargerType != process.env.EVIOBoxType) && (chargerFound.chargerType != process.env.SonOFFType)) {

                        qrCodeFound.qrCode.hwId = '';
                        qrCodeFound.qrCode.plugId = '';
                        qrCodeFound.qrCode.chargerType = '';
                        qrCodeFound.qrCode.chargingDistance = '';
                        qrCodeFound.qrCode.geometry.coordinates = [];
                        var newValues = { $set: qrCodeFound };
                        QrCode.updateQrCode(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                            }
                            else {
                                console.log(`[${context}] Qr code deleted `);
                            };
                        });
                    }
                    else {

                        qrCodeFound.qrCode.chargingDistance = '';
                        qrCodeFound.qrCode.geometry.coordinates = [];
                        var newValues = { $set: qrCodeFound };
                        QrCode.updateQrCode(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);
                            }
                            else {
                                console.log(`[${context}] Qr code deleted `);
                            };
                        });

                    };

                };
            });
        };
    });

};

function deleteChargerFromFavorite(query) {
    var context = "Function deleteChargerFromFavorite";

    var host = process.env.HostUser + process.env.PathFavorites;
    var data = query;

    axios.patch(host, data)
        .then((result) => {
            console.log(`[${context}][axios.get] Deleted from favorites`);
        })
        .catch((error) => {
            console.error(`[${context}][axios.get][.catch] Error `, error.message);
        });
};

function managementPOIsDelete(query) {
    var context = "Function managementPOIsDelete";
    return new Promise((resolve, reject) => {
        ManagementPOIs.removeManagementPOIs(query, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err.message);
            }
            else {
                resolve(result);
            };
        });
    });
};


//Function to find one charger by query
function chargerFindOne(query) {
    var context = "Function chargerFindOne";
    return new Promise((resolve, reject) => {
        Charger.findOne(query, (err, chargerFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(chargerFound);
            };
        });
    });
};

function getGroupsCSUsers(groups) {
    var context = "Funciton getListOfGroups";
    return new Promise((resolve, reject) => {
        var host = process.env.HostUser + process.env.PathGetGroupCSUsersById;
        var listOfGroups = [];
        Promise.all(
            groups.map(group => {
                return new Promise((resolve, reject) => {
                    var data = {
                        _id: group.groupId
                    };
                    axios.get(host, { data })
                        .then((values) => {
                            var newGroup = JSON.parse(JSON.stringify(values.data));
                            newGroup._id = group._id;
                            newGroup.groupId = group.groupId;
                            listOfGroups.push(newGroup);
                            resolve(true);
                        })
                        .catch((error) => {
                            console.error(`[${context}][axios.get][.catch] Error `, error.message);
                            reject(error);
                        });
                });
            })
        ).then(() => {
            resolve(listOfGroups);
        }).catch((error) => {
            console.error(`[${context}][Promise.all][.catch] Error `, error.message);
            resolve(groups);
        });
    });
};

function getFleetsGroup(groups) {
    var context = "Funciton getFleetsGroup";
    return new Promise((resolve, reject) => {

        var host = process.env.HostEvs + process.env.PathFleetById;
        var listOfFleets = [];


        Promise.all(
            groups.map(group => {
                return new Promise((resolve, reject) => {
                    var params = {
                        _id: group.fleetId
                    };
                    axios.get(host, { params })
                        .then((values) => {
                            var newGroup = JSON.parse(JSON.stringify(values.data));
                            newGroup._id = group._id;
                            newGroup.fleetId = group.fleetId;
                            newGroup.fleetName = group.fleetName;
                            listOfFleets.push(newGroup);
                            resolve(true);
                        })
                        .catch((error) => {
                            console.error(`[${context}][axios.get][.catch] Error `, error.message);
                            reject(error);
                        });
                });
            })
        ).then(() => {

            resolve(listOfFleets);
        }).catch((error) => {
            console.error(`[${context}][Promise.all][.catch] Error `, error.message);
            resolve(groups);
        });
    });
};

function getBooking(chargerFound) {
    var context = "Funciton getBooking";
    return new Promise((resolve, reject) => {
        var data = {
            hwId: chargerFound.hwId
        };
        var host = process.env.HostBooking + process.env.PathBookingByCharger;

        axios.get(host, { data })
            .then((value) => {
                var bookings = value.data;
                resolve(bookings);
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                resolve([]);
                //reject(error.response.data);
            });
    });
};

function getPOIsByCharger(query, geometry, hwId) {
    var context = "Function getPOIsByCharger";
    return new Promise(async (resolve, reject) => {

        try {

            let configManagementPOIs = await getConfigManagementPOIs();

            ManagementPOIs.findOne({ hwId: hwId }, (err, result) => {

                if (err) {

                    console.error(`[${context}] Error `, err.message);;
                    reject(err);

                }
                else {

                    if (result) {

                        if (result.POIs.length == 0) {
                            if (process.env.NODE_ENV === 'production') {
                                var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${result.geometry.coordinates[1]},${result.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                            }
                            else {
                                var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${result.geometry.coordinates[1]},${result.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                            };

                            getPOIsGoogle(host, configManagementPOIs.numberOfPois)
                                .then((POIs) => {

                                    var POI = new ManagementPOIs();
                                    POI.POIs = POIs;
                                    result.POIs = POI.POIs;
                                    var query = {
                                        _id: result._id
                                    };
                                    var newValues = { $set: result };
                                    managementPOIsUpdate(query, newValues)
                                        .then((values) => {
                                            resolve(result.POIs);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][managementPOIsUpdate]][.catch] Error `, error.message);
                                            reject(error);
                                        });

                                })
                                .catch((error) => {
                                    console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
                                    reject(error);
                                });
                        }
                        else {

                            var dateNow = new Date();

                            var timeInSecunds = configManagementPOIs.daysToUpdate * 86400;
                            var dif = (dateNow - result.updatedAt) * 0.001;

                            if (dif >= timeInSecunds) {
                                if (process.env.NODE_ENV === 'production') {
                                    var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${result.geometry.coordinates[1]},${result.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                }
                                else {
                                    var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${result.geometry.coordinates[1]},${result.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                };
                                getPOIsGoogle(host, configManagementPOIs.numberOfPois)
                                    .then((POIs) => {

                                        if (POIs.length == 0) {
                                            var POI = new ManagementPOIs();
                                            POI.POIs = POIs;
                                            result.POIs = POI.POIs;
                                            var query = {
                                                _id: result._id
                                            };
                                            var newValues = { $set: result };
                                            managementPOIsUpdate(query, newValues)
                                                .then((values) => {
                                                    console.log(`[${context}] POIs updated`);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][managementPOIsUpdate]][.catch] Error `, error.message);
                                                    reject(error);
                                                });
                                        }
                                        else {
                                            console.log(`[${context}] POIs not updated`);
                                        };

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
                                        reject(error);
                                    });
                            };
                            resolve(result.POIs);
                        };

                    }
                    else {

                        Charger.findOne({ _id: query.chargerId }, (err, result) => {

                            if (err) {

                                console.error(`[${context}][find] Error `, err.message);
                                reject(err);

                            }
                            else {

                                if (process.env.NODE_ENV === 'production') {
                                    var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${result.geometry.coordinates[1]},${result.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                }
                                else {
                                    var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${result.geometry.coordinates[1]},${result.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
                                };

                                getPOIsGoogle(host, configManagementPOIs.numberOfPois)
                                    .then((POIs) => {

                                        var POI = new ManagementPOIs();
                                        //POI.chargerId = query.chargerId;
                                        POI.hwId = hwId;
                                        POI.geometry = geometry;
                                        POI.POIs = POIs;

                                        managementPOIsCreate(POI)
                                            .then((result) => {
                                                if (result) {
                                                    resolve(result.POIs);
                                                };
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][managementPOIsCreate]][.catch] Error `, error.message);
                                                reject(error);
                                            });

                                    })
                                    .catch((error) => {

                                        console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
                                        reject(error);

                                    });

                            };

                        });

                    };

                };

            });

        } catch (error) {

            console.error(`[${context}] Error `, error.message);
            reject(error);

        };

    });
};

function getConfigManagementPOIs() {
    var context = "Function getConfigManagementPOIs";
    return new Promise((resolve, reject) => {

        var host = process.env.HostConfigs + process.env.PathConfigManagementPOIs;
        axios.get(host)
            .then((result) => {

                if (result.data.length > 0) {

                    resolve(result.data[0]);

                }
                else {

                    var configManagementPOIs = {
                        daysToUpdate: 365,
                        numberOfPois: 7
                    };

                    resolve(configManagementPOIs);

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            });

    });
};

function getPOIsGoogle(host, numberOfPois) {
    var context = "Function getPOIsGoogle";
    return new Promise((resolve, reject) => {
        axios.get(host)
            .then((result) => {
                if (result.data.results.length === 0) {
                    resolve([]);
                }
                else {
                    var newPOIs = result.data.results.sort((a, b) => b.rating - a.rating);
                    // var newPOIs = result.data.results.splice(0, numberOfPois);
                    savePhotosPOIs(newPOIs, numberOfPois)

                        .then((result) => {
                            resolve(result);
                        })
                        .catch((error) => {
                            console.error(`[${context}][savePhotosPOIs][.catch] Error `, error.message);
                            reject(error);
                        })
                };
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function savePhotosPOIs(POIs, numberOfPois) {
    var context = "Function savePhotosPOIs";
    return new Promise((resolve, reject) => {
        Promise.all(
            POIs.map((POI, poiIndex) => {
                return new Promise(async (resolve, reject) => {
                    if (poiIndex > numberOfPois - 1) {

                        let url = POI.icon

                        if (POI.id != undefined) {
                            var path = '/usr/src/app/img/google/' + POI.id + '.jpg';
                        }
                        else {
                            var path = '/usr/src/app/img/google/' + POI.place_id + '.jpg';
                        };
                        var pathImage = "";
                        if (process.env.NODE_ENV === 'production') {
                            if (POI.id != undefined) {
                                pathImage = process.env.HostProd + 'google/' + POI.id + '.jpg'; // For PROD server
                            }
                            else {
                                pathImage = process.env.HostProd + 'google/' + POI.place_id + '.jpg'; // For PROD server
                            };
                        }
                        else if (process.env.NODE_ENV === 'pre-production') {
                            if (POI.id != undefined) {
                                pathImage = process.env.HostPreProd + 'google/' + POI.id + '.jpg'; // For Pred PROD server
                            }
                            else {
                                pathImage = process.env.HostPreProd + 'google/' + POI.place_id + '.jpg'; // For Pred PROD server
                            };
                        }
                        else {
                            if (POI.id != undefined) {
                                // pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                pathImage = process.env.HostQA + 'google/' + POI.id + '.jpg'; // For QA server
                            }
                            else {
                                // pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                pathImage = process.env.HostQA + 'google/' + POI.place_id + '.jpg'; // For QA server
                            };
                        };
                        download(url, path, () => {
                            POI.photos = pathImage;
                            resolve(true);
                        });

                    } else if (POI.photos != undefined) {


                        if (POI.photos.length !== 0) {
                            var photo = POI.photos[0];
                            if (process.env.NODE_ENV === 'production') {
                                var url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyProd;
                            }
                            else {
                                var url = process.env.HostGooglePhotos + '?maxwidth=' + photo.width + '&photoreference=' + photo.photo_reference + '&key=' + process.env.GoogleKeyQA;
                            };

                            if (POI.id != undefined) {
                                var path = '/usr/src/app/img/google/' + POI.id + '.jpg';
                            }
                            else {
                                var path = '/usr/src/app/img/google/' + POI.place_id + '.jpg';
                            };
                            var pathImage = "";
                            if (process.env.NODE_ENV === 'production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostProd + 'google/' + POI.id + '.jpg'; // For PROD server
                                }
                                else {
                                    pathImage = process.env.HostProd + 'google/' + POI.place_id + '.jpg'; // For PROD server
                                };
                            }
                            else if (process.env.NODE_ENV === 'pre-production') {
                                if (POI.id != undefined) {
                                    pathImage = process.env.HostPreProd + 'google/' + POI.id + '.jpg'; // For Pred PROD server
                                }
                                else {
                                    pathImage = process.env.HostPreProd + 'google/' + POI.place_id + '.jpg'; // For Pred PROD server
                                };
                            }
                            else {
                                if (POI.id != undefined) {
                                    //pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                    pathImage = process.env.HostQA + 'google/' + POI.id + '.jpg'; // For QA server
                                }
                                else {
                                    //pathImage = process.env.HostLocal  + 'goole/' + POI.id + '.jpg';
                                    pathImage = process.env.HostQA + 'google/' + POI.place_id + '.jpg'; // For QA server
                                };
                            };
                            download(url, path, () => {
                                POI.photos = pathImage;
                                resolve(true);
                            });

                        }
                        else {
                            POI.photos = '';
                            resolve(true);
                        };

                    }
                    else {
                        POI.photos = '';
                        resolve(true);
                    };

                });
            })
        ).then(() => {
            resolve(POIs);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });
    });
};

//Function to save image in file
const download = (url, path, callback) => {
    if (fs.existsSync(path)) { return callback(); }
    request.head(url, (err, res, body) => {
        if (err) {
            console.error("Error ", err);
        }
        else {
            request(url)
                .pipe(fs.createWriteStream(path))
                .on('close', callback);
        };

    });
};

function managementPOIsUpdate(query, newValues) {
    var context = "Function managementPOIsUpdate";
    return new Promise((resolve, reject) => {
        ManagementPOIs.updateManagementPOIs(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

function getGroups(tariffs) {
    var context = "Funciton getGroups";
    return new Promise((resolve, reject) => {

        if (tariffs.length != 0) {

            Promise.all(

                tariffs.map(tariff => {

                    return new Promise((resolve, reject) => {

                        if ((tariff.groupName == process.env.ChargerAccessPublic) || (tariff.groupName == process.env.ChargerAccessPrivate) || (tariff.groupName == process.env.ChargerAccessFreeCharge)) {

                            resolve(true);

                        }
                        else {

                            var host = process.env.HostUser + process.env.PathGetGroupCSUsersById;
                            var data = {
                                _id: tariff.groupId
                            };

                            axios.get(host, { data })
                                .then((value) => {

                                    var groupCSUsers = JSON.parse(JSON.stringify(value.data));
                                    tariff.imageContent = groupCSUsers.imageContent;
                                    resolve(true);

                                })
                                .catch((error) => {

                                    console.error(`[${context}][axios.get] Error `, error.message);
                                    reject(error);

                                });

                        };

                    });

                })

            ).then(() => {

                resolve(tariffs);

            }).catch((error) => {

                console.error(`[${context}] Promise.all] Error `, error.message);
                reject(error);

            });

        }
        else {

            resolve(tariffs);

        };

    });
};

function verifyNotifymeHistory(query) {
    var context = "Funciton verifyNotifymeHistory";
    let data = query
    let host = process.env.HostNotifications + process.env.PathNotifymeHistory
    return new Promise((resolve, reject) => {
        axios.get(host, { data })
            .then(result => {
                resolve(result.data)
            })
            .catch(err => {
                reject(err)
            })
    });
};

function validateFieldsCharger(charger) {
    return new Promise((resolve, reject) => {
        if (!charger)
            reject({ auth: false, code: 'server_charger_data_required', message: 'Charger data required' });

        else if (!charger.hwId)
            reject({ auth: false, code: 'server_hwid_required', message: 'Charger Hardware Id is required' });
        else
            resolve(true);

    });
};

//Function to save image in file
function saveImageContentCharger(charger) {
    var context = "Function saveImageContentCharger";
    return new Promise((resolve, reject) => {
        try {
            const saveImageContent = (image, index) => {
                return new Promise((resolve, reject) => {

                    var dateNow = Date.now();
                    var path = `/usr/src/app/img/chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                    var pathImage = '';
                    var base64Image = image.split(';base64,').pop();
                    if (process.env.NODE_ENV === 'production') {
                        pathImage = `${process.env.HostProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For PROD server
                    }
                    else if (process.env.NODE_ENV === 'pre-production') {
                        pathImage = `${process.env.HostPreProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;// For Pred PROD server
                    }
                    else {
                        //pathImage = `${process.env.HostLocal}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                        pathImage = `${process.env.HostQA}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For QA server
                    };
                    fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);;
                        }
                        else {
                            var defaultImage = parseInt(charger.defaultImage, 10);
                            if (index === defaultImage) {
                                charger.defaultImage = pathImage;
                            };
                            charger.imageContent[index] = pathImage;
                            resolve(true);
                        };
                    });
                });
            };
            Promise.all(
                charger.imageContent.map((image, index) => saveImageContent(image, index))
            ).then((result) => {
                resolve(charger);
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};


//Function to create a charger
function createCharger(charger, res) {
    var context = "Function createCharger";
    try {

        var query = {
            hwId: charger.hwId,
            hasInfrastructure: true,
            active: true//,
            //clientName: charger.clientName
        };

        Charger.findOne(query, async (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            };

            if (!result) {

                // Funtion adding partyId, operator, operatorEmail and operatorContact to charger
                charger = await addOperatorInfoToCharger(charger);

                if (charger.plugs.length == 0) {

                    Charger.createCharger(charger, (err, result) => {
                        if (err) {
                            console.error(`[${context}][createCharger] Error `, err.message);
                            return res.status(500).send(err.message);
                        };

                        if (result) {
                            if (charger.chargerType === '002') {
                                var host = process.env.HostSonOff + process.env.PathSonOff;
                                var data = {
                                    hwId: charger.hwId
                                };
                                axios.post(host, data);
                            }
                            if (charger.chargerType === '007') {

                                var host = process.env.HostEVIOBox + process.env.PathEVIOBox;
                                var data = {
                                    hwId: charger.hwId
                                };
                                axios.post(host, data);
                            }
                            addInfrastructure(result);
                            createPOIs(charger);
                            return res.status(200).send(result);
                        } else {
                            return res.status(400).send({ auth: false, code: 'server_charger_not_created', message: "Charger not created" });
                        };

                    });

                } else {

                    if (charger.chargerType === '002' || charger.chargerType === '007') {
                        Charger.createCharger(charger, (err, result) => {
                            if (err) {
                                console.error(`[${context}][createCharger] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {
                                    if (charger.chargerType === '002') {
                                        var host = process.env.HostSonOff + process.env.PathSonOff;
                                        var data = {
                                            hwId: charger.hwId
                                        };
                                        axios.post(host, data);
                                    }
                                    if (charger.chargerType === '007') {

                                        var host = process.env.HostEVIOBox + process.env.PathEVIOBox;
                                        var data = {
                                            hwId: charger.hwId
                                        };
                                        axios.post(host, data);
                                    }
                                    addInfrastructure(result);
                                    updateQrCode(charger);
                                    createPOIs(charger);
                                    return res.status(200).send(result);
                                }
                                else {
                                    return res.status(400).send({ auth: false, code: 'server_charger_not_created', message: "Charger not created" });
                                };
                            };
                        });
                    } else {
                        addQrCodeId(charger)
                            .then((charger) => {
                                Charger.createCharger(charger, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][createCharger] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        if (result) {
                                            if (charger.chargerType === '002') {
                                                var host = process.env.HostSonOff + process.env.PathSonOff;
                                                var data = {
                                                    hwId: charger.hwId
                                                };
                                                axios.post(host, data);
                                            }
                                            if (charger.chargerType === '007') {

                                                var host = process.env.HostEVIOBox + process.env.PathEVIOBox;
                                                var data = {
                                                    hwId: charger.hwId
                                                };
                                                axios.post(host, data);
                                            }
                                            addInfrastructure(result);
                                            createPOIs(charger);
                                            return res.status(200).send(result);
                                        }
                                        else {
                                            return res.status(400).send({ auth: false, code: 'server_charger_not_created', message: "Charger not created" });
                                        };
                                    };
                                });
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    };

                };

            } else {

                return res.status(400).send({ auth: false, code: 'server_charger_already_registered', message: "Charger is already registered" });

            };

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
};

async function addOperatorInfoToCharger(charger) {
    let context = "addOperatorInfoToCharger function"
    try {

        let userOperator = await fetchUserOperator(charger.createUser)

        // Add operator info to charger
        if (userOperator) {
            charger.partyId = userOperator.partyId
            charger.operatorEmail = userOperator.operatorEmail
            charger.operatorContact = userOperator.operatorContact
            charger.operator = userOperator.operator
        }
        return charger

    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return charger
    }
}

async function fetchUserOperator(userId) {
    let context = "fetchUserOperator function"

    try {
        let host = process.env.HostUser + process.env.PathGetUserByClientListUserId;
        let config = {
            headers: {
                userid: userId,
            }
        }

        const response = await axios.get(host, config)
        return response.data
    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return null
    }
};

//Function to add a charger to an infrastructure
function addInfrastructure(charger) {
    var context = "Function addInfrastructure";
    try {
        var query = {
            _id: charger.infrastructure
        };
        Infrastructure.findOne(query, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);;
            } else {
                if (infrastructureFound) {
                    var toAdd = { chargerId: charger._id };
                    infrastructureFound.listChargers.push(toAdd);
                    var newValue = { $set: infrastructureFound };
                    Infrastructure.updateInfrastructure(query, newValue, (err, result) => {
                        if (err) {
                            console.error(`[${context}][updateInfrastructure] Error `, err.message);;
                        } else {
                            if (result)
                                console.error(`[${context}][updateInfrastructure] Charger added successfully`);
                            else
                                console.error(`[${context}][updateInfrastructure] Charger added unsuccessfully`);
                        };
                    });
                } else {
                    console.error(`[${context}][findOne] infrastructure not found`);
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

async function createPOIs(charger) {
    var context = "Function createPOIs";

    let configManagementPOIs = await getConfigManagementPOIs();

    if (process.env.NODE_ENV === 'production') {
        var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyProd}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
    }
    else {
        var host = `${process.env.HostGoogle}?key=${process.env.GoogleKeyQA}&location=${charger.geometry.coordinates[1]},${charger.geometry.coordinates[0]}&radius=1000&keyword=${process.env.POISkeyword}&rankBy=${process.env.POISrankBy}`;
    };
    getPOIsGoogle(host, configManagementPOIs.numberOfPois)
        .then((POIs) => {
            var POI = new ManagementPOIs();
            //POI.chargerId = charger._id;
            POI.hwId = charger.hwId;
            POI.geometry = charger.geometry;
            POI.POIs = POIs;
            managementPOIsCreate(POI)
                .then((result) => {
                    if (result) {
                        console.log("Create");
                    }
                })
                .catch((error) => {
                    console.error(`[${context}][managementPOIsCreate]][.catch] Error `, error.message);
                });
        })
        .catch((error) => {
            console.error(`[${context}][getPOIsGoogle]][.catch] Error `, error.message);
        });
};

function getConfigManagementPOIs() {
    var context = "Function getConfigManagementPOIs";
    return new Promise((resolve, reject) => {

        var host = process.env.HostConfigs + process.env.PathConfigManagementPOIs;
        axios.get(host)
            .then((result) => {

                if (result.data.length > 0) {

                    resolve(result.data[0]);

                }
                else {

                    var configManagementPOIs = {
                        daysToUpdate: 365,
                        numberOfPois: 7
                    };

                    resolve(configManagementPOIs);

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                reject(error);

            });

    });
};

function getPOIsGoogle(host, numberOfPois) {
    var context = "Function getPOIsGoogle";
    return new Promise((resolve, reject) => {
        axios.get(host)
            .then((result) => {
                if (result.data.results.length === 0) {
                    resolve([]);
                }
                else {
                    var newPOIs = result.data.results.sort((a, b) => b.rating - a.rating);
                    // var newPOIs = result.data.results.splice(0, numberOfPois);
                    savePhotosPOIs(newPOIs, numberOfPois)

                        .then((result) => {
                            resolve(result);
                        })
                        .catch((error) => {
                            console.error(`[${context}][savePhotosPOIs][.catch] Error `, error.message);
                            reject(error);
                        })
                };
            })
            .catch((error) => {
                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                reject(error);
            });
    });
};

function managementPOIsCreate(managementPOIs) {
    var context = "Function managementPOIsCreate";
    return new Promise((resolve, reject) => {
        ManagementPOIs.createManagementPOIs(managementPOIs, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                if (result) {
                    resolve(result);
                }
            };
        });
    });
};

function updateQrCode(charger) {
    var context = "Function updateQrCode";
    charger.plugs.map(plug => {
        var query = {
            qrCodeId: plug.qrCodeId
        };
        QrCode.findOne(query, (err, qrCode) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
            }
            else {
                qrCode.qrCode.geometry = charger.geometry;
                qrCode.qrCode.chargingDistance = charger.chargingDistance;
                var newValues = { $set: qrCode };
                QrCode.updateQrCode(query, newValues, (err, result) => {
                    if (err) {
                        console.error(`[${context}][updateQrCode] Error `, err.message);;
                    }
                    else {
                        if (result) {
                            console.log(`[${context}] Result Update`);
                        }
                        else {
                            console.log(`[${context}] Result Not Update`);
                        };
                    };
                });
            };
        });
    });
};

function addQrCodeId(charger) {
    var context = "Function addQrCodeId";
    return new Promise(async (resolve, reject) => {
        try {
            Promise.all(
                charger.plugs.map(plug => {
                    return new Promise((resolve, reject) => {
                        if (plug.qrCodeId !== undefined) {
                            var query = {
                                qrCodeId: plug.qrCodeId
                            };
                            var qrCode = {
                                qrCode: {
                                    hwId: charger.hwId,
                                    plugId: plug.plugId,
                                    chargerType: charger.chargerType,
                                    chargingDistance: charger.chargingDistance,
                                    geometry: charger.geometry
                                }
                            };
                            var newValues = { $set: qrCode };
                            QrCode.updateQrCode(query, newValues, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][updateQrCode] Error `, err.message);;
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
                        }
                        else {
                            var query = {
                                $and: [
                                    {
                                        "qrCode.hwId": charger.hwId
                                    },
                                    {
                                        "qrCode.plugId": plug.plugId
                                    }
                                ]
                            };
                            qrCodeFindOnde(query)
                                .then((qrCodeFound) => {
                                    if (qrCodeFound) {
                                        qrCodeFound.qrCode.geometry = charger.geometry;
                                        qrCodeFound.qrCode.chargerType = charger.chargerType;
                                        qrCodeFound.qrCode.chargingDistance = charger.chargingDistance;

                                        var query = {
                                            _id: qrCodeFound._id
                                        };
                                        var newValues = { $set: qrCodeFound };
                                        QrCode.updateQrCode(query, newValues, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}][updateQrCode] Error `, err.message);;
                                            }
                                            else {
                                                if (result) {
                                                    plug.qrCodeId = qrCodeFound.qrCodeId;
                                                    resolve(true);
                                                }
                                                else {
                                                    resolve(false);
                                                };
                                            };
                                        });


                                    }
                                    else {
                                        var qrCode = new QrCode(
                                            {
                                                qrCode: {
                                                    hwId: charger.hwId,
                                                    plugId: plug.plugId,
                                                    chargerType: charger.chargerType,
                                                    chargingDistance: charger.chargingDistance,
                                                    geometry: charger.geometry
                                                }
                                            }
                                        );
                                        saveQrCode(qrCode)
                                            .then((result) => {
                                                plug.qrCodeId = result.qrCodeId;
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][saveQrCode] Error `, error.message);
                                                reject(error);
                                            });
                                    };

                                })
                                .catch((error) => {
                                    console.error(`[${context}][qrCodeFindOnde] Error `, error.message);
                                    reject(error);
                                })

                        };
                    });
                })
            ).then(() => {
                resolve(charger);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function qrCodeFindOnde(query) {
    var context = "Function qrCodeFindOnde";
    return new Promise((resolve, reject) => {
        QrCode.findOne(query, (err, qrCodeFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);;
                reject(err);
            }
            else {
                resolve(qrCodeFound);
            };
        });
    });
};

function saveQrCode(qrCode) {
    var context = "Function saveQrCode";
    return new Promise(async (resolve, reject) => {
        try {
            QrCode.createQrCode(qrCode, (err, result) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);;
                    reject(err);
                }
                else {
                    switch (result.qrCodeNumber.toString().length) {
                        case 1:
                            result.qrCodeId = "00000" + result.qrCodeNumber.toString();
                            break;
                        case 2:
                            result.qrCodeId = "0000" + result.qrCodeNumber.toString();
                            break;
                        case 3:
                            result.qrCodeId = "000" + result.qrCodeNumber.toString();
                            break;
                        case 4:
                            result.qrCodeId = "00" + result.qrCodeNumber.toString();
                            break;
                        case 5:
                            result.qrCodeId = "0" + result.qrCodeNumber.toString();
                            break;
                        default:
                            result.qrCodeId = result.qrCodeNumber.toString();
                            break;
                    };
                    var query = {
                        _id: result._id
                    };
                    var newValue = { $set: result };
                    QrCode.updateQrCode(query, newValue, (err, newUpdate) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);;
                            reject(err);
                        }
                        else {
                            resolve(result);
                        };
                    });
                };
            });

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

async function makeUpdateOnChargers(charger, userId) {
    let context = "Function makeUpdateOnChargers";

    return new Promise((resolve, reject) => {

        let query = {
            _id: charger.chargerId,
            hasInfrastructure: true
        };

        if (charger.geometry !== undefined) {
            if (Object.keys(charger.geometry).length == 0) {
                delete charger.geometry;
            }
            else {
                charger.geometry.type = "Point";
            };
        };

        charger.modifyUser = userId;

        updateHwIdOnQrCode(charger);
        
        if (charger.imageContent != undefined) {

            Charger.findOne(query, (err, chargerFound) => {

                if (err) {

                    console.error(`[${context}][findOne] Error `, err.message);;
                    return res.status(500).send(err.message);

                }
                else {

                    if (charger.imageContent.length == 0) {
                        deleteFile(chargerFound.imageContent)
                            .then(() => {

                                var newValues = { $set: charger };
                                updateCharger(query, newValues)
                                    .then((answers) => {
                                        if (answers) {
                                            resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                        } else
                                            //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                                            resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                        reject(error);
                                    });

                            })
                            .catch((error) => {
                                console.error(`[${context}][deleteFile][.catch] Error `, error.message);
                                reject(error);
                            });

                    } else {
                        Promise.all(
                            charger.imageContent.map((image, index) => {
                                return new Promise((resolve, reject) => {
                                    if (image.includes('base64')) {
                                        var dateNow = Date.now();
                                        var path = `/usr/src/app/img/chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                                        var pathImage = '';
                                        var base64Image = image.split(';base64,').pop();

                                        if (process.env.NODE_ENV === 'production') {
                                            pathImage = `${process.env.HostProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For PROD server
                                        }
                                        else if (process.env.NODE_ENV === 'pre-production') {
                                            pathImage = `${process.env.HostPreProd}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;// For Pred PROD server
                                        }
                                        else {
                                            //pathImage = `${process.env.HostLocal}chargers/${charger.hwId}_${dateNow}_${index}.jpg`;
                                            pathImage = `${process.env.HostQA}chargers/${charger.hwId}_${dateNow}_${index}.jpg`; // For QA server
                                        };
                                        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                            if (err) {
                                                console.error(`[${context}] Error `, err.message);;
                                                reject(err);
                                            }
                                            else {
                                                var defaultImage = parseInt(charger.defaultImage, 10);
                                                if (index === defaultImage) {
                                                    charger.defaultImage = pathImage;
                                                };
                                                charger.imageContent[index] = pathImage;
                                                resolve(true);
                                            };
                                        });
                                    } else if (image == "") {

                                        let nameImage = chargerFound.imageContent[index].split('/');
                                        let path = `/usr/src/app/img/chargers/${nameImage[nameImage.length - 1]}`;
                                        fs.unlink(path, (err) => {
                                            if (err) {
                                                console.error(`[${context}] Error `, err.message);;
                                                //reject(err)
                                                resolve(false);
                                            };
                                        });
                                        resolve(false);

                                    } else {

                                        resolve(true);

                                    };

                                });
                            })
                        ).then((response) => {

                            let validate = response.filter(element => { return element === false });

                            if (validate.length > 0) {

                                rearrangeImage(charger)
                                    .then((charger) => {

                                        if (!charger.defaultImage.includes('http://') && !charger.defaultImage.includes('https://') && charger.defaultImage !== undefined && charger.defaultImage !== "") {
                                            charger.defaultImage = charger.imageContent[charger.defaultImage];
                                        };
                                        var newValues = { $set: charger };
                                        updateCharger(query, newValues)
                                            .then((answers) => {
                                                if (answers) {
                                                    resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                                } else
                                                    //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                                                    resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                                reject(error.message);
                                            });

                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][rearrangeImage][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                            }
                            else {

                                if (!charger.defaultImage.includes('http://') && !charger.defaultImage.includes('https://') && charger.defaultImage !== undefined && charger.defaultImage !== "") {
                                    charger.defaultImage = charger.imageContent[charger.defaultImage];
                                };
                                var newValues = { $set: charger };
                                updateCharger(query, newValues)
                                    .then((answers) => {
                                        if (answers) {
                                            resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                                        } else
                                            //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                                            resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                                        reject(error.message);
                                    });

                            };

                        }).catch((error) => {
                            console.error(`[${context}][charger.imageContent.map][.catch] Error `, error.message);
                            reject(error.message);
                        });

                    };

                };

            });

        } else {

            var newValues = { $set: charger };
            updateCharger(query, newValues)
                .then((answers) => {
                    if (answers) {
                        resolve({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                    } else
                        //return res.status(400).send({ auth: false, code: 'server_update_error', message: "Update error: " + answers });
                        resolve({ auth: false, code: "server_update_unsuccessfully", message: "Update unsuccessfully" });
                })
                .catch((error) => {
                    console.error(`[${context}][updateCharger][.catch] Error `, error.message);
                    reject(error);
                });

        };

    });

};

function updateHwIdOnQrCode(charger) {
    let context = "Function updateHwIdOnQrCode";

    if (charger.hwId) {

        let query = {
            _id: charger.chargerId,
        };

        let fields = {
            plugs: 1
        };

        Charger.findOne(query, fields, (err, result) => {
            if (err) {

                console.error(`[${context}][findOne] Error `, err.message);

            }
            else {

                if (result) {
                    result.plugs.map(plug => {

                        query = {
                            qrCodeId: plug.qrCodeId
                        };

                        let newFields = {
                            $set: {
                                "qrCode.hwId": charger.hwId
                            }
                        };

                        QrCode.findOneAndUpdate(query, newFields, { new: true }, (err, response) => {
                            if (err) {

                                console.error(`[${context}][findOne] Error `, err.message);

                            }
                            else {

                                console.log("Qr code updated");
                            }
                        });

                    })
                };
            };
        });
    }

};

function deleteFile(imageContent) {
    var context = "Function deleteFile";
    return new Promise((resolve, reject) => {
        try {
            var num = 0;
            while (num != imageContent.length) {
                var name = imageContent[num].split('/');
                var path = `/usr/src/app/img/chargers/${name[name.length - 1]}`;
                fs.unlink(path, (err) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                        resolve(true);
                        //reject(err)
                    };
                });
                num += 1;
            };
            resolve(true);
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function updateCharger(query, values) {
    var context = "Function updateCharger";
    return new Promise((resolve, reject) => {
        try {
            Charger.updateCharger(query, values, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateCharger] Error `, err.message);;
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
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function rearrangeImage(charger) {
    var context = "Funciton rearrangeImage";
    return new Promise((resolve, reject) => {
        var newImage = charger.imageContent.filter(image => {
            return image != "";
        });
        Promise.all(
            newImage.map((image, index) => {
                return new Promise((resolve, reject) => {
                    var name = "_" + index + ".jpg";
                    if (image.includes(name)) {
                        resolve(true);
                    }
                    else {
                        var nameOfImage = image.split("/");
                        var dateNow = Date.now();
                        var path = `/usr/src/app/img/chargers/${nameOfImage[nameOfImage.length - 1]}`;
                        var auxName = nameOfImage[nameOfImage.length - 1].split("_");
                        var newName = `${auxName[0]}_${dateNow}_${index}.jpg`;
                        var newPath = `/usr/src/app/img/chargers/${newName}`;
                        fs.rename(path, newPath, (err, result) => {
                            if (err) {
                                console.error(`[${context}] Error `, err.message);;
                                reject(err);
                            }
                            else {
                                if (process.env.NODE_ENV === 'production') {
                                    pathImage = `${process.env.HostProd}chargers/${newName}`; // For PROD server
                                }
                                else if (process.env.NODE_ENV === 'pre-production') {
                                    pathImage = `${process.env.HostPreProd}chargers/${newName}`; // For Pred PROD server
                                }
                                else {
                                    //pathImage = `${process.env.HostLocal}chargers/${newName}`;
                                    pathImage = `${process.env.HostQA}chargers/${newName}`; // For QA server
                                };
                                if (charger.defaultImage === image) {
                                    charger.defaultImage = pathImage;
                                    newImage[index] = pathImage;
                                    resolve(true);
                                }
                                else {
                                    newImage[index] = pathImage;
                                    resolve(true);
                                };
                            };
                        });
                    };
                });
            })
        ).then(() => {
            charger.imageContent = newImage;
            resolve(charger);
        }).catch((error) => {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        });
    });
};

function removeFromInfra(infra) {
    var context = "Funciton removeFromInfra";
    var query = {
        _id: infra._id
    };
    findOneInfrastructure(query)
        .then((infrastructureFound) => {
            if (infrastructureFound) {
                infrastructureFound.listChargers = infrastructureFound.listChargers.filter(charger => {
                    return charger.chargerId != infra.chargerId;
                });
                var newValues = { $set: infrastructureFound };
                updateInfrastructure(newValues, query)
                    .then((result) => {
                        if (result) {
                            console.log(`[${context}] Update successfully`);
                        }
                        else {
                            console.log(`[${context}] Update unsuccessfully`);
                        };
                    })
                    .catch((error) => {
                        console.error(`[${context}][findOneInfrastructure] Error `, error.message);
                    });
            }
            else {
                console.log(`[${context}] No infrastructure found`);
            };
        })
        .catch((error) => {
            console.error(`[${context}][findOneInfrastructure] Error `, error.message);
        });
};

function changeNetworkStatus(charger) {
    if (charger.networks) {
        if (charger.networks.length) {
            charger.networks = charger.networks.map(network => { return {...network , status : process.env.ChargerNetworkStatusInactive , active : false}})
        }
    }
}

async function changeAvailability(hwId , plugId , active) {
    const context = "Function changeAvailability";
    try {
        let body = {
            hwId,
            plugId,
            availability : active ? "Operative" : "Inoperative"
        }
        let host = process.env.HostOCPP16 + process.env.PathChangeAvailability
        let resp = await axios.post(host, body)
        if (resp.data) {
            console.log(`[${context}] changeAvailability success!`)
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function updateTariffId(charger , plugs , tariffId , network) {
    const context = "Function updateTariffId";
    try {
        for (let plug of plugs) {
            let plugId = plug.plugId
            let plugIndex = charger.plugs.findIndex(plug => plug.plugId === plugId)
            if (plugIndex > -1) {
                let tariffIdIndex = charger.plugs[plugIndex].tariffIds.findIndex(tariff => tariff.network === network)
                let updateTariffId = (plug.tariffId || plug.tariffId === "" )  ? plug.tariffId : tariffId
                if (tariffIdIndex > -1) {
                    charger.plugs[plugIndex].tariffIds[tariffIdIndex].tariffId = updateTariffId
                } else {
                    charger.plugs[plugIndex].tariffIds.push(
                        {
                            network,
                            tariffId : updateTariffId,
                        }
                    )
                }
            }

        }

        return await Charger.findOneAndUpdate({_id : charger._id} , {$set : charger} , {new : true}).lean()

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null 
    }
}

module.exports = router;
