const GroupDriversDependencies = require('../models/groupDriversDependencies');
const GroupDriversHandler = require('./groupDrivers');
const { logger } = require('../utils/constants');

module.exports = {
    userGroupDriversDependencies: async (user) => {
        let context = "Function userGroupDriversDependencies";
        try {

            let query = {
                'drivers': {
                    $elemMatch: {
                        'mobile': user.mobile,
                        'internationalPrefix': user.internationalPrefix,
                        'registered': false
                    }
                },
                clientName: user.clientName
            };

            let groupDriversDependenciesFound = await GroupDriversDependencies.find(query)

            if (groupDriversDependenciesFound.length > 0) {
                GroupDriversHandler.userGroupDrivers(user);
                const getDriver = (driver) => {
                    return new Promise((resolve) => {
                        if (driver.mobile == user.mobile && driver.internationalPrefix == user.internationalPrefix) {
                            driver.registered = true;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getGroupDriversDependencies = (groupDriversDependencies) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            groupDriversDependencies.drivers.map(driver => getDriver(driver))
                        ).then(() => {
                            let newValue = { $set: groupDriversDependencies };
                            let query = {
                                _id: groupDriversDependencies._id
                            };
                            GroupDriversDependencies.updateGroupDriversDependencies(query, newValue, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateGroupDriversDependencies] Error `, err.message);
                                }
                                else {
                                    console.log("Group Drivers Dependencies updated");
                                }
                            });
                            resolve(true);
                        });
                    });
                };
                Promise.all(
                    groupDriversDependenciesFound.map(groupDriversDependencies => getGroupDriversDependencies(groupDriversDependencies))
                ).then(() => {
                    console.log("Group Drivers Dependencies updated");
                });
            } else {
                console.log("No pending Group drivers");
            };


        } catch (error) {
            console.log(`[${context}]Error `, error.message);
        }

    }
}