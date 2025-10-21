const GroupCSUsersDependencies = require('../models/groupCSUsersDependencies')
const GroupCSUsersHandler = require('./groupCSUsers');
const { logger } = require('../utils/constants');

module.exports = {
    userGroupCSUsersDependencies: async (user) => {
        let context = "Function userGroupCSUsersDependencies";
        try {
            let query = {
                'users': {
                    $elemMatch: {
                        'mobile': user.mobile,
                        'internationalPrefix': user.internationalPrefix,
                        'registered': false
                    }
                },
                clientName: user.clientName
            };
            let groupCSUsersDependenciesFound = await GroupCSUsersDependencies.find(query)

            if (groupCSUsersDependenciesFound.length > 0) {
                GroupCSUsersHandler.userGroupCSUsers(user);
                const getUser = (userToAdd) => {
                    return new Promise((resolve) => {
                        if (userToAdd.mobile == user.mobile && userToAdd.internationalPrefix == user.internationalPrefix) {
                            userToAdd.registered = true;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getGroupCSUsersDependencies = (groupCSUsersDependencies) => {
                    return new Promise((resolve, reject) => {
                        Promise.all(
                            groupCSUsersDependencies.users.map(userToAdd => getUser(userToAdd))
                        ).then(() => {
                            let newValue = { $set: groupCSUsersDependencies };
                            let query = {
                                _id: groupCSUsersDependencies._id
                            };
                            GroupCSUsersDependencies.updateGroupCSUsersDependencies(query, newValue, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateGroupCSUsersDependencies] Error `, err.message);
                                    reject(err);
                                }
                                else {
                                    resolve(true);
                                };
                            });
                        });
                    });
                };
                Promise.all(
                    groupCSUsersDependenciesFound.map(groupCSUsersDependencies => getGroupCSUsersDependencies(groupCSUsersDependencies))
                ).then(() => {
                    console.log("Group of Charger Station Users Dependencies updated");
                }).catch((error) => {
                    console.log(`[${context}][Promise.all] Error `, error.message);
                });
            }
            else {
                console.log("No pending Group charger station users");
            };

        } catch (error) {
            console.log(`[${context}]Error `, error.message);
        }
    }
}