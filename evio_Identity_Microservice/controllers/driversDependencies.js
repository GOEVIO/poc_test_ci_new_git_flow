const DriversDependencies = require('../models/driversDependencies');
const DriversHandler = require('./drivers')
const { logger } = require('../utils/constants');

module.exports = {
    userDriversDependencies: async (user) => {
        let context = "Function userDriversDependencies";
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

            let driverDependenciesFound = await DriversDependencies.find(query);

            if (driverDependenciesFound.length > 0) {
                DriversHandler.userPoolDrivers(user);
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
                const getDriverDependencies = (driverDependencies) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            driverDependencies.drivers.map(driver => getDriver(driver))
                        ).then(() => {
                            let newValue = { $set: driverDependencies };
                            let query = {
                                _id: driverDependencies._id
                            };
                            DriversDependencies.updateDriversDependencies(query, newValue, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateDriversDependencies] Error `, err.message);
                                }
                                else {
                                    console.log("Drivers Dependencies updated");
                                }
                            });
                            resolve(true);
                        });
                    });
                };
                Promise.all(
                    driverDependenciesFound.map(driverDependencies => getDriverDependencies(driverDependencies))
                ).then(() => {
                    console.log("Drivers Dependencies updated");
                });
            } else {
                console.log("No pending pool drivers");
            };

        } catch (error) {
            console.log(`[${context}]Error `, error.message);
        }
    }
}