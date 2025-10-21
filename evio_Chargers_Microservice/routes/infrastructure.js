const express = require('express');
const router = express.Router();
const Infrastructure = require('../models/infrastructure');
require("dotenv-safe").load();
const axios = require("axios");
const fs = require('fs');
const Charger = require('../models/charger');
const ChargingSession = require('../models/chargingSession');
const QrCode = require('../models/qrCode');
const ManagementPOIs = require('../models/managementPOIs');
const { getCode, getName } = require('country-list');
const InfrastructuresHandler = require('../controllers/infrastructuresHandler');
const ObjectId = require("mongoose").Types.ObjectId;
const { findOneGroupCSUser, findGroupCSUser } = require('evio-library-identity').default;

const getListOfGroups = async (chargerFound) => {
    var context = "Funciton getListOfGroups";
    try {
        if (chargerFound?.listOfGroups?.length) {

            const groupIds = chargerFound.listOfGroups
                .map((group) =>
                    ObjectId.isValid(group.groupId?.toString())
                        ? new ObjectId(group.groupId.toString())
                        : undefined
                )
                .filter(group=>Boolean(group))

            const query = { "_id" : { $in : groupIds } }
            const groupsResult = await findGroupCSUser(query);
            const groupsResultWithGroupId = groupsResult.map(groupFound=>{
                const group = chargerFound.listOfGroups.find(sourceGroup=>sourceGroup.groupId==groupFound._id);
                delete groupFound._id;
                return {
                    ...group,
                    ...groupFound,
                }
            })
            chargerFound.listOfGroups = groupsResultWithGroupId;
            return chargerFound
        } else {
            console.warn(`[${context}] Warn `, 'chargerFound.listOfGroups is not valid array');
            return [];
        }
    } catch (error) {
        console.error(`[${context}][axios.get][.catch] Error `, error.message);
        throw error
    }
};

//========== POST ==========
//Create infrastructure
router.post('/api/private/infrastructure', async (req, res, next) => {
    const context = "POST /api/private/infrastructure";
    try {
        let infrastructure = new Infrastructure(req.body);
        let createUser = req.headers['userid'];
        let clientName = req.headers['clientname'];
        if (req.body.imageContent === undefined) {
            infrastructure.imageContent = "";
        };
        infrastructure.createUserId = createUser;
        infrastructure.createdBy = createUser;
        infrastructure.operatorId = await addOperatorId(createUser)
        infrastructure.clientName = clientName;
        const validation = validateFields(infrastructure, req.body)
        if (!validation?.auth) {
            console.error(`[${context}] Error - `, validation?.code ? validation.code : validation);
            return res.status(400).send(validation?.message ? validation?.message : "Invalid input Fields");
        }

        if (infrastructure.imageContent !== "") {
            try {
                infrastructure = await saveImageContent(infrastructure)
            } catch (error) {
                console.error(`[${context}][saveImageContent][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            }
        }
        createInfrastructure(infrastructure, res);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/infrastructure/runFirstTime', async (req, res, next) => {
    let context = "POST /api/private/infrastructure/runFirstTime";
    try {
        updateAddressModel();
        return res.status(200).send("OK");

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
//========== PUT ==========
//Add a charger to a group of infrastructure
router.put('/api/private/infrastructure', (req, res, next) => {
    var context = "PUT /api/private/infrastructure";
    try {
        var received = req.body;
        var query = {
            _id: received._id
        };
        findOneInfrastructure(query)
            .then((infrastructureFound) => {
                if (infrastructureFound) {
                    const addCharger = (charger) => {
                        return new Promise((resolve, reject) => {
                            var found = infrastructureFound.listChargers.find(chargers => {
                                return chargers.chargerId == charger.chargerId;
                            });
                            if (found == undefined) {
                                updateInfrastructureOnCharger(charger, "PUT", received._id);
                                infrastructureFound.listChargers.push(charger);
                                resolve(true);
                            }
                            else
                                resolve(false);
                        });
                    };
                    Promise.all(
                        received.chargers.map(charger => addCharger(charger))
                    ).then((value) => {
                        if (value.length == 1 && value[0] == false)
                            return res.status(400).send({ auth: false, code: 'server_charger_already_group', message: "Charger is already in the group" });
                        else {
                            var newValues = { $set: infrastructureFound };
                            updateInfrastructure(newValues, query)
                                .then((result) => {
                                    if (result) {
                                        getChargers(infrastructureFound)
                                            .then((infrastructureFound) => {
                                                return res.status(200).send(infrastructureFound);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    } else
                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                })
                                .catch((error) => {
                                    console.error(`[${context}][updateInfrastructure][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        };
                    });
                }
                else {
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

//========== PATCH ==========
//Update a infrastructure
router.patch('/api/private/infrastructure', async (req, res, next) => {
    let context = "PATCH /api/private/infrastructure";
    try {
        const received = req.body;
        const validation = validateInfrastructurePatchFields(received)
        if (!validation.auth) {
            console.error(`[${context}] Error - `, validation?.code ? validation.code : validation);
            return res.status(400).send(validation?.message ? validation?.message : "Invalid input Fields");
        }
        let query = {
            _id: received._id
        };
        let infrastructureFound = await findOneInfrastructure(query)
        if (!infrastructureFound) return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });

        infrastructureFound.name = received.name;
        infrastructureFound.address = received.address ? received.address : infrastructureFound.address
        infrastructureFound.CPE = received.CPE ? received.CPE : infrastructureFound.CPE;

        // check if needs to do some image work
        if ((received.imageContent == "" && infrastructureFound.imageContent != "") || (received?.imageContent && received.imageContent.includes('base64'))) {
            await unlinkImage(infrastructureFound)

            if (received?.imageContent && received?.imageContent.includes('base64')) {
                const savedImage = await saveImageContent(received)
                infrastructureFound.imageContent = savedImage.imageContent;
            } else {
                infrastructureFound.imageContent = "";
            }
        }
        let result = await updateInfrastructure({ $set: infrastructureFound }, query)
        if (!result) return res.status(400).send({ auth: false, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });

        infrastructureFound = await getChargers(infrastructureFound)
        if (infrastructureFound) return res.status(200).send(infrastructureFound);
        return res.status(500).send("Server error getChargers");
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Update Access type of an infrastructure
//Deprecated
/**
 * @deprecated Since version 0.16. Will be deleted in version 0.20. Use xxx instead.
 */
router.patch('/api/private/infrastructure/updateAccessType', (req, res, next) => {
    var context = "PATCH /api/private/infrastructure/updateAccessType";
    console.warn("[Warning] Deprecated method called");
    try {
        var received = req.body;
        var query = {
            _id: received._id
        };
        findOneInfrastructure(query)
            .then((infrastructureFound) => {
                if (infrastructureFound) {
                    if ((received.accessType === "Public") || (received.accessType === "Private") || (received.accessType === "FreeCharge")) {
                        infrastructureFound.accessType = received.accessType;
                        infrastructureFound.listOfGroups = [];
                    }
                    else {
                        infrastructureFound.accessType = received.accessType;
                        infrastructureFound.listOfGroups = received.listOfGroups;
                    };
                    var newValues = { $set: infrastructureFound };
                    updateInfrastructure(newValues, query)
                        .then((result) => {
                            if (result) {
                                updateAccessTypeChargers(infrastructureFound)
                                    .then((result) => {
                                        getChargers(infrastructureFound)
                                            .then((infrastructureFound) => {
                                                return res.status(200).send(infrastructureFound);
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateAccessTypeChargers][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            } else
                                return res.status(400).send({ auth: false, code: 'server_chargers_removed_unsuccessfully', message: "Chargers removed unsuccessfully" });
                        })
                        .catch((error) => {
                            console.error(`[${context}][updateInfrastructure][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });
                };
            })
            .catch((error) => {
                console.error(`[${context}][findOneInfrastructure] Error `, error.message);
                return res.status(500).send(error.message);
            });

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Remove charger from an infrastructure
router.patch('/api/private/infrastructure/removeCharger', (req, res, next) => {
    var context = "PATCH /api/private/infrastructure/removeCharger";
    try {
        var received = req.body;
        var query = {
            _id: received._id
        };
        if (received.chargers.length == 0) {
            return res.status(400).send({ auth: false, code: 'server_no_chargers_remove', message: "No chargers to remove" });
        } else {
            findOneInfrastructure(query)
                .then((infrastructureFound) => {
                    if (infrastructureFound) {
                        if (infrastructureFound.listChargers.length == 0) {
                            return res.status(400).send({ auth: false, code: 'server_no_chargers_remove', message: "No chargers to remove" });
                        } else {
                            const removeChargers = (charger) => {
                                return new Promise((resolve) => {
                                    var listChargers = infrastructureFound.listChargers.filter((chargers) => {
                                        if (chargers.chargerId == charger.chargerId) {
                                            updateInfrastructureOnCharger(charger, "PATCH", received._id);
                                        }
                                        return chargers.chargerId != charger.chargerId;
                                    });
                                    infrastructureFound.listChargers = listChargers;
                                    resolve(true);
                                });
                            };
                            Promise.all(
                                received.chargers.map(charger => removeChargers(charger))
                            ).then(() => {
                                var newValues = { $set: infrastructureFound };
                                updateInfrastructure(newValues, query)
                                    .then((result) => {
                                        if (result) {
                                            getChargers(infrastructureFound)
                                                .then((infrastructureFound) => {
                                                    return res.status(200).send(infrastructureFound);
                                                })
                                                .catch((error) => {
                                                    console.error(`[${context}][getChargers][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        } else
                                            return res.status(400).send({ auth: false, code: 'server_chargers_removed_unsuccessfully', message: "Chargers removed unsuccessfully" });
                                    })
                                    .catch((error) => {
                                        console.error(`[${context}][updateInfrastructure][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            });
                        };
                    } else {
                        return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][findOneFleet][.catch] Error `, error.message);
                    return res.status(500).send(error.message);
                });
        };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//remove an infrastructure
router.delete('/api/private/infrastructure', async (req, res, next) => {
    const context = "DELETE /api/private/infrastructure";
    try {
        const infrastructures = req.body;

        const query = { _id: ObjectId(infrastructures._id) };

        if (!(await removeChargerInfrastructure(infrastructures))) {
            console.error(`[${context}] removeChargerInfrastructure Error - Fail to remove infrastructure`);
            return res.status(500).send(new Error("Fail to remove infrastructure"));
        }

        const infrastructureFound = await Infrastructure.findOne(query)
        if (!infrastructureFound) {
            console.error(`[${context}] Error - Infrastructure not found`);
            return res.status(500).send(new Error("Infrastructure not found"));
        }

        // Corrected validation
        if (infrastructureFound.imageContent && infrastructureFound.imageContent !== "") {
            await unlinkImage(infrastructureFound);
        }

        const result = await Infrastructure.removeInfrastructure(query);
        if (!result) return res.status(400).send({ auth: false, code: 'server_infrastructure_not_found', message: "Infrastructure not found for given parameters" });

        return res.status(200).send({ auth: true, code: 'server_infrastructure_group_removed', message: "Infrastructure group removed" });

    } catch (error) {
        if (error.auth != undefined) return res.status(400).send(error);
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    }
})

//remove an infrastructure
router.delete('/api/private/infrastructure/user', (req, res, next) => {
    var context = "DELETE /api/private/infrastructure/user";
    try {
        var userId = req.headers['userid'];
        var query = {
            createUserId: userId
        };
        findInfrastructure(query)
            .then((infrastructuresFound) => {
                if (infrastructuresFound.length === 0) {
                    return res.status(200).send([]);
                }
                else {
                    Promise.all(
                        infrastructuresFound.map(infrastructure => {
                            return new Promise((resolve, reject) => {
                                var query = {
                                    _id: infrastructure._id
                                };
                                removeChargerInfrastructure(infrastructure)
                                    .then((value) => {
                                        Infrastructure.removeInfrastructure(query, (err, result) => {
                                            if (err) {
                                                console.error(`[${context}][findOne] Error `, err.message);
                                                reject(err);
                                            }
                                            else {
                                                if (result) {
                                                    resolve(true);
                                                } else {
                                                    resolve(false);
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
                console.error(`[${context}][findInfrastructure] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get my infrastructures
router.get('/api/private/infrastructure/myInfrastructure_old', (req, res, next) => {
    var context = "GET /api/private/infrastructure/myInfrastructure_old";
    try {
        var userId = req.headers['userid'];
        var query = {
            createUserId: userId
        };
        findInfrastructure(query)
            .then((infrastructureFound) => {
                if (infrastructureFound.length === 0)
                    return res.status(200).send(infrastructureFound);
                else {
                    var newInfrastructureFound = [];
                    Promise.all(
                        infrastructureFound.map(infrastructure => {
                            return new Promise((resolve, reject) => {
                                getChargers(infrastructure)
                                    .then((infrastructure) => {
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

router.get('/api/private/infrastructure/myInfrastructure', async (req, res, next) => {
    var context = "GET /api/private/infrastructure/myInfrastructure";
    try {
        var userId = req.headers['userid'];
        const myInfrastructures = await InfrastructuresHandler.getMyInfrastructures(userId)
        return res.status(200).send(myInfrastructures);

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//Get my infrastructures insights
router.get('/api/private/infrastructure/myInfrastructureInsights', (req, res, next) => {
    var context = "GET /api/private/infrastructure/myInfrastructureInsights";
    try {
        var userId = req.headers['userid'];
        var query = {
            createUserId: userId
        };

        findInfrastructure(query)
            .then((infrastructureFound) => {
                return res.status(200).send(infrastructureFound);
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

//Get others infrastructures
//Deprecated
/**
 * @deprecated Since version 0.16. Will be deleted in version 0.20. Use xxx instead.
 */
router.get('/api/private/infrastructure/othersInfrastructure_old', (req, res, next) => {
    var context = "GET /api/private/infrastructure/othersInfrastructure";
    try {
        var userId = req.headers['userid'];
        findMyGroupCSUsers(userId)
            //getGroupCSUsers(userId)
            .then((infrastructuresFound) => {
                infrastructuresFound.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
                return res.status(200).send(infrastructuresFound);
            })
            .catch((error) => {
                console.error(`[${context}][getGroupCSUsers] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get others infrastructures
router.get('/api/private/infrastructure/othersInfrastructure', async (req, res, next) => {
    var context = "GET /api/private/infrastructure/othersInfrastructure";
    try {
        var userId = req.headers['userid'];
        let groups = await getGroupsCSUsersMap(userId);
        let fleets = await getEVsMap(userId);
        //let fleets = await getFleetsMap(userId);
        var query;
        let result = new Promise((resolve, reject) => {
            if (groups.length === 0 && fleets.length === 0) {
                return res.status(200).send([]);

            }
            else if (groups.length > 0 && fleets.length === 0) {

                query = {
                    $or: [
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true
                };
                resolve();
            }
            else if (groups.length === 0 && fleets.length > 0) {

                query = {
                    $or: [
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true
                };
                resolve();

            }
            else {

                query = {
                    $or: [
                        {
                            'listOfFleets': {
                                $elemMatch: {
                                    'fleetId': fleets
                                }
                            }
                        },
                        {
                            'listOfGroups': {
                                $elemMatch: {
                                    'groupId': groups
                                }
                            }
                        }
                    ],
                    hasInfrastructure: true,
                    active: true
                };
                resolve();

            };
        });


        Promise.all([result])
            .then(() => {
                //query.createUserId = { $ne: userId }
                // console.log("query",)
                getOthersInfrastructure(query)
                    .then((infrastructuresFound) => {
                        infrastructuresFound.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
                        let newResponse = infrastructuresFound.filter(infra => {
                            return infra.createUserId !== userId
                        })
                        return res.status(200).send(newResponse);
                    })
                    .catch((error) => {
                        console.error(`[${context}][getGroupCSUsers] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
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

router.get('/api/private/infrastructure/getInfrastructure', (req, res, next) => {
    var context = "GET /api/private/infrastructure/getInfrastructure";
    try {
        var chargerId = req.query;
        var query = {
            listChargers: {
                $elemMatch: {
                    chargerId: chargerId.chargerId
                }
            }
        }
        findOneInfrastructure(query)
            .then((result) => {
                return res.status(200).send(result);
            })
            .catch((error) => {
                console.error(`[${context}][findOneInfrastructure] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTION ==========
//Function to validate fields received
function validateFields(infrastructure, extraVariables) {
    const context = "Function validateFields";
    try {
        if (!infrastructure) return { auth: false, code: 'server_infrastructure_data_required', message: 'Infrastructure data required' }
        if (!infrastructure.name) return { auth: false, code: 'server_nfrastructure_name_required', message: 'Infrastructure name is required' };
        if (!infrastructure.createUserId) return { auth: false, code: 'server_user_id_required', message: 'User id is required' };
        return { auth: true };
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: 'server_error', message: error.message };
    }
};

//Function to validate fields received on Infrastructure Patch
function validateInfrastructurePatchFields(inputData) {
    const context = "Function validateInfrastructurePatchFields";
    try {
        if (!inputData._id) return { auth: false, code: 'server_infrastructure_missing_id', message: 'Missing infrastructure id' }
        if (!inputData.name) return { auth: false, code: 'server_infrastructure_name_required', message: 'Infrastructure name is required' };
        return { auth: true };

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return { auth: false, code: 'server_error', message: error.message };
    }
}

//Function to save image on file
function saveImageContent(infrastructure) {
    var context = "Function saveImageContent";
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
                reject(new Error(err))
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
        try {
            const name = infrastructure.imageContent.split('/');
            const path = `/usr/src/app/img/infrastructures/${name[name.length - 1]}`;

            // Attempt to delete the file directly
            fs.unlink(path, (err) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        console.warn(`[${context}] File does not exist: ${path}`);
                    } else {
                        console.error(`[${context}] [fs.unlink] Error `, err.message);
                    }
                }
                // Always resolve to proceed regardless of the error
                resolve();
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            resolve(); // Resolve to avoid interruption
        }
    });
}

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

//Function to find infrastructure using query
function findInfrastructure(query) {
    var context = "Funciton findInfrastructure";
    return new Promise((resolve, reject) => {
        Infrastructure.find(query, (err, infrastructureFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err);
            } else {
                resolve(infrastructureFound);
            };
        });
    });
};

//Function to create an infrastructure
function createInfrastructure(infrastructure, res) {
    let context = "Funciton createInfrastructure";
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

//Function to get charger
function getChargers(infrastructureFound) {
    var context = "Funciton getChargers";
    return new Promise((resolve, reject) => {
        var listChargers = [];
        const getChargers = (charger) => {
            return new Promise((resolve, reject) => {
                var query = {
                    _id: charger.chargerId,
                    hasInfrastructure: true
                };
                Charger.findOne(query, async (err, chargerFound) => {
                    if (err) {
                        console.error(`[${context}][findOne] Error `, err.message);
                        reject(err);
                    } else {
                        if (chargerFound) {
                            chargerFound = JSON.parse(JSON.stringify(chargerFound));
                            chargerFound._id = charger._id;
                            chargerFound.chargerId = charger.chargerId;

                            let fees = await getFees(chargerFound);
                            if (fees !== false) {
                                chargerFound.fees = fees;
                            }

                            getTariffPlug(chargerFound)
                                .then((chargerFound) => {
                                    if (chargerFound.listOfGroups.length != 0) {
                                        getListOfGroups(chargerFound)
                                            .then((chargerFound) => {
                                                listChargers.push(chargerFound);
                                                resolve(true);
                                            });
                                    }
                                    else {
                                        listChargers.push(chargerFound);
                                        resolve(true);
                                    }
                                })
                                .catch((error) => {
                                    console.error(`[${context}][getTariffPlug][.catch] Error `, error.message);
                                    reject(error);
                                });
                        }
                        else {
                            listChargers.push(charger);
                            resolve(true);
                        };
                    };
                });
            });
        };
        Promise.all(
            infrastructureFound.listChargers.map(charger => getChargers(charger))
        ).then(() => {
            infrastructureFound = JSON.parse(JSON.stringify(infrastructureFound));
            listChargers.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
            infrastructureFound.listChargers = listChargers;
            resolve(infrastructureFound);
        }).catch((error) => {
            console.error(`[${context}][.catch] Error `, error.message);
            reject(error);
        });
    });
};

//Function to update access type of chargers
function updateAccessTypeChargers(infrastructureFound) {
    var context = "Funciton updateAccessTypeChargers";
    return new Promise((resolve, reject) => {
        const updateAccessTypeChargers = (charger) => {
            return new Promise((resolve, reject) => {
                var query = {
                    _id: charger.chargerId,
                    hasInfrastructure: true
                };
                Charger.findOne(query, (err, chargerFound) => {
                    if (err) {
                        console.error(`[${context}][findOne] Error `, err.message);
                        reject(err);
                    }
                    else {
                        if (chargerFound) {
                            chargerFound.accessType = infrastructureFound.accessType;
                            chargerFound.listOfGroups = infrastructureFound.listOfGroups;
                            var newValues = { $set: chargerFound };
                            Charger.updateCharger(query, newValues, (err, result) => {
                                if (err) {
                                    console.error(`[${context}][findOne] Error `, err.message);
                                    reject(err);
                                }
                                else {
                                    resolve(true);
                                };
                            });
                        }
                        else {
                            resolve(false);
                        };
                    };
                });
            });
        };
        Promise.all(
            infrastructureFound.listChargers.map(charger => updateAccessTypeChargers(charger))
        ).then((result) => {
            resolve(result);
        }).catch((error) => {
            console.error(`[${context}][Promise.all] Error `, error.message);
            reject(error);
        })
    });
};

//Function to get groups of charger station users
//Deprecated
function getGroupCSUsers(userId) {
    var context = "Funciton getGroupCSUsers";
    return new Promise((resolve, reject) => {
        var host = process.env.HostUser + process.env.PathGetGroupCSUsers;
        var headers = {
            userid: userId
        };
        axios.get(host, { headers })
            .then((value) => {
                var groupsCSUsers = value.data;
                if (groupsCSUsers.length == 0) {
                    resolve([]);
                }
                else {
                    var listGroupsCSUsersId = [];
                    Promise.all(
                        groupsCSUsers.map(group => {
                            return new Promise((resolve) => {
                                listGroupsCSUsersId.push(group._id);
                                resolve(true);
                            });
                        })
                    ).then(() => {
                        var query = {
                            'listOfGroups': {
                                $elemMatch: {
                                    groupId: listGroupsCSUsersId
                                }
                            }
                        };
                        var fields = {
                            _id: 1,
                            infrastructure: 1
                        };
                        getChargersByQuery(query, fields)
                            .then((chargersFound) => {
                                if (chargersFound.length == 0) {
                                    resolve([]);
                                }
                                else {
                                    var listOfChargersId = [];
                                    Promise.all(
                                        chargersFound.map(charger => {
                                            return new Promise((resolve) => {
                                                listOfChargersId.push(charger._id);
                                                resolve(true);
                                            });
                                        })
                                    ).then(() => {
                                        var query = {
                                            'listChargers': {
                                                $elemMatch: {
                                                    chargerId: listOfChargersId
                                                }
                                            }
                                        };
                                        findInfrastructure(query)
                                            .then((infrastructureFound) => {
                                                if (infrastructureFound.length == 0) {
                                                    resolve([]);
                                                }
                                                else {
                                                    organizeInfrastructureList(infrastructureFound, chargersFound)
                                                        .then((infrastructureFound) => {
                                                            var newInfrastructureFound = [];
                                                            Promise.all(
                                                                infrastructureFound.map(infrastructure => {
                                                                    return new Promise((resolve, reject) => {
                                                                        getChargers(infrastructure)
                                                                            .then((infrastructure) => {
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
                                                                resolve(newInfrastructureFound);
                                                            }).catch((error) => {
                                                                console.error(`[${context}][.catch] Error `, error.message);
                                                                reject(error);
                                                            });
                                                        });
                                                };
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][findInfrastructure] Error `, error.message);
                                                reject(error);
                                            });
                                    });
                                };
                            })
                            .catch((error) => {
                                console.error(`[${context}][getChargersByQuery] Error `, error.message);
                                reject(error);
                            });
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
};

//Function to get groups of charger station users
function findMyGroupCSUsers(userId) {
    var context = "Funciton findMyGroupCSUsers";
    return new Promise((resolve, reject) => {
        var host = process.env.HostUser + process.env.PathGetGroupCSUsers;
        var headers = {
            userid: userId
        };
        axios.get(host, { headers })
            .then((value) => {
                var groupsCSUsers = value.data;
                if (groupsCSUsers.length == 0) {
                    resolve([]);
                }
                else {
                    var listGroupsCSUsersId = [];
                    Promise.all(
                        groupsCSUsers.map(group => {
                            return new Promise((resolve) => {
                                listGroupsCSUsersId.push(group._id);
                                resolve(true);
                            });
                        })
                    ).then(() => {
                        var query = {
                            'listOfGroups': {
                                $elemMatch: {
                                    groupId: listGroupsCSUsersId
                                }
                            },
                            hasInfrastructure: true,
                            active: true
                        };
                        getChargersByQuery(query)
                            .then((chargersFound) => {
                                if (chargersFound.length == 0) {
                                    resolve([]);
                                }
                                else {
                                    var listOfInfrastructure = []
                                    var listOfChargers = []
                                    Promise.all(
                                        chargersFound.map(charger => {
                                            return new Promise(async (resolve, reject) => {
                                                try {
                                                    let newCharger = await getTariffPlug(charger);

                                                    let fees = await getFees(newCharger);
                                                    if (fees !== false) {
                                                        newCharger.fees = fees;
                                                    }

                                                    if (charger.listOfGroups.length != 0) {
                                                        let finalCharger = await getListOfGroups(newCharger);
                                                        listOfChargers.push(finalCharger);
                                                        listOfInfrastructure.push(charger.infrastructure);
                                                        resolve(true);
                                                    }
                                                    else {
                                                        listOfChargers.push(newCharger);
                                                        listOfInfrastructure.push(charger.infrastructure);
                                                        resolve(true);
                                                    };
                                                }
                                                catch (error) {
                                                    console.error(`[${context}][chargersFound.map] Error `, error.message);
                                                    reject(error);
                                                };
                                            });
                                        })
                                    ).then(() => {
                                        var query = {
                                            _id: listOfInfrastructure
                                        };
                                        findInfrastructure(query)
                                            .then(async (infrastructuresFound) => {
                                                try {
                                                    let newListOfInfrastructure = await putChargersInfrastructures(infrastructuresFound, listOfChargers)
                                                    resolve(newListOfInfrastructure);
                                                } catch (error) {
                                                    console.error(`[${context}][putChargersInfrastructures] Error `, error.message);
                                                    reject(error);
                                                };
                                            })
                                            .catch((error) => {
                                                console.error(`[${context}][findInfrastructure] Error `, error.message);
                                                reject(error);
                                            });
                                        //resolve(infrastructuresFound);
                                    });
                                };
                            })
                            .catch((error) => {
                                console.error(`[${context}][getChargersByQuery] Error `, error.message);
                                reject(error);
                            });
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            });
    });
};

function getOthersInfrastructure(query) {
    var context = "Funciton getOthersInfrastructure";
    return new Promise((resolve, reject) => {
        getChargersByQuery(query)
            .then((chargersFound) => {
                if (chargersFound.length == 0) {
                    resolve([]);
                }
                else {
                    var listOfInfrastructure = []
                    var listOfChargers = []
                    Promise.all(
                        chargersFound.map(charger => {
                            return new Promise(async (resolve, reject) => {
                                try {
                                    let newCharger = await getTariffPlug(charger);

                                    let fees = await getFees(newCharger);
                                    if (fees !== false) {
                                        newCharger.fees = fees;
                                    }

                                    if (charger.listOfGroups.length != 0) {
                                        let finalCharger = await getListOfGroups(newCharger);
                                        listOfChargers.push(finalCharger);
                                        listOfInfrastructure.push(charger.infrastructure);
                                        resolve(true);
                                    }
                                    else {
                                        listOfChargers.push(newCharger);
                                        listOfInfrastructure.push(charger.infrastructure);
                                        resolve(true);
                                    };
                                }
                                catch (error) {
                                    console.error(`[${context}][chargersFound.map] Error `, error.message);
                                    reject(error);
                                };
                            });
                        })
                    ).then(() => {
                        var query = {
                            _id: listOfInfrastructure
                        };
                        findInfrastructure(query)
                            .then(async (infrastructuresFound) => {
                                try {
                                    let newListOfInfrastructure = await putChargersInfrastructures(infrastructuresFound, listOfChargers)
                                    resolve(newListOfInfrastructure);
                                } catch (error) {
                                    console.error(`[${context}][putChargersInfrastructures] Error `, error.message);
                                    reject(error);
                                };
                            })
                            .catch((error) => {
                                console.error(`[${context}][findInfrastructure] Error `, error.message);
                                reject(error);
                            });
                        //resolve(infrastructuresFound);
                    });
                };
            })
            .catch((error) => {
                console.error(`[${context}][getChargersByQuery] Error `, error.message);
                reject(error);
            });
    });
};

//Function to get chargers by query
function getChargersByQuery(query, fields) {
    var context = "Funciton getChargersByQuery";
    return new Promise((resolve, reject) => {
        Charger.find(query, fields, (err, chargersFound) => {
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

//Deprecated
function organizeInfrastructureList(infrastructureFound, chargersFound) {
    var context = "Funciton organizeInfrastructureList";
    return new Promise((resolve, reject) => {
        var newListInfrastructure = [];
        const getDate = (infrastructure) => {
            return new Promise((resolve) => {
                var newInfrastructure = JSON.parse(JSON.stringify(infrastructure));
                var listOfChargers = [];
                const verifyData = (charger) => {
                    return new Promise(resolve => {
                        var found = newInfrastructure.listChargers.find(element => {
                            return element.chargerId == charger._id;
                        });
                        if (found) {
                            listOfChargers.push(found);
                            resolve(true);
                        }
                        else {
                            resolve(true);
                        };
                    });
                };
                Promise.all(
                    chargersFound.map(charger => verifyData(charger))
                )
                    .then(() => {
                        newInfrastructure.listChargers = listOfChargers;
                        newListInfrastructure.push(newInfrastructure);
                        resolve(true);
                    });
            });
        };
        Promise.all(
            infrastructureFound.map(infrastructure => getDate(infrastructure))
        ).then(() => {
            resolve(newListInfrastructure);
        });
    });
};

function updateInfrastructureOnCharger(charger, action, infrastructureId) {
    var context = "Funciton updateInfrastructureOnCharger";
    try {

        var query = {
            _id: charger.chargerId,
            hasInfrastructure: true
        };

        chargerFindOne(query)
            .then((chargerFound) => {
                if (chargerFound) {
                    if (action === "PUT") {
                        chargerFound.infrastructure = infrastructureId;
                        chargerFound.hasInfrastructure = true;
                        chargerFound.active = true;
                    }
                    else if (action === "PATCH") {
                        chargerFound.infrastructure = "";
                        chargerFound.hasInfrastructure = false;
                        chargerFound.active = false;
                    }
                    else {
                        console.error(`[${context}] unknown action`);
                    };
                    var newValue = { $set: chargerFound };
                    updateCharger(query, newValue)
                        .then((result) => {
                            if (result) {
                                console.error(`[${context}] updated`);
                            }
                            else {
                                console.error(`[${context}] Not updated`);
                            };
                        })
                        .catch((error) => {
                            console.error(`[${context}][updateCharger] Error `, error.message);
                        });
                };
            })
            .catch((error) => {
                console.error(`[${context}][chargerFindOne] Error `, error.message);
            });
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
    };
};

function chargerFindOne(query) {
    var context = "Funciton chargerFindOne";
    return new Promise((resolve, reject) => {
        Charger.findOne(query, (err, chargerFound) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(chargerFound);
            };
        });
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

function updateCharger(query, newValue) {
    var context = "Funciton updateCharger";
    return new Promise((resolve, reject) => {
        Charger.updateCharger(query, newValue, (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
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
                                        const query = {
                                            _id: tariff.groupId
                                        };
                                        findOneGroupCSUser(query)
                                            .then((groupCSUsers) => {
                                                if (groupCSUsers?.imageContent)
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
                                        const query = {
                                            _id: tariff.groupId
                                        };
                                        findOneGroupCSUser(query)
                                            .then((groupCSUsers) => {
                                                if (groupCSUsers?.imageContent)
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

function putChargersInfrastructures(infrastructuresFound, listOfChargers) {
    var context = "Funciton putChargersInfrastructures";
    return new Promise((resolve, reject) => {
        infrastructuresFound = JSON.parse(JSON.stringify(infrastructuresFound));
        var listOfInfrastructures = [];
        Promise.all(
            listOfChargers.map(charger => {
                return new Promise((resolve, reject) => {
                    var found = infrastructuresFound.find(infrastructure => {
                        return infrastructure._id === charger.infrastructure;
                    });
                    if (found) {
                        charger.chargerId = charger._id;
                        var index = listOfInfrastructures.indexOf(listOfInfrastructures.find(infra => {
                            return infra._id === found._id;
                        }));
                        if (index >= 0) {
                            listOfInfrastructures[index].listChargers.push(charger);
                            resolve(true);
                        }
                        else {
                            found.listChargers = [];
                            found.listChargers.push(charger);
                            listOfInfrastructures.push(found);
                            resolve(true);
                        };
                    }
                    else {
                        resolve(false);
                    };
                });
            })
        ).then(() => {
            resolve(listOfInfrastructures);
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

function removeChargerInfrastructure(infrastructures) {
    let context = "Funciton removeChargerInfrastructure";
    return new Promise(async (resolve, reject) => {
        try {
            const query = { infrastructure: ObjectId(infrastructures._id) }

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

                                const query = { _id: ObjectId(chargerFound._id) };
                                const queryHwId = { hwId: chargerFound.hwId };
                                const queryChargerId = { chargerId: chargerFound._id };;

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

function getGroupsCSUsersMap(user) {
    var context = "Function getGroupsCSUsersMap";
    return new Promise((resolve, reject) => {
        try {
            var headers = { userid: user };
            var host = process.env.HostUser + process.env.PathGetGroupCSUsersMap;
            axios.get(host, { headers })
                .then((result) => {
                    resolve(result.data);
                })
                .catch((error) => {
                    console.error(`[${context}][get][.catch] Error `, error.message);
                    //reject(error.response.data);
                    resolve([]);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            //reject(error);
            resolve([]);
        };
    });
};

function getEVsMap(user) {
    var context = "Function getEVsMap";
    return new Promise((resolve, reject) => {
        try {
            var headers = { userid: user };
            var host = process.env.HostEvs + process.env.PathGetAllEVsByUser;
            axios.get(host, { headers })
                .then((result) => {
                    if (result.data.length > 0) {

                        var listFleet = [];
                        Promise.all(
                            result.data.map(ev => {
                                return new Promise((resolve, reject) => {
                                    listFleet.push(ev.fleet);
                                    resolve(true);
                                });
                            })
                        ).then(() => {
                            resolve(listFleet);
                        })

                    }
                    else {
                        resolve([]);
                    };
                })
                .catch((error) => {
                    console.error(`[${context}][get][.catch] Error `, error.message);
                    //reject(error.response.data);
                    resolve([]);
                });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            //reject(error);
            resolve([]);
        };
    });
};

async function addOperatorId(createUser) {
    let context = "addOperatorId function"
    try {

        let userFound = await fetchUserById(createUser)
        if (userFound) {
            return userFound.operatorId
        } else {
            return ""
        }

    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return ""
    }
}

async function fetchUserById(userId) {
    let context = "fetchUserOperator function"

    try {
        let host = process.env.HostUser + process.env.PathGetUserById;
        let params = {
            _id: userId
        }

        const response = await axios.get(host, { params })
        return response.data
    } catch (error) {
        console.error(`[${context}][axios.get] Error `, error.message);
        return null
    }
};

async function updateAddressModel() {
    const context = "Function updateAddressModel"
    try {

        await Infrastructure.updateMany({ 'address.address': { '$exists': true } }, [{ $set: { 'address.street': "$address.address" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.address to address.street: ");
            };
        })

        await Infrastructure.updateMany({ 'address.postCode': { '$exists': true } }, [{ $set: { 'address.zipCode': "$address.postCode" } }], (err, result) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            }
            else {
                console.log("result address.postCode to address.zipCode: ");
            };
        })

        let infrastructures = await Infrastructure.find({ 'address.country': { '$exists': true } })

        let unicCountries = []

        for (let i = 0; i != infrastructures.length; i++) {
            if (infrastructures[i].address)
                if (infrastructures[i].address.country)
                    if (unicCountries.indexOf(infrastructures[i].address.country) == -1) {
                        unicCountries.push(infrastructures[i].address.country)
                    }
        }

        let coutryCodes = []

        for (let i = 0; i != unicCountries.length; i++) {
            coutryCodes.push(getCode(unicCountries[i]))
        }

        // console.log("coutryCodes")
        // console.log(coutryCodes)

        // console.log("unicCountries")
        // console.log(unicCountries)

        for (let i = 0; i != coutryCodes.length; i++) {
            if (coutryCodes[i] != undefined) {
                await Infrastructure.updateMany({ 'address.country': unicCountries[i] }, [{ $set: { 'address.countryCode': coutryCodes[i] } }], (err, result) => {
                    if (err) {
                        console.error(`[${context}] Error `, err.message);
                    }
                    else {
                        console.log("result " + unicCountries[i] + " to " + coutryCodes[i] + ": ", result);
                    };
                })
            }
            else {
                console.log("WRONG Country found: " + unicCountries[i])
            }
        }


    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

module.exports = router;
