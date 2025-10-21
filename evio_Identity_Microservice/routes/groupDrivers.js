require("dotenv-safe").load();
const express = require('express');
const router = express.Router();
const GroupDriversDependencies = require('../models/groupDriversDependencies');
const GroupDrivers = require('../models/groupDrivers');
const GroupDriversHandler = require('../controllers/groupDrivers');
const User = require('../models/user');
const fs = require('fs');
const axios = require("axios");
const { logger } = require('../utils/constants');

//========== POST ==========
//Create a group Driver
router.post('/api/private/groupDrivers', (req, res, next) => {
    const context = "POST /api/private/groupDrivers";
    try {
        const createUser = req.headers['userid'];
        const clientName = req.headers['clientname'];
        const groupsDrivers = new GroupDrivers(req.body);

        if (groupsDrivers.imageContent === undefined) {
            groupsDrivers.imageContent = "";
        };

        groupsDrivers.createUser = createUser;
        groupsDrivers.clientName = clientName;

        validateFields(groupsDrivers)
            .then(() => {
                if (groupsDrivers.listOfDrivers.length == 0) {
                    //Listo of drivers are empty
                    var query = {
                        _id: createUser
                    };
                    findOneUser(query)
                        .then((userFound) => {
                            var newDriver = {
                                driverId: userFound._id,
                                name: userFound.name,
                                mobile: userFound.mobile,
                                internationalPrefix: userFound.internationalPrefix,
                                active: true,
                                admin: true
                            };
                            groupsDrivers.listOfDrivers.push(newDriver);
                            if (groupsDrivers.imageContent === "") {
                                //No image
                                var query = {
                                    $and: [
                                        { name: groupsDrivers.name },
                                        { createUser: groupsDrivers.createUser }
                                    ]
                                };
                                groupsDriversFindOne(query)
                                    .then((groupDriversFound) => {
                                        if (groupDriversFound) {
                                            return res.status(400).send({ auth: false, code: 'server_group_name_exist', message: "Group name already exist" });
                                        }
                                        else {
                                            groupsDriversCreate(groupsDrivers)
                                                .then((result) => {
                                                    if (result)
                                                        return res.status(200).send(result);
                                                    else
                                                        return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][groupsDriversCreate][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][groupsDriversFindOne][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            }
                            else {
                                //with image
                                var query = {
                                    $and: [
                                        { name: groupsDrivers.name },
                                        { createUser: groupsDrivers.createUser }
                                    ]
                                };
                                groupsDriversFindOne(query)
                                    .then((groupDriversFound) => {
                                        if (groupDriversFound) {
                                            return res.status(400).send({ auth: false, code: 'server_group_name_exist', message: "Group name already exist" });
                                        }
                                        else {
                                            saveImageContent(groupsDrivers)
                                                .then((groupsDrivers) => {
                                                    groupsDriversCreate(groupsDrivers)
                                                        .then((result) => {
                                                            if (result)
                                                                return res.status(200).send(result);
                                                            else
                                                                return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                        })
                                                        .catch((error) => {
                                                            console.log(`[${context}][groupsDriversCreate][.catch] Error `, error.message);
                                                            return res.status(500).send(error.message);
                                                        });
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][saveImageContent][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][groupsDriversFindOne][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            };
                        })
                        .catch((error) => {
                            console.log(`[${context}][findOneUser][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    //Driver list is not empty
                    var found = groupsDrivers.listOfDrivers.find(driver => {
                        return driver.driverId == createUser
                    });
                    if (found) {
                        if (groupsDrivers.imageContent == "") {
                            //No image
                            var query = {
                                $and: [
                                    { name: groupsDrivers.name },
                                    { createUser: groupsDrivers.createUser }
                                ]
                            };
                            groupsDriversFindOne(query)
                                .then((groupDriversFound) => {
                                    if (groupDriversFound) {
                                        return res.status(400).send({ auth: false, code: 'server_group_name_exist', message: "Group name already exist" });
                                    }
                                    else {
                                        verifyUsers(groupsDrivers, clientName)
                                            .then((groupsDrivers) => {
                                                groupsDriversCreate(groupsDrivers)
                                                    .then((result) => {
                                                        if (result)
                                                            return res.status(200).send(result);
                                                        else
                                                            return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][groupsDriversCreate][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });

                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][verifyUsers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    };
                                })
                                .catch((error) => {
                                    console.log(`[${context}][groupsDriversFindOne][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            //with image
                            var query = {
                                $and: [
                                    { name: groupsDrivers.name },
                                    { createUser: groupsDrivers.createUser }
                                ]
                            };
                            groupsDriversFindOne(query)
                                .then((groupDriversFound) => {
                                    if (groupDriversFound) {
                                        return res.status(400).send({ auth: false, code: 'server_group_name_exist', message: "Group name already exist" });
                                    }
                                    else {
                                        saveImageContent(groupsDrivers)
                                            .then((groupsDrivers) => {
                                                verifyUsers(groupsDrivers, clientName)
                                                    .then((groupsDrivers) => {
                                                        groupsDriversCreate(groupsDrivers)
                                                            .then((result) => {
                                                                if (result)
                                                                    return res.status(200).send(result);
                                                                else
                                                                    return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][groupsDriversCreate][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });

                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][verifyUsers][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][saveImageContent][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    };
                                })
                                .catch((error) => {
                                    console.log(`[${context}][groupsDriversFindOne][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        };
                    }
                    else {
                        var query = {
                            _id: createUser
                        };
                        findOneUser(query)
                            .then((userFound) => {
                                var newDriver = {
                                    driverId: userFound._id,
                                    name: userFound.name,
                                    mobile: userFound.mobile,
                                    internationalPrefix: userFound.internationalPrefix,
                                    active: true,
                                    admin: true
                                };
                                groupsDrivers.listOfDrivers.push(newDriver);
                                if (groupsDrivers.imageContent == "") {
                                    //No image
                                    var query = {
                                        $and: [
                                            { name: groupsDrivers.name },
                                            { createUser: groupsDrivers.createUser }
                                        ]
                                    };
                                    groupsDriversFindOne(query)
                                        .then((groupDriversFound) => {
                                            if (groupDriversFound) {
                                                return res.status(400).send({ auth: false, code: 'server_group_name_exist', message: "Group name already exist" });
                                            }
                                            else {
                                                verifyUsers(groupsDrivers, clientName)
                                                    .then((groupsDrivers) => {
                                                        groupsDriversCreate(groupsDrivers)
                                                            .then((result) => {
                                                                if (result)
                                                                    return res.status(200).send(result);
                                                                else
                                                                    return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][groupsDriversCreate][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });

                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][verifyUsers][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            };
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][groupsDriversFindOne][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                }
                                else {
                                    //with image
                                    var query = {
                                        $and: [
                                            { name: groupsDrivers.name },
                                            { createUser: groupsDrivers.createUser }
                                        ]
                                    };
                                    groupsDriversFindOne(query)
                                        .then((groupDriversFound) => {
                                            if (groupDriversFound) {
                                                return res.status(400).send({ auth: false, code: 'server_group_name_exist', message: "Group name already exist" });
                                            }
                                            else {
                                                saveImageContent(groupsDrivers)
                                                    .then((groupsDrivers) => {
                                                        verifyUsers(groupsDrivers, clientName)
                                                            .then((groupsDrivers) => {
                                                                groupsDriversCreate(groupsDrivers)
                                                                    .then((result) => {
                                                                        if (result)
                                                                            return res.status(200).send(result);
                                                                        else
                                                                            return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                                    })
                                                                    .catch((error) => {
                                                                        console.log(`[${context}][groupsDriversCreate][.catch] Error `, error.message);
                                                                        return res.status(500).send(error.message);
                                                                    });

                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][verifyUsers][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });
                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][saveImageContent][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            };
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][groupsDriversFindOne][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][findOneUser][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });

                    };
                };
            })
            .catch((error) => {
                if (error.auth != undefined)
                    return res.status(400).send(error);
                else {
                    console.log(`[${context}][validateFields][.catch] Error `, error.message);
                    return res.status(500).send(error.message);
                }
            })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.post('/api/private/groupDrivers/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/groupDrivers/runFirstTime";
    try {
        return res.status(200).send("OK");
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========
//Add drivert to a group driver
router.put('/api/private/groupDrivers', (req, res, next) => {
    var context = "PUT /api/private/groupDrivers";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupsDriversFindOne(query)
            .then((groupDriversFound) => {
                if (groupDriversFound) {
                    confirmExist(groupDriversFound, received)
                        .then((groupDriversFound) => {
                            var newValues = { $set: groupDriversFound };
                            groupsDriversUpdate(query, newValues)
                                .then((result) => {
                                    if (result) {
                                        getGroupDrivers(groupDriversFound, userId)
                                            .then((groupDriversFound) => {
                                                return res.status(200).send(groupDriversFound);
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    } else
                                        return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][groupsDriversUpdate][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        })
                        .catch((error) => {
                            console.log(`[${context}][confirmExist][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupsDriversFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to put an user to admin of the group
router.put('/api/private/groupDrivers/putAdmin', (req, res, next) => {
    var context = "PUT /api/private/groupDrivers/putAdmin";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupsDriversFindOne(query)
            .then((groupDriversFound) => {
                if (groupDriversFound) {
                    var found = groupDriversFound.listOfDrivers.indexOf(groupDriversFound.listOfDrivers.find(driver => {
                        return driver.driverId == received.userId;
                    }));
                    if (found >= 0) {
                        groupDriversFound.listOfDrivers[found].admin = true;
                        var newValue = { $set: groupDriversFound };
                        groupsDriversUpdate(query, newValue)
                            .then((result) => {
                                if (result) {
                                    getGroupDrivers(groupDriversFound, userId)
                                        .then((groupDriversFound) => {
                                            return res.status(200).send(groupDriversFound);
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                } else
                                    return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                            })
                            .catch((error) => {
                                console.log(`[${context}][groupsDriversUpdate][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_user_not_belong', message: "User does not belong to the group" });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupsDriversFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Remove drivers from a group driver
router.patch('/api/private/groupDrivers', (req, res, next) => {
    var context = "PATCH /api/private/groupDrivers";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupsDriversFindOne(query)
            .then((groupDriversFound) => {
                if (groupDriversFound) {
                    if (groupDriversFound.listOfDrivers.length == 0) {
                        return res.status(400).send({ auth: false, code: 'server_no_drivers_to_remove', message: "No drivers to remove" });
                    }
                    else {
                        const removeDriver = (driver) => {
                            return new Promise((resolve) => {
                                var found = groupDriversFound.listOfDrivers.indexOf(groupDriversFound.listOfDrivers.find(element => {
                                    return element.mobile == driver.mobile;
                                }));
                                if (found >= 0) {
                                    console.log
                                    if (groupDriversFound.listOfDrivers[found].mobile == driver.mobile && groupDriversFound.listOfDrivers[found].internationalPrefix == driver.internationalPrefix && groupDriversFound.listOfDrivers[found].driverId == driver.driverId) {
                                        groupDriversFound.listOfDrivers.splice(found, 1);
                                        resolve(true);
                                    }
                                    else {
                                        resolve(true);
                                    };
                                }
                                else {
                                    resolve(true);
                                };
                            });
                        };
                        Promise.all(
                            received.listOfDrivers.map(driver => removeDriver(driver))
                        ).then(() => {
                            var newValues = { $set: groupDriversFound };
                            GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                    return res.status(500).send(err.message);
                                } else {
                                    if (result) {
                                        getGroupDrivers(groupDriversFound, userId)
                                            .then((groupDriversFound) => {
                                                return res.status(200).send(groupDriversFound);
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    }
                                    else
                                        return res.status(400).send({ auth: false, code: 'server_divers_unsuccessfully_removed', message: "Divers unsuccessfully removed" });
                                }
                            });
                        });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupsDriversFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//update group drivers
router.patch('/api/private/groupDrivers/update', (req, res, next) => {
    var context = "PATCH /api/private/groupDrivers/update";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            name: received.name,
            createUser: userId
        };
        GroupDrivers.findOne(query, (err, groupDriversFound) => {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                if (groupDriversFound) {
                    if (groupDriversFound._id != received._id)
                        return res.status(400).send({ auth: false, code: 'server_group_name_exist', message: "Group name already exist" });
                    else {

                        var query = {
                            _id: groupDriversFound._id
                        };

                        //Verifica se é para remover a imagem, alterar ou manter
                        if (received.imageContent == "" && groupDriversFound.imageContent != "") {

                            removeImageContent(groupDriversFound)
                                .then(() => {
                                    groupDriversFound.imageContent = "";
                                    var newValues = { $set: groupDriversFound };
                                    GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                        if (err) {
                                            console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            if (result) {
                                                getGroupDrivers(groupDriversFound, userId)
                                                    .then((groupDriversFound) => {
                                                        return res.status(200).send(groupDriversFound);
                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            }
                                            else
                                                return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                        }
                                    });
                                })
                                .catch(error => {
                                    console.log(`[${context}][removeImageContent] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });

                        }
                        else if (received.imageContent.includes('base64')) {

                            removeImageContent(groupDriversFound)
                                .then(() => {
                                    saveImageContent(received)
                                        .then((received) => {
                                            groupDriversFound.imageContent = received.imageContent;
                                            var newValues = { $set: groupDriversFound };
                                            GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                                if (err) {
                                                    console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                                    return res.status(500).send(err.message);
                                                }
                                                else {
                                                    if (result) {
                                                        getGroupDrivers(groupDriversFound, userId)
                                                            .then((groupDriversFound) => {
                                                                return res.status(200).send(groupDriversFound);
                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });
                                                    }
                                                    else
                                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                }
                                            });
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][saveImageContent] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        })
                                })
                                .catch(error => {
                                    console.log(`[${context}][removeImageContent] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                            /*
                            var path = '/usr/src/app/img/groupDrivers/' + received._id + '.jpg';
                            var pathImage = '';
                            var base64Image = received.imageContent.split(';base64,').pop();
                            if (process.env.NODE_ENV === 'production') {
                                pathImage = process.env.HostProdGroupDrivers + received._id + '.jpg'; // For PROD server
                            }
                            else if (process.env.NODE_ENV === 'pre-production') {
                                pathImage = process.env.HostPreProdGroupDrivers + received._id + '.jpg'; // For PROD server
                            }
                            else {
                                //pathImage = process.env.HostLocalGroupDrivers + received._id + '.jpg'; // For local host
                                pathImage = process.env.HostQAGroupDrivers + received._id + '.jpg'; // For QA server
                            };
                            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                if (err) {
                                    console.log(`[${context}][unlink] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    groupDriversFound.imageContent = pathImage;
                                    var newValues = { $set: groupDriversFound };
                                    GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                        if (err) {
                                            console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            if (result) {
                                                getGroupDrivers(groupDriversFound,userId)
                                                    .then((groupDriversFound) => {
                                                        return res.status(200).send(groupDriversFound);
                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            }
                                            else
                                                return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                        }
                                    });
                                };
                            });
                            */
                        }
                        else {
                            var newValues = { $set: groupDriversFound };
                            GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                    return res.status(500).send(err.message);
                                }
                                else {
                                    if (result) {
                                        getGroupDrivers(groupDriversFound, userId)
                                            .then((groupDriversFound) => {
                                                return res.status(200).send(groupDriversFound);
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    }
                                    else
                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                }
                            });
                        };
                    };
                }
                else {
                    var query = {
                        _id: received._id
                    };
                    GroupDrivers.findOne(query, (err, groupDriversFound) => {
                        if (err) {
                            console.log(`[${context}][findOne] Error `, err.message);
                            return res.status(500).send(err.message);
                        }
                        else {
                            if (groupDriversFound) {
                                groupDriversFound.name = received.name;

                                //Verifica se é para remover a imagem, alterar ou manter
                                if (received.imageContent == "" && groupDriversFound.imageContent != "") {

                                    removeImageContent(groupDriversFound)
                                        .then(() => {
                                            groupDriversFound.imageContent = "";
                                            var newValues = { $set: groupDriversFound };
                                            GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                                if (err) {
                                                    console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                                    return res.status(500).send(err.message);
                                                }
                                                else {
                                                    if (result) {
                                                        getGroupDrivers(groupDriversFound, userId)
                                                            .then((groupDriversFound) => {
                                                                return res.status(200).send(groupDriversFound);
                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });
                                                    }
                                                    else
                                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                }
                                            });
                                        })
                                        .catch(error => {
                                            console.log(`[${context}][removeImageContent] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });

                                }
                                else if (received.imageContent.includes('base64')) {

                                    removeImageContent(groupDriversFound)
                                        .then(() => {
                                            saveImageContent(received)
                                                .then((received) => {
                                                    groupDriversFound.imageContent = received.imageContent;
                                                    var newValues = { $set: groupDriversFound };
                                                    GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                                        if (err) {
                                                            console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                                            return res.status(500).send(err.message);
                                                        }
                                                        else {
                                                            if (result) {
                                                                getGroupDrivers(groupDriversFound, userId)
                                                                    .then((groupDriversFound) => {
                                                                        return res.status(200).send(groupDriversFound);
                                                                    })
                                                                    .catch((error) => {
                                                                        console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                                        return res.status(500).send(error.message);
                                                                    });
                                                            }
                                                            else
                                                                return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                        }
                                                    });
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][saveImageContent] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                })
                                        })
                                        .catch(error => {
                                            console.log(`[${context}][removeImageContent] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                    /*
                                    var path = '/usr/src/app/img/groupDrivers/' + received._id + '.jpg';
                                    var pathImage = '';
                                    var base64Image = received.imageContent.split(';base64,').pop();
                                    if (process.env.NODE_ENV === 'production') {
                                        pathImage = process.env.HostProdGroupDrivers + received._id + '.jpg'; // For PROD server
                                    }
                                    else if (process.env.NODE_ENV === 'pre-production') {
                                        pathImage = process.env.HostPreProdGroupDrivers + received._id + '.jpg'; // For PROD server
                                    }
                                    else {
                                        //pathImage = process.env.HostLocalGroupDrivers + received._id + '.jpg'; // For local host
                                        pathImage = process.env.HostQAGroupDrivers + received._id + '.jpg'; // For QA server
                                    };
                                    fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                                        if (err) {
                                            console.log(`[${context}][unlink] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            groupDriversFound.imageContent = pathImage;
                                            var newValues = { $set: groupDriversFound };
                                            GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                                if (err) {
                                                    console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                                    return res.status(500).send(err.message);
                                                }
                                                else {
                                                    if (result) {
                                                        getGroupDrivers(groupDriversFound,userId)
                                                            .then((groupDriversFound) => {
                                                                return res.status(200).send(groupDriversFound);
                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });
                                                    }
                                                    else
                                                        return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                                }
                                            });
                                        };
                                    });
                                    */
                                }
                                else {
                                    var newValues = { $set: groupDriversFound };
                                    GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                                        if (err) {
                                            console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            if (result) {
                                                getGroupDrivers(groupDriversFound, userId)
                                                    .then((groupDriversFound) => {
                                                        return res.status(200).send(groupDriversFound);
                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            }
                                            else
                                                return res.status(200).send({ auth: true, code: 'server_update_unsuccessfully', message: "Update unsuccessfully" });
                                        }
                                    });
                                };
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });
                            };
                        };
                    });
                };
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Add and remove driver frontEnd backoffice
router.patch('/api/private/groupDrivers/backOffice', (req, res, next) => {
    var context = "PATCH /api/private/groupDrivers/backOffice";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        verifyDriversBackOffice(received)
            .then((groupDriversReceived) => {
                GroupDrivers.findOne(query, (err, groupDriversFound) => {
                    if (err) {
                        console.log(`[${context}][findOne] Error `, err.message);
                        return res.status(500).send(err.message);
                    }
                    else {
                        if (groupDriversFound) {

                            validateImage(received, groupDriversFound)
                                .then((imageContent) => {

                                    groupDriversFound.imageContent = imageContent;
                                    groupDriversFound.name = received.name;
                                    groupDriversFound.listOfDrivers = groupDriversReceived.listOfDrivers;
                                    var newValues = { $set: groupDriversFound };
                                    GroupDrivers.findOneAndUpdate(query, newValues, { new: true }, (err, result) => {
                                        if (err) {
                                            console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                            return res.status(500).send(err.message);
                                        }
                                        else {
                                            getGroupDrivers(result, userId)
                                                .then((groupDriversFound) => {
                                                    return res.status(200).send(groupDriversFound);
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        };
                                    });

                                })
                                .catch((error) => {
                                    console.log(`[${context}][validateImage] Error `, error.message);
                                    return res.status(500).send(error.message);
                                })


                        }
                        else {
                            return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });
                        };
                    };
                });
            })
            .catch((error) => {
                console.log(`[${context}][verifyDriversBackOffice] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to leave groupDrivers
router.patch('/api/private/groupDrivers/leaveGroupDrivers', (req, res, next) => {
    var context = "PATCH /api/private/groupDrivers/leaveGroupDrivers";
    try {
        var userId = req.headers['userid'];
        var query = req.body;
        groupsDriversFindOne(query)
            .then((groupDriversFound) => {
                if (groupDriversFound) {
                    groupDriversFound.listOfDrivers = groupDriversFound.listOfDrivers.filter(driver => {
                        return driver.driverId != userId;
                    });
                    var newValue = { $set: groupDriversFound }
                    groupsDriversUpdate(query, newValue)
                        .then((result) => {
                            if (result) {
                                return res.status(200).send({ auth: true, code: 'server_successfully_leaves_group', message: "Successfully leaves the group" });
                            }
                            else {
                                return res.status(400).send({ auth: false, code: 'server_Unsuccessfully_leaves_group', message: "Unsuccessfully leaves the group" });
                            };
                        })
                        .catch((error) => {
                            console.log(`[${context}][groupsDriversUpdate] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupsDriversFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to torn off admin for an user in group of drivers
router.patch('/api/private/groupDrivers/removeAdmin', (req, res, next) => {
    var context = "PUT /api/private/groupDrivers/removeAdmin";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupsDriversFindOne(query)
            .then((groupDriversFound) => {
                if (groupDriversFound) {
                    var found = groupDriversFound.listOfDrivers.indexOf(groupDriversFound.listOfDrivers.find(driver => {
                        return driver.driverId == received.userId;
                    }));
                    if (found >= 0) {
                        groupDriversFound.listOfDrivers[found].admin = false;
                        var newValue = { $set: groupDriversFound };
                        groupsDriversUpdate(query, newValue)
                            .then((result) => {
                                if (result) {
                                    getGroupDrivers(groupDriversFound, userId)
                                        .then((groupDriversFound) => {
                                            return res.status(200).send(groupDriversFound);
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getGroupDrivers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                } else
                                    return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                            })
                            .catch((error) => {
                                console.log(`[${context}][groupsDriversUpdate][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_user_not_belong', message: "User does not belong to the group" });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupsDriversFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== GET ==========
//Get my groups of drivers
router.get('/api/private/groupDrivers', (req, res, next) => {
    var context = "GET /api/private/groupDrivers";
    try {
        var userId = req.headers['userid'];
        var query = {
            createUser: userId
        };
        groupsDriversFind(query, userId)
            .then((groupsDriversFound) => {
                return res.status(200).send(groupsDriversFound);
            })
            .catch((error) => {
                console.log(`[${context}][groupsDriversFind][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get groups of drivers for ev
router.get('/api/private/groupDrivers/ev', (req, res, next) => {
    var context = "GET /api/private/groupDrivers/ev";
    try {
        var query = req.body;
        groupsDriversFindOne(query)
            .then((groupsDriversFound) => {
                if (!groupsDriversFound)
                    return res.status(200).send(groupsDriversFound);
                else if (groupsDriversFound.listOfDrivers.length == 0)
                    return res.status(200).send(groupsDriversFound);
                else {
                    //return res.status(200).send(groupsDriversFound);

                    getDrivers(groupsDriversFound)
                        .then((groupsDriversFound) => {
                            return res.status(200).send(groupsDriversFound);
                        })
                        .catch((error) => {
                            console.log(`[${context}][getDrivers][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });

                }
            })
            .catch((error) => {
                console.log(`[${context}][groupsDriversFind][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/groupDrivers/otherEvs', (req, res, next) => {
    var context = "GET /api/private/groupDrivers/otherEvs";
    try {
        var userId = req.headers['userid'];
        var clientName = req.headers['clientname'];

        var query = {
            $and: [
                {
                    'listOfDrivers': {
                        $elemMatch: {
                            driverId: userId
                        }
                    }
                },
                {
                    createUser: {
                        $ne: userId
                    }
                }
            ]
        };
        GroupDrivers.find(query, (err, groupDriversFound) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                return res.status(500).send(err.message);
            }
            else {
                //console.log("groupDriversFound.length 1", groupDriversFound.length)
                return res.status(200).send(groupDriversFound);
            }
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


router.get('/api/private/groupDrivers/evsAndMyEvsInfo', async (req, res, next) => {
    var context = "GET /api/private/groupDrivers/evsAndMyEvsInfo";
    try {
        let {userId , evs , groupDrivers} = req.body;
        let newListOfEvs = await GroupDriversHandler.evsAndMyEvsInfo(evs , groupDrivers , userId)
        return res.status(200).send(newListOfEvs);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/groupDrivers/userFleetsInfo', async (req, res, next) => {
    var context = "GET /api/private/groupDrivers/userFleetsInfo";
    try {
        let {userId , evs } = req.body;
        let newListOfEvs = await GroupDriversHandler.userFleetsInfo(evs, userId)
        return res.status(200).send(newListOfEvs);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/groupDrivers/listsInfo', async (req, res, next) => {
    var context = "GET /api/private/groupDrivers/listsInfo";
    try {
        let { evs } = req.body;
        let newListOfEvs = await GroupDriversHandler.listsInfo(evs)
        return res.status(200).send(newListOfEvs);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});
//========== DELETE ==========
//Delete a group driver
router.delete('/api/private/groupDrivers', (req, res, next) => {
    var context = "DELETE /api/private/groupDrivers";
    try {
        var userId = req.headers['userid'];
        var query = req.body;

        GroupDrivers.findOne(query, (err, groupDriversFound) => {
            if (err) {

                console.log(`[${context}][removeGroupDrivers] Error `, err.message);
                return res.status(500).send(err.message);

            } else {

                if (groupDriversFound) {

                    if (groupDriversFound.imageContent == "" || groupDriversFound.imageContent == undefined) {

                        GroupDrivers.removeGroupDrivers(query, (err, result) => {
                            if (err) {
                                console.log(`[${context}][removeGroupDrivers] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {
                                    removeGroupDriverFromEV(query);
                                    removeGroupDriverDependencies(query);
                                    return res.status(200).send({ auth: true, code: 'server_groupDriver_successfully_removed', message: "Group driver successfully removed" });
                                }
                                else
                                    return res.status(400).send({ auth: false, code: 'server_groupDriver_unsuccessfully_removed', message: "Group driver unsuccessfully removed" });
                            };
                        });

                    } else {

                        removeImageContent(groupDriversFound)
                            .then(() => {
                                GroupDrivers.removeGroupDrivers(query, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][removeGroupDrivers] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        if (result) {
                                            removeGroupDriverFromEV(query);
                                            removeGroupDriverDependencies(query);
                                            return res.status(200).send({ auth: true, code: 'server_groupDriver_successfully_removed', message: "Group driver successfully removed" });
                                        }
                                        else
                                            return res.status(400).send({ auth: false, code: 'server_groupDriver_unsuccessfully_removed', message: "Group driver unsuccessfully removed" });
                                    };
                                });
                            })
                            .catch(err => {
                                console.log(`[${context}][removeImageContent] Error `, err.message);
                                return res.status(500).send(err.message);
                            });

                    };

                } else {

                    return res.status(400).send({ auth: false, code: 'server_group_drivers_not_found', message: "Group drivers not found for given parameters" });

                };
            };
        });

    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTIONS ==========
//Funtion to validate fields
function validateFields(groupsDrivers) {
    return new Promise((resolve, reject) => {
        if (!groupsDrivers.name)
            reject({ auth: false, code: 'server_group_name_req', message: "Group name is required" });
        else if (!groupsDrivers.createUser)
            reject({ auth: false, code: 'server_group_id_req', message: "Group Id is required" });
        else
            resolve(true);
    });
};

//Funtion to find one group
function groupsDriversFindOne(query) {
    var context = "Function groupsDriversFindOne";
    return new Promise((resolve, reject) => {
        GroupDrivers.findOne(query, (err, groupDriversFound) => {
            if (err) {
                console.log(`[${context}][findOnde] Error `, err.message);
                reject(err);
            }
            else {
                resolve(groupDriversFound);
            };
        });
    });
};

//Funtion to find all group drivers
function groupsDriversFind(query, userId) {
    var context = "Function groupsDriversFind";
    return new Promise((resolve, reject) => {
        GroupDrivers.find(query, (err, groupDriversFound) => {
            if (err) {
                console.log(`[${context}] Error `, err.message);
                reject(err);
            }
            else {
                if (groupDriversFound.length === 0) {
                    resolve(groupDriversFound);
                } else {
                    Promise.all(
                        groupDriversFound.map(groupDrivers => getGroupDrivers(groupDrivers, userId))
                    ).then((groupDriversFound) => {
                        resolve(groupDriversFound);
                    }).catch((error) => {
                        console.log(`[${context}] Error `, error.message);
                        reject(error);
                    });
                };
            };
        });
    });
};

function getGroupDrivers(groupDrivers, userId) {
    var context = "Function getGroupDrivers";
    return new Promise(async (resolve, reject) => {
        try {
            var driversId = [];

            let evs = await getDriverEvs(groupDrivers, userId);
            const getDriverId = (driver) => {
                return new Promise((resolve, reject) => {
                    if (driver.driverId == undefined) {
                        driversId.push(driver);
                        resolve(true);
                    } else if (driver.driverId == "") {
                        driversId.push(driver);
                        resolve(true);
                    } else {
                        var query = {
                            _id: driver.driverId
                        };
                        var fields = {
                            _id: 1,
                            internationalPrefix: 1,
                            name: 1,
                            mobile: 1,
                            imageContent: 1
                        };
                        User.findOne(query, fields, (err, userFound) => {
                            if (err) {
                                console.log(`[${context}][findOne] Error `, err.message);
                                reject(err);
                            } else {
                                if (userFound) {
                                    var returnUser = JSON.parse(JSON.stringify(userFound));
                                    returnUser.driverId = userFound._id;
                                    returnUser._id = driver._id;
                                    returnUser.admin = driver.admin;
                                    driversId.push(returnUser);
                                    resolve(true);
                                } else {
                                    driversId.push(driver);
                                    resolve(true);
                                }
                            };
                        })
                    };
                });
            };
            Promise.all(
                groupDrivers.listOfDrivers.map(driver => getDriverId(driver))
            ).then((result) => {
                var returnGroupDrivers = JSON.parse(JSON.stringify(groupDrivers));
                returnGroupDrivers.numberOfEvs = evs.length;
                returnGroupDrivers.licensePlates = Array.from(evs.map((ev) => ev.licensePlate))
                    .sort((a, b) => a.localeCompare(b));
                returnGroupDrivers.listOfDrivers = driversId;
                resolve(returnGroupDrivers);
            }).catch((error) => {
                console.log(`[${context}] Error `, error.message);
                reject(error);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to create a new group Driver
function groupsDriversCreate(groupsDrivers) {
    var context = "Function groupsDriversCreate";
    return new Promise((resolve, reject) => {
        GroupDrivers.createGroupDrivers(groupsDrivers, (err, result) => {
            if (err) {
                console.log(`[${context}][createGroupDrivers] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

//Function to save image in file
function saveImageContent(groupsDrivers) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {

            var dateNow = Date.now();
            var path = `/usr/src/app/img/groupDrivers/${groupsDrivers._id}_${dateNow}.jpg`;
            var pathImage = '';
            var base64Image = groupsDrivers.imageContent.split(';base64,').pop();
            if (process.env.NODE_ENV === 'production') {
                pathImage = `${process.env.HostProdGroupDrivers}${groupsDrivers._id}_${dateNow}.jpg`; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = `${process.env.HostPreProdGroupDrivers}${groupsDrivers._id}_${dateNow}.jpg`;// For PRE PROD server
            }
            else {
                //pathImage = `${process.env.HostLocalGroupDrivers}${groupsDrivers._id}_${dateNow}.jpg`; // For local host
                pathImage = `${process.env.HostQAGroupDrivers}${groupsDrivers._id}_${dateNow}.jpg`;// For QA server
            };
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.log(`[${context}] Error `, err.message);
                    reject(err)
                }
                else {
                    groupsDrivers.imageContent = pathImage;
                    resolve(groupsDrivers);
                };
            });
        }
        catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to remove image in file
function removeImageContent(groupsDrivers) {
    var context = "Function removeImageContent";
    return new Promise((resolve, reject) => {
        try {

            const image = groupsDrivers.imageContent.split('/');

            const path = `/usr/src/app/img/groupDrivers/${image[image.length - 1]}`;

            fs.unlink(path, (err) => {
                if (err) {
                    console.log(`[${context}][fs.unlink] Error `, err.message);
                }
                groupsDrivers.imageContent = "";
                resolve(groupsDrivers);
            });

        }
        catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to verify if the user is registered
function verifyUsers(groupsDrivers, clientName) {
    const context = "Function verifyUsers";
    return new Promise((resolve, reject) => {
        try {
            var groupDriversDependencies = [];
            const verifyDriver = (driver) => {
                return new Promise((resolve) => {
                    if (driver.driverId == "") {
                        let query = {
                            mobile: driver.mobile,
                            internationalPrefix: driver.internationalPrefix,
                            clientName: clientName
                        };
                        findOneUser(query)
                            .then((userFound) => {

                                if (userFound) {
                                    driver.active = true;
                                    driver.driverId = userFound._id;
                                    resolve(true);
                                }
                                else {
                                    driver.active = false;
                                    groupDriversDependencies.push(driver);
                                    resolve(true);
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                reject(error);
                            });
                    }
                    else if (driver.driverId == undefined) {
                        let query = {
                            mobile: driver.mobile,
                            internationalPrefix: driver.internationalPrefix,
                            clientName: clientName
                        };
                        findOneUser(query)
                            .then((userFound) => {

                                if (userFound) {
                                    driver.active = true;
                                    driver.driverId = userFound._id;
                                    resolve(true);
                                }
                                else {
                                    driver.active = false;
                                    groupDriversDependencies.push(driver);
                                    resolve(true);
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                reject(error);
                            });
                    }
                    else {
                        driver.active = true;
                        resolve(true);
                    };
                });
            };
            Promise.all(
                groupsDrivers.listOfDrivers.map(driver => verifyDriver(driver))
            ).then((result) => {
                addGroupDriversDependencies(groupsDrivers, groupDriversDependencies)
                    .then(() => {
                        resolve(groupsDrivers);
                    })
                    .catch((error) => {
                        console.log(`[${context}][addGroupDriversDependencies][.catch] Error `, error.message);
                        resolve(groupsDrivers);
                    });

            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to verify if the user exist on data base
function findOneUser(query) {
    var context = "Function findOneUser";
    return new Promise((resolve, reject) => {
        try {
            User.findOne(query, (error, userFound) => {
                if (error) {
                    console.log(`[${context}][findOnde] Error `, error.message);
                    reject(error);
                }
                else {
                    resolve(userFound);
                };
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to confirm if the divers already exist in group drivers
function confirmExist(groupDriversFound, received) {
    var context = "Function confirmExist";
    return new Promise((resolve, reject) => {
        try {
            var groupDriversDependencies = [];
            const getDriver = (driver) => {

                return new Promise((resolve, reject) => {
                    var found = groupDriversFound.listOfDrivers.find(element => {
                        return (element.mobile == driver.mobile);
                    });
                    if (found) {
                        if (driver.driverId != undefined && driver.driverId != "") {

                            var found = groupDriversFound.listOfDrivers.find(element => {
                                return (element.driverId == driver.driverId);
                            });
                            if (found) {
                                resolve(false);
                            }
                            else {
                                var query = {
                                    _id: driver.driverId
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        driver.active = true;
                                        driver.name = userFound.name;
                                        driver.mobile = userFound.mobile;
                                        driver.internationalPrefix = userFound.internationalPrefix;
                                        groupDriversFound.listOfDrivers.push(driver);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            };
                        }
                        else {
                            if (driver.driverId == undefined) {
                                var query = {
                                    $and: [
                                        { mobile: driver.mobile },
                                        { internationalPrefix: driver.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        if (userFound) {
                                            if (found.mobile == userFound.mobile && found.internationalPrefix == userFound.internationalPrefix && found.driverId == userFound._id) {
                                                resolve(false);
                                            }
                                            else {
                                                driver.active = true;
                                                driver.driverId = userFound._id;
                                                groupDriversFound.listOfDrivers.push(driver);
                                                resolve(true);
                                            };
                                        }
                                        else {
                                            if (found.mobile == driver.mobile && found.internationalPrefix == driver.internationalPrefix && found.driverId == driver.driverId) {
                                                resolve(false);
                                            }
                                            else {
                                                driver.active = false;
                                                groupDriversDependencies.push(driver);
                                                groupDriversFound.listOfDrivers.push(driver);
                                                resolve(true);
                                            };
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else if (driver.driverId == "") {
                                var query = {
                                    $and: [
                                        { mobile: driver.mobile },
                                        { internationalPrefix: driver.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        if (userFound) {
                                            if (found.mobile == userFound.mobile && found.internationalPrefix == userFound.internationalPrefix && found.driverId == userFound._id)
                                                resolve(false);
                                            else {
                                                driver.active = true;
                                                driver.driverId = userFound._id;
                                                groupDriversFound.listOfDrivers.push(driver);
                                                resolve(true);
                                            };
                                        }
                                        else {
                                            if (found.mobile == driver.mobile && found.internationalPrefix == driver.internationalPrefix && found.driverId == driver.driverId) {
                                                resolve(false);
                                            }
                                            else {
                                                driver.active = false;
                                                groupDriversDependencies.push(driver);
                                                groupDriversFound.listOfDrivers.push(driver);
                                                resolve(true);
                                            };
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                if (found.mobile == driver.mobile && found.internationalPrefix == driver.internationalPrefix && found.driverId == driver.driverId) {
                                    resolve(false);
                                }
                                else {
                                    driver.active = true;
                                    groupDriversFound.listOfDrivers.push(driver);
                                    resolve(true);
                                };
                            };
                        };
                    }
                    else {
                        if (driver.driverId != undefined && driver.driverId != "") {

                            var found = groupDriversFound.listOfDrivers.find(element => {
                                return (element.driverId == driver.driverId);
                            });
                            if (found) {
                                resolve(false);
                            }
                            else {
                                var query = {
                                    _id: driver.driverId
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        driver.active = true;
                                        driver.name = userFound.name;
                                        driver.mobile = userFound.mobile;
                                        driver.internationalPrefix = userFound.internationalPrefix;
                                        groupDriversFound.listOfDrivers.push(driver);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            };
                        }
                        else {
                            if (driver.driverId == undefined) {
                                var query = {
                                    $and: [
                                        { mobile: driver.mobile },
                                        { internationalPrefix: driver.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {

                                        if (userFound) {
                                            driver.active = true;
                                            driver.driverId = userFound._id;
                                            groupDriversFound.listOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                        else {
                                            driver.active = false;
                                            groupDriversDependencies.push(driver);
                                            groupDriversFound.listOfDrivers.push(driver);
                                            resolve(true);
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else if (driver.driverId == "") {
                                var query = {
                                    $and: [
                                        { mobile: driver.mobile },
                                        { internationalPrefix: driver.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {

                                        if (userFound) {
                                            driver.active = true;
                                            driver.driverId = userFound._id;
                                            groupDriversFound.listOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                        else {
                                            driver.active = false;
                                            groupDriversDependencies.push(driver);
                                            groupDriversFound.listOfDrivers.push(driver);
                                            resolve(true);
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                driver.active = true;
                                groupDriversFound.listOfDrivers.push(driver);
                                resolve(true);
                            };
                        };
                    };
                });
            };
            Promise.all(
                received.listOfDrivers.map(driver => getDriver(driver))
            ).then((result) => {
                if (groupDriversDependencies.length != 0) {
                    addGroupDriversDependencies(groupDriversFound, groupDriversDependencies)
                        .then(() => {
                            resolve(groupDriversFound);
                        })
                        .catch((error) => {
                            console.log(`[${context}][addGroupDriversDependencies][.catch] Error `, error.message);
                            resolve(groupDriversFound);
                        });

                } else {
                    resolve(groupDriversFound);
                };
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to update a group of drivers
function groupsDriversUpdate(query, newValues) {
    var context = "Function groupsDriversUpdate";
    return new Promise((resolve, reject) => {
        try {
            GroupDrivers.updateGroupDrivers(query, newValues, (err, result) => {
                if (err) {
                    console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result)
                        resolve(true);
                    else
                        resolve(false);
                }
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to get drivers
function getDrivers(groupsDriversFound) {
    var context = "Function getDrivers";
    return new Promise((resolve, reject) => {
        try {
            var driverId = []
            const getDriver = (drivers) => {
                return new Promise((resolve) => {
                    if (drivers.driverId == undefined) {
                        driverId.push(drivers);
                        resolve(false);
                    }
                    else if (drivers.driverId == '') {
                        driverId.push(drivers);
                        resolve(false);
                    }
                    else {
                        var query = {
                            _id: drivers.driverId
                        };

                        var fields = {
                            _id: 1,
                            name: 1,
                            internationalPrefix: 1,
                            mobile: 1,
                            imageContent: 1
                        }
                        User.findOne(query, fields, (err, userFound) => {
                            if (err) {
                                console.log(`[${context}][findOne] Error `, err.message);
                                reject(err);
                            }
                            else {
                                if (userFound) {
                                    userFound = JSON.parse(JSON.stringify(userFound));
                                    userFound.driverId = userFound._id;
                                    driverId.push(userFound);
                                    resolve(true);
                                }
                                else {
                                    driverId.push(drivers);
                                    resolve(false);
                                };
                            };
                        });
                    };
                });
            };
            Promise.all(
                groupsDriversFound.listOfDrivers.map(drivers => getDriver(drivers))
            ).then(() => {
                var newGroupsDriversFound = {
                    _id: groupsDriversFound._id,
                    name: groupsDriversFound.name,
                    imageContent: groupsDriversFound.imageContent,
                    createUser: groupsDriversFound.createUser,
                    listOfDrivers: driverId
                };
                resolve(newGroupsDriversFound);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to add driver to a groupDriversDependencies
function addGroupDriversDependencies(groupsDrivers, groupDriversDependencies) {
    var context = "Function addDriversDependencies";
    return new Promise((resolve, reject) => {
        try {
            var query = {
                groupId: groupsDrivers._id
            };
            GroupDriversDependencies.findOne(query, (err, GroupDriversDependenciesFound) => {
                if (err) {
                    console.log(`[${context}][findOne] Error `, err.message);
                    reject(err);
                }
                else {
                    if (GroupDriversDependenciesFound) {
                        verifyExist(GroupDriversDependenciesFound, groupDriversDependencies, groupsDrivers.name)
                            .then((GroupDriversDependenciesFound) => {
                                var newValues = { $set: GroupDriversDependenciesFound };
                                GroupDriversDependencies.updateGroupDriversDependencies(query, newValues, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][updateGroupDriversDependencies] Error `, err.message);
                                        reject(err);
                                    }
                                    else {
                                        resolve(true);
                                    };
                                });
                            })
                            .catch((error) => {
                                console.log(`[${context}][verifyExist][.catch] Error `, error.message);
                                reject(error);
                            });
                    }
                    else {

                        var newGroupDriversDependencies = new GroupDriversDependencies();
                        newGroupDriversDependencies.userId = groupsDrivers.createUser;
                        newGroupDriversDependencies.groupId = groupsDrivers._id;
                        newGroupDriversDependencies.clientName = groupsDrivers.clientName;

                        verifyExist(newGroupDriversDependencies, groupDriversDependencies, groupsDrivers.name)
                            .then((newGroupDriversDependencies) => {
                                GroupDriversDependencies.createGroupDriversDependencies(newGroupDriversDependencies, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][createGroupDriversDependencies] Error `, err.message);
                                        reject(err);
                                    }
                                    else {
                                        resolve(true);
                                    };
                                });
                            })
                            .catch((error) => {
                                console.log(`[${context}][verifyExist][.catch] Error `, error.message);
                                reject(error);
                            });
                    }
                }
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function verifyExist(newGroupDriversDependencies, groupDriversDependencies, groupName) {
    var context = "Function verifyExist";
    return new Promise((resolve, reject) => {
        try {
            var toSendSMSNotification = [];
            const addDriver = (driver) => {
                return new Promise((resolve, reject) => {
                    var found = newGroupDriversDependencies.drivers.find((element) => {
                        return (element.mobile == driver.mobile);
                    });
                    if (found == undefined) {
                        var newDriver = {
                            mobile: driver.mobile,
                            internationalPrefix: driver.internationalPrefix,
                            registered: false
                        };
                        toSendSMSNotification.push(driver);
                        newGroupDriversDependencies.drivers.push(newDriver);
                        resolve(true);
                    } else {
                        resolve(false)
                    };
                });
            };
            Promise.all(
                groupDriversDependencies.map(driver => addDriver(driver))
            ).then(async () => {

                let group = await GroupDrivers.findOne({ _id: groupDriversDependencies.groupId }, { _id: 1, createUser: 1 });
                let clientName;
                if (group) {
                    clientName = await User.findOne({ _id: group.createUser }, { _id: 1, clientName: 1 })

                    if (clientName.clientName === process.env.clientNameEVIO)
                        sendSMSNotification(toSendSMSNotification, groupName);

                } else {
                    sendSMSNotification(toSendSMSNotification, groupName);
                };

                resolve(newGroupDriversDependencies);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to send SMS notification to register
function sendSMSNotification(value, groupName, clientName) {
    var context = "Function sendSMSNotification";
    var params = {
        value,
        groupName: groupName,
        clientName: clientName,
    };

    if (value.length != 0) {
        var host = process.env.NotificationsHost + process.env.NotificationsPathGroupDrivers;

        axios.post(host, params)
            .then((value) => {
                console.log(`[${context}] SMS Send`, value.data);
            })
            .catch((error) => {
                console.log(`[${context}][post][.catch] Error`, error.message);
            });
    }
    else {
        console.log("There are no unregistered users");
    };
};

//
function verifyDriversBackOffice(received) {
    var context = "Function verifyDriversBackOffice";
    return new Promise((resolve, reject) => {
        try {
            var groupDriversDependencies = [];
            const getDriver = (driver) => {
                return new Promise((resolve, reject) => {
                    if (driver.new) {
                        var query = {
                            mobile: driver.mobile,
                            internationalPrefix: driver.internationalPrefix
                        };
                        findOneUser(query)
                            .then((userFound) => {
                                if (userFound) {
                                    driver.active = true;
                                    driver.driverId = userFound._id;
                                    resolve(true);
                                }
                                else {
                                    driver.active = false;
                                    groupDriversDependencies.push(driver);
                                    resolve(true);
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                reject(error);
                            });
                    }
                    else {
                        resolve(true);
                    };
                });
            };
            Promise.all(
                received.listOfDrivers.map(driver => getDriver(driver))
            ).then(() => {
                addGroupDriversDependencies(received, groupDriversDependencies)
                resolve(received);
            }).catch((error) => {
                console.log(`[${context}][Promise.all][.catch] Error `, error.message);
                reject(error);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

function removeGroupDriverFromEV(query) {
    var context = "Function removeGroupDriverFromEV";
    var host = process.env.HostEv + process.env.PathRemoveGroupDriver;
    var data = {
        groupDriver: query._id
    };
    axios.patch(host, data)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Group driver removed from evs`);
            }
            else {
                console.log(`[${context}] Group driver not removed from evs`);
            };
        })
        .catch((error) => {
            console.log(`[${context}][ axios.patch] Error `, error.message);
        });

};

function removeGroupDriverDependencies(params) {
    var context = "Function removeGroupDriverFromEV";
    var query = {
        groupId: params._id
    };
    GroupDriversDependencies.removeGroupDriversDependencies(query, (err, result) => {
        if (err) {
            console.log(`[${context}][removeGroupDriversDependencies] Error `, err.message);
        }
        else {
            if (result) {
                console.log(`[${context}] Group driver dependencies successfully removed`);
            }
            else {
                console.log(`[${context}] No group driver dependencies to remove`);
            };
        };
    });
};

function validateImage(received, groupDriversFound) {
    var context = "Function validateImage";
    return new Promise((resolve, reject) => {

        if (received.imageContent == "" && groupDriversFound.imageContent != "") {

            removeImageContent(groupDriversFound)
                .then(() => {
                    resolve("");
                })
                .catch((error) => {
                    console.log(`[${context}][removeImageContent] Error `, error.message);
                    resolve("");
                });

        }
        else if (received.imageContent.includes('base64')) {

            removeImageContent(groupDriversFound)
                .then(() => {
                    saveImageContent(received)
                        .then(received => {
                            resolve(received.imageContent);
                        })
                        .catch((error) => {
                            console.log(`[${context}][saveImageContent] Error `, error.message);
                            resolve("");
                        });
                })
                .catch((error) => {
                    console.log(`[${context}][removeImageContent] Error `, error.message);
                    resolve("");
                });

            /*
            var path = '/usr/src/app/img/groupDrivers/' + received._id + '.jpg';
            var pathImage = '';
            var base64Image = received.imageContent.split(';base64,').pop();
            if (process.env.NODE_ENV === 'production') {
                pathImage = process.env.HostProdGroupDrivers + received._id + '.jpg'; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = process.env.HostPreProdGroupDrivers + received._id + '.jpg'; // For PROD server
            }
            else {
                //pathImage = process.env.HostLocalGroupDrivers + received._id + '.jpg'; // For local host
                pathImage = process.env.HostQAGroupDrivers + received._id + '.jpg'; // For QA server
            };
            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.log(`[${context}][unlink] Error `, err.message);
                    //return res.status(500).send(err.message);
                }

                resolve(pathImage);

            });
            */
        }
        else {

            resolve(received.imageContent);

        };

    });
};

function getDriverEvs(groupDrivers, userId) {
    var context = "Function getDriverEvs";
    return new Promise((resolve, reject) => {
        //console.log("groupDrivers", groupDrivers);
        //console.log("userId", userId);
        let host = `${process.env.HostEv}${process.env.PathGetEVByGroup}/${groupDrivers._id}`
        let headers = {
            userid: userId
        };
        axios.get(host, { headers })
            .then((result) => {
                resolve(result.data);
            })
            .catch(error => {
                console.log(`[${context}] Error `, error.message);
                resolve([]);
            });

    });
};


module.exports = router;