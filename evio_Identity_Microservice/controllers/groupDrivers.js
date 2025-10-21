const GroupDrivers = require('../models/groupDrivers')
const ContractHandler = require('./contracts')
const User = require('../models/user')
const { clientTypes } = require('../utils/constants').default;
const TokenStatusService = require('../services/tokenStatus.service');

module.exports = {
    userGroupDrivers: async (user) => {
        let context = "Function userGroupDrivers";
        try {
            let query = {
                'listOfDrivers': {
                    $elemMatch: {
                        'mobile': user.mobile,
                        'internationalPrefix': user.internationalPrefix,
                        'active': false
                    }
                },
                clientName: user.clientName
            };
            let groupDriverFound = await GroupDrivers.find(query)

            if (groupDriverFound.length > 0) {
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (driver.mobile == user.mobile && driver.internationalPrefix == user.internationalPrefix) {
                            driver.active = true;
                            driver.driverId = user._id;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getGroupDriver = (groupDriver) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            groupDriver.listOfDrivers.map(driver => getDriver(driver))
                        ).then(() => {
                            let newValue = { $set: groupDriver };
                            let query = {
                                _id: groupDriver._id
                            };
                            GroupDrivers.updateGroupDrivers(query, newValue, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateGroupDrivers] Error `, err.message);
                                }
                                else {
                                    console.log("Group Drivers updated");
                                }
                            });
                            resolve(true);
                        });
                    });
                }
                Promise.all(
                    groupDriverFound.map(groupDriver => getGroupDriver(groupDriver))
                ).then(() => {
                    console.log("Group Drivers updated");
                });
            }
            else {
                console.log("No group drivers");
            }

        } catch (error) {
            console.log(`[${context}]Error `, error.message);
        }
    },
    updateMobileGroupDrivers: (user) => {
        let context = "Function updateMobileGroupDrivers";

        let query = {
            "listOfDrivers.driverId": user._id
        };

        let newValues = {
            $set: { "listOfDrivers.$.mobile": user.mobile }
        };

        GroupDrivers.updateMany(query, newValues, (err, result) => {
            if (err) {
                console.log(`[${context}][.catch] Error `, err.message);
            }
            else
                console.log("Updated", result);
        });
    },
    evsAndMyEvsInfo: async (evs ,groupDrivers , userId) => {
        let context = "Function evsAndMyEvsInfo";
        try {
            const evIdList = evs.map(ev => ev._id)
            const contracts = await ContractHandler.getEvsContracts(userId, evIdList)
            return await getEvsDriversInfo(evs , contracts , groupDrivers , userId)

        } catch (error) {
            console.log(`[${context}]Error `, error.message);
            throw new Error(error)
        }
    },    
    userFleetsInfo: async (evs, userId) => {
        let context = "Function userFleetsInfo";
        try {
            const evIdList = evs.map(ev => ev._id)
            const contracts = await ContractHandler.getFleetEvsContracts(userId, evIdList);
            return await getFleetEvsInfo(evs , contracts)

        } catch (error) {
            console.log(`[${context}]Error `, error.message);
            throw new Error(error)
        }
    },
    listsInfo: async (evs) => {
        let context = "Function listsInfo";
        try {
            return await getFleetEvsInfo(evs , [])

        } catch (error) {
            console.log(`[${context}]Error `, error.message);
            throw new Error(error)
        }
    },
}

async function getEvsDriversInfo(evs , contracts ,groupDrivers , userId) {
    let context = "Function getEvsDriversInfo";
    const dateNow = new Date();
    try {
        let newEvsFound = []
        for (let ev of evs) {
            ev = JSON.parse(JSON.stringify(ev));
            let contract = contracts.find(contract => contract.evId === ev._id)
            if (ev.userId === userId) {
                await getGroupsDrivers(ev)
                .then((newListOfGroupDrivers) => {
                    ev.listOfGroupDrivers = newListOfGroupDrivers;

                    if (contract) {
                        ev.contractId = contract._id;
                    }
                    newEvsFound.push(ev);
                })
                .catch((error) => {
                    console.log(`[${context}] Error `, error.message);
                })

            } else if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length == 0)) {
                await getValidationDriver(ev, userId, dateNow)
                .then((result) => {
                    if (result) {
                        if (contract) {
                            ev.contractId = contract._id;
                        };
                        newEvsFound.push(ev);
                    }
                });
            }
            else if ((ev.listOfDrivers.length == 0) && (ev.listOfGroupDrivers.length != 0)) {
                await getValidationGroupDrivers(ev, dateNow, groupDrivers)
                .then(async (result) => {
                    if (result) {
                        await getGroupsDrivers(ev)
                            .then((newListOfGroupDrivers) => {
                                ev.listOfGroupDrivers = newListOfGroupDrivers;
                                if (contract) {
                                    //first element
                                    ev.contractId = contract._id;
                                };

                                newEvsFound.push(ev);
                            })
                            .catch((error) => {
                                console.log(`[${context}] Error `, error.message);
                            })
                    }
                });
            }
            else if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length != 0)) {
                //console.log("Drivers and GroupDrivers",ev)
                await getValidationDriver(ev, userId, dateNow)
                .then(async (result) => {
                    if (result) {
                        await getGroupsDrivers(ev)
                        .then((newListOfGroupDrivers) => {
                            ev.listOfGroupDrivers = newListOfGroupDrivers;
                            if (contract) {
                                //first element
                                ev.contractId = contract._id;
                            };
                            newEvsFound.push(ev);
                        })
                        .catch((error) => {
                            console.log(`[${context}] Error `, error.message);
                        })
                    }
                    else {
                        await getValidationGroupDrivers(ev, dateNow, groupDrivers)
                        .then(async (result) => {
                            //console.log("Drivers and GroupDrivers _A",result)
                            if (result) {
                                await getGroupsDrivers(ev)
                                .then((newListOfGroupDrivers) => {
                                    ev.listOfGroupDrivers = newListOfGroupDrivers;
                                    if (contract) {
                                        //first element
                                        ev.contractId = contract._id;
                                    };
                                    newEvsFound.push(ev);
                                })
                                .catch((error) => {
                                    console.log(`[${context}] Error `, error.message);
                                })
                            }
                        });
                    };
                });
            }
        }
        return newEvsFound
      
    } catch (error) {
        console.log(`[${context}]Error `, error.message);
        throw new Error(error)
    }
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

function getDrivers(groupsDriversFound, groupDrivers) {
    var context = "Function getDrivers";
    return new Promise((resolve, reject) => {
        try {
            var driverId = []
            const getDriver = (drivers) => {
                return new Promise(async (resolve) => {
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
                        let userFound = await User.findOne(query, fields).lean();

                        if (userFound) {
                            userFound = JSON.parse(JSON.stringify(userFound));
                            userFound.driverId = userFound._id;
                            userFound.userId = userFound._id;
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
            Promise.all(
                groupsDriversFound.listOfDrivers.map(drivers => getDriver(drivers))
            ).then(() => {
                //console.log("groupsDriversFound", groupsDriversFound);
                //console.log("groupDrivers", groupDrivers);
                groupDrivers.listOfDrivers = driverId;
                var newGroupsDriversFound = {
                    _id: groupsDriversFound._id,
                    name: groupsDriversFound.name,
                    imageContent: groupsDriversFound.imageContent,
                    createUser: groupsDriversFound.createUser,
                    listOfDrivers: driverId
                };
                //console.log("groupDrivers", groupDrivers);
                resolve(groupDrivers);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};

async function getGroupsDrivers(evFound){
    const context = "Function getGroupsDrivers";
    try {
        let newListOfGroupDrivers = [];

        for (let groupDrivers of evFound.listOfGroupDrivers) {
            let query = {
                _id: groupDrivers.groupId
            };

            let groupDriversFound = await GroupDrivers.findOne(query).lean()
            if (!groupDriversFound) {

                newListOfGroupDrivers.push(groupDrivers);
            } else if (groupDriversFound.listOfDrivers.length == 0) {
                newListOfGroupDrivers.push(groupDrivers);
            } else {
                const updatedGroupDrivers = await getDrivers(groupDriversFound, groupDrivers)
                newListOfGroupDrivers.push(updatedGroupDrivers);
            };
        }
        return newListOfGroupDrivers
    } catch (error) {
        console.log(`[${context}]Error `, error.message);
        throw new Error(error)
    };
}

async function getFleetEvsInfo(evs , contracts) {
    let context = "Function getFleetEvsInfo";
    try {
        const tokenStatusService = new TokenStatusService(); 
        let listOfEvs = []
        for (let ev of evs) {
            ev = JSON.parse(JSON.stringify(ev));
            ev.evId = ev._id;
            let contract = contracts.find(contract => contract.evId === ev._id)
            if (contract) {
                ev.contract = {
                    ...contract,
                    rfidUIState: tokenStatusService.getRfidUIState({ contract, clientType: clientTypes.ClientB2B, requestUserId: contract.userId })
                }
            }

            if ((ev.listOfDrivers.length == 0) && (ev.listOfGroupDrivers.length == 0)) {
                listOfEvs.push(ev);
            }
            else if ((ev.listOfDrivers.length != 0) && (ev.listOfGroupDrivers.length == 0)) {
                await getListOfDriversInfo(ev)
                .then((listOfDrivers) => {
                    ev.listOfDrivers = listOfDrivers;
                    listOfEvs.push(ev);
                })
                .catch((error) => {
                    console.log(`[${context}][getListOfDriversInfo] Error `, error.message);
                });
            }
            else if ((ev.listOfDrivers.length == 0) && (ev.listOfGroupDrivers.length != 0)) {
                await getGroupsDrivers(ev)
                .then((listOfGroupDrivers) => {
                    ev.listOfGroupDrivers = listOfGroupDrivers;
                    listOfEvs.push(ev);
                })
                .catch((error) => {
                    console.log(`[${context}][getGroupsDrivers] Error `, error.message);
                });
            }
            else {
                await getGroupsDrivers(ev)
                .then(async (listOfGroupDrivers) => {
                    await getListOfDriversInfo(ev)
                    .then((listOfDrivers) => {
                        ev.listOfGroupDrivers = listOfGroupDrivers;
                        ev.listOfDrivers = listOfDrivers;
                        listOfEvs.push(ev);
                    })
                    .catch((error) => {
                        console.log(`[${context}][getListOfDriversInfo] Error `, error.message);
                    });
                })
                .catch((error) => {
                    console.log(`[${context}][getGroupsDrivers] Error `, error.message);
                });
            };
        }
        return listOfEvs
      
    } catch (error) {
        console.log(`[${context}]Error `, error.message);
        throw new Error(error)
    }
}

function getListOfDriversInfo(evFound) {
    var context = "Function getListOfDriversInfo";
    return new Promise((resolve, reject) => {
        try {
            var newlistOfDrivers = [];
            const getDrivers = (driver) => {
                return new Promise(async (resolve, reject) => {
                    if (driver.userId == "") {
                        newlistOfDrivers.push(driver);
                        resolve(true);
                    } else if (driver.userId === undefined) {
                        newlistOfDrivers.push(driver);
                        resolve(true);
                    } else {
                        var query = {
                            _id: driver.userId
                        };
                        var fields = {
                            _id: 1,
                            name: 1,
                            internationalPrefix: 1,
                            mobile: 1,
                            imageContent: 1
                        }
                        let userFound = await User.findOne(query, fields).lean();

                        if (!userFound) {
                            newlistOfDrivers.push(driver);
                            resolve(true);
                        } else {
                            driver = JSON.parse(JSON.stringify(driver));
                            driver.name = userFound.name;
                            driver.internationalPrefix = userFound.internationalPrefix;
                            driver.mobile = userFound.mobile;
                            driver.imageContent = userFound.imageContent;
                            newlistOfDrivers.push(driver);
                            resolve(true);
                        };

                    };
                });
            };
            Promise.all(
                evFound.listOfDrivers.map(driver => getDrivers(driver))
            ).then(() => {
                resolve(newlistOfDrivers);
            }).catch((error) => {
                console.log(`[${context}][Promise.all] Error `, error.message);
                reject(error);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        };
    });
};