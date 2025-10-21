const EV = require('../models/ev');
const ExternalRequest = require('./externalRequestHandler')

module.exports = {
    getEVsSharedWithMe: (userId) => {
        let context = "Funciton getEVsSharedWithMe";
        return new Promise(async (resolve, reject) => {
            try {

                if (!userId)
                    reject({ auth: false, code: 'server_user_id_required', message: "User Id required" });

                let groupDrivers = await ExternalRequest.getGroupDrivers(userId);
                let evs = await getEvsShared(userId, groupDrivers);

                resolve(evs);

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
        })
    },
    validateOnlyOneEV: async (userId) => {
        let context = "Funciton validateOnlyOneEV";

        let evsFound = await EV.find({ userId: userId, hasFleet: true })
        if (evsFound.length === 1) {
            let evUpdated = await EV.findOneAndUpdate({ userId: userId, hasFleet: true }, { $set: { primaryEV: true } }, { new: true })
        }
    },
    sharedEvsAndMyEvs: (userId) => {
        let context = "Funciton sharedEvsAndMyEvs";
        return new Promise(async (resolve, reject) => {
            try {

                let groupDrivers = await ExternalRequest.getGroupDrivers(userId);

                let evs = await sharedEvsAndMyEvs(userId , groupDrivers)
                
                let newListOfEvs = await ExternalRequest.getEvsAndMyEvsInfo(evs , groupDrivers , userId);

                resolve(newListOfEvs);

            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                reject(error);
            }
        })
    }
}


function getEvsShared(userId, groupDrivers) {
    let context = "Function getEvsShared";
    return new Promise((resolve, reject) => {

        //var dateNow = new Date();
        let query;
        if (groupDrivers.length == 0) {
            query = {
                $or: [
                    {
                        'listOfDrivers': {
                            $elemMatch: {
                                userId: userId
                            }
                        }
                    }
                ],
                hasFleet: true

            };
        }
        else {
            query = {
                $or: [
                    {
                        'listOfDrivers': {
                            $elemMatch: {
                                userId: userId
                            }
                        }
                    },
                    {
                        'listOfGroupDrivers': {
                            $elemMatch: {
                                groupId: groupDrivers
                            }
                        }
                    }
                ],
                hasFleet: true
            };
        };

        EV.find(query, (err, evsFound) => {
            if (err) {
                console.error(`[${context}][find] Error `, err.message);
                reject(err)
            }

            resolve(evsFound);

        });
    });
};



async function queryEvs(query) {
    let context = "Function queryEvs";
    try  {
        return await EV.find(query).lean()
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}

async function sharedEvsAndMyEvs(userId , groupDrivers) {
    let context = "Function sharedEvsAndMyEvs";
    try {
        let query = {
            $or: [
                {
                    userId : userId
                },
                {
                    'listOfDrivers': {
                        $elemMatch: {
                            userId: userId
                        }
                    }
                }
            ],
            hasFleet: true

        };
        if (groupDrivers.length !== 0) {
            query["$or"].push(
                {
                    'listOfGroupDrivers': {
                        $elemMatch: {
                            groupId: groupDrivers
                        }
                    }
                }
            )
        }
        return await queryEvs(query)
    } catch (error) {
        console.error(`[${context}][find] Error `, error.message);
        throw new Error(error)
    }
}