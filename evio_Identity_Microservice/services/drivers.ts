/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-relative-packages */
import axios from 'axios';
import User from '../models/user';
import Drivers from '../models/drivers';
import DriversDependencies from '../models/driversDependencies';
import { logger } from '../utils/constants';
import { BadRequest, Conflict } from '../utils';
import { EV, IAddNewDriver } from '../interfaces/drivers.interface';

// Function to verify if the user exist on data base
function findOneUser(query) {
    const context = 'Function findOneUser';
    return new Promise((resolve, reject) => {
        try {
            User.findOne(query, (error, userFound) => {
                if (error) {
                    console.log(`[${context}][findOnde] Error `, error.message);
                    reject(error);
                }
                resolve(userFound);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

// Function to send SMS notification to register
function sendSMSNotification(value, userId) {
    const context = 'Function sendSMSNotification';
    
    if (value.length !== 0) {
        const host = `${process.env.NotificationsHost}${process.env.NotificationsPathDrivers}`;
        const query = {
            _id: userId
        };
        const fields = {
            name: 1,
            clientName: 1
        };
        User.findOne(query, fields, undefined, (err, userFound) => {
            if (err) {
                console.log(`[${context}][findOne] Error`, err.message);
            } else if (userFound) {
                const { name, clientName } = userFound;
                const params = {
                    value,
                    name,
                    clientName
                };
                axios.post(host, params)
                    .then((value) => {
                        console.log(`[${context}] SMS Send`, value.data);
                    })
                    .catch((error) => {
                        console.log(`[${context}][post][.catch] Error`, error.message);
                    });
            } else {
                console.log(`[${context}] Users not found for given parameters`);
            }
        });
    } else {
        console.log('There are no unregistered users');
    }
}

function verifyExist(driversDependenciesFound, driversDependencies, userId, clientName) {
    const context = 'Function verifyExist';
    return new Promise((resolve, reject) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toSendSMSNotification: any[] = [];
            const addDriver = (driver) => new Promise((resolve) => {
                const found = driversDependenciesFound.drivers.find((element) => (
                    element.mobile === driver.mobile
                    && element.internationalPrefix === driver.internationalPrefix
                ));
                if (!found) {
                    const newDriver = {
                        mobile: driver.mobile,
                        internationalPrefix: driver.internationalPrefix,
                        registered: false
                    };
                    toSendSMSNotification.push(driver);
                    driversDependenciesFound.drivers.push(newDriver);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            Promise.all(
                driversDependencies.map((driver) => addDriver(driver))
            ).then(() => {
                if (clientName === process.env.clientNameEVIO) {
                    sendSMSNotification(toSendSMSNotification, userId);
                }
                resolve(driversDependenciesFound);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

// Function to add a driver to driversDependencies
function addDriversDependencies(driversDependencies, userId, clientName) {
    const context = 'Function addDriversDependencies';
    return new Promise((resolve, reject) => {
        try {
            const query = {
                userId,
                clientName
            };
            DriversDependencies.findOne(query, (err, driversDependenciesFound) => {
                if (err) {
                    console.log(`[${context}] Error `, err.message);
                    reject(err);
                } else if (driversDependenciesFound) {
                    verifyExist(driversDependenciesFound, driversDependencies, userId, clientName)
                        .then((driversDependenciesFound) => {
                            const newValues = { $set: driversDependenciesFound };
                            DriversDependencies.updateDriversDependencies(query, newValues, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateDriversDependencies] Error `, err.message);
                                    reject(err);
                                } else {
                                    resolve(true);
                                }
                            });
                        })
                        .catch((error) => {
                            console.log(`[${context}][verifyExist][.catch] Error `, error.message);
                            reject(error);
                        });
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const newdriversDependencies: any = new DriversDependencies();
                    newdriversDependencies.userId = userId;
                    newdriversDependencies.clientName = clientName;
                    verifyExist(newdriversDependencies, driversDependencies, userId, clientName)
                        .then((driversDependenciesFound) => {
                            DriversDependencies.createDriversDependencies(driversDependenciesFound, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][createDriversDependencies] Error `, err.message);
                                    reject(err);
                                } else {
                                    resolve(true);
                                }
                            });
                        })
                        .catch((error) => {
                            console.log(`[${context}][verifyExist][.catch] Error `, error.message);
                            reject(error);
                        });
                }
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

// Function to add a driver to a pool of drivers
function addPoolDrivers(poolDrivers, driversFound, userId, clientName) {
    const context = 'Function addPoolDrivers';
    return new Promise((resolve, reject) => {
        try {
            const driversDependencies: unknown[] = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addDriver = (inputedDriver: any) => new Promise((resolve, reject) => {
                const driver = inputedDriver;
                const found = driversFound.poolOfDrivers.find(
                    (element) => (element.mobile === driver.mobile)
                );

                if (found) {
                    if (driver.driverId !== undefined && driver.driverId !== '') {
                        const foundWithId = driversFound.poolOfDrivers.find(
                            (element) => (element.driverId === driver.driverId)
                        );
                        if (foundWithId) {
                            resolve(false);
                        } else {
                            const query = {
                                _id: driver.driverId
                            };
                            findOneUser(query)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .then((userFound: any) => {
                                    driver.active = true;
                                    driver.name = userFound.name;
                                    driver.mobile = userFound.mobile;
                                    driver.internationalPrefix = userFound.internationalPrefix;
                                    driversFound.poolOfDrivers.push(driver);
                                    resolve(true);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                    reject(error);
                                });
                        }
                    } else {
                        if (driver.driverId === undefined) {
                            const query = {
                                mobile: driver.mobile,
                                internationalPrefix: driver.internationalPrefix,
                                clientName
                            };
                            findOneUser(query)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .then((userFound: any) => {
                                    if (userFound) {
                                        if (userFound._id === userId) resolve(false);
                                        else if (
                                            found.mobile === userFound.mobile
                                            && found.internationalPrefix === userFound.internationalPrefix
                                            && found.driverId === userFound._id
                                        ) resolve(false);
                                        else {
                                            driver.active = true;
                                            driver.driverId = userFound._id;
                                            driversFound.poolOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                    } else if (found.mobile === driver.mobile && found.internationalPrefix === driver.internationalPrefix && (found.driverId === driver.driverId || found.driverId === '')) {
                                        resolve(false);
                                    } else {
                                        driver.active = false;
                                        driver.driverId = '';
                                        driversDependencies.push(driver);
                                        driversFound.poolOfDrivers.push(driver);
                                        resolve(true);
                                    }
                                }).catch((error) => {
                                    console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                    reject(error);
                                });
                        } else if (driver.driverId === '') {
                            const query = {
                                mobile: driver.mobile,
                                internationalPrefix: driver.internationalPrefix,
                                clientName
                            };
                            findOneUser(query)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .then((userFound: any) => {
                                    if (userFound) {
                                        if (userFound._id === userId) resolve(false);
                                        else if (found.mobile === userFound.mobile && found.internationalPrefix === userFound.internationalPrefix && found.driverId === userFound._id)
                                            resolve(false);
                                        else {
                                            driver.active = true;
                                            driver.driverId = userFound._id;
                                            driversFound.poolOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                    } else if (found.mobile === driver.mobile && found.internationalPrefix === driver.internationalPrefix && (found.driverId === driver.driverId || found.driverId === undefined)) {
                                        resolve(false);
                                    } else {
                                        driver.active = false;
                                        driversDependencies.push(driver);
                                        driversFound.poolOfDrivers.push(driver);
                                        resolve(true);
                                    }
                                }).catch((error) => {
                                    console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                    reject(error);
                                });
                        } else if (driver.driverId === userId) {
                            resolve(false);
                        } else {
                            if (found.mobile === driver.mobile && found.internationalPrefix === driver.internationalPrefix && found.driverId === driver.driverId) {
                                resolve(false);
                            } else {
                                driver.active = true;
                                driversFound.poolOfDrivers.push(driver);
                                resolve(true);
                            }
                        }
                    }
                } else {
                    if (driver.driverId !== undefined && driver.driverId !== '') {
                        const foundWithId = driversFound.poolOfDrivers.find(
                            (element) => (element.driverId === driver.driverId)
                        );
                        if (foundWithId) {
                            resolve(false);
                        } else {
                            const query = {
                                _id: driver.driverId
                            };
                            findOneUser(query)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .then((userFound: any) => {
                                    driver.active = true;
                                    driver.name = userFound.name;
                                    driver.mobile = userFound.mobile;
                                    driver.internationalPrefix = userFound.internationalPrefix;
                                    driversFound.poolOfDrivers.push(driver);
                                    resolve(true);
                                })
                                .catch((error) => {
                                    console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                    reject(error);
                                });
                        }
                    } else {
                        if (driver.driverId === undefined) {
                            const query = {
                                $and: [
                                    { mobile: driver.mobile },
                                    { internationalPrefix: driver.internationalPrefix },
                                    { clientName }
                                ]
                            };
                            findOneUser(query)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .then((userFound: any) => {
                                    if (userFound) {
                                        if (userFound._id === userId) resolve(false);
                                        else {
                                            driver.active = true;
                                            driver.driverId = userFound._id;
                                            driversFound.poolOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                    } else {
                                        driver.active = false;
                                        driversDependencies.push(driver);
                                        driversFound.poolOfDrivers.push(driver);
                                        resolve(true);
                                    }
                                })
                                .catch((error) => {
                                    console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                    reject(error);
                                });
                        } else if (driver.driverId === '') {
                            const query = {
                                $and: [
                                    { mobile: driver.mobile },
                                    { internationalPrefix: driver.internationalPrefix },
                                    { clientName }

                                ]
                            };
                            findOneUser(query)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .then((userFound: any) => {
                                    if (userFound) {
                                        if (userFound._id === userId) resolve(false);
                                        else {
                                            driver.active = true;
                                            driver.driverId = userFound._id;
                                            driversFound.poolOfDrivers.push(driver);
                                            resolve(true);
                                        }
                                    } else {
                                        driver.active = false;
                                        driversDependencies.push(driver);
                                        driversFound.poolOfDrivers.push(driver);
                                        resolve(true);
                                    }
                                })
                                .catch((error) => {
                                    console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                    reject(error);
                                });
                        } else if (driver.driverId === userId) {
                            resolve(false);
                        } else if (driver.mobile === '' && driver.driverId !== '') {
                            const query = {
                                _id: driver.driverId
                            };
                            findOneUser(query)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .then((userFound: any) => {
                                    if (userFound._id === userId) resolve(false);
                                    else {
                                        driver.active = true;
                                        driver.mobile = userFound.mobile;
                                        driver.name = userFound.name;
                                        driver.internationalPrefix = userFound.internationalPrefix;
                                        driversFound.poolOfDrivers.push(driver);
                                        resolve(true);
                                    }
                                })
                                .catch((error) => {
                                    console.log(`[${context}][findOneUser] [.catch] Error `, error.message);
                                    reject(error);
                                });
                        } else {
                            driver.active = true;
                            driversFound.poolOfDrivers.push(driver);
                            resolve(true);
                        }
                    }
                }
            });
            Promise.all(
                poolDrivers.drivers.map((driver) => addDriver(driver))
            ).then(() => {
                addDriversDependencies(driversDependencies, userId, clientName)
                    .then(() => {
                        resolve(driversFound);
                    })
                    .catch((error) => {
                        console.log(`[${context}][addDriversDependencies] Error `, error.message);
                        resolve(driversFound);
                    });
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

function getDriverEvs(driverFound, userId): Promise<Array<EV>> {
    const context = 'Function getDriverEvs';
    return new Promise((resolve) => {
        const host = `${process.env.HostEv}${process.env.PathGetEVByUserId}`;
        const headers = {
            userid: userId
        };
        const data = driverFound;
        axios.get(host, { data, headers })
            .then((result) => {
                resolve(result.data);
            })
            .catch((error) => {
                console.log(`[${context}] Error `, error.message);
                resolve([]);
            });
    });
}

// Function to get id from drivers
function getDriversId(driversFound, userId) {
    const context = 'Function getDriversId';
    return new Promise((resolve, reject) => {
        try {
            const driversId: unknown[] = [];
            // eslint-disable-next-line no-async-promise-executor
            const getId = (inputedDriver) => new Promise(async (resolve, reject) => {
                let driver = inputedDriver;
                if (!driver.driverId) {
                    driver = JSON.parse(JSON.stringify(driver));
                    const evs = await getDriverEvs(driver, userId);
                    driver.numberOfEvs = evs.length;
                    driver.licensePlates = Array.from(evs.map((ev) => ev.licensePlate))
                        .sort((a, b) => a.localeCompare(b));
                    driversId.push(driver);
                    resolve(true);
                } else {
                    const evs = await getDriverEvs(driver, userId);
                    const query = {
                        _id: driver.driverId
                    };

                    const fields = {
                        _id: 1,
                        internationalPrefix: 1,
                        name: 1,
                        mobile: 1,
                        imageContent: 1
                    };
                    User.findOne(query, fields, undefined, (err, usersFound) => {
                        if (err) {
                            console.log(`[${context}][findOne] Error `, err.message);
                            reject(err);
                        } else if (usersFound) {
                            const returnUser = JSON.parse(JSON.stringify(usersFound));
                            returnUser.driverId = usersFound._id;
                            returnUser._id = driver._id;
                            returnUser.numberOfEvs = evs.length;
                            returnUser.licensePlates = Array.from(evs.map((ev) => ev.licensePlate))
                                .sort((a, b) => a.localeCompare(b));
                            driversId.push(returnUser);
                            resolve(true);
                        } else {
                            driver = JSON.parse(JSON.stringify(driver));
                            driver.numberOfEvs = evs.length;
                            driver.licensePlates = Array.from(evs.map((ev) => ev.licensePlate))
                                .sort((a, b) => a.localeCompare(b));
                            driversId.push(driver);
                            resolve(true);
                        }
                    });
                }
            });
            Promise.all(
                driversFound.poolOfDrivers.map((driver) => getId(driver))
            ).then(() => {
                const drivers = {
                    _id: driversFound._id,
                    userId: driversFound.userId,
                    poolOfDrivers: driversId
                };
                resolve(drivers);
            });
        } catch (error) {
            console.log(`[${context}] Error `, error.message);
            reject(error);
        }
    });
}

// ========== FUNCTION ==========
// Function to find a pool of drivers
function poolDriversFindOne(query) {
    const context = 'Function poolDriversFindOne';
    return new Promise((resolve, reject) => {
        Drivers.findOne(query, (err, result) => {
            if (err) {
                console.log(`[${context}][findOne] Error `, err.message);
                reject(err);
            }
            resolve(result);
        });
    });
}

const getDrivers = async (userId: string) => {
    const driversFound = await Drivers.findOne({ userId });

    if (!driversFound) return {};

    if (driversFound.poolOfDrivers.length === 0) return driversFound;

    const driversIds = await getDriversId(driversFound, userId);

    return driversIds;
};

// eslint-disable-next-line consistent-return
const addNewDrivers = async (drivers: Array<IAddNewDriver>, userId: string, clientName: string) => {
    const context = '[Service Function] addNewDrivers';
    const driversList = { drivers };

    const query = {
        userId,
        clientName
    };
    const userPoolDrivers = await poolDriversFindOne(query);

    if (!userPoolDrivers) throw BadRequest({ auth: false, code: 'server_pool_drivers_not_found', message: 'Pool of drivers not found for given parameters' }, context);

    console.log(
        driversList,
        userPoolDrivers,
        userId,
        clientName
    );

    // Check for duplicate mobile numbers
    if (checkDuplicateMobiles(driversList.drivers)) {
        throw Conflict({ auth: false, code: 'server_recieved_duplicate_drivers', message: 'Received duplicate drivers' }, context);
    }
    // Check for duplicate drivers in the pool
    if (checkDuplicateDrivers(driversList, userPoolDrivers).length > 0) {
        throw Conflict({ auth: false, code: 'server_duplicate_drivers', message: 'Duplicate drivers found in the pool' }, context);
    }

    const driverToInsertInPoll = await addPoolDrivers(
        driversList,
        userPoolDrivers,
        userId,
        clientName
    );

    const newValues = { $set: driverToInsertInPoll };

    const updatedDrivers = await Drivers.updateDrivers(query, newValues, () => {});

    if (!updatedDrivers) throw BadRequest({ auth: false, code: 'server_update_unsuccessfully', message: 'Update unsuccessfully' }, context);

    const driversIds = await getDriversId(driverToInsertInPoll, userId);

    return driversIds;
};

const checkDuplicateMobiles = (drivers: any) => {
  const mobiles = new Set();
  const duplicates: Array<string> = [];

  for (const driver of drivers) {
    if (mobiles.has(driver.mobile)) {
      duplicates.push(driver.mobile);
      continue;
    }
    mobiles.add(driver.mobile);
  }

  if (duplicates.length > 0) {
    console.log('Duplicate mobile numbers found');
    return true;
  }

  console.log('No duplicate mobile numbers found');
  return false;
}

const checkDuplicateDrivers = (driverData, pool) => {
  return driverData.drivers.flatMap(driver => 
    pool.poolOfDrivers
      .filter(poolDriver => 
        poolDriver.driverId === driver.driverId && 
        `${poolDriver.internationalPrefix}${poolDriver.mobile}` === 
        `${driver.internationalPrefix}${driver.mobile}`
      )
      .map(match => ({ source: driver.mobile, match }))
  );
}

/**
 * Function to fetch EVs by userId.
 * @param {string} userId - The userId to pass as a route parameter.
 * @returns {Promise<EV[]>} - Returns the fetched EVs or an empty array on failure.
 */
async function getEvsByUserId(userId: string): Promise<EV[]> {
    const context = 'Function getEvsByUserId';
    try {
      console.log(`[${context}] Initiating request`);
  
      const url = `${process.env.HostEv}/api/private/evs/byUserId/${userId}`;
      const result = await axios.get(url);
  
      console.log(`[${context}] Successfully fetched ${result.data.length} EVs`);
      return result.data;
    } catch (error) {
      console.error(`[${context}] Error`, error);
      return [];
    }
  }

export default { addNewDrivers, getDrivers, getEvsByUserId };
