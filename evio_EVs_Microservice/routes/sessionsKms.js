const express = require('express')
const router = express.Router()
require("dotenv-safe").load()
const axios = require('axios')
const schedule = require('node-schedule');
const Utils = require('../utils/evChargingUtils');
const { isInputKmValid } = require('../utils/validationUtils');

// bd
const ObjectId = require('mongodb').ObjectID;
const EV = require('../models/ev')

const AddKmHandler = require('../handlers/addKmToEV')


function updateSession(evKms, sessionID, chargerType) {
    const context = " sessionsKms updateSession"
    return new Promise((resolve, reject) => {
        try {
            const data = {
                updateObject: evKms,
                sessionID: sessionID,

            }
            let host = process.env.LISTCHARGERSOCPI.includes(chargerType) ? process.env.HostOCPI + process.env.PathGetSessions : process.env.HostCharger + process.env.PathGetChargingSession

            axios.patch(host, data).then(function (sessionUpdated) {
                resolve(sessionUpdated)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(error)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(error)
        }
    })
}

function updateSessionStatistics(evKms, sessionID) {
    const context = " sessionsKms updateSessionStatistics"
    return new Promise((resolve, reject) => {
        try {
            const data = {
                updateObject: evKms,
                sessionID: sessionID,
            }

            axios.patch(process.env.HostStatistics + process.env.PathPatchSessionsKms, data).then(function (sessionUpdated) {
                resolve(sessionUpdated)

            }).catch(function (error) {
                console.error(`[${context}] Error `, error);
                reject(error.message)
            })
        } catch (error) {
            console.error(`[${context}] Error `, error);
            reject(error.message)
        }
    })
}

router.post('/api/ev/session/kms', async (req, res, next) => {
    const context = " POST /api/private/session/kms"
    try {
        const { kms, evID, sessionID, userID: useriD, chargerType } = req.body;

        if (!isInputKmValid(req.body)) {
            console.error(`[${context}] Error - Invalid input data`);
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Invalid input data", type: "topmessage" });
        }

        // check for EVid
        const ev = await EV.findOne({ _id: evID })
        if (!ev) {
            console.error(`[${context}] Error - No ev found `, evID)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No EV found", type: "topmessage" });
        }
        if (!ev.acceptKMs) {
            console.error(`[${context}] Error - EV doesn't accept Kms`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "EV doesn't accept Kms", type: "topmessage" });
        }
        // get session 
        let responseSession = await Utils.getChargingSessionByID(sessionID, chargerType)
        if (responseSession.status !== 200) {
            console.error(`[${context}] Error - Getting Charging Session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Charging Session", type: "topmessage" });
        }
        let chargingSession = responseSession.data
        if (!chargingSession) {
            console.error(`[${context}] Error - No charging session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No charging session", type: "topmessage" });
        }

        if (chargingSession.evKms) {
            console.error(`[${context}] Error - Charging Session Already has km `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Charging Session Already has km", type: "topmessage" });
        }

        // get user
        let responseUser = await Utils.getUserById(useriD)
        if (responseUser.status !== 200) {
            console.error(`[${context}] Error - Getting Charging Session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Charging Session", type: "topmessage" });
        }
        const user = responseUser.data
        if (!user) {
            console.error(`[${context}] Error - No user Found`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No user Found", type: "topmessage" });
        }
        const isFleetManager = user.clientType == "b2b" ? true : false

        let chargingSessionStart = null
        if (!chargingSession.startDate && !chargingSession.start_date_time) {
            console.error(`[${context}] Error - Missing Start Date from Charging Session`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Missing start date from Charging Session", type: "topmessage" });

        } else if (chargingSession.startDate) chargingSessionStart = new Date(chargingSession.startDate)
        else if (chargingSession.start_date_time) chargingSessionStart = new Date(chargingSession.start_date_time)

        // check kms
        const checkKmsObject = Utils.checkKms(kms, ev.listOfKMs, chargingSessionStart)
        if (!checkKmsObject || !checkKmsObject.isValid) {
            // get last charging session
            let lastSessionUpdateKMs = true
            if (typeof checkKmsObject.lastEvKms) {
                let responseLastSession = await Utils.getChargingSessionByID(checkKmsObject.lastEvKms.sessionID, checkKmsObject.lastEvKms.chargerType)
                if (responseLastSession.status !== 200 || !responseLastSession.data) {
                    console.error(`[${context}] Error - Getting Charging Session `)
                    return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Last Charging Session", type: "topmessage" });
                }
                if (responseLastSession.data.userId !== chargingSession.userId && !isFleetManager) {
                    // in case the last charging session was made by other user
                    return res.status(400).send({ auth: false, code: "patch_km_different_user", message: "Last session has more km, please contact your fleet manager to correct this problem", type: "dialog" });
                }
                lastSessionUpdateKMs = responseLastSession.data.updateKMs
            }

            if ((!lastSessionUpdateKMs && Utils.isInvalidTimePatch(checkKmsObject.lastEvKms.kmsDate)) && !isFleetManager) {
                if (checkKmsObject.lastEvKms) {
                    delete checkKmsObject.lastEvKms._id
                    delete checkKmsObject.lastEvKms.sessionID
                    delete checkKmsObject.lastEvKms.chargerType
                }
                return res.status(409).send({
                    message: {
                        auth: false,
                        code: checkKmsObject.up ? "insertKm_messageErrorKmSupAndDateUpdateFalse" : "insertKm_messageErrorKmAndDateUpdateFalse",
                        message: "km InvalID",
                        type: "dialog"
                    },
                    lastEvKms: {
                        ...checkKmsObject.lastEvKms,
                        sessionStartDate: chargingSessionStart
                    }
                });
            }
            else return res.status(409).send({
                message: {
                    auth: false,
                    code: checkKmsObject.up ? "insertKm_messageErrorKmSupAndDateUpdateTrue" : "insertKm_messageErrorKmAndDateUpdateTrue",
                    message: "km InvalID", type: "dialog"
                },
                lastEvKms: {
                    ...checkKmsObject.lastEvKms,
                    sessionStartDate: chargingSessionStart
                }
            });
        }

        // update EV  
        const kmAdded = await AddKmHandler.addKmToEV(evID, kms, sessionID, chargingSessionStart, isFleetManager, chargerType, chargingSession._id)
        if (kmAdded.status !== 200) {
            console.error(`[${context}] Error - Updating km to EV `, kmAdded.data)
            return res.status(400).send({ auth: false, code: kmAdded.data.message ? kmAdded.data.message.code : "error", message: kmAdded.data.message ? kmAdded.data.message.message : "Updating km to EV", type: "topmessage" });
        }

        let dateNow = new Date()
        let evKms = {
            evKms: {
                kms: kms,
                kmsDate: dateNow,
                updatedKmsDate: dateNow
            }
        }
        // update statistics session (if exists)
        const responseUpdateStatistics = await updateSessionStatistics(evKms, process.env.LISTCHARGERSOCPI.includes(chargerType) ? chargingSession.id : chargingSession.sessionId)
        if (!responseUpdateStatistics || responseUpdateStatistics.status !== 200 || !responseUpdateStatistics.data) {
            console.error(`[${context}] Error - Updating Charging Session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Updating Charging Statistics Session", type: "topmessage" });
        }
        // update session
        const responseUpdateSession = await updateSession(evKms, sessionID, chargerType)
        if (responseUpdateSession.status !== 200 || !responseUpdateSession.data) {
            console.error(`[${context}] Error - Updating Charging Session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Updating Charging Session", type: "topmessage" });
        }

        return res.status(200).send({ message: { auth: true, code: "configurationKeys_updateSuccessful", message: "Success", type: "topmessage" }, chargingSession: responseUpdateSession.data })
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send({ message: { auth: false, code: "general_genericErrorMessage", message: error?.message ? error.message : "", type: "topmessage" } });
    }
})

router.patch('/api/ev/session/kms', async (req, res, next) => {
    const context = " PATCH /api/private/session/kms"
    try {
        const { kms, evID, sessionID, userID: useriD, chargerType } = req.body;

        if (!isInputKmValid(req.body)) {
            console.error(`[${context}] Error - Invalid input data`);
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Invalid input data", type: "topmessage" });
        }

        // check for EVid
        const ev = await EV.findOne({ _id: evID })
        if (!ev) {
            console.error(`[${context}] Error - No ev found `, evID)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No EV found", type: "topmessage" });
        }
        // check if sessionID is in this listofKms of this EV
        const sessionIdFinder = (kms) => kms.sessionID == sessionID
        const index = ev.listOfKMs.findIndex(sessionIdFinder)
        if (index < 0) {
            console.error(`[${context}] Error - listOfKMsModel doesn't have this session ID`);
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "listOfKMsModel doesn't have this session ID", type: "topmessage" });
        }

        if (!ev.acceptKMs) {
            console.error(`[${context}] Error - EV doesn't accept Kms`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "EV doesn't accept Kms", type: "topmessage" });
        }

        // get session 
        let responseSession = await Utils.getChargingSessionByID(sessionID, chargerType)
        if (responseSession.status !== 200) {
            console.error(`[${context}] Error - Getting Charging Session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Charging Session", type: "topmessage" });
        }
        let chargingSession = responseSession.data
        if (!chargingSession) {
            console.error(`[${context}] Error - No charging session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No charging session", type: "topmessage" });
        }

        if (!chargingSession.evKms) {
            console.error(`[${context}] Error - Charging Session doesn't have km`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Charging Session doesn't have km", type: "topmessage" });
        }

        // get user
        let responseUser = await Utils.getUserById(useriD)
        if (responseUser.status !== 200) {
            console.error(`[${context}] Error - Getting Charging Session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Charging Session", type: "topmessage" });
        }
        const user = responseUser.data
        if (!user) {
            console.error(`[${context}] Error - No user Found`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "No user Found", type: "topmessage" });
        }
        const isFleetManager = user.clientType == "b2b" ? true : false
        // check time 
        if (!isFleetManager && Utils.isInvalidTimePatch(chargingSession.evKms.kmsDate) && !chargingSession.updateKMs) {
            console.error(`[${context}] Error - Has passed the time allowed to update, pls contact the fleet manager`)
            return res.status(400).send({ auth: false, code: "patch_km_timeout", message: "Has passed the time allowed to update, please contact your fleet manager", type: "dialog" });
        }

        let chargingSessionStart = null
        if (!chargingSession.startDate && !chargingSession.start_date_time) {
            console.error(`[${context}] Error - Missing Start Date from Charging Session`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Missing start date from Charging Session", type: "topmessage" });

        } else if (chargingSession.startDate) chargingSessionStart = new Date(chargingSession.startDate)
        else if (chargingSession.start_date_time) chargingSessionStart = new Date(chargingSession.start_date_time)

        // check kms
        const checkKmsObject = Utils.checkPatchKms(kms, ev.listOfKMs, index)
        if (!checkKmsObject || !checkKmsObject.isValid) {
            // get last charging session
            let lastSessionUpdateKMs = true
            if (checkKmsObject.lastEvKms) {
                let responseLastSession = await Utils.getChargingSessionByID(checkKmsObject.lastEvKms.sessionID, checkKmsObject.lastEvKms.chargerType)
                if (responseLastSession.status !== 200 || !responseLastSession.data) {
                    console.error(`[${context}] Error - Getting Charging Session `)
                    return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Getting Last Charging Session", type: "topmessage" });
                }
                if (responseLastSession.data.userId !== chargingSession.userId && !isFleetManager) {
                    // in case the last charging session was made by other user
                    return res.status(400).send({ auth: false, code: "patch_km_different_user", message: "Last session has more km, please contact your fleet manager to correct this problem", type: "dialog" });
                }
                lastSessionUpdateKMs = responseLastSession.data.updateKMs
            }

            if ((!lastSessionUpdateKMs && Utils.isInvalidTimePatch(checkKmsObject.lastEvKms.kmsDate)) && !isFleetManager) {
                if (checkKmsObject.lastEvKms) {
                    delete checkKmsObject.lastEvKms._id
                    delete checkKmsObject.lastEvKms.sessionID
                    delete checkKmsObject.lastEvKms.chargerType
                }

                return res.status(409).send({
                    message: {
                        auth: false,
                        code: checkKmsObject.up ? "insertKm_messageErrorKmSupAndDateUpdateFalse" : "insertKm_messageErrorKmAndDateUpdateFalse",
                        message: "km InvalID",
                        type: "dialog"
                    },
                    lastEvKms: {
                        ...checkKmsObject.lastEvKms,
                        sessionStartDate: chargingSessionStart
                    }
                });
            } else return res.status(409).send({
                message: {
                    auth: false,
                    code: checkKmsObject.up ? "insertKm_messageErrorKmSupAndDateUpdateTrue" : "insertKm_messageErrorKmAndDateUpdateTrue",
                    message: "km InvalID",
                    type: "dialog"
                },
                lastEvKms: {
                    ...checkKmsObject.lastEvKms,
                    sessionStartDate: chargingSessionStart
                }
            });

        }

        // const kmUpdated = await AddKmHandler.patchKmToEV(evID, kms, sessionID, ev.listOfKMs[index].chargingDate, isFleetManager, chargerType)
        const kmUpdated = await AddKmHandler.patchKmToEV(evID, kms, sessionID, isFleetManager, chargingSession._id)
        if (kmUpdated.status !== 200) {
            console.error(`[${context}] Error - Updating km to EV `, kmUpdated.data)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Updating km to EV", type: "topmessage" });
        }

        // updating session
        const dateNow = new Date();
        let evKms = {
            evKms: {
                kms: kms,
                kmsDate: chargingSession.evKms.kmsDate,
                updatedKmsDate: dateNow
            }
        }

        // update statistics session (if exists)
        const responseUpdateStatistics = await updateSessionStatistics(evKms, process.env.LISTCHARGERSOCPI.includes(chargerType) ? chargingSession.id : chargingSession.sessionId)
        if (responseUpdateStatistics.status !== 200 || !responseUpdateStatistics.data) {
            console.error(`[${context}] Error - Updating Charging Session Sttaistics`)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Updating Charging Session", type: "topmessage" });
        }

        const responseUpdateSession = await updateSession(evKms, sessionID, chargerType)
        if (responseUpdateSession.status !== 200 || !responseUpdateSession.data) {
            console.error(`[${context}] Error - Updating Charging Session `)
            return res.status(400).send({ auth: false, code: "general_genericErrorMessage", message: "Error Updating Charging Session", type: "topmessage" });
        }

        return res.status(200).send({ message: { auth: true, code: "configurationKeys_updateSuccessful", message: "Success", type: "topmessage" }, chargingSession: responseUpdateSession.data })

    } catch (error) {
        console.error(`[${context}] Error `, error);
        return res.status(500).send({ message: { auth: false, code: "general_genericErrorMessage", message: typeof error.message != "undefined" ? error.message : "", type: "topmessage" } });
    }
})
module.exports = router;