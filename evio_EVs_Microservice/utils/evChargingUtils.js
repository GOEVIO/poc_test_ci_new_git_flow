const axios = require('axios')


function updateSessionStatisticsAcceptKm(evID, acceptKMs) {
    const context = " Utils updateSessionStatisticsAcceptKm"
    return new Promise((resolve, reject) => {
        try {
            let data = {
                evID: evID,
                acceptKMs: acceptKMs
            }
            axios.patch(process.env.HostStatistics + process.env.PathPatchSessionsAcceptKMs, data).then(function (sessionUpdated) {
                if (sessionUpdated) resolve(true)
                else reject(false)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(false)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(false)
        }
    })
}

function updateSessionOCPIAcceptKm(evID, acceptKMs) {
    const context = " Utils updateSessionOCPIAcceptKm"
    return new Promise((resolve, reject) => {
        try {

            let data = {
                evID: evID,
                acceptKMs: acceptKMs
            }

            axios.patch(process.env.HostOCPI + process.env.PathPatchSessionsEVAcceptKMs, data).then(function (sessionUpdated) {
                if (sessionUpdated) resolve(true)
                else reject(false)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(false)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(false)
        }
    })
}

function updateSessionChargerAcceptKm(evID, acceptKMs) {
    const context = " Utils updateSessionChargerAcceptKm"
    return new Promise((resolve, reject) => {
        try {
            let data = {
                evID: evID,
                acceptKMs: acceptKMs
            }

            axios.patch(process.env.HostCharger + process.env.PathPatchSessionsEVAcceptKMsChargers, data).then(function (sessionUpdated) {
                if (sessionUpdated) resolve(true)
                else reject(false)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(false)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(false)
        }
    })
}

function updateSessionStatisticsUpdateKMs(evID, updateKMs) {
    const context = " Utils updateSessionStatisticsUpdateKMs"
    return new Promise((resolve, reject) => {
        try {
            let data = {
                evID: evID,
                updateKMs: updateKMs
            }

            axios.patch(process.env.HostStatistics + process.env.PathPatchSessionsUpdateKMs, data).then(function (sessionUpdated) {
                if (sessionUpdated) resolve(true)
                else reject(false)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(false)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(false)
        }
    })
}

function updateSessionOCPIUpdateKMs(evID, updateKMs) {
    const context = " Utils updateSessionOCPIUpdateKMs"
    return new Promise((resolve, reject) => {
        try {

            let data = {
                evID: evID,
                updateKMs: updateKMs
            }

            axios.patch(process.env.HostOCPI + process.env.PathPatchSessionsEVUpdateKMs, data).then(function (sessionUpdated) {
                if (sessionUpdated) resolve(true)
                else reject(false)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(false)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(false)
        }
    })
}

function updateSessionChargerUpdateKMs(evID, updateKMs) {
    const context = " Utils updateSessionChargerAcceptKm"
    return new Promise((resolve, reject) => {
        try {
            let data = {
                evID: evID,
                updateKMs: updateKMs
            }

            axios.patch(process.env.HostCharger + process.env.PathPatchSessionsEVUpdateKMsChargers, data).then(function (sessionUpdated) {
                if (sessionUpdated) resolve(true)
                else reject(false)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(false)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(false)
        }
    })
}

let Utils = {
    checkKms: function (kms, listOfKMs, chargingSessionStart) {
        const context = "Utils checkKms"
        try {
            const sessionDateVarDate = new Date(chargingSessionStart)
            let evKilometers = 0
            let lastEvKms = null
            if (listOfKMs && listOfKMs.length > 0) {
                for (let index = 0; index < listOfKMs.length; index++) {

                    if (new Date(listOfKMs[index].chargingDate) > sessionDateVarDate) {
                        // the last index is what should be used to be compared
                        if (index > 0) {
                            evKilometers = listOfKMs[index - 1].kms
                            lastEvKms = {
                                _id: listOfKMs[index - 1]._id,
                                kms: listOfKMs[index - 1].kms,
                                sessionID: listOfKMs[index - 1].sessionID,
                                kmsDate: listOfKMs[index - 1].kmsDate,
                                chargerType: listOfKMs[index - 1].chargerType
                            }
                        }
                        if (listOfKMs.length >= index && kms > listOfKMs[index].kms) {
                            // the next charging charging session already has more kms
                            lastEvKms = {
                                _id: listOfKMs[index]._id,
                                kms: listOfKMs[index].kms,
                                sessionID: listOfKMs[index].sessionID,
                                kmsDate: listOfKMs[index].kmsDate,
                                chargerType: listOfKMs[index].chargerType
                            }
                            return { isValid: false, lastEvKms: lastEvKms, up: true }
                        }
                        break
                    } else if (index == listOfKMs.length - 1) {
                        evKilometers = listOfKMs[index].kms
                        lastEvKms = {
                            _id: listOfKMs[index]._id,
                            kms: listOfKMs[index].kms,
                            sessionID: listOfKMs[index].sessionID,
                            kmsDate: listOfKMs[index].kmsDate,
                            chargerType: listOfKMs[index].chargerType
                        }
                    }
                }
            }
            return kms >= evKilometers ? { isValid: true } : { isValid: false, lastEvKms: lastEvKms, up: false }
        } catch (error) {
            console.error(`[${context}] Error `, error);
            return false
        }
    },

    isInvalidTimePatch: function (dateInsertion) {
        const context = "[ utils isValidTimePatch ]"
        try {
            if (!dateInsertion) {
                console.error(`${context} Error - Invalid input date `, dateInsertion);
                return true
            }
            let dateToTimeout = new Date(dateInsertion)
            dateToTimeout.setMinutes(dateToTimeout.getMinutes() + Number(process.env.TIMEUPDATEKM));
            let dateNow = new Date()
            return dateNow > dateToTimeout

        } catch (error) {
            console.error(`${context} Error `, error);
            return true
        }
    },
    // will validate if it can add kms to the EV
    checkPatchKms: function (kms, listOfKMsModel, index) {
        const context = "[ utils checkPatchKms ]"
        try {
            let evKilometers = 0
            let lastEvKms = null
            if (listOfKMsModel.length > 1) {
                if (index > 0) {
                    evKilometers = listOfKMsModel[index - 1].kms
                    lastEvKms = {
                        _id: listOfKMsModel[index - 1]._id,
                        kms: listOfKMsModel[index - 1].kms,
                        sessionID: listOfKMsModel[index - 1].sessionID,
                        kmsDate: listOfKMsModel[index - 1].kmsDate,
                        chargerType: listOfKMsModel[index - 1].chargerType
                    }

                }
                // validation
                if (listOfKMsModel.length >= index + 2 && kms > listOfKMsModel[index + 1].kms) {
                    lastEvKms = {
                        _id: listOfKMsModel[index + 1]._id,
                        kms: listOfKMsModel[index + 1].kms,
                        sessionID: listOfKMsModel[index + 1].sessionID,
                        kmsDate: listOfKMsModel[index + 1].kmsDate,
                        chargerType: listOfKMsModel[index + 1].chargerType
                    }
                    return { isValid: false, lastEvKms: lastEvKms, up: true }
                }
            }
            return kms >= evKilometers ? { isValid: true } : { isValid: false, lastEvKms: lastEvKms, up: false }

        } catch (error) {
            console.error(`${context} Error `, error.message);
            return false
        }
    },
    getUserById: function (userID) {
        const context = "[ utils getEVByUserId ]"
        return new Promise((resolve, reject) => {
            try {

                axios.get(process.env.HostUsers + process.env.PathUsers, { headers: { "userid": userID } }).then(function (session) {
                    resolve(session)

                }).catch(function (error) {
                    console.error(`[${context}] Error `, error);
                    reject(error)
                })
            } catch (error) {
                console.error(`${context} Error `, error);
                reject(error)
            }
        })
    },
    getChargingSessionByID: function (sessionID, chargerType) {
        const context = " sessionsKms getChargingSessionByID"
        return new Promise((resolve, reject) => {
            try {
                let host = process.env.LISTCHARGERSOCPI.includes(chargerType) ? process.env.HostOCPI + process.env.PathGetSessions : process.env.HostCharger + process.env.PathGetChargingSession

                let params = {
                    sessionID: sessionID
                }
                axios.get(host, { params: params }).then(function (session) {
                    resolve(session)

                }).catch(function (error) {
                    console.error(`[${context}] Error `, error);
                    reject(null)
                })

            } catch (error) {
                console.error(`[${context}] Error `, error);
                reject(null)
            }
        });
    },
    EVupdateAcceptKmsInAllSessions: function (arrayEvID, acceptKMs) {
        const context = "Utils EVupdateAcceptKmsInAllSessions"
        return new Promise((resolve, reject) => {
            try {
                if (!Array.isArray(arrayEvID) || typeof acceptKMs !== "boolean") {
                    console.log(`[${context}] Error - missing or wrong input variables`)
                    reject(false)
                }

                // update history sessions chargers
                let isSessionStatistcsUpdated = updateSessionStatisticsAcceptKm(arrayEvID, acceptKMs)

                // update ocpi sessions
                let isSessionOCPIUpdated = updateSessionOCPIAcceptKm(arrayEvID, acceptKMs)

                // update Charger sessions
                let isChargerSessionUpdated = updateSessionChargerAcceptKm(arrayEvID, acceptKMs)

                Promise.all([isSessionStatistcsUpdated, isSessionOCPIUpdated, isChargerSessionUpdated]).then(function (allUpdated) {
                    resolve(true)
                }).catch(function (error) {
                    console.error(`[${context}] Error - Fail to update all Sessions`, error);
                    reject(false)
                })
            } catch (error) {
                console.error(`[${context}] Error `, error);
                reject(error.message)
            }
        })
    },
    EVupdateUpdateKMsInAllSessions: function (arrayEvID, updateKMs) {
        const context = "Utils EVupdateUpdateKMsInAllSessions"
        try {
            return new Promise((resolve, reject) => {
                if (!Array.isArray(arrayEvID) || typeof updateKMs !== "boolean") {
                    console.log(`[${context}] Error - missing or wrong input variables`)
                    reject(false)
                }

                // update history sessions chargers
                let isSessionStatistcsUpdated = updateSessionStatisticsUpdateKMs(arrayEvID, updateKMs)

                // update ocpi sessions
                let isSessionOCPIUpdated = updateSessionOCPIUpdateKMs(arrayEvID, updateKMs)

                // update Charger sessions
                let isChargerSessionUpdated = updateSessionChargerUpdateKMs(arrayEvID, updateKMs)

                Promise.all([isSessionStatistcsUpdated, isSessionOCPIUpdated, isChargerSessionUpdated]).then(function (allUpdated) {
                    resolve(true)
                }).catch(function (error) {
                    console.error(`[${context}] Error - Fail to update all Sessions`, error);
                    reject(false)
                })
            }).catch(function (error) {
                console.error(`[${context}] Error `, error.message);
                return false
            })
        } catch (error) {
            console.error(`[${context}] Error `, error.message);
            return false
        }
    }
}

module.exports = Utils;