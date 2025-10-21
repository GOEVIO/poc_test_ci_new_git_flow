const axios = require('axios')
const Fleets = require('../models/fleets')
const Ev = require('../models/ev')
const Utils = require('../utils/evChargingUtils')

async function updateEVSAcceptedKMs(listEvs, acceptKMs) {
    let context = "[fleetKm updateEVSAcceptedKMs]"
    try {
        if (!listEvs || typeof acceptKMs !== "boolean") {
            console.error(`[${context}] Error - missing input information`, listEvs, acceptKMs);
            return false
        }

        if (listEvs.length < 1) return false // nothing to do, this is just a last protection
        let listEvids = []
        let ids = []
        for (let ev of listEvs) {
            if (!ev.evId) {
                console.log(`${context} Error - EV without id ??`, ev)
                continue
            }

            listEvids.push(ev.evId)
            ids.push({ _id: ev.evId })
        }

        let updateAll = await Utils.EVupdateAcceptKmsInAllSessions(listEvids, acceptKMs)
        if (!updateAll) {
            console.log(`${context} Error -Fail to update All sessions from ev: `, listEvids,)
            return false
        }
        let query = { $or: ids }
        await Ev.updateMany(query, { $set: { "acceptKMs": acceptKMs } })
        console.log(`All ${listEvs.length} EV acceptedKm set to `, acceptKMs)
        return true
    } catch (error) {
        console.error(`${context} Error `, error)
        return false
    }
}

function findOneFleet(query) {
    var context = "fleetKm findOneFleet";
    return new Promise((resolve, reject) => {
        try {
            Fleets.findOne(query, (err, fleetFound) => {
                if (err) {
                    console.error(`[${context}][findOne] Error `, err.message);
                    reject(err);
                } else {
                    if (fleetFound) {
                        resolve(fleetFound);
                    } else
                        reject({ auth: false, code: 'server_fleet_not_found', message: "Fleet not found for given parameters" });
                };
            });
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return res.status(500).send(error.message);
        };
    });
};

async function updateEVSAcceptedUpdateKMs(listEvs, updateKMs) {
    let context = "[fleetKm updateEVSAcceptedUpdateKMs]"
    try {
        if (!Array.isArray(listEvs) || typeof updateKMs !== "boolean") {
            console.error(`[${context}] Error - missing input information`, listEvs, updateKMs);
            return false
        }

        if (listEvs.length < 1) return false // nothing to do, this is just a last protection

        let listEvids = []
        let ids = []
        for (let ev of listEvs) {
            if (!ev.evId) {
                console, log(`${context} Error - EV without id ??`, ev)
                continue
            }

            listEvids.push(ev.evId)
            ids.push({ _id: ev.evId })
        }

        let updateAll = await Utils.EVupdateUpdateKMsInAllSessions(listEvids, updateKMs)
        if (!updateAll) {
            console.log(`${context} Error -Fail to update All sessions`)
            return false
        }

        let query = { $or: ids }
        await Ev.updateMany(query, { $set: { "updateKMs": updateKMs } })

        console.log(`All ${listEvs.length} EV acceptedKm set to `, updateKMs)
        return true
    } catch (error) {
        console.error(`[${context}] Error `, error.message)
        return false
    }
}

module.exports = {
    updateAcceptKms: function (arrayFleetId, acceptKms) {
        var context = "FleetKm updateAcceptKms "
        return new Promise(async (resolve, reject) => {
            try {
                if (!Array.isArray(arrayFleetId) || arrayFleetId.length < 1 || typeof acceptKms !== "boolean") {
                    console.error(`[${context}] Error - missing input information`);
                    reject({ "status": 400, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": "missing input information", "type": "dialog" } })
                }

                let listEvs = []
                let queryUpdate = []
                for (let fleetID of arrayFleetId) {

                    let query = {
                        _id: fleetID
                    }

                    let fleet = await findOneFleet(query)
                    if (!fleet) continue

                    queryUpdate.push({ _id: fleetID })

                    if (fleet.listEvs.length > 0) {
                        for (let evId of fleet.listEvs) {
                            listEvs.push(evId)
                        }
                    }

                }
                if (listEvs.length > 0) {
                    let allUpdated = await updateEVSAcceptedKMs(listEvs, acceptKms)
                    if (!allUpdated) {
                        console.log(`[${context}] - Error - Fail to Update All`)
                        reject({ "status": 500, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": "Fail to Update All", "type": "dialog" } })
                    }
                }
                // update the fleet with the 
                query = { $or: queryUpdate }
                let fleetUpdated = await Fleets.updateMany(query, { $set: { "acceptKMs": acceptKms } })
                if (!fleetUpdated) {
                    console.error(`[${context}][updateFleets] Error `, fleetUpdated);
                    reject({ "status": 400, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": "Fail to Update Fleet", "type": "dialog" } })
                }

                return resolve({ "message": { "auth": true, "code": "configurationKeys_updateSuccessful", "message": "Success", "type": "dialog" } });
            } catch (error) {
                console.error(`[${context}] Error `, error);
                return reject({ "status": 500, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": error.message, "type": "dialog" } });
            }
        })
    },
    updateUpdateKms: function (arrayFleetId, updateKMs) {
        var context = "FleetKm updateUpdateKms "
        return new Promise(async (resolve, reject) => {
            try {
                if (!Array.isArray(arrayFleetId) || arrayFleetId.length < 1 || typeof updateKMs !== "boolean") {
                    console.error(`[${context}] Error - missing input information`);
                    reject({ "status": 400, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": "missing input information", "type": "dialog" } })
                }

                let listEvs = []
                let queryUpdate = []
                for (let fleetID of arrayFleetId) {
                    let query = {
                        _id: fleetID
                    }
                    let fleet = await findOneFleet(query)
                    if (!fleet) continue

                    queryUpdate.push({ _id: fleetID })

                    if (fleet.listEvs.length > 0) {
                        for (let evId of fleet.listEvs) {
                            listEvs.push(evId)
                        }
                    }
                }
                if (listEvs.length > 0) {
                    let allUpdated = await updateEVSAcceptedUpdateKMs(listEvs, updateKMs)
                    if (!allUpdated) {
                        console.log(`[${context}] - Error - Fail to Update All`)
                        reject({ "status": 500, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": "Fail to Update All", "type": "dialog" } })
                    }
                }

                // update the fleet with the 
                query = { $or: queryUpdate }
                let fleetUpdated = await Fleets.updateMany(query, { $set: { "updateKMs": updateKMs } })
                if (!fleetUpdated) {
                    console.error(`[${context}][updateFleets] Error `);
                    reject({ "status": 400, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": "Fail to Update Fleet", "type": "dialog" } })
                }
                return resolve({ "message": { "auth": true, "code": "configurationKeys_updateSuccessful", "message": "Success", "type": "dialog" } });


            } catch (error) {
                console.error(`[${context}] Error `, error);
                return reject({ "status": 500, "message": { "auth": false, "code": "configurationKeys_updateSuccessful", "message": error.message, "type": "dialog" } });
            }
        })
    }
}