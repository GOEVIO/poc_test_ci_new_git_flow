const EV = require('../models/ev')
const { ObjectId } = require('mongodb');

const Utils = require('../utils/evChargingUtils')

function orderKmsByDate(listKm) {
    const context = "EV orderKmsByDate"
    try {
        if (listKm.length < 2) {
            return listKm
        }
        return listKm.sort(function (a, b) {
            return new Date(a.chargingDate) - new Date(b.chargingDate);
        })
    } catch (error) {
        console.error(`[${context}] Error `, error);
        return listKm
    }
}


module.exports = {
    addKmToEV: function (evID, kms, sessionID, sessionDate, isFleetManager, chargerType, session_id) {
        const context = "AddKmToEV Handler addKmToEV"
        return new Promise(async (resolve, reject) => {
            try {

                let query = {
                    _id: new ObjectId(evID)
                }
                EV.findOne(query).then(function (ev) {
                    if (!ev) {
                        return resolve({ status: 400, data: { message: { auth: false, code: "unknown_evID", message: "Unknown EV ID" } } })
                    }

                    // check kilometers sent
                    const checkKmsObject = Utils.checkKms(kms, ev.listOfKMs, sessionDate)
                    if (!checkKmsObject || !checkKmsObject.isValid) {
                        if (Utils.isInvalidTimePatch(checkKmsObject.lastEvKms.chargingDate) && !isFleetManager) return res.status(409).send({ message: { auth: false, code: "insertKm_messageErrorKmAndDateUpdateFalse", message: "km InvalID", type: "dialog" }, lastEvKms: checkKmsObject.lastEvKms });
                        else return res.status(409).send({ message: { auth: false, code: "insertKm_messageErrorKmAndDateUpdateTrue", message: "km InvalID", type: "dialog" }, lastEvKms: checkKmsObject.lastEvKms });
                    }

                    if (!ev.acceptKMs) {
                        console.error(`[${context}] Error - EV doens't allow to add Kms`);
                        return resolve({ status: 400, data: { message: { auth: false, code: "error", message: "EV doens't allow to add Kms" } } })
                    }
                    // it will not be validated the session ID because this request should be sent after updating the session data
                    let date = new Date()
                    let kmsObject = {
                        _id: session_id,
                        kms: kms,
                        sessionID: sessionID,
                        chargerType: chargerType,
                        kmsDate: date,
                        updatedKmsDate: date,
                        chargingDate: sessionDate
                    }

                    ev.listOfKMs.push(kmsObject)

                    ev.listOfKMs = orderKmsByDate(ev.listOfKMs)
                    EV.findOneAndUpdate(query, { $set: { listOfKMs: ev.listOfKMs } }, { new: true }).then(function (updatedEV) {
                        console.log(`Kilometers added to EV ${updatedEV._id}`)
                        return resolve({ status: 200, data: { message: { auth: true, code: "success", message: "Success" }, ev: updatedEV } })

                    }).catch(function (error) {
                        console.error(`[${context}] Error `, error.message);
                        return resolve({ status: 500, data: { message: { auth: false, code: "error", message: error.message } } })
                    })

                }).catch(function (error) {
                    console.error(`[${context}] Error `, error.message);
                    return resolve({ status: 500, data: { message: { auth: false, code: "error", message: error.message } } })
                })
            } catch (error) {
                console.error(`[${context}] Error `, error.message);
                return resolve({ status: 500, data: { message: { auth: false, code: "error", message: error.message } } })
            }
        })
    },
    patchKmToEV: function (evID, kms, sessionID, isFleetManager) {
        const context = "AddKmToEV Handler patchKmToEV"
        return new Promise(async (resolve, reject) => {
            try {

                if (!evID || kms < 0 || !sessionID || typeof isFleetManager !== "boolean") {
                    console.error(`[${context}] Error - missing or wrong input variables`)
                    return resolve({ status: 400, data: { auth: false, code: "general_genericErrorMessage", message: "missing or wrong input variables" } })
                }

                let query = {
                    _id: new ObjectId(evID)
                }
                EV.findOne(query).then(function (ev) {
                    if (!ev) {
                        return resolve({ status: 400, data: { auth: false, code: "general_genericErrorMessage", message: "Unknown EV ID" } })
                    }
                    // check if sessionID is in this listofKms of this EV
                    const sessionIdFinder = (kms) => kms.sessionID == sessionID
                    let index = ev.listOfKMs.findIndex(sessionIdFinder)
                    if (index < 0) {
                        console.error(`[${context}] Error - listOfKMsModel doesn't have this session ID`);
                        return resolve({ status: 400, data: { auth: false, code: "general_genericErrorMessage", message: "listOfKMsModel doesn't have this session ID" } })
                    }

                    if (!ev.acceptKMs) {
                        console.error(`[${context}] Error - Ev doesn't acceptKMS`);
                        return resolve({ status: 400, data: { auth: false, code: "general_genericErrorMessage", message: "EV doens't allow to add Kms" } })
                    }

                    // check kilometers sent
                    const checkKmsObject = Utils.checkPatchKms(kms, ev.listOfKMs, index)
                    if (!checkKmsObject || !checkKmsObject.isValid) {
                        if (Utils.isInvalidTimePatch(checkKmsObject.lastEvKms.chargingDate) && !isFleetManager) return resolve({ status: 409, data: { message: { auth: false, code: "insertKm_messageErrorKmAndDateUpdateFalse", message: "km InvalID", type: "dialog" }, lastEvKms: checkKmsObject.lastEvKms } })
                        else resolve({ status: 409, data: { message: { auth: false, code: "insertKm_messageErrorKmAndDateUpdateTrue", message: "km InvalID", type: "dialog" }, lastEvKms: checkKmsObject.lastEvKms } })
                    }

                    // it will not be validated the session ID because this request should be sent after updating the session data
                    let date = new Date()
                    ev.listOfKMs[index].kms = kms
                    ev.listOfKMs[index].updatedKmsDate = date

                    EV.findOneAndUpdate(query, { $set: { listOfKMs: ev.listOfKMs } }, { new: true }).then(function (updatedEV) {
                        console.log(`Kilometers added to EV ${updatedEV._id}`)
                        return resolve({ status: 200, data: { message: { auth: true, code: "success", message: "Success" }, ev: updatedEV } })

                    }).catch(function (error) {
                        console.error(`[${context}] Error `, error.message);
                        return resolve({ status: 500, data: { message: { auth: false, code: "general_genericErrorMessage", message: error.message } } })
                    })

                }).catch(function (error) {
                    console.error(`[${context}] Error `, error);
                    return resolve({ status: 500, data: { message: { auth: false, code: "general_genericErrorMessage", message: error.message } } })
                })
            } catch (error) {
                console.error(`[${context}] Error `, error);
                return resolve({ status: 500, data: { message: { auth: false, code: "general_genericErrorMessage", message: error.message } } })
            }
        })
    }

}