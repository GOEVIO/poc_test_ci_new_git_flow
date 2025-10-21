const GroupCSUsers = require('../models/groupCSUsers')
const { logger } = require('../utils/constants');

module.exports = {
    userGroupCSUsers: async (user) => {
        let context = "Function userGroupCSUsers";
        try {
            let query = {
                'listOfUsers': {
                    $elemMatch: {
                        'mobile': user.mobile,
                        'internationalPrefix': user.internationalPrefix,
                        'active': false
                    }
                },
                clientName: user.clientName
            };
            let groupCSUsersFound = await GroupCSUsers.find(query)

            if (groupCSUsersFound.length > 0) {
                const getUser = (userToAdd) => {
                    return new Promise((resolve) => {
                        if (userToAdd.mobile == user.mobile && userToAdd.internationalPrefix == user.internationalPrefix) {
                            userToAdd.active = true;
                            userToAdd.userId = user._id;
                            resolve(true);
                        }
                        else
                            resolve(false);
                    });
                };
                const getGroupCSUsers = (groupCSUsers) => {
                    return new Promise((resolve, reject) => {
                        Promise.all(
                            groupCSUsers.listOfUsers.map(userToAdd => getUser(userToAdd))
                        ).then(() => {
                            var newValue = { $set: groupCSUsers };
                            var query = {
                                _id: groupCSUsers._id
                            };
                            GroupCSUsers.updateGroupCSUsers(query, newValue, (err, result) => {
                                if (err) {
                                    console.log(`[${context}][updateGroupCSUsers] Error `, err.message);
                                    reject(err)
                                }
                                else {
                                    resolve(true);
                                };
                            });

                        });
                    });
                }
                Promise.all(
                    groupCSUsersFound.map(groupCSUsers => getGroupCSUsers(groupCSUsers))
                ).then(() => {
                    console.log("Group Charger Station Users updated");
                }).catch((error) => {
                    console.log(`[${context}][ Promise.all] Error `, error.message);
                });
            }
            else {
                console.log("No group charger station users");
            };

        } catch (error) {
            console.log(`[${context}]Error `, error.message);
        }
    },
    updateMobileGroupCSUsers: (user) => {
        let context = "Function updateMobileGroupCSUsers";

        let query = {
            "listOfUsers.userId": user._id
        };

        let newValues = {
            $set: { "listOfUsers.$.mobile": user.mobile }
        };

        GroupCSUsers.updateMany(query, newValues, (err, result) => {
            if (err) {
                console.log(`[${context}][.catch] Error `, err.message);
            }
            else
                console.log("Updated", result);
        });
    }
}