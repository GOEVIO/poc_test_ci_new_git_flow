require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const EV = require('../models/ev');
const Fleets = require('../models/fleets');
const axios = require('axios');
const fs = require('fs');
const { resolve } = require('path');
const EVsHandler = require('../controllers/evsHandler');
const ErrorHandler = require('../controllers/errorHandler');
const ObjectId = require("mongoose").Types.ObjectId;
const Utils = require('../utils/evChargingUtils');
// Disable node-cron by mocking for an easy turn-back 
// const cron = require('node-cron'); 
const cron = {
    schedule: ()=>({
     start: ()=>{},
     stop: ()=>{},   
     validate: ()=>{},
     status: '',
    })
};
const axiosS = require("../services/axios");
const { validateUserPerClientName } = require('../auth/auth');
const { findGroupCSUser, listAllEvsIdByContracts } = require('evio-library-identity').default;
const evDatabaseHost = 'http://ev-database:3025';
const publicEVDatabaseProxy = `${evDatabaseHost}/api/private/evsdb/getEVInfo`;

const AddKmHandler = require('../handlers/addKmToEV')

// Services
const { deleteCachedContractsByUserId } = require('../services/contracts');

let createMissingContractstask = null

//========== JOBS ==========
if (process.env.NODE_ENV === 'production') {
    startCreateMissingContractsJob();
};

//========== POST ==========
//Create a new EV
router.post('/api/private/evs', (req, res, next) => {
    var context = "POST /api/private/evs";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        var clientName = req.headers['clientname'];
        var fleet = req.body.fleet;
        var req_body = req.body;
        var ev = new EV(req_body);
        ev.userId = userId;
        ev.clientName = clientName;

        if (!validateUserPerClientName(req.headers)) {
            console.log(`[${context}] Action not allowed for ${clientName}`);
            return res
                .status(400)
                .send({
                    auth: false,
                    code: "action_not_allowed",
                    message: "Action not allowed",
                });
        }

        if (req.body.imageContent === undefined)
            ev.imageContent = "";
        if (!fleet)
            return res.status(400).send({ auth: false, code: 'server_fleet_id_required', message: "Fleet Id required" });

        if (req.body.evType === undefined) {
            ev.evType = "car";
        }

        validateFields(ev)
            .then(() => {
                if ((ev.licensePlate !== undefined) && (ev.licensePlate !== "")) {
                    var query = {
                        licensePlate: ev.licensePlate,
                        hasFleet: true,
                        clientName: clientName
                    };
                    findOneEv(query)
                        .then((evFound) => {
                            query = {
                                _id: fleet
                            };
                            if (evFound) {
                                return res.status(400).send({ auth: false, code: 'server_license_plate_exists', message: 'License plate already exists' });
                            }
                            else {
                                if ((req.body.imageContent !== undefined) && (req.body.imageContent !== "") && (ev.imageContent.includes('base64'))) {
                                    Fleets.findOne(query, (err, fleetFound) => {
                                        if (err) {
                                            console.error(`[${context}][findOne] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        } else {
                                            if (fleetFound) {
                                                var newEv = {
                                                    evId: ev._id
                                                };
                                                fleetFound.listEvs.push(newEv);
                                                // add km variables
                                                ev.acceptKMs = fleetFound.acceptKMs
                                                ev.updateKMs = fleetFound.updateKMs

                                                newValues = { $set: fleetFound };
                                                Fleets.updateFleets(query, newValues, (err, result) => {
                                                    if (err) {
                                                        console.error(`[${context}][updateFleets] Error `, err.message);
                                                        return res.status(500).send(err.message);
                                                    } else {
                                                        saveImageContent(ev)
                                                            .then((value) => {
                                                                createEvs(value, req_body, res);
                                                            })
                                                            .catch((error) => {
                                                                console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });
                                                    };
                                                });
                                            } else {
                                                return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });
                                            }
                                        }
                                    });
                                }
                                else {
                                    Fleets.findOne(query, (err, fleetFound) => {
                                        if (err) {
                                            console.error(`[${context}][findOne] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        } else {
                                            if (fleetFound) {
                                                var newEv = {
                                                    evId: ev._id
                                                };
                                                fleetFound.listEvs.push(newEv);
                                                newValues = { $set: fleetFound };

                                                // add km variables
                                                ev.acceptKMs = fleetFound.acceptKMs
                                                ev.updateKMs = fleetFound.updateKMs

                                                Fleets.updateFleets(query, newValues, (err, result) => {
                                                    if (err) {
                                                        console.error(`[${context}][updateFleets] Error `, err.message);
                                                        return res.status(500).send(err.message);
                                                    } else
                                                        createEvs(ev, req_body, res);
                                                });
                                            } else {
                                                return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });
                                            }
                                        };
                                    });
                                };
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][findOneEv] Error `, error.message);
                            return res.status(400).send(error);
                        })
                }
                else {
                    var query = {
                        _id: fleet
                    };
                    if ((req.body.imageContent !== undefined) && (req.body.imageContent !== "") && (ev.imageContent.includes('base64'))) {
                        Fleets.findOne(query, (err, fleetFound) => {
                            if (err) {
                                console.error(`[${context}][findOne] Error `, err.message);
                                return res.status(500).send(err.message);
                            } else {
                                if (fleetFound) {
                                    var newEv = {
                                        evId: ev._id
                                    };
                                    fleetFound.listEvs.push(newEv);

                                    // add km variables
                                    ev.acceptKMs = fleetFound.acceptKMs
                                    ev.updateKMs = fleetFound.updateKMs

                                    newValues = { $set: fleetFound };
                                    Fleets.updateFleets(query, newValues, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}][updateFleets] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        } else {
                                            saveImageContent(ev)
                                                .then((value) => {
                                                    createEvs(value, req_body, res);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        };
                                    });
                                } else {
                                    return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });
                                }
                            }
                        });
                    } else {
                        Fleets.findOne(query, (err, fleetFound) => {
                            if (err) {
                                console.error(`[${context}][findOne] Error `, err.message);
                                return res.status(500).send(err.message);
                            } else {
                                if (fleetFound) {
                                    var newEv = {
                                        evId: ev._id
                                    };
                                    fleetFound.listEvs.push(newEv);

                                    // add km variables
                                    ev.acceptKMs = fleetFound.acceptKMs
                                    ev.updateKMs = fleetFound.updateKMs

                                    newValues = { $set: fleetFound };
                                    Fleets.updateFleets(query, newValues, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}][updateFleets] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        } else
                                            createEvs(ev, req_body, res);
                                    });
                                } else {
                                    return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });
                                }
                            };
                        });
                    };
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

router.post('/api/private/evs/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/evs/runFirstTime";
    try {
        //create function to add old EVS the camps
        addInvoices()
        //addClientName();
        //updateBllingBy();
        //updateImageHistory()
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

// will add another KMs Object to the EV
router.post('/api/private/evs/kms', (req, res, next) => {
    var context = "POST /api/private/evs/kms";
    try {
        const evID = req.body.evID
        const kms = req.body.kms
        const sessionID = req.body.sessionID
        const sessionDate = req.body.sessionDate
        const isFleetManager = req.body.FleetManager
        const chargerType = req.body.chargerType

        if (!sessionDate || !evID || typeof evID !== "string" || !kms || typeof kms !== "number" || !sessionID || typeof sessionID !== "string" || !chargerType || !process.env.LISTOFCHARGERTYPES.includes(chargerType)) {
            console.error(`[${context}] Error - missing or wrong input variables`)
            return res.status(400).send({ message: { auth: false, code: "bad_input", message: "missing or wrong input variables" } })
        }

        // get session
        Utils.getChargingSessionByID(sessionID, chargerType).then(function (responseSession) {
            if (responseSession.status !== 200) {
                console.error(`[${context}] Error - Getting Charging Session `)
                return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Charging Session", type: "topmessage" });
            }
            let chargingSession = responseSession.data
            if (!chargingSession) {
                console.error(`[${context}] Error - No charging session `)
                return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No charging session", type: "topmessage" });
            }
            AddKmHandler.addKmToEV(evID, kms, sessionID, sessionDate, isFleetManager, chargerType, chargingSession._id).then(function (addedKm) {
                return res.status(addedKm.status).send(addedKm.data)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send({ message: { auth: false, code: "error", message: error.message } });
            })
        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({ message: { auth: false, code: "error", message: error.message } });
        })



    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ message: { auth: false, code: "error", message: error.message } });
    };
});

router.post('/api/private/evs/createMissingContracts', (req, res, next) => {
    var context = "POST /api/private/evs/createMissingContracts";
    try {
        createMissingContracts()
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//========== PATCH ==========
//Update EVs
router.patch('/api/private/evs', (req, res, next) => {
    var context = "PATCH /api/private/evs";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        var ev = req.body;
        var fleet = req.body.fleet;
        var query = { _id: ev._id };
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User id required" });
        if (!ev._id)
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });
        if (!fleet)
            return res.status(400).send({ auth: false, code: 'server_fleet_id_required', message: "Fleet Id required" });

        if ((ev.licensePlate !== undefined) && (ev.licensePlate !== "")) {
            var licence_query = {
                licensePlate: ev.licensePlate,
                hasFleet: true,
                _id: {
                    "$ne": ev._id
                }
            };
            findOneEv(licence_query)
                .then((evFound) => {
                    if (evFound) {
                        return res.status(400).send({ auth: false, code: 'server_license_plate_exists', message: 'License plate already exists' });
                    }
                    else {

                        if (ev.imageContent != undefined) {
                            EV.findOne(query, (err, evFound) => {
                                if (err) {
                                    console.error(`[${context}][findOne] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    if (ev.imageContent == "") {
                                        var path = '/usr/src/app/img/evs/' + evFound._id + '.jpg';
                                        fs.unlink(path, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}] [fs.unlink]Error `, err.message);
                                                //return res.status(500).send(err.message);
                                            }
                                            //else {

                                            if (ev.evInfo.databaseVehicleId == undefined || ev.evInfo.databaseVehicleId == 0.0) {

                                                let params = {
                                                    brand: ev.brand,
                                                    model: ev.model,
                                                    version: ev.version,
                                                    dateFrom: ev.dateFrom,
                                                    dateTo: ev.dateTo,
                                                    plugPower: ev.evInfo.internalChargerPower,
                                                    vehicleId: ev.vehicleId
                                                }

                                                axios.get(publicEVDatabaseProxy, { params: params })
                                                    .then((evInfoFound) => {

                                                        ev.evInfo = evInfoFound.data;

                                                        if (ev.imageContent.includes('ev-database') && ev.imageContent !== evInfoFound.data.evImage) {
                                                            ev.imageContent = evInfoFound.data.evImage;
                                                        }

                                                        var newValues = { $set: ev };
                                                        updateLicensePlateOnContract(ev);
                                                        updateEV(query, newValues, res);

                                                    })
                                                    .catch((error) => {
                                                        if (error.response) {

                                                            console.error(`[${context}] [Status 400] Error `, error.response.data);
                                                            return res.status(400).send(error.response.data);

                                                        }
                                                        else {

                                                            console.error(`[${context}] [Status 500] Error `, error.message);
                                                            return res.status(500).send(error.message);
                                                        }
                                                        //console.error(`[${context}][.then][find] Error `, error.message);
                                                        //return res.status(400).send({ auth: false, code: 'ev_update_failed', message: "Failed to update EV" });
                                                    });

                                            }
                                            else {
                                                var newValues = { $set: ev };
                                                updateLicensePlateOnContract(ev);
                                                updateEV(query, newValues, res);
                                            }

                                            //};
                                        });
                                    } else if (ev.imageContent.includes('base64')) {
                                        var path = '/usr/src/app/img/evs/' + evFound._id + '.jpg';
                                        var pathImage = '';
                                        var base64Image = ev.imageContent.split(';base64,').pop();
                                        if (process.env.NODE_ENV === 'production') {
                                            pathImage = process.env.HostProd + 'evs/' + evFound._id + '.jpg'; // For PROD server
                                        }
                                        else if (process.env.NODE_ENV === 'pre-production') {
                                            pathImage = process.env.HostPreProd + 'evs/' + evFound._id + '.jpg'; // For PER PROD server
                                        }
                                        else {
                                            //pathImage = process.env.HostLocal + 'evs/'  + evFound._id + '.jpg';
                                            pathImage = process.env.HostQA + 'evs/' + evFound._id + '.jpg'; // For QA server
                                        };
                                        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                            if (err) {
                                                console.error(`[${context}] [fs.writeFile]Error `, err.message);
                                                return res.status(500).send(err.message);
                                            }
                                            else {
                                                ev.imageContent = pathImage;

                                                if (ev.evInfo.databaseVehicleId == undefined || ev.evInfo.databaseVehicleId == 0.0) {

                                                    let params = {
                                                        brand: ev.brand,
                                                        model: ev.model,
                                                        version: ev.version,
                                                        dateFrom: ev.dateFrom,
                                                        dateTo: ev.dateTo,
                                                        plugPower: ev.evInfo.internalChargerPower,
                                                        vehicleId: ev.vehicleId
                                                    }

                                                    axios.get(publicEVDatabaseProxy, { params: params })
                                                        .then((evInfoFound) => {

                                                            ev.evInfo = evInfoFound.data;

                                                            if (ev.imageContent.includes('ev-database') && ev.imageContent !== evInfoFound.data.evImage) {
                                                                ev.imageContent = evInfoFound.data.evImage;
                                                            }

                                                            var newValues = { $set: ev };
                                                            updateLicensePlateOnContract(ev);
                                                            updateEV(query, newValues, res);

                                                        })
                                                        .catch((error) => {
                                                            if (error.response) {

                                                                console.error(`[${context}] [Status 400] Error `, error.response.data);
                                                                return res.status(400).send(error.response.data);

                                                            }
                                                            else {

                                                                console.error(`[${context}] [Status 500] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            }
                                                            //console.error(`[${context}][.then][find] Error `, error.message);
                                                            //return res.status(400).send({ auth: false, code: 'ev_update_failed', message: "Failed to update EV" });
                                                        });

                                                }
                                                else {
                                                    var newValues = { $set: ev };
                                                    updateLicensePlateOnContract(ev);
                                                    updateEV(query, newValues, res);
                                                }

                                            };
                                        });
                                    } else {

                                        if (ev.evInfo.databaseVehicleId == undefined || ev.evInfo.databaseVehicleId == 0.0) {

                                            let params = {
                                                brand: ev.brand,
                                                model: ev.model,
                                                version: ev.version,
                                                dateFrom: ev.dateFrom,
                                                dateTo: ev.dateTo,
                                                plugPower: ev.evInfo.internalChargerPower,
                                                vehicleId: ev.vehicleId
                                            }

                                            axios.get(publicEVDatabaseProxy, { params: params })
                                                .then((evInfoFound) => {

                                                    ev.evInfo = evInfoFound.data;

                                                    if (ev.imageContent.includes('ev-database') && ev.imageContent !== evInfoFound.data.evImage) {
                                                        ev.imageContent = evInfoFound.data.evImage;
                                                    }

                                                    var newValues = { $set: ev };
                                                    updateLicensePlateOnContract(ev);
                                                    updateEV(query, newValues, res);

                                                })
                                                .catch((error) => {
                                                    if (error.response) {

                                                        console.error(`[${context}] [Status 400] Error `, error.response.data);
                                                        return res.status(400).send(error.response.data);

                                                    }
                                                    else {

                                                        console.error(`[${context}] [Status 500] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    }
                                                    //console.error(`[${context}][.then][find] Error `, error.message);
                                                    //return res.status(400).send({ auth: false, code: 'ev_update_failed', message: "Failed to update EV" });
                                                });

                                        }
                                        else {
                                            var newValues = { $set: ev };
                                            updateLicensePlateOnContract(ev);
                                            updateEV(query, newValues, res);
                                        }

                                    };
                                };
                            });
                        }
                        else {

                            if (ev.evInfo.databaseVehicleId == undefined || ev.evInfo.databaseVehicleId == 0.0) {

                                let params = {
                                    brand: ev.brand,
                                    model: ev.model,
                                    version: ev.version,
                                    dateFrom: ev.dateFrom,
                                    dateTo: ev.dateTo,
                                    plugPower: ev.evInfo.internalChargerPower
                                }

                                axios.get(publicEVDatabaseProxy, { params: params })
                                    .then((evInfoFound) => {

                                        ev.evInfo = evInfoFound.data;

                                        if (ev.imageContent.includes('ev-database') && ev.imageContent !== evInfoFound.data.evImage) {
                                            ev.imageContent = evInfoFound.data.evImage;
                                        }

                                        var newValues = { $set: ev };
                                        updateLicensePlateOnContract(ev);
                                        updateEV(query, newValues, res);

                                    })
                                    .catch((error) => {
                                        if (error.response) {

                                            console.error(`[${context}] [Status 400] Error `, error.response.data);
                                            return res.status(400).send(error.response.data);

                                        }
                                        else {

                                            console.error(`[${context}] [Status 500] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        }
                                        //console.error(`[${context}][.then][find] Error `, error.message);
                                        //return res.status(400).send({ auth: false, code: 'ev_update_failed', message: "Failed to update EV" });
                                    });

                            }
                            else {

                                var newValues = { $set: ev };
                                updateLicensePlateOnContract(ev);
                                updateEV(query, newValues, res);

                            }

                        };

                    };
                })
                .catch((error) => {
                    console.error(`[${context}][findOneEv] Error `, error.message);
                    return res.status(400).send(error);
                })
        }
        else {
            return res.status(400).send({ auth: false, code: 'license_not_valid', message: 'License plate not valid' });
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update images of evs
router.patch('/api/private/evs/images', (req, res, next) => {
    var context = "PATCH /api/private/evs/images";
    try {
        var ev = req.body;
        var path = '/usr/src/app/img/evs/' + ev._id + '.jpg';
        var base64Image = ev.imageContent.split(';base64,').pop();
        fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
            if (err) {
                console.error(`[${context}][fs.writeFile] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send({ auth: true, code: 'server_images_updated', message: "Images updated successfully" })
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint assigning drivers to an EV
router.patch('/api/private/evs/assigningDrivers', (req, res, next) => {
    var context = "PATCH /api/private/evs/assigningDrivers";
    try {

        var userId = req.headers['userid'];
        var ev = req.body;
        if (ev.listOfGroupDrivers.length == 0 && ev.listOfDrivers.length == 0)
            return res.status(400).send({ auth: false, code: 'server_nothing_to_add', message: "Without drivers and group drivers to add" });
        else {

            var query = {
                _id: ev.evId
            };

            EV.findOne(query, async (err, evFound) => {

                if (err) {

                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);

                };

                if (evFound) {

                    if (ev.invoiceType)
                        evFound.invoiceType = ev.invoiceType
                    if (ev.invoiceCommunication)
                        evFound.invoiceCommunication = ev.invoiceCommunication

                    if (evFound.plafondId && evFound.plafondId != "-1") {

                        let foundListOfGroupDrivers = ev.listOfGroupDrivers.filter(group => {
                            return group.paymenteBy !== "myself"
                        });

                        let foundListOfDrivers = ev.listOfDrivers.filter(driver => {
                            return driver.paymenteBy !== "myself"
                        });

                        if (foundListOfGroupDrivers.length > 0 || foundListOfDrivers.length > 0) {

                            return res.status(400).send({ auth: false, code: 'server_cant_add', message: "It is not possible to add drivers with the responsibility of paying the driver, as there is a plafound defined in the EV" });

                        } else {

                            if (ev.listOfGroupDrivers.length != 0 && ev.listOfDrivers.length == 0) {
                                addListOfGroupDrivers(ev, evFound)
                                    .then((evFound) => {
                                        var newValues = { $set: evFound };
                                        updateEV(query, newValues, res);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][addListOfGroupDrivers][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            } else if (ev.listOfGroupDrivers.length == 0 && ev.listOfDrivers.length != 0) {
                                addListOfDrivers(ev, evFound)
                                    .then((evFound) => {
                                        var newValues = { $set: evFound };
                                        updateEV(query, newValues, res);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][addListOfDrivers][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            } else if (ev.listOfGroupDrivers.length != 0 && ev.listOfDrivers.length != 0) {
                                addListOfGroupDrivers(ev, evFound)
                                    .then((evFound) => {
                                        addListOfDrivers(ev, evFound)
                                            .then((evFound) => {
                                                var newValues = { $set: evFound };
                                                updateEV(query, newValues, res);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][addListOfDrivers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][addListOfGroupDrivers][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            } else {
                                var newValues = { $set: evFound };
                                updateEV(query, newValues, res);
                            };

                        };

                    } else {

                        if (ev.listOfGroupDrivers.length != 0 && ev.listOfDrivers.length == 0) {
                            addListOfGroupDrivers(ev, evFound)
                                .then((evFound) => {
                                    var newValues = { $set: evFound };
                                    updateEV(query, newValues, res);
                                })
                                .catch((error) => {
                                    console.error(`[${context}][addListOfGroupDrivers][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        } else if (ev.listOfGroupDrivers.length == 0 && ev.listOfDrivers.length != 0) {
                            addListOfDrivers(ev, evFound)
                                .then((evFound) => {
                                    var newValues = { $set: evFound };
                                    updateEV(query, newValues, res);
                                })
                                .catch((error) => {
                                    console.error(`[${context}][addListOfDrivers][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        } else if (ev.listOfGroupDrivers.length != 0 && ev.listOfDrivers.length != 0) {
                            addListOfGroupDrivers(ev, evFound)
                                .then((evFound) => {
                                    addListOfDrivers(ev, evFound)
                                        .then((evFound) => {
                                            var newValues = { $set: evFound };
                                            updateEV(query, newValues, res);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][addListOfDrivers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                })
                                .catch((error) => {
                                    console.error(`[${context}][addListOfGroupDrivers][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        } else {
                            var newValues = { $set: evFound };
                            updateEV(query, newValues, res);
                        };

                    };

                } else {

                    return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });

                };

            });

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to remove drivers from EV
router.patch('/api/private/evs/removeDrivers', (req, res, next) => {
    const context = "PATCH /api/private/evs/removeDrivers";
    try {
        const ev = req.body;
        if (ev.listOfGroupDrivers.length == 0 && ev.listOfDrivers.length == 0)
            return res.status(400).send({ auth: false, code: 'server_nothing_to_add', message: "Without drivers and group drivers to add" });
       

        const query = {
            _id: ev.evId
        };

        EV.findOne(query, (err, evFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }

            if (!evFound) {
                console.error(`[${context}][findOne] Error: Evs not found for given parameters`);
                return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });
            }
                        
            if (ev.listOfGroupDrivers.length != 0 && ev.listOfDrivers.length == 0) {
                removeGroupsDrivers(ev, evFound)
                    .then((evFound) => {
                        var newValues = { $set: evFound };
                        updateEV(query, newValues, res);
                    })
                    .catch((error) => {
                        console.error(`[${context}][removeGroupsDrivers][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            }
            else if (ev.listOfGroupDrivers.length == 0 && ev.listOfDrivers.length != 0) {
                removeDrivers(ev, evFound)
                    .then((evFound) => {
                        var newValues = { $set: evFound };
                        updateEV(query, newValues, res);
                    })
                    .catch((error) => {
                        console.error(`[${context}][removeDrivers][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            }
            else if (ev.listOfGroupDrivers.length != 0 && ev.listOfDrivers.length != 0) {
                removeGroupsDrivers(ev, evFound)
                    .then((evFound) => {
                        removeDrivers(ev, evFound)
                            .then((evFound) => {
                                var newValues = { $set: evFound };
                                updateEV(query, newValues, res);
                            })
                            .catch((error) => {
                                console.error(`[${context}][removeDrivers][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    })
                    .catch((error) => {
                        console.error(`[${context}][removeGroupsDrivers][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            }
            else {
                var newValues = { $set: evFound };
                updateEV(query, newValues, res);
            };
        });
        
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to stop being an ev driver
router.patch('/api/private/evs/leaveBeDriver', (req, res, next) => {
    var context = "PATCH /api/private/evs/leaveBeDriver";
    try {
        var userId = req.headers['userid'];
        var query = req.body;
        findOneEv(query)
            .then((evFound) => {
                if (evFound) {
                    evFound.listOfDrivers = evFound.listOfDrivers.filter(driver => {
                        return driver.userId != userId;
                    });
                    var newValue = { $set: evFound };
                    updateEv(query, newValue)
                        .then((result) => {
                            if (result) {
                                return res.status(200).send({ auth: true, code: 'server_driver_removed_successfully', message: "Driver removed successfully" });
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_driver_removed_unsuccessfully', message: "Driver removed unsuccessfully" });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][updateEv] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findOneEv] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to update status and number of total sessions (internal endpoint)
router.patch('/api/private/evs/updateStatus', (req, res, next) => {
    var context = "PATCH /api/private/evs/updateStatus";
    try {
        var received = req.body;
        var query = {
            _id: received.evId
        };
        findOneEv(query)
            .then((evFound) => {
                if (evFound) {
                    if (received.status === '20') {
                        evFound.status = process.env.EVsStatusInUse;
                        var newValue = { $set: evFound };
                        updateEV(query, newValue, res);
                    }
                    else if (received.chargingSessionStatus !== undefined && received.chargingSessionStatus === '60') {
                        evFound.status = process.env.EVsStatusAvailable;
                        var newValue = { $set: evFound };
                        updateEV(query, newValue, res);
                    }
                    else {
                        evFound.status = process.env.EVsStatusAvailable;
                        var found = evFound.sessions.indexOf(evFound.sessions.find(session => {
                            return session.userId === received.userId;
                        }));
                        if (found >= 0) {
                            evFound.sessions[found].numberOfSessions += 1;
                            var newValue = { $set: evFound };
                            updateEV(query, newValue, res);
                        }
                        else {
                            var newSession = {
                                userId: received.userId,
                                numberOfSessions: 1
                            };
                            evFound.sessions.push(newSession);
                            var newValue = { $set: evFound };
                            updateEV(query, newValue, res);
                        };
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findOneEv] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to remove a groupDriver from the EVS
router.patch('/api/private/evs/removeGroupDriver', (req, res, next) => {
    var context = "PATCH /api/private/evs/removeGroupDriver";
    try {
        var received = req.body;
        var query = {
            'listOfGroupDrivers': {
                $elemMatch: {
                    groupId: received.groupDriver
                }
            }
        };

        findEv(query)
            .then((evsFound) => {
                //console.log("EvsFound", evsFound);
                if (evsFound.length == 0) {
                    return res.status(200).send(true);
                }
                else {
                    Promise.all(
                        evsFound.map(ev => {
                            return new Promise((resolve, reject) => {
                                ev.listOfGroupDrivers = ev.listOfGroupDrivers.filter(group => {
                                    return group.groupId != received.groupDriver;
                                });
                                var query = {
                                    _id: ev._id
                                };
                                var newValue = { $set: ev };
                                updateEv(query, newValue)
                                    .then((result) => {
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        resolve(false)
                                    });
                            });
                        })
                    ).then((result) => {
                        return res.status(200).send(true);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findEv] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to remove a user be driver (multi Evs)
router.patch('/api/private/evs/removeDriverEv', (req, res, next) => {
    var context = "PATCH /api/private/evs/removeDriverEv";
    try {
        if (req.headers['userid'] !== undefined) {
            var userId = req.headers['userid'];
        }
        else {
            var userId = req.body.userId;
        };

        var query = {
            listOfDrivers: {
                $elemMatch: {
                    userId: userId
                }
            }
        };
        findEv(query)
            .then((evsFound) => {
                if (evsFound.length === 0) {
                    return res.status(200).send([]);
                }
                else {
                    Promise.all(
                        evsFound.map(ev => {
                            return new Promise((resolve, reject) => {
                                var query = {
                                    _id: ev._id
                                };
                                ev.listOfDrivers = ev.listOfDrivers.filter(driver => {
                                    return driver.userId != userId;
                                });
                                var newValues = { $set: ev };
                                EV.updateEV(query, newValues, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][updateEV] Error `, err.message);
                                        reject(err);
                                    } else {
                                        if (result)
                                            resolve(true);
                                        else
                                            resolve(false);
                                    };
                                });
                            });
                        })
                    ).then((result) => {
                        return res.status(200).send(result);
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.patch('/api/private/evs/removeDriversAllEVs', (req, res, next) => {
    const context = "PATCH /api/private/evs/removeDriversAllEVs";
    try {

        let received = req.body;

        let query = {
            userId: received.userId,
            listOfDrivers: { $exists: true, $not: { $size: 0 } }
        };

        //console.log("query", query);

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (evsFound.length === 0) {
                    return res.status(200).send(true);
                }
                else {

                    console.log("evsFound", evsFound.length);
                    Promise.all(
                        evsFound.map(ev => {
                            return new Promise((resolve, reject) => {

                                let listOfDrivers;

                                if (received.driverId === "" || received.driverId === undefined) {

                                    listOfDrivers = ev.listOfDrivers.filter(driver => {
                                        return (driver.internationalPrefix + driver.mobile != received.internationalPrefix + received.mobile);
                                    });
                                }
                                else {

                                    listOfDrivers = ev.listOfDrivers.filter(driver => {
                                        return driver.userId != received.driverId;
                                    });
                                };
                                //console.log("listOfDrivers", listOfDrivers);

                                if (listOfDrivers.length === ev.listOfDrivers.length) {
                                    resolve(true);
                                }
                                else {
                                    let query = { _id: ev._id };
                                    let newValues = { $set: { listOfDrivers: listOfDrivers } };
                                    updateEv(query, newValues)
                                        .then(() => {
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}] Error `, error.message);
                                            reject(error);
                                        })
                                };

                            });

                        })
                    ).then(() => {
                        return res.status(200).send(true);
                    }).catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });

                };

            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to update list of drivers when user registers
router.patch('/api/private/evs/updateListOfDrivers', (req, res, next) => {
    var context = "PATCH /api/private/evs/updateListOfDrivers";
    try {
        let received = req.body;

        let query = {
            "listOfDrivers.mobile": received.mobile,
            "listOfDrivers.internationalPrefix": received.internationalPrefix,
            clientName: received.clientName
        };

        let newValues = {
            $set: {
                "listOfDrivers.$.userId": received._id,
                "listOfDrivers.$.name": received.name,
            }
        };

        EV.updateMany(query, newValues, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result.n === 0) {
                    return res.status(200).send(false);
                }
                else {
                    return res.status(200).send(true);
                };
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Add plafond to an EV
router.patch('/api/private/evs/addPlafondIdToEV', (req, res, next) => {
    var context = "PATCH /api/private/evs/addPlafondIdToEV";
    try {

        let received = req.body;

        if (!received.evId) {
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "EV ID required" });
        };

        if (!received.plafondId) {
            return res.status(400).send({ auth: false, code: 'server_plafond_id_required', message: "Plafond ID required" });
        };

        let query = {
            _id: received.evId
        };

        EV.findOneAndUpdate(query, { $set: { plafondId: received.plafondId } }, { new: true }, (err, newEV) => {
            if (err) {
                console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(true);
            };
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//remove plafond to an EV
router.patch('/api/private/evs/removePlafondIdToEV', (req, res, next) => {
    var context = "PATCH /api/private/evs/removePlafondIdToEV";
    try {

        let received = req.body;

        if (!received.evId) {
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "EV ID required" });
        };

        let query = {
            _id: received.evId
        };

        EV.findOneAndUpdate(query, { $set: { plafondId: "" } }, { new: true }, (err, newEV) => {
            if (err) {
                console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                return res.status(200).send(true);
            };
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

// activate/disable accepted Kms for this EV
router.patch('/api/private/evs/acceptKMs', (req, res, next) => {
    const context = "Patch /api/private/evs/acceptKMs"
    try {
        const evID = req.body.evID
        const acceptKMs = req.body.acceptKMs

        if (!evID || typeof evID !== "string" || typeof acceptKMs !== "boolean") {
            console.log(`[${context}] Error - missing or wrong input variables`)
            return res.status(400).send({ message: { auth: false, code: "bad_input", message: "missing or wrong input variables" } })
        }

        let query = {
            _id: evID
        }
        EV.findOne(query).then(function (ev) {
            if (!ev) return res.status(400).send({ message: { auth: false, code: "error", message: "Unknown EV ID" } });
            Utils.EVupdateAcceptKmsInAllSessions([evID], acceptKMs).then(function (allUpdated) {
                if (!allUpdated) return res.status(500).send({ message: { auth: false, code: "error", message: "Unable to update all sessions with acceptKMs" } }); EV.findOneAndUpdate(query, { $set: { acceptKMs: acceptKMs } }, (err, ev) => {
                    if (err) {
                        console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                        return res.status(500).send({ message: { auth: false, code: "error", message: err.message } });
                    }
                    if (!ev) return res.status(400).send({ message: { auth: false, code: "error", message: "Unknown EV ID" } });

                    return res.status(200).send({ message: { auth: true, code: "success", message: "success" }, ev: ev });
                })
            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            })
        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

// activate/disable updateKMs for this EV
router.patch('/api/private/evs/updateKMs', (req, res, next) => {
    const context = "Patch /api/private/evs/updateKMs"
    try {
        const evID = req.body.evID
        const updateKMs = req.body.updateKMs

        if (!evID || typeof evID !== "string" || typeof updateKMs !== "boolean") {
            console.log(`[${context}] Error - missing or wrong input variables`)
            return res.status(400).send({ message: { auth: false, code: "bad_input", message: "missing or wrong input variables" } })
        }

        let query = {
            _id: evID
        }
        EV.findOne(query).then(function (ev) {
            if (!ev) return res.status(400).send({ message: { auth: false, code: "error", message: "Unknown EV ID" } });
            Utils.EVupdateUpdateKMsInAllSessions([evID], updateKMs).then(function (allUpdated) {
                if (!allUpdated) return res.status(500).send({ message: { auth: false, code: "error", message: "Unable to update all sessions with updateKMs" } });
                EV.findOneAndUpdate(query, { $set: { updateKMs: updateKMs } }, (err, ev) => {
                    if (err) {
                        console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                        return res.status(500).send({ message: { auth: false, code: "error", message: err.message } });
                    }
                    if (!ev) return res.status(400).send({ message: { auth: false, code: "error", message: "Unknown EV ID" } });

                    return res.status(200).send({ message: { auth: true, code: "success", message: "success" }, ev: ev });
                })
            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            })
        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

// activate/disable accepted Kms for this EV
router.patch('/api/private/evs/updateKMs', (req, res, next) => {
    const context = "Patch /api/private/evs/updateKMs"
    try {
        const evID = req.body.evID
        const updateKMs = req.body.updateKMs

        if (!evID || typeof evID !== "string" || typeof updateKMs !== "boolean") {
            console.log(`[${context}] Error - missing or wrong input variables`)
            return res.status(400).send({ message: { auth: false, code: "bad_input", message: "missing or wrong input variables" } })
        }

        let query = {
            _id: evID
        }

        EV.findOneAndUpdate(query, { $set: { updateKMs: updateKMs } }, (err, ev) => {
            if (err) {
                console.error(`[${context}][findOneAndUpdate] Error `, err.message);
                return res.status(500).send({ message: { auth: false, code: "error", message: err.message } });

            }
            if (!ev) return res.status(406).send({ message: { auth: false, code: "unknown_evID", message: "Unknown EV ID" } });
            else return res.status(200).send({ message: { auth: true, code: "success", message: "success" }, ev: ev });
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

router.patch('/api/private/evs/kms', (req, res, next) => {
    const context = " Patch /api/private/evs/kms"
    try {
        const evID = req.body.evID
        const kms = req.body.kms
        const sessionID = req.body.sessionID
        const isFleetManager = req.body.FleetManager
        const chargerType = req.body.chargerType

        if (!evID || typeof evID !== "string" || !kms || typeof kms !== "number" || !sessionID || typeof sessionID !== "string" || typeof isFleetManager !== "boolean") {
            console.error(`[${context}] Error - missing or wrong input variables`)
            return res.status(400).send({ message: { auth: false, code: "bad_input", message: "missing or wrong input variables" } })
        }

        Utils.getChargingSessionByID(sessionID, chargerType).then(function (responseSession) {
            if (responseSession.status !== 200) {
                console.error(`[${context}] Error - Getting Charging Session `)
                return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Charging Session", type: "topmessage" });
            }
            let chargingSession = responseSession.data
            if (!chargingSession) {
                console.error(`[${context}] Error - No charging session `)
                return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No charging session", type: "topmessage" });
            }
            AddKmHandler.patchKmToEV(evID, kms, sessionID, isFleetManager, chargingSession._id).then(function (addedKm) {
                return res.status(addedKm.status).send(addedKm.data)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send({ message: { auth: false, code: "general_genericErrorMessage", message: error.message } });
            })
        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({ message: { auth: false, code: "general_genericErrorMessage", message: error.message } });
        })

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send({ message: { auth: false, code: "general_genericErrorMessage", message: error.message } });
    };
})

//========== PUT ==========
//Edit a EV, make primary EV
router.put('/api/private/evs', (req, res, next) => {
    var context = "PUT /api/private/evs";
    try {
        var userId = req.headers['userid'] //in headers we can't use camelcase, always lowercase;
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });

        const ev = new EV(req.body);

        //var evId = ev._id;
        var evId = req.body._id;
        if (!evId)
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "EV ID required" });

        EV.markAllAsSecondaryEV(userId, function (err, result) {
            if (err) {
                console.error(`[${context}][markAllAsSecondaryEV] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (result) {

                    console.log("evId", evId);
                    EV.markAsPrimaryEV(evId, function (err, result2) {
                        if (err) {
                            console.error(`[${context}][markAsPrimaryEV] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (result2)
                                return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                            else
                                return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                        };
                    });
                };
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get all evs of a given user
router.get('/api/private/evs_old', async (req, res, next) => {
    var context = "GET /api/private/evs_old";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        //console.log("userId ", userId);
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });

        let groupDrivers = await getGroupDrivers(userId, res);
        let evs = await getEvs(userId, groupDrivers, res);
        let myEvs = await getMyEvs(userId, res);

        if ((evs.length == 0) && (myEvs.length != 0)) {
            return res.status(200).send(myEvs);
        }
        else if ((evs.length != 0) && (myEvs.length == 0)) {
            return res.status(200).send(evs);
        }
        else if ((evs.length != 0) && (myEvs.length != 0)) {
            let newListOfEvs = await listOfEvs(evs, myEvs);
            return res.status(200).send(newListOfEvs);
        }
        else {
            return res.status(200).send([]);
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs', async (req, res, next) => {
    var context = "GET /api/private/evs";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        //console.log("userId ", userId);
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });

        let newListOfEvs = await EVsHandler.sharedEvsAndMyEvs(userId)
        return res.status(200).send(newListOfEvs);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.get('/api/private/evs/landingPage', async (req, res, next) => {
    var context = "GET /api/private/evs/landingPage";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        console.log("userId ", userId);
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });

        let groupDrivers = await getGroupDrivers(userId, res);
        let evsLandingPage = await getEvsLandingPage(userId, groupDrivers, res);
        //console.log("groupDrivers", groupDrivers);
        return res.status(200).send(evsLandingPage);


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/sharedWithMe/:userId', async (req, res, next) => {
    let context = "GET /api/private/evs/sharedWithMe:userId";
    try {
        let userId = req.params.userId
        EVsHandler.getEVsSharedWithMe(userId)
            .then((response) => {
                return res.status(200).send(response);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                ErrorHandler.ErrorHandler(error, res);
            })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        ErrorHandler.ErrorHandler(error, res);
    };
});
//Get evs geral
router.get('/api/private/evs/geral', (req, res, next) => {
    var context = "GET /api/private/evs/geral";
    try {
        const filter = {};
        if (req.query) {
            filter.query = req.query;
        };

        EV.find(filter.query, (err, evs) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else
                return res.status(200).send(evs);
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get all evs
router.get('/api/private/evs/frontend', (req, res, next) => {
    var context = "GET /api/private/evs/frontend";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });

        const filter = {};
        if (req.query) {
            filter.query = req.query;
        };

        EV.find(filter.query, (err, evs) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (typeof evs === 'undefined' || evs.length <= 0)
                    return res.status(400).send({ auth: false, code: "server_evs_not_found", message: 'Evs not found for given parameters' });
                else {
                    getChargingSessions(evs, function (evs) {
                        return res.status(200).send(evs);
                    });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get evs for my sessions
router.get('/api/private/evs/mySession', (req, res, next) => {
    var context = "GET /api/private/evs/mySession";
    try {
        var query = req.body;
        EV.findOne(query, (err, result) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (result)
                    return res.status(200).send(result);
                else {
                    var ev = new EV();
                    return res.status(200).send(ev);
                };
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get ev details by id
router.get('/api/private/ev/details', (req, res, next) => {
    var context = "GET /api/private/ev/details";
    try {
        var userId = req.headers['userid'];
        var query = req.query;
        let clientName = req.headers['clientname'];
        if (query._id == undefined || query._id == '') {
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });
        }
        else {
            EV.findOne(query, async (err, evFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                } else {
                    if (evFound) {

                        evFound = JSON.parse(JSON.stringify(evFound));
                        let networks = await getNetworksEV(evFound, clientName);
                        evFound.networks = networks;

                        if (evFound.listOfDrivers.length == 0 && evFound.listOfGroupDrivers.length == 0) {
                            //without drivers or group drivers
                            return res.status(200).send(evFound);
                        } else if (evFound.listOfDrivers.length != 0 && evFound.listOfGroupDrivers.length == 0) {
                            //Only with drivers
                            getDrivers(evFound)
                                .then((newlistOfDrivers) => {
                                    evFound.listOfDrivers = newlistOfDrivers;
                                    return res.status(200).send(evFound);
                                    /*
                                    var newEvFound = {
                                        _id: evFound._id,
                                        primaryEV: evFound.primaryEV,
                                        brand: evFound.brand,
                                        model: evFound.model,
                                        version: evFound.version,
                                        country: evFound.country,
                                        licensePlate: evFound.licensePlate,
                                        evInfo: evFound.evInfo,
                                        imageContent: evFound.imageContent,
                                        listOfDrivers: newlistOfDrivers,
                                        listOfGroupDrivers: evFound.listOfGroupDrivers,
                                        userId: evFound.userId
                                    };
                                    return res.status(200).send(newEvFound);
                                    */
                                })
                                .catch((error) => {
                                    console.error(`[${context}][getDrivers][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        } else if (evFound.listOfDrivers.length == 0 && evFound.listOfGroupDrivers.length != 0) {
                            //Only with group drivers
                            getGroupsDrivers(evFound)
                                .then((newListOfGroupDrivers) => {
                                    evFound.listOfGroupDrivers = newListOfGroupDrivers;
                                    return res.status(200).send(evFound);
                                    /*
                                    var newEvFound = {
                                        _id: evFound._id,
                                        primaryEV: evFound.primaryEV,
                                        brand: evFound.brand,
                                        model: evFound.model,
                                        version: evFound.version,
                                        country: evFound.country,
                                        licensePlate: evFound.licensePlate,
                                        evInfo: evFound.evInfo,
                                        imageContent: evFound.imageContent,
                                        listOfDrivers: evFound.listOfDrivers,
                                        listOfGroupDrivers: newListOfGroupDrivers,
                                        userId: evFound.userId
                                    };
                                    return res.status(200).send(newEvFound);
                                    */
                                })
                                .catch((error) => {
                                    console.error(`[${context}][getGroupsDrivers][.catch] [1] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        } else {
                            //With groups drivers and drivers
                            getGroupsDrivers(evFound)
                                .then((newListOfGroupDrivers) => {
                                    getDrivers(evFound)
                                        .then((newlistOfDrivers) => {
                                            evFound.listOfDrivers = newlistOfDrivers;
                                            evFound.listOfGroupDrivers = newListOfGroupDrivers;
                                            return res.status(200).send(evFound);
                                            /*
                                            var newEvFound = {
                                                _id: evFound._id,
                                                primaryEV: evFound.primaryEV,
                                                brand: evFound.brand,
                                                model: evFound.model,
                                                version: evFound.version,
                                                country: evFound.country,
                                                licensePlate: evFound.licensePlate,
                                                evInfo: evFound.evInfo,
                                                imageContent: evFound.imageContent,
                                                listOfDrivers: newlistOfDrivers,
                                                listOfGroupDrivers: newListOfGroupDrivers,
                                                userId: evFound.userId
                                            };
                                            return res.status(200).send(newEvFound);
                                            */
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][getDrivers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                })
                                .catch((error) => {
                                    console.error(`[${context}][getGroupsDrivers][.catch] [2] Error `, error.message);
                                    return res.status(500).send(error.message);
                                })
                        };
                    } else
                        return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get ev history
router.get('/api/private/ev/history/:id', (req, res, next) => {
    var context = "GET /api/private/ev/history";
    try {
        var userId = req.headers['userid'];
        var evId = req.params.id;
        //console.log("evId", evId);
        var query = {
            _id: evId
        };

        if (query._id == undefined || query._id == '') {
            console.log("{ auth: false, code: server_ev_id_required, message: Ev id required }");
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });
        }
        else {
            EV.findOne(query, async (err, evFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (evFound) {
                        evFound = JSON.parse(JSON.stringify(evFound));
                        let fleet
                        if (evFound.fleet)
                            fleet = await Fleets.findOne({ _id: evFound.fleet })
                        else
                            fleet = undefined;

                        if (!fleet) {
                            fleet = '-1';
                        };

                        if (evFound.listOfGroupDrivers && evFound.listOfGroupDrivers.length > 0) {

                            //Only with group drivers
                            getGroupsDrivers(evFound)
                                .then((newListOfGroupDrivers) => {
                                    evFound.listOfGroupDrivers = newListOfGroupDrivers;
                                    return res.status(200).send({ ev: evFound, fleet: fleet });

                                })
                                .catch((error) => {
                                    console.error(`[${context}][getGroupsDrivers][.catch][1] Error `, error.message);
                                    //return res.status(500).send(error.message);
                                    return res.status(200).send({ ev: evFound, fleet: fleet });
                                });

                        } else {

                            return res.status(200).send({ ev: evFound, fleet: fleet });

                        }

                    } else {

                        console.log("{ auth: false, code: server_evs_not_found, message: Evs not found for given parameters }");
                        return res.status(200).send({ ev: '-1', fleet: undefined });
                        //return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });
                    }
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/ev/byId', (req, res, next) => {
    const context = "GET /api/private/ev/byId";
    try {
        let userId = req.headers['userid'];
        let query = req.query;
        if (query._id == undefined || query._id == '') {
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });
        }
        else {
            EV.findOne(query, (err, evFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (evFound) {
                        return res.status(200).send(evFound);
                    }
                    else
                        return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get evs details by id of infrastructurs
router.get('/api/private/evs/details', (req, res, next) => {
    var context = "GET /api/private/evs/details";
    try {
        var userId = req.headers['userid'];

        let clientName = req.headers['clientname'];
        if (req.query._id == undefined || req.query._id == '') {
            return res.status(400).send({ auth: false, code: 'server_fleet_id_required', message: "Fleet id required" });
        }
        else {
            var query = {
                fleet: req.query._id,
                hasFleet: true
            };
            EV.find(query, (err, evsFound) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (evsFound.length == 0) {
                        return res.status(200).send(evsFound);
                    }
                    else {
                        var listOfEvs = []
                        const getDetails = (evFound) => {
                            return new Promise(async (resolve, reject) => {

                                evFound = JSON.parse(JSON.stringify(evFound));
                                let networks = await getNetworksEV(evFound, clientName);
                                evFound.networks = networks;
                                if (evFound.listOfDrivers.length == 0 && evFound.listOfGroupDrivers.length == 0) {
                                    //without drivers or group drivers
                                    listOfEvs.push(evFound);
                                    resolve(true);
                                }
                                else if (evFound.listOfDrivers.length != 0 && evFound.listOfGroupDrivers.length == 0) {
                                    //Only with drivers
                                    getDrivers(evFound)
                                        .then((newlistOfDrivers) => {
                                            evFound.listOfDrivers = newlistOfDrivers;
                                            listOfEvs.push(evFound);
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][getDrivers][.catch] Error `, error.message);
                                            reject(error.message);
                                        });
                                }
                                else if (evFound.listOfDrivers.length == 0 && evFound.listOfGroupDrivers.length != 0) {
                                    //Only with group drivers
                                    getGroupsDrivers(evFound)
                                        .then((newListOfGroupDrivers) => {
                                            evFound.listOfGroupDrivers = newListOfGroupDrivers;
                                            listOfEvs.push(evFound);
                                            resolve(true);
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][getGroupsDrivers][.catch] [3] Error `, error.message);
                                            reject(error.message);
                                        });
                                }
                                else {
                                    //With groups drivers and drivers
                                    getGroupsDrivers(evFound)
                                        .then((newListOfGroupDrivers) => {
                                            getDrivers(evFound)
                                                .then((newlistOfDrivers) => {
                                                    evFound.listOfDrivers = newlistOfDrivers
                                                    evFound.listOfGroupDrivers = newListOfGroupDrivers;
                                                    listOfEvs.push(evFound);
                                                    resolve(true);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][getDrivers][.catch] Error `, error.message);
                                                    reject(error.message);
                                                });
                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][getGroupsDrivers][.catch] [4] Error `, error.message);
                                            reject(error.message);
                                        });
                                };
                            });
                        };

                        Promise.all(
                            evsFound.map(ev => getDetails(ev))
                        ).then(() => {
                            listOfEvs.sort((a, b) => (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0));
                            //listOfEvs.sort((a, b) => (a.licensePlate > b.licensePlate) ? 1 : ((b.licensePlate > a.licensePlate) ? -1 : 0));
                            return res.status(200).send(listOfEvs);
                        }).catch((error) => {
                            console.error(`[${context}][evsFound.map][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                    };
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

router.get('/api/private/evs/myEvs', (req, res, next) => {
    var context = "GET /api/private/evs/myEvs";
    try {
        var userId = req.headers['userid'];
        var query = {
            userId: userId
        };
        findEv(query)
            .then((result) => {
                if (result.length != 0) {
                    return res.status(200).send(result);
                }
                else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}][findEv] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/allEVs', (req, res, next) => {
    var context = "GET /api/private/evs/allEVs";
    try {

        var query = {};
        findEv(query)
            .then((result) => {
                if (result.length != 0) {
                    return res.status(200).send(result);
                } else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.error(`[${context}][findEv] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/evUser', (req, res, next) => {
    var context = "GET /api/private/evs/evUser";
    try {

        if (!req.query.evId) {
            return res.status(400).send({ auth: false, code: 'ev_id_missing', message: "EV id required" });
        }

        var query = {
            _id: req.query.evId
        };

        findOneEv(query)
            .then((evFound) => {
                if (evFound) {

                    if (evFound.listOfGroupDrivers.length === 0 && evFound.listOfDrivers.length === 0) {
                        return res.status(200).send({ userId: evFound.userId });
                    }
                    else {
                        if (evFound.listOfGroupDrivers.length > 0) {
                            return res.status(200).send({ userId: evFound.userId });
                        }
                        else {
                            if (evFound.listOfDrivers.length > 1) {
                                return res.status(200).send({ userId: evFound.userId });
                            }
                            else {
                                return res.status(200).send({ userId: evFound.listOfDrivers[0].userId });
                            }
                        }
                    }

                }
                else {
                    return res.status(400).send({ auth: false, code: 'ev_not_found', message: "EV not found" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findOneEv] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/byGroup/:id', (req, res, next) => {
    var context = "GET /api/private/evs/bygroup/:id";
    try {

        let groupId = req.params;

        var userId = req.headers['userid'];
        let query = {

            'listOfGroupDrivers': {
                $elemMatch: {
                    groupId: groupId.id
                }
            },
            userId: userId,
            hasFleet: true

        };

        //console.log("query", query);

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                console.log("evsFound", evsFound);
                return res.status(200).send(evsFound);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/byUserId', (req, res, next) => {
    var context = "GET /api/private/evs/byUserId";
    try {

        let driver = req.body;
        var userId = req.headers['userid'];

        //console.log("userId", userId);
        //console.log("driver", driver);
        let query = {

            'listOfDrivers': {
                $elemMatch: {
                    $or: [
                        { userId: driver.driverId },
                        {
                            mobile: driver.mobile,
                            internationalPrefix: driver.internationalPrefix
                        }
                    ]
                }
            },
            userId: userId,
            hasFleet: true

        };

        //console.log("query", query);
        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                //console.log("evsFound", evsFound);
                return res.status(200).send(evsFound);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/byUserId/:id', (req, res, next) => {
    var context = "GET /api/private/evs/byUserId/:id";
    try {

        let userId = req.params;
        let query = {

            'listOfDrivers': {
                $elemMatch: {
                    userId: userId.id
                }
            }

        };

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                //console.log("evsFound", evsFound);
                return res.status(200).send(evsFound);
            };
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/numberOfEVs/:userId', (req, res, next) => {
    var context = "GET /api/private/evs/numberOfEVs/:userId";
    try {

        let userId = req.params.userId;

        let query = {
            userId: userId
        };

        EV.find(query, { _id: 1 }, (err, evsFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                return res.status(200).send({ numberOfEVs: evsFound.length, listEVs: evsFound });
            }
        })


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get EV's to palfond
router.get('/api/private/evs/toPlafond', (req, res, next) => {
    var context = "GET /api/private/evs/toPlafond";
    var userId = req.headers['userid'];

    let query = {
        $and: [
            {hasFleet:true},
            { userId: userId },
            {
                $or: [
                    {
                        plafondId: {
                            $exists: false
                        }
                    },
                    {
                        plafondId: {
                            $exists: true, $eq: ""
                        }
                    }
                ]
            },
            {
                $or: [
                    {
                        listOfDrivers: {
                            $elemMatch: { paymenteBy: "myself" }
                        }
                    },
                    {
                        listOfGroupDrivers: {
                            $elemMatch: { paymenteBy: "myself" }
                        }
                    },
                    {
                        listOfDrivers: {
                            $size: 0
                        },
                        listOfGroupDrivers: {
                            $size: 0
                        }
                    }
                ]
            }
        ]
    };

    findEv(query)
        .then((result) => {

            if (result.length === 0) {

                return res.status(200).send(result);

            } else {
                let listOfEvs = [];
                Promise.all(
                    result.map(ev => {
                        return new Promise(async (resolve, reject) => {

                            let foundListOfDDrivers = ev.listOfDrivers.filter(driver => {
                                return driver.paymenteBy === "driver";
                            });
                            let foundListOfGroupDrivers = ev.listOfGroupDrivers.filter(driver => {
                                return driver.paymenteBy === "driver";
                            });

                            if (foundListOfDDrivers.length === 0 && foundListOfGroupDrivers.length === 0) {

                                ev = JSON.parse(JSON.stringify(ev));

                                if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length == 0)) {

                                    let listOfDrivers = await getDrivers(ev);
                                    //let listOfDrivers = await getDriversNew(ev);
                                    ev.listOfDrivers = listOfDrivers;
                                    listOfEvs.push(ev);
                                    //lestEvs.push(ev);
                                    resolve(true);

                                } else if ((ev.listOfDrivers.length == 0) && (ev.listOfGroupDrivers.length != 0)) {

                                    let listOfGroupDrivers = await getGroupsDrivers(ev);

                                    //console.log("listOfGroupDrivers", listOfGroupDrivers);
                                    //let listOfGroupDrivers = await getGroupsDriversNew(ev);
                                    ev.listOfGroupDrivers = listOfGroupDrivers;
                                    //console.log("ev", ev.listOfGroupDrivers);
                                    listOfEvs.push(ev);
                                    resolve(true);

                                } else if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length != 0)) {

                                    let listOfGroupDrivers = await getGroupsDrivers(ev);
                                    let listOfDrivers = await getDrivers(ev);
                                    //let listOfGroupDrivers = await getGroupsDriversNew(ev);
                                    //let listOfDrivers = await getDriversNew(ev);
                                    ev.listOfDrivers = listOfDrivers;
                                    ev.listOfGroupDrivers = listOfGroupDrivers;
                                    listOfEvs.push(ev);
                                    resolve(true);

                                } else {

                                    listOfEvs.push(ev);
                                    resolve(true);

                                };

                            } else {

                                resolve(true);

                            };

                        });
                    })
                ).then(response => {

                    return res.status(200).send(listOfEvs);

                }).catch(error => {

                    console.error(`[${context}][] Error `, error.message);
                    return res.status(500).send(error.message);

                });

            };
        })
        .catch((error) => {
            console.error(`[${context}][findEv] Error `, error.message);
            return res.status(500).send(error.message);
        });

});

router.get('/evioapi/evs', async (req, res, next) => {
    var context = "GET /evioapi/evs";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        //console.log("userId ", userId);
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });

        //let groupDrivers = await getGroupDrivers(userId, res);

        //console.log("groupDrivers ", groupDrivers);

        //let evs = await getEvsExternalAPI(userId, groupDrivers, res);
        let evs = await getEvsExternalAPI(userId, req, res);
        //console.log("evs ", evs);

        return res.status(200).send(evs);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/evs/evsMap', async (req, res, next) => {
    var context = "GET /api/private/evs/evsMap";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        var groupDrivers = req.body.groupDrivers;

        //console.log("userId ", userId);
        //console.log("req.body ", req.body);
        //console.log("groupDrivers ", groupDrivers.length);

        if (!groupDrivers) {
            groupDrivers = await getGroupDrivers(userId, res);
        };


        //console.log("groupDrivers 1", groupDrivers);

        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User Id required" });

        let evs = await getEvsMap(userId, groupDrivers, res);
        let myEvs = await getMyEvsMap(userId, res);

        //console.log("evs ", evs.length);
        //console.log("myEvs ", myEvs.length);
        if ((evs.length == 0) && (myEvs.length != 0)) {
            return res.status(200).send(myEvs);
        }
        else if ((evs.length != 0) && (myEvs.length == 0)) {
            return res.status(200).send(evs);
        }
        else if ((evs.length != 0) && (myEvs.length != 0)) {
            let newListOfEvs = await listOfEvs(evs, myEvs);
            return res.status(200).send(newListOfEvs);
        }
        else {
            return res.status(200).send([]);
        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/ev/allInfoById', async (req, res, next) => {
    const context = "GET /api/private/ev/allInfoById";
    try {
        let query = req.query;
        if (query._id == undefined || query._id == '') {
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });
        }
        else {
            EV.findOne(query, async (err, evFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }
                else {
                    if (evFound) {
                        let fleet = undefined
                        if (evFound.fleet) {
                            fleet = await Fleets.findOne({ _id: evFound.fleet }, { listEvs: 0 })
                        }


                        evFound = JSON.parse(JSON.stringify(evFound));
                        try {
                            if (evFound.listOfGroupDrivers.length != 0) {
                                let newListOfGroupDrivers = await getGroupsDrivers(evFound)
                                evFound.listOfGroupDrivers = newListOfGroupDrivers;
                            }
                            // if (evFound.listOfDrivers.length != 0 && evFound.listOfGroupDrivers.length == 0) {
                            //     //Only with drivers
                            //     let newlistOfDrivers = await getDrivers(evFound)
                            //     evFound.listOfDrivers = newlistOfDrivers;
                            // } else if (evFound.listOfDrivers.length == 0 && evFound.listOfGroupDrivers.length != 0) {
                            //     //Only with group drivers
                            //     let newListOfGroupDrivers = await getGroupsDrivers(evFound)
                            //     evFound.listOfGroupDrivers = newListOfGroupDrivers;

                            // } else if (evFound.listOfDrivers.length != 0 && evFound.listOfGroupDrivers.length != 0) {
                            //     //With groups drivers and drivers
                            //     let newListOfGroupDrivers = await getGroupsDrivers(evFound)
                            //     let newlistOfDrivers = await getDrivers(evFound)
                            //     evFound.listOfDrivers = newlistOfDrivers;
                            //     evFound.listOfGroupDrivers = newListOfGroupDrivers;
                            // };
                        } catch (error) {
                            console.log(`[${context}] Error `, error.message)
                        }
                        return res.status(200).send({ ev: evFound, fleet });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_evs_not_found', message: "Evs not found for given parameters" });
                    }
                };
            });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.get('/api/private/ev/evIds', async (req, res, next) => {
    const context = "GET /api/private/ev/evIds";
    try {

        let query = { $match: { hasFleet: true } }

        let project = {
            $group:
            {
                _id: null,
                EVIds: { $push: "$_id" }
            }
        }

        let EVids = await EV.aggregate([query, project])

        return res.status(200).send(EVids[0].EVIds);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete a EV
//deprecated
/**
 * @deprecated Since version 27. Will be deleted in version 30. Use xxx instead.
 */
router.delete('/api/private/evs_old', (req, res, next) => {
    var context = "DELETE /api/private/evs";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        var evId = req.body;
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User id required" });

        if (!evId)
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });

        var query = {
            _id: evId._id,
            userId: userId
        };

        findOneEv(query)
            .then((evFound) => {

                if (evFound) {
                    if (evFound.status === process.env.EVsStatusAvailable) {
                        //if (evFound.fleet !== "") {

                        var query = {
                            _id: evFound.fleet
                        };

                        findOneFleet(query)
                            .then((fleetFound) => {
                                if (fleetFound) {

                                    fleetFound.listEvs = fleetFound.listEvs.filter(ev => {
                                        return ev.evId != evFound._id;
                                    });
                                    var newValues = { $set: fleetFound };
                                    updateFleet(query, newValues)
                                        .then((result) => {
                                            var query = {
                                                _id: evId._id,
                                                userId: userId
                                            };

                                            EV.removeEV(query, (err, result) => {
                                                if (err) {
                                                    console.error(`[${context}][removeEV] Error `, err.message);
                                                    return res.status(500).send(err.message);
                                                }
                                                else {
                                                    if (result)
                                                        return res.status(200).send({ auth: true, code: 'server_delete_successfully', message: "Successfully deleted" });
                                                    else
                                                        return res.status(400).send({ auth: false, code: 'server_delete_unsuccessfully', message: "Unsuccessfully deleted" });
                                                };
                                            });

                                        })
                                        .catch((error) => {
                                            console.error(`[${context}][updateFleet] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                }
                                else {
                                    EV.removeEV(query, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}][removeEV] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            if (result)
                                                return res.status(200).send({ auth: true, code: 'server_delete_successfully', message: "Successfully deleted" });
                                            else
                                                return res.status(400).send({ auth: false, code: 'server_delete_unsuccessfully', message: "Unsuccessfully deleted" });
                                        };
                                    });
                                };
                            })
                            .catch((error) => {
                                console.error(`[${context}][findOneFleet] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                        /*}
                        else {

                        };*/
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_deleted_inUse', message: 'EV in use cannot be deleted' });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_deleted_owner', message: 'Can only be deleted by the owner' });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findOneEv] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Delete a EV
router.delete('/api/private/evs', async (req, res, next) => {
    var context = "DELETE /api/private/evs";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        var evId = req.body._id;
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User id required" });

        if (!evId)
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });

        var query = {
            _id: evId,
            userId: userId
        };

        let evFound = await findOneEv(query);

        let sessions = await getSessionsByEV(evId);

        if (sessions.length === 0) {

            let queryFleet = {
                _id: evFound.fleet
            };

            let newValues = {
                $pull: {
                    listEvs: { evId: evId }
                }
            };

            updateFleet(queryFleet, newValues)
                .then((result) => {

                    EV.removeEV(query, (err, result) => {
                        if (err) {
                            console.error(`[${context}][removeEV] Error `, err.message);
                            return res.status(500).send(err.message);
                        } else {
                            deleteContractFleet({ evId: evId });
                            if (evFound.plafondId || evFound.plafondId !== "") {
                                removePlafond(evId)
                            };
                            if (result)
                                return res.status(200).send({ auth: true, code: 'server_delete_successfully', message: "Successfully deleted" });
                            else
                                return res.status(400).send({ auth: false, code: 'server_delete_unsuccessfully', message: "Unsuccessfully deleted" });
                        };
                    });

                })
                .catch((error) => {
                    console.error(`[${context}] Error `, error.message);
                    return res.status(500).send(error.message);
                });

        } else {

            let activeSessions = sessions.filter(session => {
                return session.status === '20';
            });

            if (activeSessions.length > 0) {
                return res.status(400).send({ auth: false, code: 'server_ev_in_use', message: "EV cannot be deleted, EV in use" });
            }
            else {

                let queryFleet = {
                    _id: evFound.fleet
                };

                let newValues = {
                    $pull: {
                        listEvs: { evId: evId }
                    }
                };

                updateFleet(queryFleet, newValues)
                    .then((result) => {

                        let newValues = {
                            $set: {
                                hasFleet: false,
                                //fleet: "",
                                listOfGroupDrivers: [],
                                listOfDrivers: []
                            }
                        };

                        updateEV(query, newValues, res)
                            .then((result) => {
                                if (Array.isArray(evFound.listOfDrivers)) {
                                    evFound.listOfDrivers.forEach(driver => {
                                        deleteCachedContractsByUserId(driver.userId);
                                    });
                                }
                                
                                removeContractFleet({ evId: evId, fleetId: evFound.fleet });
                                if (evFound.plafondId || evFound.plafondId !== "") {
                                    removePlafond(evId)
                                };
                                if (result)
                                    return res.status(200).send({ auth: true, code: 'server_delete_successfully', message: "Successfully deleted" });
                                else
                                    return res.status(400).send({ auth: false, code: 'server_delete_unsuccessfully', message: "Unsuccessfully deleted" });
                            })
                            .catch((error) => {
                                console.error(`[${context}] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    })
                    .catch((error) => {
                        console.error(`[${context}] Error `, error.message);
                        return res.status(500).send(error.message);
                    });

            };

        };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Remove images of charger
router.delete('/api/private/evs/images', (req, res, next) => {
    var context = "DELETE /api/private/evs/images";
    try {
        var ev = req.body;
        var query = {
            _id: ev._id
        };
        EV.findOne(query, (err, evFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } else {
                if (evFound) {
                    var path = '/usr/src/app/img/evs/' + ev._id + '.jpg';
                    fs.unlink(path, (err) => {
                        if (err) {
                            console.error(`[${context}] Error `, err.message);
                            //return res.status(500).send(err.message);
                            evFound.imageContent = '';
                            var newValues = { $set: evFound };
                            updateEV(query, newValues, res);
                        }
                        else {
                            evFound.imageContent = '';
                            var newValues = { $set: evFound };
                            updateEV(query, newValues, res);
                        };
                    });
                } else {
                    return res.status(400).send({ auth: false, code: 'server_charger_not_found', message: "Charger not found for given parameters" });
                };
            };
        });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

// for cases that the charging session
router.delete('/api/private/evs/kms', (req, res, next) => {
    const context = " Delete /api/private/evs/kms"
    try {
        let evID = req.body.evID
        let sessionID = req.body.sessionID

        if (!evID || !sessionID) {
            console.error(`[${context}] Error - missing or wrong input variables`)
            return res.status(400).send({ message: { auth: false, code: "bad_input", message: "missing or wrong input variables" } })
        }

        let query = {
            _id: ObjectId(evID),
            'listOfKMs.sessionID': sessionID
        }

        EV.findOne(query).then(function (ev) {
            if (!ev){
                console.error(`[${context}] Error - Unknown evID or ev doesn't have km from sessionID`)
                return res.status(400).send({ message: { auth: false, code: "error", message: "Unknown evID or ev doesn't have km from sessionID" } });
            }

            EV.updateOne(query, { $pull: { 'listOfKMs': { 'sessionID': sessionID } } }).then(function (result) {
                return res.status(200).send({ message: { auth: true, code: "success", message: "success" } });

            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send({ message: { auth: false, code: "error", message: error.message } });
            })
        }).catch(function (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send({ message: { auth: false, code: "error", message: error.message } });
        })

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send({ message: { auth: false, code: "error", message: error.message } });
    }
})

//========== FUNCTIONS ==========
/*
    Get a child from an array childdren an search the Evs database
    Used by function getEvs()
*/
const getEv = (ev) => {
    var context = "Function getEv";
    var query = {
        _id: ev.baseId
    }
    return new Promise((resolve, reject) => {
        try {
            EV.find(query, (err, ev) => {
                if (err) {
                    console.error(`[${context}][find] Error `, err.message);
                    reject(err);
                }
                else {
                    if (ev)
                        resolve(ev);
                    else
                        resolve([]);
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to find one ev by qyery
function findOneEv(query) {
    var context = "Function findOneEv";
    return new Promise((resolve, reject) => {
        EV.findOne(query, (err, evFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(evFound);
            };
        });
    });
};

//Function to find evs by qyery
function findEv(query) {
    var context = "Function findEv";
    return new Promise((resolve, reject) => {
        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err);
            }
            else {
                resolve(evsFound);
            };
        });
    });
};

//Function to create Ev's
function createEvs(ev, req_body, res) {
    var context = "Function createEvs";
    var query = {
        userId: ev.userId,
        hasFleet: true
    };
    findEv(query)
        .then((evsFound) => {
            if (evsFound.length === 0) {
                ev.primaryEV = true;
            };

            query = {
                brand: req_body.brand,
                model: req_body.model,
                version: req_body.version,
                dateFrom: req_body.dateFrom,
                dateTo: req_body.dateTo,
                plugPower: req_body.plugPower,
                vehicleId: req_body.vehicleId
            }

            axios.get(publicEVDatabaseProxy, { params: query })
                .then((evInfoFound) => {

                    ev.evInfo = evInfoFound.data;

                    EV.createEvs(ev, (err, result) => {
                        if (err) {
                            console.error(`[${context}][createEvs] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (result) {
                                createContractFleet(ev).then(async () => {
                                    await deleteCachedContractsByUserId(ev.userId);
                                    result = JSON.parse(JSON.stringify(result));
                                    result.evId = result._id;
                                    return res.status(200).send(result);
                                });
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_ev_not_created', message: "EV not created" });
                            };
                        };
                    });

                })
                .catch((error) => {
                    console.error(`[${context}][.then][find] Error `, error.message);
                    return res.status(400).send({ auth: false, code: 'ev_creation_failed', message: "Failed to create EV" });
                });

        })
        .catch((error) => {
            console.error(`[${context}][findEv] Error `, error.message);
            return res.status(500).send(error.message);
        });
};

function updateEv(query, newValue) {
    var context = "Function updateEv";
    return new Promise((resolve, reject) => {
        EV.updateEV(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}][updateEV] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

//Function to save image in file
function saveImageContent(ev) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {
            var path = '/usr/src/app/img/evs/' + ev._id + '.jpg';
            var pathImage = '';
            var base64Image = ev.imageContent.split(';base64,').pop();
            if (process.env.NODE_ENV === 'production') {
                pathImage = process.env.HostProd + 'evs/' + ev._id + '.jpg'; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = process.env.HostPreProd + 'evs/' + ev._id + '.jpg'; // For PRE PROD server
            }
            else {
                //pathImage = process.env.HostLocal + 'evs/' + ev._id + '.jpg'; // For local host
                pathImage = process.env.HostQA + 'evs/' + ev._id + '.jpg'; // For QA server
            };
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                    reject(err);
                }
                else {
                    ev.imageContent = pathImage;
                    resolve(ev);
                };
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to update an EV
function updateEV(query, newValues, res) {
    context = "Function updateEV";
    return new Promise((resolve, reject) => {
        try {
            EV.updateEV(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateEV] Error `, err.message);
                    reject(err);
                } else {
                    if (result) {
                        // updateImageStatistics(query._id)
                        updateImagePlafond(query, newValues)
                        updateUsersPlafond(query)

                        if (Array.isArray(newValues.$set.listOfDrivers)) {
                            newValues.$set.listOfDrivers.forEach(driver => {
                                deleteCachedContractsByUserId(driver.userId);
                            });
                        }

                        return res.status(200).send({ auth: true, code: 'server_update_successfully', message: "Update successfully" });
                    }
                    else
                        return res.status(400).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

async function getChargingSessions(evs, callback) {
    var context = "Function getChargingSessions";
    try {
        for (let ev of evs) {
            await getData(ev).then((response) => {
                try {
                    if (typeof response === 'undefined' || response.length <= 0) {
                        ev.status = "";
                        ev.consumptionChargingSession = 0;
                        ev.batteryChargingSession = 0;
                        ev.paymentChargingSession = 0;
                        ev.chargerId = "";
                    }
                    else {
                        ev.status = response.status;
                        ev.consumptionChargingSession = response.timeCharged;
                        ev.batteryChargingSession = response.batteryCharged;
                        ev.paymentChargingSession = response.estimatedPrice;
                        ev.chargerId = response.hwId;
                    }

                } catch (error) {
                    ev.status = "";
                    ev.consumptionChargingSession = 0;
                    ev.batteryChargingSession = 0;
                    ev.paymentChargingSession = 0;
                    ev.chargerId = "";
                };

            });
        };
        callback(evs);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        callback(error);
    };
};

const getData = (ev) => {
    var context = "Function getData";
    return new Promise((resolve, reject) => {
        try {
            var chargersEvioServiceProxy = 'http://chargers:3002/api/private/chargingSession/inSession';
            // chargersEvioServiceProxy += "?status=" + process.env.SessionStatusRunning + "&evId=" + ev._id;
            chargersEvioServiceProxy += "?evId=" + ev._id;

            axios.get(chargersEvioServiceProxy)
                .then((response) => {
                    if (response.data.chargingSession.length != 0)
                        resolve(response.data.chargingSession[0]);
                    else {
                        var value = [];
                        resolve(value);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][.catch] Error `, error.message);
                    reject(error)
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function validateFields(ev) {
    return new Promise((resolve, reject) => {
        if (!ev)
            reject({ auth: false, code: 'server_ev_data_required', message: 'EV data is required' });

        else if (!ev.userId)
            reject({ auth: true, code: 'server_user_id_required', message: "User Id required" });

        else if (!ev.brand)
            reject({ auth: false, code: 'server_ev_brand_required', message: 'EV brand is required' });

        else if (!ev.model)
            reject({ auth: false, code: 'server_ev_model_required', message: 'EV model is required' });

        else if (ev.version == null || ev.version == undefined)
            reject({ auth: false, code: 'server_ev_version_required', message: 'EV version is required' });

        else if (!ev.country)
            reject({ auth: false, code: 'server_ev_country_required', message: 'EV country is required' });

        else
            resolve(true);
    });
};

//Function to add groups drivers
function addListOfGroupDrivers(ev, evFound) {
    var context = "Function addListOfGroupDrivers";
    return new Promise((resolve, reject) => {
        try {
            const addGroupDrivers = (groupDrivers) => {
                return new Promise((resolve) => {
                    var found = evFound.listOfGroupDrivers.indexOf(evFound.listOfGroupDrivers.find(element => {
                        return element.groupId == groupDrivers.groupId;
                    }));

                    if (found >= 0) {

                        if (!groupDrivers.billingBy) {
                            if (!evFound.listOfGroupDrivers[found].billingBy) {
                                if (groupDrivers.paymenteBy === "myself")
                                    groupDrivers.billingBy = process.env.EVBillingByMyself;
                                else
                                    groupDrivers.billingBy = process.env.EVBillingByDriver;
                            } else {
                                groupDrivers.billingBy = evFound.listOfGroupDrivers[found].billingBy;
                            };
                        };

                        evFound.listOfGroupDrivers[found] = groupDrivers;

                        resolve(true);

                    } else {

                        if (!groupDrivers.billingBy) {
                            if (groupDrivers.paymenteBy === "myself")
                                groupDrivers.billingBy = process.env.EVBillingByMyself;
                            else
                                groupDrivers.billingBy = process.env.EVBillingByDriver;
                        };

                        evFound.listOfGroupDrivers.push(groupDrivers);
                        resolve(true);

                    };
                });
            };
            Promise.all(
                ev.listOfGroupDrivers.map(groupDrivers => addGroupDrivers(groupDrivers))
            ).then(() => {
                resolve(evFound);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to add drivers
function addListOfDrivers(ev, evFound) {
    var context = "Function addListOfDrivers";
    return new Promise((resolve, reject) => {
        try {
            const addDrivers = (drivers) => {
                return new Promise((resolve) => {
                    var found = evFound.listOfDrivers.indexOf(evFound.listOfDrivers.find(element => {
                        return element._id == drivers._id;
                    }));
                    if (found >= 0) {
                        evFound.listOfDrivers[found] = drivers;
                        resolve(true);
                    } else {

                        if (!drivers.billingBy) {
                            if (drivers.paymenteBy === "myself")
                                drivers.billingBy = process.env.EVBillingByMyself;
                            else
                                drivers.billingBy = process.env.EVBillingByDriver;
                        };

                        evFound.listOfDrivers.push(drivers);
                        resolve(true);

                    };
                });
            };
            Promise.all(
                ev.listOfDrivers.map(drivers => addDrivers(drivers))
            ).then(() => {
                resolve(evFound);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to get groups driver
function getGroupsDrivers(evFound) {
    var context = "Function getGroupsDrivers";
    return new Promise((resolve, reject) => {
        try {
            var newListOfGroupDrivers = [];
            const getGroupsDrivers = (groupDrivers) => {
                return new Promise((resolve, reject) => {

                    //Validate periodType
                    //if (groupDrivers.period.periodType === "always") {
                    var data = {
                        _id: groupDrivers.groupId
                    };
                    //console.log("Data",data);
                    var host = process.env.HostUsers + process.env.PathDrivers;
                    axios.get(host, { data })
                        .then((result) => {
                            var groupDriversFound = result.data;

                            //console.log("groupDriversFound", groupDriversFound);
                            groupDrivers = JSON.parse(JSON.stringify(groupDrivers));
                            groupDrivers.name = groupDriversFound.name;
                            groupDrivers.imageContent = groupDriversFound.imageContent;
                            //console.log("groupDrivers", groupDrivers);

                            if ((groupDriversFound.listOfDrivers === undefined) || (groupDriversFound.listOfDrivers.length == 0)) {

                                groupDrivers.listOfDrivers = groupDriversFound.listOfDrivers;
                                newListOfGroupDrivers.push(groupDrivers);
                                resolve(true);
                            }
                            else {

                                getListOfDrivers(groupDriversFound.listOfDrivers)
                                    .then((listOfDrivers) => {
                                        groupDrivers.listOfDrivers = listOfDrivers;
                                        newListOfGroupDrivers.push(groupDrivers);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][getListOfDrivers][.catch] Error `, error.message);
                                        reject(error);
                                    });
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][axios.get][.catch] Error `, error.message);
                            reject(error);
                        });
                    //Validate periodType
                    /*}
                    else {
                        var dateNow = new Date();
                        var startDate = new Date(groupDrivers.period.period.startDate);
                        var stopDate = new Date(groupDrivers.period.period.stopDate);
                        if ((dateNow >= startDate) && (dateNow <= stopDate)) {
                            var data = {
                                _id: groupDrivers.groupId
                            };
                            var host = process.env.HostUsers + process.env.PathDrivers;
                            axios.get(host, { data })
                                .then((result) => {
                                    var groupDriversFound = result.data;
                                    groupDrivers = JSON.parse(JSON.stringify(groupDrivers));
                                    groupDrivers.name = groupDriversFound.name;
                                    groupDrivers.imageContent = groupDriversFound.imageContent;
                                    if (groupDriversFound.listOfDrivers.length == 0) {
                                        groupDrivers.listOfDrivers = groupDriversFound.listOfDrivers;
                                        newListOfGroupDrivers.push(groupDrivers);
                                        resolve(true);
                                    }
                                    else {
                                        getListOfDrivers(groupDriversFound.listOfDrivers)
                                            .then((listOfDrivers) => {
                                                groupDrivers.listOfDrivers = listOfDrivers;
                                                newListOfGroupDrivers.push(groupDrivers);
                                                resolve(true);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][getListOfDrivers][.catch] Error `, error.message);
                                                reject(error);
                                            });
                                    };
                                })
                                .catch((error) => {
                                    console.error(`[${context}][axios.get][.catch] Error `, error.response.data);
                                    reject(error.response.data);
                                });
                        }
                        else {
                            resolve(false);
                        };
                    };
                    */
                });
            };
            Promise.all(
                evFound.listOfGroupDrivers.map(groupDrivers => getGroupsDrivers(groupDrivers))
            ).then(() => {

                //console.log("newListOfGroupDrivers", newListOfGroupDrivers);
                resolve(newListOfGroupDrivers);

            }).catch((error) => {
                console.error(`[${context}][Promise.all] Error `, error.message);
                reject(error);
            })
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to get drivers
function getDrivers(evFound) {
    var context = "Function getDrivers";
    return new Promise((resolve, reject) => {
        try {
            var newlistOfDrivers = [];
            const getDrivers = (driver) => {
                return new Promise((resolve, reject) => {
                    if (driver.userId == "") {
                        newlistOfDrivers.push(driver);
                        resolve(true);
                    } else if (driver.userId === undefined) {
                        newlistOfDrivers.push(driver);
                        resolve(true);
                    }
                    else {
                        var headers = {
                            userid: driver.userId
                        };
                        var host = process.env.HostUsers + process.env.PathUsers;
                        axios.get(host, { headers })
                            .then((result) => {
                                var driversFound = result.data;
                                if (driversFound.auth !== undefined) {
                                    newlistOfDrivers.push(driver);
                                    resolve(true);
                                }
                                else {
                                    //Validate periodType
                                    //if (driver.period.periodType === "always") {
                                    driver = JSON.parse(JSON.stringify(driver));
                                    driver.name = driversFound.name;
                                    driver.internationalPrefix = driversFound.internationalPrefix;
                                    driver.mobile = driversFound.mobile;
                                    driver.imageContent = driversFound.imageContent;
                                    newlistOfDrivers.push(driver);
                                    resolve(true);
                                    //Validate periodType
                                    /*}
                                    else {
                                        var dateNow = new Date();
                                        var startDate = new Date(driver.period.period.startDate);
                                        var stopDate = new Date(driver.period.period.stopDate);
                                        if ((startDate <= dateNow) && (stopDate >= dateNow)) {
                                            driver = JSON.parse(JSON.stringify(driver));
                                            driver.name = driversFound.name;
                                            driver.internationalPrefix = driversFound.internationalPrefix;
                                            driver.mobile = driversFound.mobile;
                                            driver.imageContent = driversFound.imageContent;
                                            newlistOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                        else {
                                            resolve(false);
                                        };
                                    };
                                    */
                                };
                            })
                            .catch((error) => {
                                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                                reject(error);
                            });
                    };
                });
            };
            Promise.all(
                evFound.listOfDrivers.map(driver => getDrivers(driver))
            ).then(() => {
                resolve(newlistOfDrivers);
            }).catch((error) => {
                console.error(`[${context}][Promise.all] Error `, error.message);
                reject(error);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function getListOfDrivers(listOfDrivers) {
    var context = "Function getListOfDrivers";
    return new Promise((resolve, reject) => {
        try {
            var newlistOfDrivers = [];
            const getDrivers = (driver) => {
                return new Promise((resolve, reject) => {
                    console.log("driver", driver);
                    if (driver.driverId == "") {
                        newlistOfDrivers.push(driver);
                        resolve(true);
                    } else if (driver.driverId === undefined) {
                        newlistOfDrivers.push(driver);
                        resolve(true);
                    } else {
                        console.log("driver.driverId", driver.driverId)
                        var headers = {
                            userid: driver.driverId
                        };
                        var host = process.env.HostUsers + process.env.PathUsers;
                        axios.get(host, { headers })
                            .then((result) => {

                                var driversFound = result.data;
                                if (driversFound.auth !== undefined) {
                                    newlistOfDrivers.push(driver);
                                    resolve(true);

                                } else {

                                    driver = JSON.parse(JSON.stringify(driver));
                                    driver.name = driversFound.name;
                                    driver.internationalPrefix = driversFound.internationalPrefix;
                                    driver.mobile = driversFound.mobile;
                                    driver.imageContent = driversFound.imageContent;
                                    console.log("driver", driver)
                                    newlistOfDrivers.push(driver);
                                    resolve(true);

                                }
                            })
                            .catch((error) => {
                                console.error(`[${context}][axios.get][.catch] Error `, error.message);
                                reject(error);
                            });
                    };
                });
            };
            Promise.all(
                listOfDrivers.map(driver => getDrivers(driver))
            ).then(() => {
                resolve(newlistOfDrivers);
            }).catch((error) => {
                console.error(`[${context}][Promise.all] Error `, error.message);
                reject(error);
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};
//Function to remove group driver from an ev
function removeGroupsDrivers(ev, evFound) {
    var context = "Function removeGroupsDrivers";
    return new Promise((resolve, reject) => {
        try {
            const removeGroupsDrivers = (groupDrivers) => {
                return new Promise((resolve) => {
                    evFound.listOfGroupDrivers = evFound.listOfGroupDrivers.filter(group => {

                        return group.groupId != groupDrivers;
                    });
                    resolve(true);
                });
            };
            Promise.all(
                ev.listOfGroupDrivers.map(groupDrivers => removeGroupsDrivers(groupDrivers))
            ).then(() => {
                resolve(evFound);
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to remove drivers from an ev
function removeDrivers(ev, evFound) {
    var context = "Function removeDrivers";
    return new Promise((resolve, reject) => {
        try {
            const removeDriver = (driver) => {
                return new Promise((resolve) => {
                    evFound.listOfDrivers = evFound.listOfDrivers.filter(element => {
                        return element._id != driver;
                    });
                    resolve(true);
                });
            };
            Promise.all(
                ev.listOfDrivers.map(driver => removeDriver(driver))
            ).then(() => {
                resolve(evFound);
            });
        }
        catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Funtion to get the group drivers I belong to
function getGroupDrivers(userId, res) {
    var context = "Function getGroupDrivers";
    return new Promise((resolve) => {

        var host = process.env.HostUsers + process.env.PathGetGroupDrivers;
        var headers = {
            userid: userId
        };
        axios.get(host, { headers })
            .then((value) => {
                if (value.data.length == 0) {
                    resolve(value.data);
                }
                else {
                    var groupDrivers = [];
                    const getGroupId = (group) => {
                        return new Promise((resolve) => {
                            groupDrivers.push(group._id);
                            resolve(true);
                        });
                    };
                    Promise.all(
                        value.data.map(group => getGroupId(group))
                    ).then(() => {
                        resolve(groupDrivers);
                    });
                }
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                return res.status(500).send(error);
            })
    });
};

//Function to get ev by list of Drivers and list of group Drivers
function getEvs(userId, groupDrivers, res) {
    var context = "Function getEvs";
    return new Promise((resolve) => {

        var dateNow = new Date();
        if (groupDrivers.length == 0) {
            var query = {

                'listOfDrivers': {
                    $elemMatch: {
                        userId: userId
                    }
                },
                hasFleet: true

            };
        }
        else {
            var query = {
                $or: [
                    {
                        'listOfDrivers': {
                            $elemMatch: {
                                userId: userId
                            }
                        }
                    },
                    {
                        'listOfGroupDrivers': {
                            $elemMatch: {
                                groupId: groupDrivers
                            }
                        }
                    }
                ],
                hasFleet: true
            };
        };

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {

                if (evsFound.length == 0) {
                    resolve(evsFound);
                }
                else {
                    var newEvsFound = [];
                    Promise.all(
                        evsFound.map(ev => {
                            return new Promise(async (resolve) => {

                                let contract = await getEvContract(ev._id, userId);

                                if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length == 0)) {
                                    getValidationDriver(ev, userId, dateNow)
                                        .then((result) => {
                                            if (result) {
                                                ev = JSON.parse(JSON.stringify(ev));
                                                if (contract.length !== 0) {
                                                    //first element
                                                    ev.contractId = contract[0]._id;
                                                };
                                                newEvsFound.push(ev);
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            }
                                        });
                                }
                                else if ((ev.listOfDrivers.length == 0) && (ev.listOfGroupDrivers.length != 0)) {
                                    getValidationGroupDrivers(ev, dateNow, groupDrivers)
                                        .then((result) => {
                                            if (result) {
                                                ev = JSON.parse(JSON.stringify(ev));
                                                getGroupsDrivers(ev)
                                                    .then((newListOfGroupDrivers) => {
                                                        ev.listOfGroupDrivers = newListOfGroupDrivers;
                                                        if (contract.length !== 0) {
                                                            //first element
                                                            ev.contractId = contract[0]._id;
                                                        };

                                                        newEvsFound.push(ev);
                                                        resolve(true);
                                                    })
                                                    .catch((error) => {
                                                        console.error(`[${context}] Error `, error.message);
                                                        resolve(false);
                                                    })
                                            }
                                            else {
                                                resolve(false);
                                            }
                                        });
                                }
                                else if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length != 0)) {
                                    //console.log("Drivers and GroupDrivers",ev)
                                    getValidationDriver(ev, userId, dateNow)
                                        .then((result) => {
                                            if (result) {
                                                ev = JSON.parse(JSON.stringify(ev));
                                                getGroupsDrivers(ev)
                                                    .then((newListOfGroupDrivers) => {
                                                        ev.listOfGroupDrivers = newListOfGroupDrivers;
                                                        if (contract.length !== 0) {
                                                            //first element
                                                            ev.contractId = contract[0]._id;
                                                        };
                                                        newEvsFound.push(ev);
                                                        resolve(true);
                                                    })
                                                    .catch((error) => {
                                                        console.error(`[${context}] Error `, error.message);
                                                        resolve(false);
                                                    })
                                            }
                                            else {
                                                getValidationGroupDrivers(ev, dateNow, groupDrivers)
                                                    .then((result) => {
                                                        //console.log("Drivers and GroupDrivers _A",result)
                                                        if (result) {
                                                            getGroupsDrivers(ev)
                                                                .then((newListOfGroupDrivers) => {
                                                                    ev = JSON.parse(JSON.stringify(ev));
                                                                    ev.listOfGroupDrivers = newListOfGroupDrivers;
                                                                    if (contract.length !== 0) {
                                                                        //first element
                                                                        ev.contractId = contract[0]._id;
                                                                    };
                                                                    newEvsFound.push(ev);
                                                                    resolve(true);
                                                                })
                                                                .catch((error) => {
                                                                    console.error(`[${context}] Error `, error.message);
                                                                    resolve(false);
                                                                })
                                                        }
                                                        else {
                                                            resolve(false);
                                                        }
                                                    });
                                            };
                                        });
                                }
                                else {
                                    resolve(false);
                                };

                            });
                        })
                    ).then(() => {
                        resolve(newEvsFound);
                    });
                }
            };
        });
    });
};

//Function to get ev by list of Drivers and list of group Drivers for Landing page
function getEvsLandingPage(userId, groupDrivers, res) {
    var context = "Function getEvs";
    return new Promise((resolve, reject) => {

        //var dateNow = new Date();
        var query;
        if (groupDrivers.length == 0) {
            query = {
                $or: [
                    {
                        'listOfDrivers': {
                            $elemMatch: {
                                userId: userId
                            }
                        }
                    },
                    {
                        userId: userId
                    }
                ],
                hasFleet: true

            };
        }
        else {
            query = {
                $or: [
                    {
                        'listOfDrivers': {
                            $elemMatch: {
                                userId: userId
                            }
                        }
                    },
                    {
                        'listOfGroupDrivers': {
                            $elemMatch: {
                                groupId: groupDrivers
                            }
                        }
                    },
                    {
                        userId: userId
                    }
                ],
                hasFleet: true
            };
        };

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {

                //console.log("evsFound.length", evsFound.length);

                if (evsFound.length == 0) {

                    resolve(evsFound);

                } else {

                    let host = process.env.HostUsers + process.env.PathGetContractByEVLandingPage;

                    let data = {
                        evs: evsFound,
                        groupDrivers: groupDrivers
                    };

                    let headers = {
                        userid: userId
                    };

                    axios.get(host, { data, headers })
                        .then((response) => {

                            //console.log("response", response.data);
                            resolve(response.data)

                        })
                        .catch((error) => {

                            console.error(`[${context}][find] Error `, error.message);
                            return res.status(500).send(error.message);

                        });

                };
            };
        });
    });
};

function getEvsMap(userId, groupDrivers, res) {
    var context = "Function getEvsMap";
    return new Promise((resolve) => {
        //console.log("1")
        var dateNow = new Date();
        if (groupDrivers.length == 0) {
            var query = {

                'listOfDrivers': {
                    $elemMatch: {
                        userId: userId
                    }
                }

            };
        }
        else {
            var query = {
                $or: [
                    {
                        'listOfDrivers': {
                            $elemMatch: {
                                userId: userId
                            }
                        }
                    },
                    {
                        'listOfGroupDrivers': {
                            $elemMatch: {
                                groupId: groupDrivers
                            }
                        }
                    }
                ]
            };
        };

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            } else {

                //console.log(`[${context}] evsFound`, evsFound);
                if (evsFound.length == 0) {
                    resolve(evsFound);
                }
                else {
                    var newEvsFound = [];
                    Promise.all(
                        evsFound.map(ev => {
                            return new Promise(async (resolve) => {

                                if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length == 0)) {
                                    getValidationDriver(ev, userId, dateNow)
                                        .then((result) => {
                                            if (result) {
                                                newEvsFound.push(ev);
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            }
                                        });
                                }
                                else if ((ev.listOfDrivers.length == 0) && (ev.listOfGroupDrivers.length != 0)) {
                                    getValidationGroupDrivers(ev, dateNow, groupDrivers)
                                        .then((result) => {
                                            if (result) {
                                                newEvsFound.push(ev);
                                                resolve(true);
                                            }
                                            else {
                                                resolve(false);
                                            }
                                        });
                                }
                                else if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length != 0)) {
                                    //console.log("Drivers and GroupDrivers",ev)
                                    getValidationDriver(ev, userId, dateNow)
                                        .then((result) => {
                                            if (result) {
                                                newEvsFound.push(ev);
                                                resolve(true);
                                            }
                                            else {
                                                getValidationGroupDrivers(ev, dateNow, groupDrivers)
                                                    .then((result) => {
                                                        //console.log("Drivers and GroupDrivers _A",result)
                                                        if (result) {
                                                            newEvsFound.push(ev);
                                                            resolve(true);
                                                        }
                                                        else {
                                                            resolve(false);
                                                        }
                                                    });
                                            };
                                        });
                                }
                                else {
                                    resolve(false);
                                };
                            });
                        })
                    ).then(() => {
                        resolve(newEvsFound);
                    });
                }
            };
        });
    });
};

//function getEvsExternalAPI(userId, groupDrivers, res) {
function getEvsExternalAPI(userId, req, res) {
    let context = "Function getEvsExternalAPI";
    return new Promise(async (resolve, reject) => {
        try {
            const createdAt = req.query.createdAt
            const updatedAt = req.query.updatedAt
            let query;

            const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

            if ((createdAt && !datePattern.test(createdAt)) || (updatedAt && !datePattern.test(updatedAt))) {
                console.error(`[${context}] Error - Data Format Invalid`);
                return res.status(400).send('Invalid date format. Use yyyy-mm-ddThh:mm format.');
            }

            query = {
                userId: userId
            };

            /*if (groupDrivers.length == 0) {
                query = {
                    $or: [
                        {
                            'listOfDrivers': {
                                $elemMatch: {
                                    userId: userId
                                }
                            }
                        },
                        {
                            userId: userId
                        }
                    ]
                };
            }
            else {
                query = {
                    $or: [
                        {
                            'listOfDrivers': {
                                $elemMatch: {
                                    userId: userId
                                }
                            }
                        },
                        {
                            'listOfGroupDrivers': {
                                $elemMatch: {
                                    groupId: groupDrivers
                                }
                            }
                        },
                        {
                            userId: userId
                        }
                    ]
                };
            };*/

            let fields = {
                _id: 1,
                fleet: 1,
                imageContent: 1,
                country: 1,
                model: 1,
                licensePlate: 1,
                brand: 1,
                evType: 1,
                otherInfo: 1,
                "evInfo.plugs.plugPower": 1,
                "evInfo.plugs.plugType": 1,
                "evInfo.maxBatteryCapacity": 1,
                "evInfo.internalChargerPower": 1,
                "evInfo.maxFastChargingPower": 1
            };

            if(!createdAt && !updatedAt){
                query = {
                    userId: userId
                };
            } else if(!createdAt){
                query = {
                    userId: userId,
                    updatedAt: { $gte: new Date(updatedAt)}
                };
            } else if(!updatedAt){
                query = {
                    userId: userId,
                    createdAt: { $gte: new Date(createdAt)} ,
                };
            } else{
                query = {
                    userId: userId,
                    $and: [
                        { createdAt: { $gte: new Date(createdAt)} },
                        { updatedAt: { $gte: new Date(updatedAt)} }
                    ]
                };
            }

            const evsFound = await EV.find(query, fields);

            resolve(evsFound);

        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            reject(error.message);
        }
    });
}


function getValidationDriver(ev, userId, dateNow) {
    return new Promise(resolve => {
        var found = ev.listOfDrivers.indexOf(ev.listOfDrivers.find(driver => {
            return driver.userId == userId
        }));
        if (found >= 0) {
            if (ev.listOfDrivers[found].period.periodType === 'always') {
                resolve(true);
            }
            else {
                if ((ev.listOfDrivers[found].period.period.startDate <= dateNow) && (ev.listOfDrivers[found].period.period.stopDate >= dateNow)) {
                    resolve(true);
                }
                else {
                    resolve(false);
                };
            };
        }
        else {
            resolve(false);
        };
    });
};

function getValidationGroupDrivers(ev, dateNow, groupDrivers) {
    return new Promise(resolve => {
        var isValid = [];
        Promise.all(
            groupDrivers.map(groupDriver => {
                return new Promise(resolve => {
                    var found = ev.listOfGroupDrivers.indexOf(ev.listOfGroupDrivers.find(group => {
                        return group.groupId == groupDriver;
                    }));
                    if (found >= 0) {

                        if (ev.listOfGroupDrivers[found].period.periodType === 'always') {
                            isValid.push(ev.listOfGroupDrivers[found]);
                            // console.log("isValid", isValid)
                            resolve(true);
                        }
                        else {
                            if ((ev.listOfGroupDrivers[found].period.period.startDate <= dateNow) && (ev.listOfGroupDrivers[found].period.period.stopDate >= dateNow)) {
                                isValid.push(ev.listOfGroupDrivers[found]);
                                resolve(true);
                            }
                            else {
                                resolve(false);
                            };
                        };
                    }
                    else {
                        resolve(false);
                    };
                });
            })
        ).then(() => {
            if (isValid.length > 0) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
};

function getMyEvs(userId, res) {
    var context = "Function getMyEvs";
    return new Promise((resolve) => {
        var query = {
            userId: userId,
            hasFleet: true
        };
        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                var newEvsFound = [];
                Promise.all(
                    evsFound.map(ev => {
                        return new Promise(async (resolve) => {

                            ev = JSON.parse(JSON.stringify(ev));
                            let contract = await getEvContract(ev._id, userId);
                            getGroupsDrivers(ev)
                                .then(async (newListOfGroupDrivers) => {
                                    ev.listOfGroupDrivers = newListOfGroupDrivers;

                                    if (contract.length !== 0) {
                                        //first element
                                        ev.contractId = contract[0]._id;
                                    }

                                    newEvsFound.push(ev);
                                    resolve(true);
                                })
                                .catch((error) => {
                                    console.error(`[${context}] Error `, error.message);
                                    resolve(false);
                                })
                        });
                    })

                ).then(() => {
                    resolve(newEvsFound);
                });
            };
        });
    });
};

function getMyEvsMap(userId, res) {
    var context = "Function getMyEvsMap";
    return new Promise((resolve) => {

        var query = {
            userId: userId,
            hasFleet: true
        };

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                resolve(evsFound);
            };
        });
    });
};

function listOfEvs(evs, myEvs) {
    var context = "Function listOfEvs";
    return new Promise((resolve) => {
        var listOfEvs = myEvs;
        Promise.all(
            evs.map(ev => {
                return new Promise(resolve => {
                    var found = myEvs.find(evs => {
                        return evs._id == ev._id;
                    });
                    if (found) {
                        resolve(false);
                    }
                    else {
                        listOfEvs.push(ev);
                        resolve(true);
                    };
                });
            })
        ).then(() => {
            resolve(listOfEvs);
        });
    });
};

function findOneFleet(query) {
    var context = "Function findOneFleet";
    return new Promise((resolve, reject) => {
        Fleets.findOne(query, (err, fleetFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(fleetFound);
            };
        });
    });
};

function updateFleet(query, newValues) {
    var context = "Function updateFleet";
    return new Promise((resolve, reject) => {
        Fleets.updateFleets(query, newValues, (err, fleetFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(fleetFound);
            };
        });
    });
};

function createContractFleet(ev) {
    let context = "Function createContractFleet";

    let data = {
        evId: ev._id,
        fleetId: ev.fleet,
        userId: ev.userId,
        licensePlate: ev.licensePlate
    };

    let proxy = process.env.HostUsers + process.env.PathContracts;
    return new Promise((resolve, reject) => {

        axios.post(proxy, data)
            .then((result) => {
                //updateChargersWhitelist(ev.fleet)
                console.log(`[${context}][${proxy}] Contract fleet created `)
                resolve(result.data);

            })
            .catch((error) => {
                console.error(`[${context}][${proxy}] Error `, error.message);
                reject(error);

            });
    });

};

function getEvContract(evId, userId) {
    var context = "Function getEvContract";

    let host = process.env.HostUsers + process.env.PathGetContractByEV;

    let params = {
        evId: evId
    }

    let headers = {
        userid: userId
    }

    return new Promise((resolve, reject) => {
        axios.get(host, { headers, params })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            })

    });

}

function functionUpdateEvInfo() {
    var context = 'function FunctionUpdateEvInfo'
    EV.find({ hasFleet: true }, function (err, evs) {
        if (err) {
            console.error(`[${context}][findOne] Error `, err.message);

        }
        else {
            if (evs.length !== 0) {

                evs.map(ev => {

                    createContractFleet(ev);

                });

            }
        }

    });
}

function updateLicensePlateOnContract(ev) {
    var context = "Function updateLicensePlateOnContract";

    let host = process.env.HostUsers + process.env.PathUpdateLicensePlaceFleetContract;

    let data = {
        evId: ev._id,
        licensePlate: ev.licensePlate
    };

    axios.patch(host, data)
        .then((result) => {
            console.log(`[${context}] Contract updated `, ev.licensePlate);
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
        });

};

function getSessionsByEV(evId) {
    var context = "Function getSessionsByEV";
    return new Promise(async (resolve, reject) => {

        let sessionsEVIO = await getSessionsEVIOByEV(evId);
        let sessionsMobiE = await getSessionsMobiEByEV(evId);

        resolve(sessionsEVIO.concat(sessionsMobiE));

    });
};

//Get sessions by ev on EVIO network
function getSessionsEVIOByEV(evId) {
    var context = "Function getSessionsEVIOByEV";
    return new Promise(async (resolve, reject) => {

        let host = process.env.HostCharger + process.env.PathGetSessionByEV + `/${evId}`;

        axios.get(host)
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message);
                resolve([]);
            });

    });
};

//Get sessions by ev on EVIO network
function getSessionsMobiEByEV(evId) {
    var context = "Function getSessionsMobiEByEV";
    return new Promise(async (resolve, reject) => {

        let host = process.env.HostChargingSessionMobie + process.env.PathGetSessionByEV + `/${evId}`;

        axios.get(host)
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.error(`[${context}][${host}] Error `, error.message);
                resolve([]);
            });

    });
};

function removeContractFleet(ev) {
    var context = "Function removeContractFleet";

    let data = {
        evId: ev.evId
    };
    let host = process.env.HostUsers + process.env.PathRemoveContractTypeFleet;

    axios.delete(host, { data })
        .then((result) => {
            console.log("Contract removed");
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
        });

};

function deleteContractFleet(ev) {
    var context = "Function deleteContractFleet";

    let data = {
        evId: ev.evId
    };
    let host = process.env.HostUsers + process.env.PathDeleteContractTypeFleet;

    axios.delete(host, { data })
        .then((result) => {
            console.log("Contract removed");
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
        });

};

async function getChargers(host, query) {
    const context = "Function getChargers";
    try {
        let resp = await axios.get(host, query)
        if (resp.data) {
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}


async function getAllContracts(host, params) {
    const context = "Function getAllContracts";
    try {
        let resp = await axios.get(host, { params })
        if (resp.data) {
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getFleetsGroupIdtags(listOfFleets, contractsHost) {
    const context = "Function getFleetsGroupIdtags";
    try {
        let idTagsArray = []
        for (let fleet of listOfFleets) {
            let contractsQuery = {
                fleetId: fleet.fleetId,
                contractType: process.env.ContractTypeFleet
            }
            let allContracts = await getAllContracts(contractsHost, contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

async function getUsersGroupIdtags(listOfGroups, contractsHost) {
    const context = "Function getUsersGroupIdtags";
    try {
        let listOfUsers = await getListOfUsersArray(listOfGroups)
        let idTags = await getListOfUsersIdTags(listOfUsers, contractsHost)
        return idTags
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
};

async function getGroupOfUsers(host, params) {
    const context = "Function getGroupOfUsers";
    try {
        let resp = await axios.get(host, { params })
        if (resp.data) {
            return resp.data
        } else {
            return null
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

async function getListOfUsersArray(listOfGroups) {
    const context = "Function getListOfUsersArray";
    try {
        const groupIds = listOfGroups
        .map((group) =>
            ObjectId.isValid(group.groupId?.toString())
                ? new ObjectId(group.groupId.toString())
                : undefined
        )
        .filter(group=>Boolean(group))

        const query = { "_id" : { $in : groupIds } }

        const groupsResult = await findGroupCSUser(query);

        const listOfUsers = groupsResult.reduce((accm,group)=>{
            if (!group?.listOfUsers?.length){
                return accm;
            }
            return [
                ...accm,
                ...usersGroup.listOfUsers
            ]
        },[])

        return listOfUsers;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error;
    }
}

async function getListOfUsersIdTags(listOfUsers, contractsHost) {
    const context = "Function getListOfUsersIdTags";
    try {
        let idTagsArray = []
        for (let user of listOfUsers) {
            let contractsQuery = {
                userId: user.userId,
                contractType: process.env.ContractTypeUser
            }
            let allContracts = await getAllContracts(contractsHost, contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

function getIdTags(allContracts, networkEnum, tokenType, tokenStatus) {
    const context = "Function getIdTags";
    try {
        let idTags = []
        for (let contract of allContracts) {
            let token = getSpecificToken(contract, networkEnum, tokenType)
            let idTagsArray = token ? retrieveIdTagsFromToken(token, tokenStatus) : []
            idTags.push(...idTagsArray)
        }
        return idTags
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }
}

function getSpecificToken(contract, networkEnum, tokenType) {
    return contract.networks.find(network => network.network === networkEnum).tokens.find(token => token.tokenType === tokenType)
}

function retrieveIdTagsFromToken(token, status) {
    const context = "Function retrieveIdTagsFromToken";
    try {
        const idTagInfoStatus = {
            "active": "Accepted",
            "inactive": "Blocked",
            "toRequest": "Blocked",
        }
        if (token.status === status) {
            if (token.tokenType === process.env.AuthTypeRFID) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                if (token.idTagHexa) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexa, idTagInfoStatus[status]))
                }
                if (token.idTagHexaInv) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagHexaInv, idTagInfoStatus[status]))
                }
                return returnTokens
            } else if (token.tokenType === process.env.AuthTypeApp_User) {
                let returnTokens = []
                if (token.idTagDec) {
                    returnTokens.push(formatIdTagToWhitelist(token.idTagDec, idTagInfoStatus[status]))
                }
                return returnTokens
            }
        } else {
            return []
        }
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return []
    }

}

function formatIdTagToWhitelist(idTag, status) {
    return {
        idTag: idTag,
        idTagInfo: {
            status: status
        }
    }
}

function removeRepeatedIdTags(authorizationArray) {
    /**
        If eventually there're repeated idTags, we can't send them, else the charger will return an error
        when updating local authorization list
    */
    return authorizationArray.filter((obj, index, self) =>
        index === self.findIndex((t) => (
            t.idTag === obj.idTag
        ))
    )
}

function getNetworksEV(evFound, clientName) {
    const context = "Function getNetworksEV";
    return new Promise((resolve, reject) => {

        const host = `${process.env.HostUsers}${process.env.PathGetNetworks}/${evFound._id}`;

        console.log("host", host);

        axios.get(host)
            .then((response) => {
                if (response.data) {

                    let networks = [];

                    Promise.all(
                        response.data.networks.map(network => {

                            return new Promise((resolve, reject) => {
                                if (network.isVisible !== false) {
                                    let token = network.tokens.find(token => {
                                        return token.tokenType === 'APP_USER' || token.tokenType === 'OTHER'
                                    });

                                    let status;
                                    if (token) {
                                        status = token.status;
                                    } else {
                                        status = 'inactive'
                                    }
                                    let networkInfo = {
                                        name: network.name,
                                        networkName: network.networkName,
                                        network: network.network,
                                        status: status
                                    }

                                    console.log("networkInfo", networkInfo);

                                    if (clientName === process.env.clientNameSC || clientName === process.env.clientNameKLC || clientName === process.env.WhiteLabelKinto) {

                                        networks.push(networkInfo);
                                        resolve(true);

                                    } else {
                                        if (process.env.listOfNetworks.includes(networkInfo.network)) {
                                            networks.push(networkInfo);
                                            resolve(true);
                                        } else {
                                            resolve(true);
                                        }
                                    }
                                } else {
                                    resolve(true);
                                }
                            });
                        })

                    ).then((response) => {

                        resolve(networks);

                    }).catch(error => {

                        console.error(`[${context}] Error `, error.message);
                        resolve([]);

                    });

                } else {

                    resolve([]);

                };

            })
            .catch((error) => {

                console.error(`[${context}] Error `, error.message);
                resolve([]);

            });

    });
};

function removePlafond(evId) {
    var context = "Function removePlafond";

    let data = {
        evId: evId
    };
    let host = process.env.HostPayments + process.env.PathDeletePlafond;

    axios.delete(host, { data })
        .then((result) => {
            console.log("Contract removed");
        })
        .catch((error) => {
            console.error(`[${context}] Error `, error.message);
        });
};

async function prioritizeIdTags(idTagsInfoArray, hwId) {
    const context = "Function prioritizeIdTags"
    try {
        let host = process.env.HostCharger + process.env.PathGetPriorityIdTags
        let data = {
            idTagsInfoArray,
            hwId
        }
        let resp = await axios.get(host, { data })
        if (resp.data) {
            return resp.data
        } else {
            return idTagsInfoArray
        }
    } catch (error) {
        console.error(`[${context}][.catch] Error `, error.message);
        return idTagsInfoArray
    }
};

//addClientName()
async function addClientName() {
    const context = "Function addClientName";
    try {

        let evs = await EV.updateMany({}, { $set: { clientName: "EVIO" } });
        let fleets = await Fleets.updateMany({}, { $set: { clientName: "EVIO" } });

        console.log("evs", evs)
        console.log("fleets", fleets)

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};


//updateBllingBy();
async function updateBllingBy() {
    const context = "Function updateBllingBy";
    try {

        let query = {
            $or: [
                {
                    'listOfDrivers.0': { $exists: true }
                },
                {
                    'listOfGroupDrivers.0': { $exists: true }
                }
            ]
        };

        let fields = {
            _id: 1,
            listOfDrivers: 1,
            listOfGroupDrivers: 1
        };

        EV.find(query, fields, (err, evsFound) => {
            if (err) {

                console.error(`[${context}] Error `, err.message);

            }

            if (evsFound.length > 0) {

                evsFound.forEach(ev => {

                    let listOfDrivers = new Promise((resolve, reject) => {

                        if (ev.listOfDrivers.length > 0) {

                            Promise.all(
                                ev.listOfDrivers.map(driver => {
                                    return new Promise((resolve, reject) => {

                                        if (driver.paymenteBy === "myself") {
                                            driver.billingBy = "owner"
                                            resolve()
                                        } else {
                                            driver.billingBy = "driver"
                                            resolve()
                                        };

                                        //console.log("Drivers", driver);
                                    });
                                })
                            ).then(() => {

                                resolve(true);

                            }).catch(err => {

                                console.error(`[${context}] Error `, err.message);
                                resolve(true);

                            })

                        } else {
                            resolve(true)
                        };

                    });

                    let listOfGroupDrivers = new Promise((resolve, reject) => {

                        if (ev.listOfGroupDrivers.length > 0) {

                            Promise.all(
                                ev.listOfGroupDrivers.map(groupDriver => {
                                    return new Promise((resolve, reject) => {

                                        if (groupDriver.paymenteBy === "myself") {
                                            groupDriver.billingBy = "owner"
                                            resolve()
                                        } else {
                                            groupDriver.billingBy = "driver"
                                            resolve()
                                        };

                                        //console.log("Drivers", driver);
                                    });
                                })
                            ).then(() => {

                                resolve(true);

                            }).catch(err => {

                                console.error(`[${context}] Error `, err.message);
                                resolve(true);

                            })

                        } else {
                            resolve(true)
                        };

                    });

                    Promise.all([listOfDrivers, listOfGroupDrivers])
                        .then(() => {

                            EV.updateEV({ _id: ev._id }, { $set: ev }, (err, result) => {
                                if (err)
                                    console.error(`[${context}] Error `, err.message);

                                console.log("Sucess")

                            })

                        })
                        .catch((err) => {

                            console.error(`[${context}] Error `, err.message);

                        });

                })

            };

        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

async function updateImageHistory() {
    const context = "Function updateImageHistory";

    EV.find({ hasFleet: true }, { _id: 1 }, (err, EVsFound) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        };

        if (EVsFound.length > 0) {

            EVsFound.forEach(ev => {
                console.log("ev", ev);
                // updateImageStatistics(ev._id)
            });

        };
    });

};

async function updateImageStatistics(chargerId) {
    const context = "Funciton updateImageStatistics";

    try {

        let evFound = await EV.findOne({ _id: chargerId }, { _id: 1, imageContent: 1 });
        //console.log("chargerFound", chargerFound);

        let data = {
            type: "EVS",
            ev: evFound
        }
        let host = process.env.HostStatistics + process.env.PathUpdateImageHistory
        let response = await axios.patch(host, data)

        console.log("Update", response.data);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

async function updateImagePlafond(query, newValues) {
    const context = "Funciton updateImageStatistics";

    try {

        let body = {
            "evId": query._id,
            "ev": {
                "brand": newValues.$set.brand,
                "model": newValues.$set.model,
                "imageContent": newValues.$set.imageContent,
                "licensePlate": newValues.$set.licensePlate
            }
        }

        let host = process.env.HostPayments + process.env.PathPatchPlafond
        let response = await axios.patch(host, body)

        console.log("Update", response.data);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };

};

async function updateUsersPlafond(query) {
    const context = "Function updateUsersPlafond";
    try {
        let queryEV = {
            "_id": query._id,
        }

        let ev = await EV.find(queryEV)

        if (ev.length > 0)
            ev = ev[0]

        if (ev.plafondId) {

            let listOfUsersIds = []
            let listOfGroupIds = []

            ev.listOfDrivers.forEach(driver => {
                listOfUsersIds.push(driver.userId)
            });

            ev.listOfGroupDrivers.forEach(driver => {
                if (driver.userId)
                    listOfUsersIds.push(driver.userId)
                if (driver.groupId)
                    listOfGroupIds.push(driver.groupId)
            });


            let queryToIdentity = {
                userIds: listOfUsersIds,
                groupIds: listOfGroupIds
            }

            let hostIdentity = process.env.HostUsers + process.env.PathPostGetListOfUsersFromEV

            let users = await axiosS.axiosPostBody(hostIdentity, queryToIdentity)


            console.log("users")
            console.log(users)

            let usersPlafond = []

            users.forEach(user => {
                usersPlafond.push({
                    name: user.name,
                    userId: user._id,
                    imageContent: user.imageContent,
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix
                })
            });

            let hostPayments = process.env.HostPayments + process.env.PathPatchPlafondUsers

            let body = {
                plafondId: ev.plafondId,
                users: usersPlafond
            }


            let plafond = await axiosS.axiosPatch(hostPayments, body)
        }
    } catch (error) {
        console.error(`[${context}] Error `, error);
    };
}

//addInvoices()
async function addInvoices() {
    const context = "evs addInvoices";
    try {

        let evs = await EV.updateMany({}, { $set: { invoiceType: "INVOICE_INCLUDED", invoiceCommunication: "ONLY_COMPANY" } });

        console.log("evs", evs)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function startCreateMissingContractsJob() {
    initCreateMissingContractsJob().then(() => {
        createMissingContractstask.start();
        console.log("Create missing Contracts Job Started")

    }).catch((e) => {
        console.log("Error starting Create missing Contracts Job")
    });
}

function initCreateMissingContractsJob() {
    return new Promise((resolve, reject) => {

        console.log("Create missing Contracts Job Init");
        var timer = "40 4 * * *"; // Everyday at 04h:40

        createMissingContractstask = cron.schedule(timer, () => {
            console.log('Create missing Contracts Job ' + new Date().toISOString());

            createMissingContracts()
        }, {
            scheduled: false
        });

        resolve();

    });
};

async function createMissingContracts() {
    const context = "Function createMissingContracts";
    try {
        const evIds = await listAllEvsIdByContracts();

        let query = { _id: { $nin: evIds }, hasFleet: true }

        let evsLeft = await EV.find(query)

        console.log("Ev with contract Found: " + evIds.length + "\nEvs without contract Found: " + evsLeft.length)

        evsLeft.forEach(ev => {
            createContractFleet(ev)
        });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

module.exports = router;
