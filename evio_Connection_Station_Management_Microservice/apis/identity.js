const axios = require('axios');

function getUserAccount(userId) {
    var context = "Function getUserAccount";
    return new Promise((resolve, reject) => {
        try {

            var host = process.env.IdentityHost + process.env.UsersAccountsPath;
            var headers = {
                userid: userId
            };

            axios.get(host, { headers })
                .then((result) => {

                    resolve(result.data);

                })
                .catch((error) => {

                    console.log(`[${context}] [${host}] Error `, error.message);
                    resolve({});
                    //reject(error.message);

                });

        } catch (error) {

            console.log(`[${context}] Error `, error.message);
            resolve({});
            //reject(error.message);

        };
    });
};

function getContractByIdTagValidate(userId, idTag, evId, networkType) {
    const context = "Function getContractByIdTagValidate";
    return new Promise(async (resolve, reject) => {
        let host = process.env.IdentityHost + process.env.PathGetContractByIdTag;

        let params = {
            userId: userId,
            idTag: idTag,
            networkType: networkType,
            evId: evId
        };

        axios.get(host, { params })
            .then((result) => {

                if (result.data) {


                    resolve(result.data.contract);


                } else {
                    resolve("-1");
                };

            })
            .catch((error) => {
                console.log(`[${context}][${host}] Error `, error.message);
                resolve("-1");
            });
    });
};

function getContractByIdTag(userId, idTag, evId) {
    var context = "Function getContractByIdTag";
    return new Promise(async (resolve, reject) => {
        var host = process.env.IdentityHost + process.env.PathGetContractByIdTag;

        var params = {
            userId: userId,
            idTag: idTag,
            networkType: 'EVIO',
            evId: evId
        };

        axios.get(host, { params })
            .then((result) => {

                if (result.data) {
                    if (result.data.cardNumber)
                        resolve(result.data.cardNumber);
                    else
                        resolve("-1");
                }
                else {
                    resolve("-1");
                };

            })
            .catch((error) => {
                console.log(`[${context}][${host}] Error `, error.message);
                resolve("-1");
            });
    });
};

module.exports = {
    getUserAccount,
    getContractByIdTagValidate,
    getContractByIdTag
};