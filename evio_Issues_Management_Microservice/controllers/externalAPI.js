const axios = require("axios");

module.exports = {
    getNameOfUser: function (issuesFound) {
        var context = "Function getNameOfUser";
        return new Promise((resolve, reject) => {
            try {
                var host = process.env.HostUser + process.env.PathGetUser;
                const getNameOfUser = (issue) => {
                    return new Promise((resolve, reject) => {
                        var headers = {
                            userid: issue.issuedUserId
                        };
                        axios.get(host, { headers })
                            .then((value) => {
                                var userFound = value.data;
                                issue.issuedUserId = userFound.name;
                                resolve(true);
                            })
                            .catch((error) => {
                                console.error(`[${context}][getNameOfUser] Error`, error.message);
                                reject(error);
                            });
                    });
                };

                Promise.all(
                    issuesFound.map(issue => getNameOfUser(issue))
                ).then(() => {
                    resolve(issuesFound);
                }).catch((error) => {
                    console.error(`[${context}][issuesFound.map] Error `, error.message);
                    reject(error);
                })

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            };
        });
    }
};