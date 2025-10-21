require("dotenv-safe").load();
const axios = require("axios");
const ErrorHandler = require("./errorHandler");

const { findGroupCSUser, findContractByIdTag } = require('evio-library-identity/dist').default;

module.exports = {
    getContract: async function (idTag, res) {
        let context = "Function getContract";
        try {
            const contract = await findContractByIdTag(idTag);
            return contract || "-1";
        } catch (error) {
            console.error(`[${context}][.catch] Error `, error.message);
            //ErrorHandler.ErrorHandler(error, res);
            return "-1";
            
        }
    },
    getListUsers: function (userId, userIdWillPay, evOwnerId, chargerOwnerId) {
        let context = "Function getListUsers";
        return new Promise((resolve, reject) => {

            let listUsers = [];

            if (userId && userId != "-1" && userId.toUpperCase() != 'UNKNOWN')
                if (!listUsers.some(user => user === userId))
                    listUsers.push(userId)


            if (userIdWillPay && userIdWillPay != "-1" && userIdWillPay.toUpperCase() != 'UNKNOWN')
                if (!listUsers.some(user => user === userIdWillPay))
                    listUsers.push(userIdWillPay);


            if (chargerOwnerId && chargerOwnerId != "-1" && chargerOwnerId.toUpperCase() != 'UNKNOWN')
                if (!listUsers.some(user => user === chargerOwnerId))
                    listUsers.push(chargerOwnerId);

            if (evOwnerId && evOwnerId != "-1" && typeof evOwnerId === 'string')
                if (evOwnerId.toUpperCase() != 'UNKNOWN')
                    if (!listUsers.some(user => user === evOwnerId))
                        listUsers.push(evOwnerId);

            console.log("listUsers", listUsers);

            let host = process.env.HostUsers + process.env.PathGetListUsers;

            let params = {
                _id: listUsers
            };

            axios.get(host, { params })
                .then((result) => {

                    //console.log("result.data", result.data);

                    if (result.data.length === 0) {
                        var response = {
                            user: "-1",
                            userWillPay: "-1",
                            chargerOwner: "-1",
                            evOwner: "-1"
                        };
                        resolve(response);
                    }
                    else {

                        let user = result.data.find(newUser => {
                            return newUser._id === userId;
                        });
                        let userWillPay = result.data.find(newUser => {
                            return newUser._id === userIdWillPay;
                        });
                        let chargerOwner = result.data.find(newUser => {
                            return newUser._id === chargerOwnerId;
                        });
                        let evOwner = result.data.find(newUser => {
                            return newUser._id === evOwnerId;
                        });

                        if (!user)
                            user = "-1";

                        if (!userWillPay)
                            userWillPay = "-1";

                        if (!chargerOwner)
                            chargerOwner = "-1";

                        if (!evOwner)
                            evOwner = "-1";

                        var response = {
                            user: user,
                            userWillPay: userWillPay,
                            chargerOwner: chargerOwner,
                            evOwner: evOwner
                        };
                        resolve(response);
                    };

                })
                .catch((error) => {
                    console.error(`[${context}][${host}] Error`, error.message);
                    //ErrorHandler.ErrorHandler(error, res);
                    var response = {
                        user: "-1",
                        userWillPay: "-1",
                        chargerOwner: "-1",
                        evOwner: "-1"
                    };
                    resolve(response);
                });
        });
    },
    getUser: function (userId) {
        let context = "Function getUser";
        return new Promise((resolve, reject) => {

            let headers = {
                userid: userId
            };

            let host = process.env.HostUsers + process.env.PathGetUser;

            axios.get(host, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {

                    console.error(`[${context}][${host}] Error`, error.message);
                    //ErrorHandler.ErrorHandler(error, res);
                    resolve('-1');

                });
        });
    },
    async getGroupsCSUsersIdentity (groups) {
        const context = "Function getGroupsCSUsers history handle";
        try {
            const groupIds = groups.map(group => group.groupId).filter(group=> !!group)
    
            const query = { "_id" : { $in : groupIds } }
    
            const groupsResult = await findGroupCSUser(query);
    
            const result = groupsResult?.map(groupFound => {
                const group = groups.find(sourceGroup => sourceGroup.groupId === groupFound._id);
                delete groupFound._id;
                return {
                    ...group,
                    ...groupFound,
                }
            })
    
            return result
    
        } catch (error) {
            console.error(`[${context}][.catch] Error `, error.message);
            throw error;
        }
    },
};

//========== FUNCTION ==========