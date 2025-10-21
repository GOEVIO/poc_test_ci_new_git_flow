const express = require('express');
const router = express.Router();
const EV = require('../models/ev');
const Fleets = require('../models/fleets');
const axios = require('axios');
const fs = require('fs');
require("dotenv-safe").load();

const evTypesMapping = require('../models/evTypesMapping.json');
const chargingTypesMapping = require('../models/chargingTypesMapping.json');

router.get('/api/private/otherEvs', (req, res, next) => {
    var context = "POST api/private/otherEvs";
    try {
        return res.status(200).send(evTypesMapping);
    }
    catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send(error.message);
    }
});

//========== POST ==========
//Create a new EV
router.post('/api/private/otherEvs', (req, res, next) => {
    let context = "POST /api/private/otherEvs";
    try {
        let userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        let clientName = req.headers['clientname'];
        let fleet = req.body.fleet;

        let req_body = req.body;
        if (req.body.batteryCapacity) {
            if (req.body.batteryCapacity.includes('KWh')) {
                let batteryCapacity = req.body.batteryCapacity.split('K');
                req.body.batteryCapacity = batteryCapacity[0];
            }
        }

        let ev = new EV(req_body);
        ev.userId = userId;
        ev.clientName = clientName;
        if (req.body.imageContent === undefined)
            ev.imageContent = "";
        if (!fleet)
            return res.status(400).send({ auth: false, code: 'server_fleet_id_required', message: "Fleet Id required" });

        let evType = req.body.evType;
        if (!evType)
            return res.status(400).send({ auth: false, code: 'server_ev_type_required', message: "EV type required" });

        if (ev.brand === process.env.EVBRANDTYPECARD || ev.brand === process.env.EVBRANDTYPEUSER) {
            ev.batteryCapacity = "60"
            ev.plugs = [
                {
                    plugType: "Type 2",
                    plugPower: "22"
                }
            ]

            req_body.batteryCapacity = "60"
            req_body.plugs = [
                {
                    plugType: "Type 2",
                    plugPower: "22"
                }
            ]
        }

        validateOtherEVsFields(ev)
            .then(() => {
                if (evType === "otherEv") {
                    addOtherEvsNoLicense(ev, req_body, res);
                }
                else {
                    addOtherEvsWithLicense(ev, req_body, res);
                }
            })
            .catch((error) => {
                return res.status(400).send(error);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update EVs
router.patch('/api/private/otherEvs', (req, res, next) => {
    var context = "PATCH /api/private/otherEvs";
    try {
        var userId = req.headers['userid']; //in headers we can't use camelcase, always lowercase
        var ev = req.body;
        var fleet = req.body.fleet;
        if (!userId)
            return res.status(400).send({ auth: false, code: 'server_user_id_required', message: "User id required" });
        if (!ev._id)
            return res.status(400).send({ auth: false, code: 'server_ev_id_required', message: "Ev id required" });
        if (!fleet)
            return res.status(400).send({ auth: false, code: 'server_fleet_id_required', message: "Fleet Id required" });

        let evType = req.body.evType;

        if (evType === "otherEv") {
            updateOtherEvsNoLicense(ev, res);
        }
        else {
            updateOtherEvsWithLicense(ev, res);
        }

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Function to create Ev's
async function createOtherEvs(ev, req_body, res) {
    const context = "Function createOtherEvs";
    return new Promise((resolve, reject) => {
        const query = {
            userId: ev.userId,
            hasFleet: true
        };

        findEv(query)
        .then((evsFound) => {
            if (evsFound.length === 0) {
                ev.primaryEV = true;
            };

            let evInfo = {
                maxBatteryCapacity: req_body.batteryCapacity,
                useableBatteryCapacity: req_body.batteryCapacity,
                internalChargerPower: null,
                maxFastChargingPower: null,
                plugs: req_body.plugs
            }

            evInfo = checkPlugInfo(evInfo, req_body.plugs);
            ev.evInfo = evInfo;

            EV.createEvs(ev, async (err, result) => {
                if (err) {
                    console.error(`[${context}][createEvs] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result) {
                        await createContractFleet(ev);
                        resolve(result);
                    }
                    else {
                        reject({ auth: false, code: 'server_ev_not_created', message: "EV not created" });
                    };
                };
            });

        })
        .catch((error) => {
            console.error(`[${context}][findEv] Error `, error.message);
            reject(error);
        });
    }); 

    
};

//Function to update an EV
function updateEV(query, newValues, res) {
    const context = "Function updateEV";
    return new Promise((resolve, reject) => {
        try {
            EV.updateEV(query, newValues, (err, result) => {
                if (err) {
                    console.error(`[${context}][updateEV] Error `, err.message);
                    reject(err);
                } else {
                    if (result) {
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

function validateOtherEVsFields(ev) {
    return new Promise((resolve, reject) => {
        if (!ev)
            reject({ auth: false, code: 'server_ev_data_required', message: 'EV data is required' });

        else if (!ev.userId)
            reject({ auth: true, code: 'server_user_id_required', message: "User Id required" });

        else if (!ev.evType)
            reject({ auth: true, code: 'server_ev_type_required', message: "Ev type required" });

        /*else if (!ev.brand)
            reject({ auth: false, code: 'server_ev_brand_required', message: 'EV brand is required' });

        else if (!ev.model)
            reject({ auth: false, code: 'server_ev_model_required', message: 'EV model is required' });*/

        else if (!ev.country)
            reject({ auth: false, code: 'server_ev_country_required', message: 'EV country is required' });

        else
            resolve(true);
    });
};

function checkPlugInfo(evInfo, plugs) {

    if (plugs.length !== 0) {
        if (plugs.length === 1) {
            evInfo.internalChargerPower = plugs[0].plugPower;
        }
        else {

            let min_plugPower = null;
            let max_plugPower = null;

            for (let index = 0; index < plugs.length; index++) {
                const plug = plugs[index];

                if (min_plugPower !== null) {
                    if (parseInt(plug.plugPower) < parseInt(min_plugPower)) {

                        if (parseInt(min_plugPower) > parseInt(max_plugPower)) {
                            max_plugPower = min_plugPower;
                        }
                        min_plugPower = plug.plugPower;
                    }
                }
                else {
                    min_plugPower = plug.plugPower;
                }

                if (max_plugPower !== null) {

                    if (parseInt(plug.plugPower) > parseInt(max_plugPower)) {

                        if (parseInt(min_plugPower) > parseInt(max_plugPower)) {
                            min_plugPower = max_plugPower;
                        }
                        max_plugPower = plug.plugPower;

                    }
                }
                else {
                    max_plugPower = plug.plugPower;
                }

            }

            evInfo.internalChargerPower = min_plugPower;
            evInfo.maxFastChargingPower = max_plugPower;

        }
    }

    return evInfo;

    /*for (let index = 0; index < plugs.length; index++) {
        const plug = plugs[index];

        chargingTypesMapping.forEach(mapping => {
            if (mapping.plug === plug.plugType) {
                if (plug.plugPower >= mapping.power_min
                    && plug.plugPower <= mapping.power_max) {

                    if (mapping.chargeType === "fast") {

                        if (evInfo.maxFastChargingPower === null) {
                            evInfo.maxFastChargingPower = plug.plugPower;
                        }
                        else {
                            if (plug.plugPower > evInfo.maxFastChargingPower) {
                                evInfo.maxFastChargingPower = plug.plugPower;
                            }
                        }

                    }
                    else {
                        evInfo.internalChargerPower = plug.plugPower;
                    }

                }
            }
        });

        if (plug.plugType === "SCHUKO EU" || plug.plugType === "J1772" /*|| plug.plugType === "Type 2"*//*) {
if (evInfo.internalChargerPower === null) {
evInfo.internalChargerPower = plug.plugPower;
}
}
else {
if (plug.plugType === "Unknown") {
evInfo.internalChargerPower = plug.plugPower;
}
else {
if (evInfo.maxFastChargingPower === null) {
evInfo.maxFastChargingPower = plug.plugPower;
}
else {
if (plug.plugPower > evInfo.maxFastChargingPower) {
evInfo.maxFastChargingPower = plug.plugPower;
}
}
}
}

}*/

}

async function createContractFleet(ev) {
    let context = "Function createContractFleet";

    let data = {
        evId: ev._id,
        fleetId: ev.fleet,
        userId: ev.userId,
        licensePlate: ev.licensePlate
    };

    let proxy = process.env.HostUsers + process.env.PathContracts;

    axios.post(proxy, data)
        .then((result) => {
            console.log(`[${context}][${proxy}] Contract fleet created `)
        })
        .catch((error) => {
            console.error(`[${context}][${proxy}] Error `, error.message);

        });
};

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

function addOtherEvsNoLicense(ev, req_body, res) {
    const context = "Function addOtherEvsNoLicense";

    let fleet = req_body.fleet;

    const query = {
        _id: fleet
    };

    if ((req_body.imageContent !== undefined) && (req_body.imageContent !== "") && (ev.imageContent.includes('base64'))) {
        Fleets.findOne(query, (err, fleetFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            } 

            if (!fleetFound) {return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' }); }

            var newEv = {
                evId: ev._id
            };
            fleetFound.listEvs.push(newEv);
            const newValues = { $set: fleetFound };
            saveImageContent(ev)
                .then((value) => {
                    createOtherEvs(value, req_body, res)
                    .then((resultCreate) => {
                        Fleets.updateFleets(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}][updateFleets] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                        });
                        return res.status(200).send(resultCreate);
                    })
                    .catch((error) => {
                        console.error(`[${context}][createOtherEvs][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                })
                .catch((error) => {
                    console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                    return res.status(500).send(error.message);
                });
            
        });
    } else {
        Fleets.findOne(query, (err, fleetFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            
            if (!fleetFound) { return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });}
            
            var newEv = {
                evId: ev._id
            };
            fleetFound.listEvs.push(newEv);
            const newValues = { $set: fleetFound };

            createOtherEvs(ev, req_body, res)
                .then((resultCreate) => {
                    Fleets.updateFleets(query, newValues, (err, result) => {
                        if (err) {
                            console.error(`[${context}][updateFleets] Error `, err.message);
                            return res.status(500).send(err.message);
                        }                            
                    });
                    return res.status(200).send(resultCreate);
                }).catch((error) => {
                    console.error(`[${context}][createOtherEvs][.catch] Error `, error.message);
                    return res.status(500).send(error.message);
                });                    
           
        });
    }

};

function addOtherEvsWithLicense(ev, req_body, res) {
    const context = "Function addOtherEvsWithLicense";
    console.log(`[${context}] ev.licensePlate: `, ev.licensePlate);

    if ((ev.licensePlate !== undefined) && (ev.licensePlate !== "")) {

        let fleet = req_body.fleet;

        var query = {
            licensePlate: ev.licensePlate,
            hasFleet: true,
            country: ev.country
        };

        findOneEv(query)
            .then((evFound) => {
                query = {
                    _id: fleet
                };
                if (evFound) {
                    return res.status(400).send({ auth: false, code: 'server_license_plate_exists', message: 'License plate already exists' });
                }

                if ((req_body.imageContent !== undefined) && (req_body.imageContent !== "") && (ev.imageContent.includes('base64'))) {
                    Fleets.findOne(query, async (err, fleetFound) => {
                        if (err) {
                            console.error(`[${context}][findOne] Error `, err.message);
                            return res.status(500).send(err.message);
                        }

                        if (!fleetFound) {return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });}

                        const newEv = {
                            evId: ev._id
                        };
                        fleetFound.listEvs.push(newEv);
                        const newValues = { $set: fleetFound };

                        saveImageContent(ev)
                            .then(async (value) => {
                                createOtherEvs(value, req_body, res)
                                    .then((resultCreate) => {
                                        Fleets.updateFleets(query, newValues, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}][updateFleets] Error `, err.message);
                                                return res.status(500).send(err.message);
                                            }
                                            return res.status(200).send(resultCreate);
                                        });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][createOtherEvs][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            })
                            .catch((error) => {
                                console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });                            
                    });
                }
                else {
                    Fleets.findOne(query, async (err, fleetFound) => {
                        if (err) {
                            console.error(`[${context}][findOne] Error `, err.message);
                            return res.status(500).send(err.message);
                        }

                        if (!fleetFound) {return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });}

                        const newEv = {evId: ev._id};
                        fleetFound.listEvs.push(newEv);
                        const newValues = { $set: fleetFound };
                        createOtherEvs(ev, req_body, res)
                            .then((resultCreate) => {
                                Fleets.updateFleets(query, newValues, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][updateFleets] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }                                       
                                    return res.status(200).send(resultCreate);
                                });
                            })
                            .catch((error) => {
                                console.error(`[${context}][createOtherEvs][.catch] 0 Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    });
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
                } 

                if (!fleetFound) {return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });}
                
                const newEv = {
                    evId: ev._id
                };
                fleetFound.listEvs.push(newEv);
                const newValues = { $set: fleetFound };
                saveImageContent(ev)
                    .then((value) => {
                        createOtherEvs(value, req_body, res)
                            .then((resultCreate) => {
                                Fleets.updateFleets(query, newValues, (err, result) => {
                                    if (err) {
                                        console.error(`[${context}][updateFleets] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }

                                    return res.status(200).send(resultCreate);
                                });
                            })
                            .catch((error) => {
                                console.error(`[${context}][createOtherEvs][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });                           
                    })
                    .catch((error) => {
                        console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            });
        } else {
            Fleets.findOne(query, async (err, fleetFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    return res.status(500).send(err.message);
                }

                if (!fleetFound) {return res.status(400).send({ auth: false, code: 'server_fleet_not_found', message: 'Fleet not found for given parameters' });}
                    
                const newEv = {
                    evId: ev._id
                };
                fleetFound.listEvs.push(newEv);
                const newValues = { $set: fleetFound };
                createOtherEvs(ev, req_body, res)
                    .then((resultCreate) => {
                        Fleets.updateFleets(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}][updateFleets] Error `, err.message);
                                return res.status(500).send(err.message);
                            }                                
                        });
                        return res.status(200).send(resultCreate);
                    })
                    .catch((error) => {
                        console.error(`[${context}][createOtherEvs][.catch] Error `, error.message);
                        return res.status(500).send(error.message);
                    }); 
            });
        };
    };

};

function updateOtherEvsNoLicense(ev, res) {
    var context = "Function updateOtherEvsNoLicense";

    let query = { _id: ev._id };

    let evInfo = {
        maxBatteryCapacity: ev.evInfo.maxBatteryCapacity,
        internalChargerPower: null,
        maxFastChargingPower: null,
        plugs: ev.evInfo.plugs
    }

    evInfo = checkPlugInfo(evInfo, ev.evInfo.plugs);
    ev.evInfo = evInfo;

    if (ev.imageContent != undefined) {
        EV.findOne(query, (err, evFound) => {
            if (err) {
                console.error(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (ev.imageContent == "" && evFound.imageContent != "") {

                    unlinkImage(evFound)
                        .then(() => {
                            var newValues = { $set: ev };
                            updateLicensePlateOnContract(ev);
                            updateEV(query, newValues, res);
                        })
                        .catch(err => {
                            console.error(`[${context}] [unlinkImage]Error `, err.message);

                            var newValues = { $set: ev };
                            updateLicensePlateOnContract(ev);
                            updateEV(query, newValues, res);
                        });
                    /*
                    var path = '/usr/src/app/img/evs/' + evFound._id + '.jpg';
                    fs.unlink(path, (err, result) => {
                        if (err) {
                            console.error(`[${context}] [fs.unlink]Error `, err.message);

                            var newValues = { $set: ev };
                            updateLicensePlateOnContract(ev);
                            updateEV(query, newValues, res);

                            //return res.status(500).send(err.message);
                        }
                        else {
                            var newValues = { $set: ev };
                            updateLicensePlateOnContract(ev);
                            updateEV(query, newValues, res);
                        };
                    });
                    */

                } else if (ev.imageContent.includes('base64')) {

                    unlinkImage(evFound)
                        .then(() => {
                            saveImageContent(ev)
                                .then((ev) => {

                                    var newValues = { $set: ev };
                                    updateLicensePlateOnContract(ev);
                                    updateEV(query, newValues, res);

                                })
                                .catch(err => {
                                    console.error(`[${context}][saveImageContent] Error `, err.message);
                                    return res.status(500).send(err.message);
                                });

                        })
                        .catch(err => {
                            console.error(`[${context}][unlinkImage] Error `, err.message);
                            return res.status(500).send(err.message);
                        });

                    /*
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

                            var newValues = { $set: ev };
                            updateLicensePlateOnContract(ev);
                            updateEV(query, newValues, res);
                        };
                    });
                    */

                }
                else {
                    var newValues = { $set: ev };
                    updateLicensePlateOnContract(ev);
                    updateEV(query, newValues, res);
                };
            };
        });
    }
    else {

        var newValues = { $set: ev };
        updateLicensePlateOnContract(ev);
        updateEV(query, newValues, res);

    };

}

function updateOtherEvsWithLicense(ev, res) {
    var context = "Function updateOtherEvsWithLicense";

    let query = { _id: ev._id };

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

                    let evInfo = {
                        maxBatteryCapacity: ev.evInfo.maxBatteryCapacity,
                        internalChargerPower: null,
                        maxFastChargingPower: null,
                        plugs: ev.evInfo.plugs
                    }

                    evInfo = checkPlugInfo(evInfo, ev.evInfo.plugs);
                    ev.evInfo = evInfo;

                    if (ev.imageContent != undefined) {
                        EV.findOne(query, (err, evFound) => {
                            if (err) {
                                console.error(`[${context}][findOne] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (ev.imageContent == "" && evFound.imageContent != "") {

                                    unlinkImage(evFound)
                                        .then(() => {
                                            var newValues = { $set: ev };
                                            updateLicensePlateOnContract(ev);
                                            updateEV(query, newValues, res);
                                        })
                                        .catch(err => {
                                            console.error(`[${context}] [unlinkImage]Error `, err.message);

                                            var newValues = { $set: ev };
                                            updateLicensePlateOnContract(ev);
                                            updateEV(query, newValues, res);
                                        });

                                    /*
                                    var path = '/usr/src/app/img/evs/' + evFound._id + '.jpg';
                                    fs.unlink(path, (err, result) => {
                                        if (err) {
                                            console.error(`[${context}] [fs.unlink]Error `, err.message);

                                            var newValues = { $set: ev };
                                            updateLicensePlateOnContract(ev);
                                            updateEV(query, newValues, res);

                                            //return res.status(500).send(err.message);
                                        }
                                        else {
                                            var newValues = { $set: ev };
                                            updateLicensePlateOnContract(ev);
                                            updateEV(query, newValues, res);
                                        };
                                    });
                                    */

                                } else if (ev.imageContent.includes('base64')) {

                                    unlinkImage(evFound)
                                        .then(() => {
                                            saveImageContent(ev)
                                                .then((ev) => {

                                                    var newValues = { $set: ev };
                                                    updateLicensePlateOnContract(ev);
                                                    updateEV(query, newValues, res);

                                                })
                                                .catch(err => {
                                                    console.error(`[${context}][saveImageContent] Error `, err.message);
                                                    return res.status(500).send(err.message);
                                                });

                                        })
                                        .catch(err => {
                                            console.error(`[${context}][unlinkImage] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        });

                                    /*
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

                                            var newValues = { $set: ev };
                                            updateLicensePlateOnContract(ev);
                                            updateEV(query, newValues, res);
                                        };
                                    });
                                    */


                                } else {
                                    var newValues = { $set: ev };
                                    updateLicensePlateOnContract(ev);
                                    updateEV(query, newValues, res);
                                };
                            };
                        });
                    }
                    else {
                        var newValues = { $set: ev };
                        updateLicensePlateOnContract(ev);
                        updateEV(query, newValues, res);
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

}

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
                console.error(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            else {
                resolve(evsFound);
            };
        });
    });
};

//Function to save image in file
function saveImageContent(ev) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {

            var dateNow = Date.now();
            var path = `/usr/src/app/img/evs/${ev._id}_${dateNow}.jpg`;
            var pathImage = '';
            var base64Image = ev.imageContent.split(';base64,').pop();

            if (process.env.NODE_ENV === 'production') {
                pathImage = `${process.env.HostProd}evs/${ev._id}_${dateNow}.jpg`; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = `${process.env.HostPreProd}evs/${ev._id}_${dateNow}.jpg`; // For PRE PROD server
            }
            else {
                //pathImage = `${process.env.HostLocal}evs/${ev._id}_${dateNow}.jpg`; // For local host
                pathImage = `${process.env.HostQA}evs/${ev._id}_${dateNow}.jpg`; // For QA server
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

//Function to delete image
function unlinkImage(ev) {
    var context = "Function unlinkImage";
    return new Promise((resolve, reject) => {

        const image = ev.imageContent.split('/');

        const path = `/usr/src/app/img/evs/${image[image.length - 1]}`;

        fs.unlink(path, (err, result) => {
            if (err) {
                console.error(`[${context}] [fs.unlink]Error `, err.message);
                resolve(ev);
                //reject(err);
            } else {
                resolve(ev);
            };
        });
    });
};

router.post('/api/private/otherEvs/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/otherEvs/runFirstTime";
    try {
        //updateEvTypeToCar();
        updateOhterEvsChargersMEtrics();
        return res.status(200).send("OK");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

function updateEvTypeToCar() {
    EV.find({}, (err, evs) => {
        if (err) {
            console.error(`[${context}][find] Error `, err.message);
        } else {
            if (evs.length !== 0) {

                evs.forEach(ev => {

                    let query = { _id: ev._id };

                    if (ev.evType === undefined) {

                        ev.evType = "car";
                        var newValues = { $set: ev };

                        EV.updateEV(query, newValues, (err, result) => {
                            if (err) {
                                console.error(`[${context}][updateEV] Error `, err.message);
                                reject(err);
                            } else {
                                if (result) {
                                    console.log("Updated evType");
                                }
                                else
                                    console.log("evType not updated");
                            };
                        });

                    }
                    else {
                        console.log("Already has evType");
                    }

                });

            }
            else {
                console.log("No evs");
            }
        };
    });
}

async function updateOhterEvsChargersMEtrics() {

    let query = {
        evType: {
            $in: ["motorcycle",
                "bicycle",
                "electricScooter",
                "truck",
                "boat",
                "plane",
                "otherEv"]
        }
    }

    let evs = await EV.find(query)

    for (let i = 0; i != evs.length; i++) {

        checkPlugInfo(evs[i].evInfo, evs[i].evInfo.plugs)

        await EV.updateOne({ _id: evs[i]._id }, { $set: { evInfo: evs[i].evInfo } })
    }

}
module.exports = router;