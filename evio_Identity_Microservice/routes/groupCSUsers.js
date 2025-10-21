const express = require('express');
const router = express.Router();
const GroupCSUsers = require('../models/groupCSUsers');
const GroupCSUsersDependencies = require('../models/groupCSUsersDependencies');
const GroupDrivers = require('../models/groupDrivers');
const User = require('../models/user');
const Contract = require('../models/contracts');
require("dotenv-safe").load();
const fs = require('fs');
const axios = require("axios");
const { logger } = require('../utils/constants');
const { findOneGroupCSUser, findGroupCSUser, findGroupCSUserGroupMap } = require('evio-library-identity').default;
//========== POST ==========
//Create a group of charger station users
router.post('/api/private/groupCSUsers', (req, res, next) => {
    const context = "POST /api/private/groupCSUsers";
    try {
        const createUser = req.headers['userid'];
        const clientName = req.headers['clientname'];
        const groupCSUsers = new GroupCSUsers(req.body);
        if (groupCSUsers.imageContent === undefined) {
            groupCSUsers.imageContent = "";
        };
        groupCSUsers.createUser = createUser;
        groupCSUsers.clientName = clientName;
        validateFields(groupCSUsers)
            .then(() => {
                if (groupCSUsers.listOfUsers.length == 0) {
                    //Listo of users are empty
                    var query = {
                        _id: createUser
                    };
                    findOneUser(query)
                        .then((userFound) => {
                            var newUser = {
                                userId: userFound._id,
                                name: userFound.name,
                                mobile: userFound.mobile,
                                internationalPrefix: userFound.internationalPrefix,
                                active: true,
                                admin: true
                            };
                            groupCSUsers.listOfUsers.push(newUser);
                            if (groupCSUsers.imageContent == "") {
                                //No image
                                groupCSUsersCreate(groupCSUsers)
                                    .then((result) => {
                                        if (result)
                                            getGroupCSUsers(result)
                                                .then((groupCSUsersFound) => {
                                                    return res.status(200).send(groupCSUsersFound);
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        else
                                            return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][groupCSUsersCreate][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            }
                            else {
                                //with image
                                saveImageContent(groupCSUsers)
                                    .then((groupCSUsers) => {
                                        groupCSUsersCreate(groupCSUsers)
                                            .then((result) => {
                                                if (result)
                                                    getGroupCSUsers(result)
                                                        .then((groupCSUsersFound) => {
                                                            return res.status(200).send(groupCSUsersFound);
                                                        })
                                                        .catch((error) => {
                                                            console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                            return res.status(500).send(error.message);
                                                        });
                                                else
                                                    return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][groupCSUsersCreate][.catch] Error `, error.message);
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
                            console.log(`[${context}][findOneUser][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    //User list is not empty
                    var found = groupCSUsers.listOfUsers.indexOf(groupCSUsers.listOfUsers.find(user => {
                        return user.userId == createUser
                    }));
                    if (found >= 0) {
                        groupCSUsers.listOfUsers[found].admin = true;
                        if (groupCSUsers.imageContent == "") {
                            //No image
                            verifyUsers(groupCSUsers, clientName)
                                .then((groupCSUsers) => {
                                    groupCSUsersCreate(groupCSUsers)
                                        .then((result) => {
                                            if (result)
                                                getGroupCSUsers(result)
                                                    .then((groupCSUsersFound) => {
                                                        return res.status(200).send(groupCSUsersFound);
                                                    })
                                                    .catch((error) => {
                                                        console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                        return res.status(500).send(error.message);
                                                    });
                                            else
                                                return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][groupCSUsersCreate][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][verifyUsers][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            //with image
                            saveImageContent(groupCSUsers)
                                .then((groupCSUsers) => {
                                    verifyUsers(groupCSUsers, clientName)
                                        .then((groupCSUsers) => {
                                            groupCSUsersCreate(groupCSUsers)
                                                .then((result) => {
                                                    if (result)
                                                        getGroupCSUsers(result)
                                                            .then((groupCSUsersFound) => {
                                                                return res.status(200).send(groupCSUsersFound);
                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });
                                                    else
                                                        return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][groupCSUsersCreate][.catch] Error `, error.message);
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
                    }
                    else {
                        var query = {
                            _id: createUser
                        };
                        findOneUser(query)
                            .then((userFound) => {
                                var newUser = {
                                    userId: userFound._id,
                                    name: userFound.name,
                                    mobile: userFound.mobile,
                                    internationalPrefix: userFound.internationalPrefix,
                                    active: true,
                                    admin: true
                                };
                                groupCSUsers.listOfUsers.push(newUser);
                                if (groupCSUsers.imageContent == "") {
                                    //No image
                                    verifyUsers(groupCSUsers, clientName)
                                        .then((groupCSUsers) => {
                                            groupCSUsersCreate(groupCSUsers)
                                                .then((result) => {
                                                    if (result)
                                                        getGroupCSUsers(result)
                                                            .then((groupCSUsersFound) => {
                                                                return res.status(200).send(groupCSUsersFound);
                                                            })
                                                            .catch((error) => {
                                                                console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                                return res.status(500).send(error.message);
                                                            });
                                                    else
                                                        return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][groupCSUsersCreate][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][verifyUsers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                }
                                else {
                                    //with image
                                    saveImageContent(groupCSUsers)
                                        .then((groupCSUsers) => {
                                            verifyUsers(groupCSUsers, clientName)
                                                .then((groupCSUsers) => {
                                                    groupCSUsersCreate(groupCSUsers)
                                                        .then((result) => {
                                                            if (result)
                                                                getGroupCSUsers(result)
                                                                    .then((groupCSUsersFound) => {
                                                                        return res.status(200).send(groupCSUsersFound);
                                                                    })
                                                                    .catch((error) => {
                                                                        console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                                        return res.status(500).send(error.message);
                                                                    });
                                                            else
                                                                return res.status(400).send({ auth: false, code: 'server_group_not_created', message: "Group not created" });
                                                        })
                                                        .catch((error) => {
                                                            console.log(`[${context}][groupCSUsersCreate][.catch] Error `, error.message);
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

router.post('/api/private/groupCSUsers/runFirstTime', (req, res, next) => {
    var context = "POST /api/private/groupCSUsers/runFirstTime";
    try {
        return res.status(200).send("OK");
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PUT ==========
//Add user to a group of charger station users
router.put('/api/private/groupCSUsers', (req, res, next) => {
    var context = "PUT /api/private/groupCSUsers";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupCSUsersFindOne(query)
            .then((groupCSUsersFound) => {
                if (groupCSUsersFound) {
                    confirmExist(groupCSUsersFound, received)
                        .then((groupCSUsersFound) => {
                            var newValues = { $set: groupCSUsersFound };
                            groupCSUsersUpdate(query, newValues)
                                .then((result) => {
                                    if (result) {
                                        getGroupCSUsers(groupCSUsersFound)
                                            .then((groupCSUsersFound) => {
                                                return res.status(200).send(groupCSUsersFound);
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    } else
                                        return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        })
                        .catch((error) => {
                            console.log(`[${context}][confirmExist][.catch] Error `, error.message);
                            return res.status(500).send(error.message);
                        });
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_groupCSUsers_not_found', message: "Group charger station users not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupCSUsersFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to put an user to admin of the group
router.put('/api/private/groupCSUsers/putAdmin', (req, res, next) => {
    var context = "put /api/private/groupCSUsers/putAdmin";
    try {
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupCSUsersFindOne(query)
            .then((groupCSUsersFound) => {
                if (groupCSUsersFound) {
                    var found = groupCSUsersFound.listOfUsers.indexOf(groupCSUsersFound.listOfUsers.find(user => {
                        return user.userId == received.userId;
                    }));
                    if (found >= 0) {
                        groupCSUsersFound.listOfUsers[found].admin = true;
                        var newValue = { $set: groupCSUsersFound };
                        groupCSUsersUpdate(query, newValue)
                            .then((result) => {
                                if (result) {
                                    getGroupCSUsers(groupCSUsersFound)
                                        .then((groupCSUsersFound) => {
                                            return res.status(200).send(groupCSUsersFound);
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                } else
                                    return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                            })
                            .catch((error) => {
                                console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_user_not_belong', message: "User does not belong to the group" });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_groupCSUsers_not_found', message: "Group charger station users not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupCSUsersFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== PATCH ==========
//Remove users from a group of charger station users
router.patch('/api/private/groupCSUsers', (req, res, next) => {
    var context = "PATCH /api/private/groupCSUsers";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupCSUsersFindOne(query)
            .then((groupCSUsersFound) => {
                if (groupCSUsersFound) {
                    if (groupCSUsersFound.listOfUsers.length == 0) {
                        return res.status(400).send({ auth: false, code: 'server_no_user_to_remove', message: "No Users to remove" });
                    }
                    else {
                        const removeUser = (user) => {
                            return new Promise((resolve) => {
                                var found = groupCSUsersFound.listOfUsers.indexOf(groupCSUsersFound.listOfUsers.find(element => {
                                    return element.mobile == user.mobile;
                                }));
                                if (found >= 0) {
                                    if (groupCSUsersFound.listOfUsers[found].mobile == user.mobile && groupCSUsersFound.listOfUsers[found].internationalPrefix == user.internationalPrefix && groupCSUsersFound.listOfUsers[found].userId == user.userId) {
                                        groupCSUsersFound.listOfUsers.splice(found, 1);
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
                            received.listOfUsers.map(user => removeUser(user))
                        ).then(() => {
                            var newValues = { $set: groupCSUsersFound };
                            groupCSUsersUpdate(query, newValues)
                                .then((result) => {
                                    if (result) {
                                        getGroupCSUsers(groupCSUsersFound)
                                            .then((groupCSUsersFound) => {
                                                return res.status(200).send(groupCSUsersFound);
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    } else
                                        return res.status(400).send({ auth: false, code: 'server_users_unsuccessfully_removed', message: "Users unsuccessfully removed" });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_groupCSUsers_not_found', message: "Group charger station users not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupCSUsersFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Add and remove user frontEnd backoffice
router.patch('/api/private/groupCSUsers/backOffice', (req, res, next) => {
    var context = "PATCH /api/private/groupCSUsers/backOffice";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        verifyUsersBackOffice(received)
            .then((groupCSUsersReceived) => {
                groupCSUsersFindOne(query)
                    .then((groupCSUsersFound) => {
                        if (groupCSUsersFound) {
                            groupCSUsersFound.listOfUsers = groupCSUsersReceived.listOfUsers;
                            var newValues = { $set: groupCSUsersFound };
                            groupCSUsersUpdate(query, newValues)
                                .then((result) => {
                                    if (result) {
                                        getGroupCSUsers(groupCSUsersFound)
                                            .then((groupCSUsersFound) => {
                                                return res.status(200).send(groupCSUsersFound);
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    } else
                                        return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                                })
                                .catch((error) => {
                                    console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                    return res.status(500).send(error.message);
                                });
                        }
                        else {
                            return res.status(400).send({ auth: false, code: 'server_groupCSUsers_not_found', message: "Group charger station users not found for given parameters" });
                        };
                    })
                    .catch((error) => {
                        console.log(`[${context}][groupCSUsersFindOne] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
            })
            .catch((error) => {
                console.log(`[${context}][verifyUsersBackOffice] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };

});

//update group of charger station users
router.patch('/api/private/groupCSUsers/update', (req, res, next) => {
    var context = "PATCH /api/private/groupCSUsers/update";
    try {
        var userId = req.headers['userid'];
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupCSUsersFindOne(query)
            .then((groupCSUsersFound) => {
                if (groupCSUsersFound) {

                    groupCSUsersFound.name = received.name;

                    if (received.imageContent == "" && groupCSUsersFound.imageContent != "") {

                        removeImageContent(groupCSUsersFound)
                            .then(() => {

                                groupCSUsersFound.imageContent = "";
                                var newValues = { $set: groupCSUsersFound };
                                groupCSUsersUpdate(query, newValues)
                                    .then((result) => {
                                        if (result) {
                                            getGroupCSUsers(groupCSUsersFound)
                                                .then((groupCSUsersFound) => {
                                                    return res.status(200).send(groupCSUsersFound);
                                                })
                                                .catch((error) => {
                                                    console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                    return res.status(500).send(error.message);
                                                });
                                        } else
                                            return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });

                            })
                            .catch(err => {
                                console.log(`[${context}][removeImageContent] Error `, err.message);
                                return res.status(500).send(err.message);
                            });


                    }
                    else if (received.imageContent.includes('base64')) {

                        removeImageContent(groupCSUsersFound)
                            .then(() => {
                                saveImageContent(received)
                                    .then((received) => {
                                        groupCSUsersFound.imageContent = received.imageContent;
                                        var newValues = { $set: groupCSUsersFound };
                                        groupCSUsersUpdate(query, newValues)
                                            .then((result) => {
                                                if (result) {
                                                    getGroupCSUsers(groupCSUsersFound)
                                                        .then((groupCSUsersFound) => {
                                                            return res.status(200).send(groupCSUsersFound);
                                                        })
                                                        .catch((error) => {
                                                            console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                                            return res.status(500).send(error.message);
                                                        });
                                                } else
                                                    return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                                            })
                                            .catch((error) => {
                                                console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                                return res.status(500).send(error.message);
                                            });
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][saveImageContent][.catch] Error `, error.message);
                                        return res.status(500).send(error.message);
                                    });
                            })
                            .catch(err => {
                                console.log(`[${context}][removeImageContent] Error `, err.message);
                                return res.status(500).send(err.message);
                            });

                    }
                    else {
                        var newValues = { $set: groupCSUsersFound };
                        groupCSUsersUpdate(query, newValues)
                            .then((result) => {
                                if (result) {
                                    getGroupCSUsers(groupCSUsersFound)
                                        .then((groupCSUsersFound) => {
                                            return res.status(200).send(groupCSUsersFound);
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                } else
                                    return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                            })
                            .catch((error) => {
                                console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    };

                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_groupCSUsers_not_found', message: "Group charger station users not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupCSUsersFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to leave group of charger station users
router.patch('/api/private/groupCSUsers/leaveGroupCSUsers', (req, res, next) => {
    var context = "PATCH /api/private/groupCSUsers/leaveGroupCSUsers";
    try {
        var userId = req.headers['userid'];
        var query = req.body;
        groupCSUsersFindOne(query)
            .then((groupCSUsersFound) => {
                if (groupCSUsersFound) {
                    groupCSUsersFound.listOfUsers = groupCSUsersFound.listOfUsers.filter(user => {
                        return user.userId != userId;
                    });
                    var newValue = { $set: groupCSUsersFound };
                    groupCSUsersUpdate(query, newValue)
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
                    return res.status(400).send({ auth: false, code: 'server_groupCSUsers_not_found', message: "Group charger station users not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupCSUsersFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Endpoint to torn off admin for an user in group of charger station users
router.patch('/api/private/groupCSUsers/removeAdmin', (req, res, next) => {
    var context = "put /api/private/groupCSUsers/removeAdmin";
    try {
        var received = req.body;
        var query = {
            _id: received._id
        };
        groupCSUsersFindOne(query)
            .then((groupCSUsersFound) => {
                if (groupCSUsersFound) {
                    var found = groupCSUsersFound.listOfUsers.indexOf(groupCSUsersFound.listOfUsers.find(user => {
                        return user.userId == received.userId;
                    }));
                    if (found >= 0) {
                        groupCSUsersFound.listOfUsers[found].admin = false;
                        var newValue = { $set: groupCSUsersFound };
                        groupCSUsersUpdate(query, newValue)
                            .then((result) => {
                                if (result) {
                                    getGroupCSUsers(groupCSUsersFound)
                                        .then((groupCSUsersFound) => {
                                            return res.status(200).send(groupCSUsersFound);
                                        })
                                        .catch((error) => {
                                            console.log(`[${context}][getGroupCSUsers][.catch] Error `, error.message);
                                            return res.status(500).send(error.message);
                                        });
                                } else
                                    return res.status(400).send({ auth: false, code: 'server_add_unsuccessful', message: "Add unsuccessful" });
                            })
                            .catch((error) => {
                                console.log(`[${context}][groupCSUsersUpdate][.catch] Error `, error.message);
                                return res.status(500).send(error.message);
                            });
                    }
                    else {
                        return res.status(400).send({ auth: false, code: 'server_user_not_belong', message: "User does not belong to the group" });
                    };
                }
                else {
                    return res.status(400).send({ auth: false, code: 'server_groupCSUsers_not_found', message: "Group charger station users not found for given parameters" });
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupCSUsersFindOne] Error `, error.message);
                return res.status(500).send(error.message);
            });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== DELETE ==========
//Delete a group of charger station users
router.delete('/api/private/groupCSUsers', (req, res, next) => {
    var context = "DELETE /api/private/groupCSUsers";
    try {
        var userId = req.headers['userid'];
        var query = req.body;


        GroupCSUsers.findOne(query, (err, groupCSUsersFound) => {
            if (err) {

                console.log(`[${context}][] Error `, err.message);
                return res.status(500).send(err.message);

            } else {

                if (groupCSUsersFound) {

                    if (groupCSUsersFound.imageContent == "" || groupCSUsersFound.imageContent == undefined) {

                        GroupCSUsers.removeGroupCSUsers(query, (err, result) => {
                            if (err) {
                                console.log(`[${context}][removeGroupCSUsers] Error `, err.message);
                                return res.status(500).send(err.message);
                            }
                            else {
                                if (result) {
                                    removeGroupCSUsersFromCharger(query);
                                    removeGroupCSUsersDependencies(query);
                                    return res.status(200).send({ auth: true, code: 'server_groupCSUsers_successfully_removed', message: "Group of charger station users successfully removed" });
                                }
                                else
                                    return res.status(400).send({ auth: false, code: 'server_groupCSUsers_unsuccessfully_removed', message: "Group of charger station users unsuccessfully removed" });
                            };
                        });

                    } else {
                        removeImageContent(groupCSUsersFound)
                            .then(() => {
                                GroupCSUsers.removeGroupCSUsers(query, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][removeGroupCSUsers] Error `, err.message);
                                        return res.status(500).send(err.message);
                                    }
                                    else {
                                        if (result) {
                                            removeGroupCSUsersFromCharger(query);
                                            removeGroupCSUsersDependencies(query);
                                            return res.status(200).send({ auth: true, code: 'server_groupCSUsers_successfully_removed', message: "Group of charger station users successfully removed" });
                                        }
                                        else
                                            return res.status(400).send({ auth: false, code: 'server_groupCSUsers_unsuccessfully_removed', message: "Group of charger station users unsuccessfully removed" });
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

//========== GET ==========
//Get my groups of charger station users
router.get('/api/private/groupCSUsers', (req, res, next) => {
    var context = "GET /api/private/groupCSUsers";
    try {
        var userId = req.headers['userid'];
        var query = {
            createUser: userId
        };
        groupCSUsersFind(query)
            .then((groupCSUsersFound) => {
                if (groupCSUsersFound.length == 0)
                    return res.status(200).send(groupCSUsersFound);
                else {
                    Promise.all(
                        groupCSUsersFound.map(groupCSUsers => getGroupCSUsers(groupCSUsers))
                    ).then((groupCSUsersFound) => {
                        return res.status(200).send(groupCSUsersFound);
                    }).catch((error) => {
                        console.log(`[${context}][Promise.all] Error `, error.message);
                        return res.status(500).send(error.message);
                    });
                };
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

//Get Groups that i belong
router.get('/api/private/groupCSUsers/othersGroupsCSUsers', (req, res, next) => {
    var context = "GET /api/private/groupCSUsers/othersGroupsCSUsers";
    try {
        var userId = req.headers['userid'];
        var query = {
            $and: [
                {
                    'listOfUsers': {
                        $elemMatch: {
                            userId: userId
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
        var fields = {
            _id: 1
        };
        GroupCSUsers.find(query, fields, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][GroupCSUsers.find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                return res.status(200).send(groupCSUsersFound);
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//Get Groups that i belong for map
router.get('/api/private/groupCSUsers/map', (req, res, next) => {
    var context = "GET /api/private/groupCSUsers/map";
    try {
        var userId = req.headers['userid'];
        var query = {
            'listOfUsers': {
                $elemMatch: {
                    userId: userId
                }
            }
        };
        var fields = {
            _id: 1
        };
        GroupCSUsers.find(query, fields, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][GroupCSUsers.find] Error `, error.message);
                return res.status(500).send(error.message);
            }
            else {
                //console.log("groupCSUsersFound.length", groupCSUsersFound.length)
                if (groupCSUsersFound.length == 0)
                    return res.status(200).send(groupCSUsersFound);
                else {
                    var newGroup = [];
                    Promise.all(
                        groupCSUsersFound.map(group => {
                            return new Promise((resolve) => {
                                newGroup.push(group._id);
                                resolve(true);
                            });
                        })
                    ).then(() => {
                        return res.status(200).send(newGroup);
                    });
                };
            };
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/groupCSUsers/groupMap', async (req, res, next) => {
    var context = "GET /api/private/groupCSUsers/groupMap";
    try {
        var userId = req.headers['userid'];
        const groupIdsResponse = await findGroupCSUserGroupMap(userId)
            .catch(error=>{
                Sentry.captureException(error);
                console.log(`[${context}] Error `, error.message);
                return res.status(500).send(error.message);
            });
        return res.status(200).send(groupIdsResponse);
    } catch (error) {
        Sentry.captureException(error);
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});


//Get group of charger station users by id
router.get('/api/private/groupCSUsers/byId', (req, res, next) => {
    var context = "GET /api/private/groupCSUsers/byid";
    try {
        if ((Object.keys(req.query).length != 0) && (Object.keys(req.body).length == 0)) {
            var query = req.query;
        }
        else if ((Object.keys(req.query).length == 0) && (Object.keys(req.body).length != 0)) {
            var query = req.body;
        }
        else if ((Object.keys(req.query).length != 0) && (Object.keys(req.body).length != 0)) {
            var body = req.body;
            var params = req.query;
            var query = Object.assign(params, body);
        }
        else {
            return res.status(400).send("A query must be provided");
        };
        findOneGroupCSUser(query).then((groupCSUsersFound) => {
            return res.status(200).send(groupCSUsersFound);
        })
        .catch((error) => {
            console.log(`[${context}][findOneGroupCSUser][.catch] Error `, {...error});
            return res.status(500).send(error.message);
        });
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

router.get('/api/private/groupCSUsers/byIdList', (req, res, next) => {
    var context = "GET /api/private/groupCSUsers/byIdList";
    try {
        let query = {
            _id : {$in : req?.body?.listOfGroupsIds }
        }
        groupCSUsersFind(query)
            .then((groupCSUserFound) => {
                if (groupCSUserFound.length > 0) {
                    return res.status(200).send(groupCSUserFound);
                } else {
                    return res.status(200).send([]);
                };
            })
            .catch((error) => {
                console.log(`[${context}][groupCSUsersFindOne][.catch] Error `, error.message);
                return res.status(500).send(error.message);
            })
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return res.status(500).send(error.message);
    };
});

//========== FUNCTIONS ==========

//Funtion to validate fields
function validateFields(groupCSUsers) {
    return new Promise((resolve, reject) => {
        if (!groupCSUsers.name)
            reject({ auth: false, code: 'server_group_name_req', message: "Group name is required" });
        else if (!groupCSUsers.createUser)
            reject({ auth: false, code: 'server_group_id_req', message: "Group Id is required" });
        else
            resolve(true);
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

//Function to create a new group charger sstation users
function groupCSUsersCreate(groupCSUsers) {
    var context = "Function groupCSUsersCreate";
    return new Promise((resolve, reject) => {
        GroupCSUsers.createGroupCSUsers(groupCSUsers, (err, result) => {
            if (err) {
                console.log(`[${context}][createGroupCSUsers] Error `, err.message);
                reject(err);
            }
            else {
                resolve(result);
            };
        });
    });
};

//Function to save image in file
function saveImageContent(groupCSUsers) {
    var context = "Function saveImageContent";
    return new Promise((resolve, reject) => {
        try {

            var dateNow = Date.now();
            var path = `/usr/src/app/img/groupCSUsers/${groupCSUsers._id}_${dateNow}.jpg`;
            var pathImage = '';
            var base64Image = groupCSUsers.imageContent.split(';base64,').pop();

            if (process.env.NODE_ENV === 'production') {
                pathImage = `${process.env.HostProdGroupCSUsers}${groupCSUsers._id}_${dateNow}.jpg`; // For PROD server
            }
            else if (process.env.NODE_ENV === 'pre-production') {
                pathImage = `${process.env.HostPreProdGroupCSUsers}${groupCSUsers._id}_${dateNow}.jpg`; // For PROD server
            }
            else {
                //pathImage = `${process.env.HostLocalGroupCSUsers}${groupCSUsers._id}_${dateNow}.jpg`; // For local host
                pathImage = `${process.env.HostQAGroupCSUsers}${groupCSUsers._id}_${dateNow}.jpg`; // For QA server
            };

            fs.writeFile(path, base64Image, { encoding: 'base64' }, function (err, result) {
                if (err) {
                    console.log(`[${context}] Error `, err.message);
                    reject(err)
                }
                else {
                    groupCSUsers.imageContent = pathImage;
                    resolve(groupCSUsers);
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
function removeImageContent(groupCSUsers) {
    var context = "Function removeImageContent";
    return new Promise((resolve, reject) => {
        try {

            const image = groupCSUsers.imageContent.split('/');

            const path = `/usr/src/app/img/groupCSUsers/${image[image.length - 1]}`;

            fs.unlink(path, (err) => {
                if (err) {
                    console.log(`[${context}][fs.unlink] Error `, err.message);
                }
                groupCSUsers.imageContent = "";
                resolve(groupCSUsers);
            });

        }
        catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to verify if the user is registered
function verifyUsers(groupCSUsers, clientName) {
    const context = "Function verifyUsers";
    return new Promise((resolve, reject) => {
        try {
            var groupCSUsersDependencies = [];
            const verifyUser = (user) => {
                return new Promise((resolve, reject) => {
                    if (user.userId == "") {
                        let query = {
                            mobile: user.mobile,
                            internationalPrefix: user.internationalPrefix,
                            clientName: clientName
                        };
                        findOneUser(query)
                            .then((userFound) => {
                                if (userFound) {
                                    user.active = true;
                                    user.userId = userFound._id;
                                    resolve(true);
                                }
                                else {
                                    user.active = false;
                                    groupCSUsersDependencies.push(user);
                                    resolve(true);
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                reject(error);
                            });
                    }
                    else if (user.userId == undefined) {
                        let query = {
                            mobile: user.mobile,
                            internationalPrefix: user.internationalPrefix,
                            clientName: clientName
                        };
                        findOneUser(query)
                            .then((userFound) => {
                                if (userFound) {
                                    user.active = true;
                                    user.userId = userFound._id;
                                    resolve(true);
                                }
                                else {
                                    user.active = false;
                                    user.userId = "";
                                    groupCSUsersDependencies.push(user);
                                    resolve(true);
                                };
                            })
                            .catch((error) => {
                                console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                reject(error);
                            });
                    }
                    else {
                        user.active = true;
                        resolve(true);
                    };
                });
            };
            Promise.all(
                groupCSUsers.listOfUsers.map(user => verifyUser(user))
            ).then((result) => {
                if (groupCSUsersDependencies.length != 0)
                    addGroupCSUsersDependencies(groupCSUsers, groupCSUsersDependencies);
                resolve(groupCSUsers);
            }).catch((error) => {
                console.log(`[${context}][.catch] Error `, error.message);
                reject(error);
            })
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Funtion to find one group
function groupCSUsersFindOne(query) {
    var context = "Function groupCSUsersFindOne";
    return new Promise((resolve, reject) => {
        GroupCSUsers.findOne(query, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][findOnde] Error `, err.message);
                reject(err);
            }
            else {
                resolve(groupCSUsersFound);
            };
        });
    });
};

//Function to confirm if the user already exist in group of charger station users
function confirmExist(groupCSUsersFound, received) {
    var context = "Function confirmExist";
    return new Promise((resolve, reject) => {
        try {
            var groupCSUsersDependencies = [];
            const getUser = (user) => {
                return new Promise((resolve, reject) => {
                    var found = groupCSUsersFound.listOfUsers.find(element => {
                        return (element.mobile == user.mobile);
                    });
                    if (found) {
                        if (user.userId != undefined && user.userId != "") {
                            var found = groupCSUsersFound.listOfUsers.find(element => {
                                return (element.userId == user.userId);
                            });
                            if (found) {
                                resolve(false);
                            }
                            else {
                                var query = {
                                    _id: user.userId
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        user.active = true;
                                        user.name = userFound.name;
                                        user.internationalPrefix = userFound.internationalPrefix;
                                        user.mobile = userFound.mobile;
                                        groupCSUsersFound.listOfUsers.push(user);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            };
                        }
                        else {
                            if (user.userId == undefined) {
                                var query = {
                                    $and: [
                                        { mobile: user.mobile },
                                        { internationalPrefix: user.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        if (userFound) {
                                            if (found.mobile == userFound.mobile && found.internationalPrefix == userFound.internationalPrefix && found.userId == userFound._id) {
                                                resolve(false);
                                            }
                                            else {
                                                user.active = true;
                                                user.userId = userFound._id;
                                                groupCSUsersFound.listOfUsers.push(user);
                                                resolve(true);
                                            };
                                        }
                                        else {
                                            if (found.mobile == user.mobile && found.internationalPrefix == user.internationalPrefix && found.userId == "") {
                                                resolve(false);
                                            }
                                            else {
                                                user.active = false;
                                                user.userId = "";
                                                groupCSUsersDependencies.push(user);
                                                groupCSUsersFound.listOfUsers.push(user);
                                                resolve(true);
                                            };
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else if (user.userId == "") {
                                var query = {
                                    $and: [
                                        { mobile: user.mobile },
                                        { internationalPrefix: user.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        if (userFound) {
                                            if (found.mobile == userFound.mobile && found.internationalPrefix == userFound.internationalPrefix && found.userId == userFound._id)
                                                resolve(false);
                                            else {
                                                user.active = true;
                                                user.userId = userFound._id;
                                                groupCSUsersFound.listOfUsers.push(user);
                                                resolve(true);
                                            };
                                        }
                                        else {
                                            if (found.mobile == user.mobile && found.internationalPrefix == user.internationalPrefix && found.userId == user.userId) {
                                                resolve(false);
                                            }
                                            else {
                                                user.active = false;
                                                groupCSUsersDependencies.push(user);
                                                groupCSUsersFound.listOfUsers.push(user);
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
                                if (found.mobile == user.mobile && found.internationalPrefix == user.internationalPrefix && found.userId == user.userId) {
                                    resolve(false);
                                }
                                else {
                                    user.active = true;
                                    groupCSUsersFound.listOfUsers.push(user);
                                    resolve(true);
                                };
                            };
                        };
                    }
                    else {
                        if ((user.userId == undefined || user.userId == "") && (user.mobile == undefined || user.mobile == "")) {
                            resolve(false);
                        }
                        else if (user.userId != undefined && user.userId != "") {
                            var found = groupCSUsersFound.listOfUsers.find(element => {
                                return (element.userId == user.userId);
                            });
                            if (found) {
                                resolve(false);
                            }
                            else {
                                var query = {
                                    _id: user.userId
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        user.active = true;
                                        user.name = userFound.name;
                                        user.internationalPrefix = userFound.internationalPrefix;
                                        user.mobile = userFound.mobile;
                                        groupCSUsersFound.listOfUsers.push(user);
                                        resolve(true);
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            };
                        }
                        else {
                            if (user.userId == undefined) {
                                var query = {
                                    $and: [
                                        { mobile: user.mobile },
                                        { internationalPrefix: user.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {
                                        if (userFound) {
                                            user.active = true;
                                            user.userId = userFound._id;
                                            groupCSUsersFound.listOfUsers.push(user);
                                            resolve(true);
                                        }
                                        else {
                                            user.active = false;
                                            user.userId = "";
                                            groupCSUsersDependencies.push(user);
                                            groupCSUsersFound.listOfUsers.push(user);
                                            resolve(true);
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else if (user.userId == "") {
                                var query = {
                                    $and: [
                                        { mobile: user.mobile },
                                        { internationalPrefix: user.internationalPrefix }
                                    ]
                                };
                                findOneUser(query)
                                    .then((userFound) => {

                                        if (userFound) {
                                            user.active = true;
                                            user.userId = userFound._id;
                                            groupCSUsersFound.listOfUsers.push(user);
                                            resolve(true);
                                        }
                                        else {
                                            user.active = false;
                                            groupCSUsersDependencies.push(user);
                                            groupCSUsersFound.listOfUsers.push(user);
                                            resolve(true);
                                        };
                                    })
                                    .catch((error) => {
                                        console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                        reject(error);
                                    });
                            }
                            else {
                                user.active = true;
                                groupCSUsersFound.listOfUsers.push(user);
                                resolve(true);
                            };
                        };
                    };
                });
            };
            Promise.all(
                received.listOfUsers.map(user => getUser(user))
            ).then((result) => {
                if (groupCSUsersDependencies.length != 0)
                    addGroupCSUsersDependencies(groupCSUsersFound, groupCSUsersDependencies);
                resolve(groupCSUsersFound);

            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Function to update a group of charger station users
function groupCSUsersUpdate(query, newValues) {
    var context = "Function groupCSUsersUpdate";
    return new Promise((resolve, reject) => {
        try {
            GroupCSUsers.updateGroupCSUsers(query, newValues, (err, result) => {
                if (err) {
                    console.log(`[${context}][updateGroupCSUsers] Error `, err.message);
                    reject(err);
                }
                else {
                    if (result)
                        resolve(true);
                    else
                        resolve(false);
                };
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

//Funtion to get information of user
function getGroupCSUsers(groupCSUsers) {
    var context = "Function getGroupCSUsers";
    return new Promise((resolve, reject) => {
        try {
            var usersId = [];
            const getUserId = (user) => {
                return new Promise((resolve, reject) => {
                    if (user.userId == undefined) {
                        usersId.push(user);
                        resolve(true);
                    } else if (user.userId == "") {
                        usersId.push(user);
                        resolve(true);
                    }
                    else {
                        var query = {
                            _id: user.userId
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
                            }
                            else {
                                if (userFound) {
                                    var returnUser = JSON.parse(JSON.stringify(userFound));
                                    returnUser.userId = userFound._id;
                                    returnUser._id = user._id;
                                    returnUser.admin = user.admin;
                                    usersId.push(returnUser);
                                    resolve(true);
                                }
                                else {
                                    usersId.push(user);
                                    resolve(true);
                                }
                            };
                        })
                    };
                });
            };
            Promise.all(
                groupCSUsers.listOfUsers.map(user => getUserId(user))
            ).then((result) => {
                var returnGroupCSUsers = JSON.parse(JSON.stringify(groupCSUsers));
                returnGroupCSUsers.listOfUsers = usersId;
                resolve(returnGroupCSUsers);
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

//Function to verify new users
function verifyUsersBackOffice(received) {
    var context = "Function verifyUsersBackOffice";
    return new Promise((resolve, reject) => {
        try {
            var groupCSUsersDependencies = [];
            const getUser = (user) => {
                return new Promise((resolve, reject) => {
                    if (user.new) {
                        var query = {
                            mobile: user.mobile,
                            internationalPrefix: user.internationalPrefix
                        };
                        findOneUser(query)
                            .then((userFound) => {
                                if (userFound) {
                                    user.active = true;
                                    user.userId = userFound._id;
                                    resolve(true);
                                }
                                else {
                                    user.active = false;
                                    groupCSUsersDependencies.push(user);
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
                received.listOfUsers.map(user => getUser(user))
            ).then(() => {
                if (groupCSUsersDependencies.length != 0)
                    addGroupCSUsersDependencies(received, groupCSUsersDependencies)
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

//Function to get all all groups of charger station users by query
function groupCSUsersFind(query) {
    var context = "Function groupCSUsersFind";
    return new Promise((resolve, reject) => {
        GroupCSUsers.find(query, (err, groupCSUsersFound) => {
            if (err) {
                console.log(`[${context}][findOnde] Error `, err.message);
                reject(err);
            }
            else {
                resolve(groupCSUsersFound);
            };
        });
    });
};

//Function to add user to a GroupCSUsersDependencies
function addGroupCSUsersDependencies(groupCSUsers, groupCSUsersDependencies) {
    var context = "Function addGroupCSUsersDependencies";
    return new Promise((resolve, reject) => {
        try {
            var query = {
                groupId: groupCSUsers._id
            };
            GroupCSUsersDependencies.findOne(query, (err, groupCSUsersDependenciesFound) => {
                if (err) {
                    console.log(`[${context}][findOne] Error `, err.message);
                }
                else {
                    if (groupCSUsersDependenciesFound) {
                        verifyExist(groupCSUsersDependenciesFound, groupCSUsersDependencies, groupCSUsers.name)
                            .then((groupCSUsersDependenciesFound) => {
                                var newValues = { $set: groupCSUsersDependenciesFound };
                                GroupCSUsersDependencies.updateGroupCSUsersDependencies(query, newValues, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][updateGroupCSUsersDependencies] Error `, err.message);
                                    }
                                    else {
                                        console.log("Add");
                                    };
                                });
                            })
                            .catch((error) => {
                                console.log(`[${context}][verifyExist][.catch] Error `, error.message);
                            });
                    }
                    else {
                        var newGroupCSUsersDependencies = new GroupCSUsersDependencies();
                        newGroupCSUsersDependencies.userId = groupCSUsers.createUser;
                        newGroupCSUsersDependencies.groupId = groupCSUsers._id;
                        newGroupCSUsersDependencies.clientName = groupCSUsers.clientName

                        verifyExist(newGroupCSUsersDependencies, groupCSUsersDependencies, groupCSUsers.name)
                            .then((newGroupCSUsersDependencies) => {
                                GroupCSUsersDependencies.createGroupCSUsersDependencies(newGroupCSUsersDependencies, (err, result) => {
                                    if (err) {
                                        console.log(`[${context}][createGroupCSUsersDependencies] Error `, err.message);
                                    }
                                    else {
                                        console.log("Add");
                                    };
                                });
                            })
                            .catch((error) => {
                                console.log(`[${context}][verifyExist][.catch] Error `, error.message);
                                reject(error);
                            });
                    };
                };
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
        };
    });
};

function verifyExist(groupCSUsersDependenciesFound, groupCSUsersDependencies, groupName) {
    var context = "Function verifyExist";
    return new Promise((resolve, reject) => {
        try {
            var toSendSMSNotification = [];
            const addUser = (user) => {
                return new Promise((resolve, reject) => {
                    var found = groupCSUsersDependenciesFound.users.find((element) => {
                        return (element.mobile == user.mobile);
                    });
                    if (found == undefined) {
                        var newUser = {
                            mobile: user.mobile,
                            internationalPrefix: user.internationalPrefix,
                            registered: false
                        };
                        toSendSMSNotification.push(user);
                        groupCSUsersDependenciesFound.users.push(newUser);
                        resolve(true);
                    } else {
                        resolve(false)
                    };
                });
            };
            Promise.all(
                groupCSUsersDependencies.map(user => addUser(user))
            ).then(async () => {

                let group = await GroupCSUsers.findOne({ _id: groupCSUsersDependencies.groupId }, { _id: 1, createUser: 1 });
                let clientName;
                if (group) {
                    clientName = await User.findOne({ _id: group.createUser }, { _id: 1, clientName: 1 })

                    if (clientName.clientName === process.env.clientNameEVIO)
                        sendSMSNotification(toSendSMSNotification, groupName);

                } else {
                    sendSMSNotification(toSendSMSNotification, groupName);
                };

                resolve(groupCSUsersDependenciesFound);
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
        var host = process.env.NotificationsHost + process.env.NotificationsPathGroupCSUsers;

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

function removeGroupCSUsersFromCharger(query) {
    var context = "Function removeGroupCSUsersFromCharger";
    var data = {
        groupCSUsers: query._id
    };
    var host = process.env.HostCharger + process.env.PathRemoveGroupCSUsers;
    axios.patch(host, data)
        .then((result) => {
            if (result.data) {
                console.log(`[${context}] Group charger station users removed from chargers`);
            }
            else {
                console.log(`[${context}] Group charger station users not removed from chargers`);
            };
        })
        .catch((error) => {
            console.log(`[${context}][ axios.patch] Error `, error.message);
        });
};

function removeGroupCSUsersDependencies(params) {
    var context = "Function removeGroupCSUsersDependencies";
    var query = {
        groupId: params._id
    };
    GroupCSUsersDependencies.removeGroupCSUsersDependencies(query, (err, result) => {
        if (err) {
            console.log(`[${context}][removeGroupCSUsersDependencies] Error `, err.message);
        }
        else {
            if (result) {
                console.log(`[${context}] Group charger station users dependencies successfully removed`);
            }
            else {
                console.log(`[${context}] No group charger station users dependencies to remove`);
            };
        };
    });
};


async function getFleetsGroupIdtags(listOfFleets) {
    const context = "Function getFleetsGroupIdtags";
    try {
        let idTagsArray = []
        for (let fleet of listOfFleets) {
            let contractsQuery = {
                fleetId: fleet.fleetId,
                contractType: process.env.ContractTypeFleet
            }
            let allContracts = await contractsFind(contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getUsersGroupIdtags(listOfGroups) {
    const context = "Function getUsersGroupIdtags";
    try {
        let listOfUsers = await getListOfUsersArray(listOfGroups)
        let idTags = await getListOfUsersIdTags(listOfUsers)
        return idTags
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getListOfUsersArray(listOfGroups) {
    const context = "Function getListOfUsersArray";
    try {
        let listOfUsers = []
        for (let group of listOfGroups) {
            let groupQuery = {
                _id: group.groupId
            }
            let usersGroup = await groupCSUsersFindOne(groupQuery)
            if (usersGroup) {
                listOfUsers.push(...usersGroup.listOfUsers)
            }
        }
        return listOfUsers
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
    }
}

async function getListOfUsersIdTags(listOfUsers) {
    const context = "Function getListOfUsersIdTags";
    try {
        let idTagsArray = []
        for (let user of listOfUsers) {
            let contractsQuery = {
                userId: user.userId,
                contractType: process.env.ContractTypeUser
            }
            let allContracts = await contractsFind(contractsQuery)
            let idTags = getIdTags(allContracts, process.env.NetworkEVIO, process.env.AuthTypeRFID, process.env.TokenStatusActive)
            idTagsArray.push(...idTags)
        }
        return idTagsArray
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
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
        console.log(`[${context}] Error `, error.message);
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
        console.log(`[${context}] Error `, error.message);
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

function contractsFind(query) {
    var context = "Function contractsFind";
    return new Promise((resolve, reject) => {
        Contract.find(query, (err, contractsFound) => {
            if (err) {
                console.log(`[${context}][find] Error `, err.message);
                reject(err);
            }
            else {
                resolve(contractsFound);
            };
        });
    });
};


async function getChargers(host, params) {
    const context = "Function getChargers";
    try {
        let resp = await axios.get(host, { params })
        if (resp.data) {
            return resp.data
        } else {
            return []
        }
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        return []
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
        console.log(`[${context}][.catch] Error `, error.message);
        return idTagsInfoArray
    }
}

module.exports = router;
