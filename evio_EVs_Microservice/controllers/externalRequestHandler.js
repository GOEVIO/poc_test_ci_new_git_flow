const AxiosHandler = require('../services/axios');

module.exports = {
    getGroupDrivers: (userId) => {
        let context = "Function getGroupDrivers";
        return new Promise(async (resolve, reject) => {
            try {
                let host = process.env.HostUsers + process.env.PathGetGroupDrivers;
                let headers = {
                    userid: userId
                };

                let groupsDrivers = await AxiosHandler.axiosGetHeaders(host, headers);

                if (groupsDrivers.length == 0) {
                    resolve(groupsDrivers);
                }
                else {
                    let groupDrivers = [];
                    const getGroupId = (group) => {
                        return new Promise((resolve) => {
                            groupDrivers.push(group._id);
                            resolve(true);
                        });
                    };
                    Promise.all(
                        groupsDrivers.map(group => getGroupId(group))
                    ).then(() => {
                        resolve(groupDrivers);
                    });
                }
            } catch (error) {
                console.error(`[${context}] Error`, error.message);
                reject(error);
            };
        });
    },
    getEvsAndMyEvsInfo: (evs , groupDrivers , userId) => {
        let context = "Function getEvsAndMyEvsInfo";
        return new Promise(async (resolve, reject) => {
            try {
                if (evs?.length > 0) {
                    let host = process.env.HostUsers + process.env.PathGetEvsAndMyEvsInfo;
                    let newListOfEvs = await AxiosHandler.axiosGetBody(host, {evs , groupDrivers , userId});
                    resolve(newListOfEvs)
                } else {
                    resolve([])
                }
            } catch (error) {
                console.error(`[${context}] Error`, error.message);
                reject(error);
            };
        });
    },
    getUserFleetsInfo: (evs , userId = undefined) => {
        let context = "Function getUserFleetsInfo";
        return new Promise(async (resolve, reject) => {
            try {
                if (evs?.length > 0) {
                    let host = process.env.HostUsers + process.env.PathGetUserFleetsInfo;
                    let newListOfEvs = await AxiosHandler.axiosGetBody(host, {evs , userId});
                    resolve(newListOfEvs)
                } else {
                    resolve([])
                }
            } catch (error) {
                console.error(`[${context}] Error`, error.message);
                reject(error);
            };
        });
    },
    getEvsDriversInfo: (evs) => {
        let context = "Function getEvsDriversInfo";
        return new Promise(async (resolve, reject) => {
            try {
                if (evs?.length > 0) {
                    let host = process.env.HostUsers + process.env.PathGetEvsListsInfo;
                    let newListOfEvs = await AxiosHandler.axiosGetBody(host, {evs});
                    resolve(newListOfEvs)
                } else {
                    resolve([])
                }
            } catch (error) {
                console.error(`[${context}] Error`, error.message);
                reject(error);
            };
        });
    }
}