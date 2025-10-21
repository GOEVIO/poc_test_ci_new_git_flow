const Drivers = require('../models/drivers');
const { logger } = require('../utils/constants');

module.exports = {
    userPoolDrivers: async (user) => {
        try {

            let context = "Function userPoolDrivers";
            let query = {
                'poolOfDrivers': {
                    $elemMatch: {
                        'mobile': user.mobile,
                        'internationalPrefix': user.internationalPrefix,
                        'active': false
                    }
                },
                clientName: user.clientName
            };
            let driverFound = await Drivers.find(query);

            if (driverFound.length > 0) {
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
                const getDriverFound = (found) => {
                    return new Promise((resolve) => {
                        Promise.all(
                            found.poolOfDrivers.map(driver => getDriver(driver))
                        ).then(() => {
                            let newValue = { $set: found };
                            let query = {
                                _id: found._id
                            };
                            Drivers.updateDrivers(query, newValue, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateDrivers] Error `, err.message);
                                }
                                else {
                                    console.log("Drivers updated");
                                }
                            });
                            resolve(true);
                        });
                    });
                }
                Promise.all(
                    driverFound.map(found => getDriverFound(found))
                ).then(() => {
                    console.log("Drivers updated");
                });
            }
            else {
                console.log("No pool drivers");
            }



        } catch (error) {
            console.log(`[${context}]Error `, error.message);
        }
    },
    updateMobileDrivers: (user) => {
        let context = "Function updateMobileDrivers";

        let query = {
            "poolOfDrivers.driverId": user._id
        };

        let newValues = {
            $set: { "poolOfDrivers.$.mobile": user.mobile }
        };

        Drivers.updateMany(query, newValues, (err, result) => {
            if (err) {
                console.log(`[${context}][.catch] Error `, err.message);
            }
            else
                console.log("Updated", result);
        });

    }

}
