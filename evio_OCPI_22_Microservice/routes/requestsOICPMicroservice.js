const express = require('express');
const router = express.Router();
const Session = require('./../models/sessions')
const CDR = require('./../models/cdrs')
const Utils = require('../utils')
const axios = require('axios')



//DB
const Tariff = require('../models/tariffs')

function getDayOfWeek() {
    const context = "[RequestsOICP getDayOfWeek]"
    try {
        let day = new Date().getDay()
        switch (day) {
            case 0:
                return "SUNDAY"
            case 1:
                return "MONDAY"
            case 2:
                return "TUESDAY"
            case 3:
                return "WEDNESDAY"
            case 4:
                return "THURSDAY"
            case 5:
                return "FRIDAY"
            case 6:
                return "SATURDAY"

            default:
                return null
                break;
        }

    } catch (error) {
        console.log(`${context} getDayOfWeek Error - `, error)
        return false
    }
}

function getCDRChargingPeriods(cdr, session) {
    const context = "[RequestsOICP getCDRChargingPeriods]"
    try {
        if (!cdr || !session) {
            console.log(` ${context} Error - missing input fields`);
            return null
        }

        let tariffElements = session.tariffOPC.elements
        let allIncluded = false // flag to know if all the charging session is contemplated in theses elements, and no need to check the next ones
        let chargingPeriods = []
        let periodDate = new Date(cdr.SessionStart) // the timestamp of what is already accounted from the periods
        for (let element of tariffElements) {
            let period = null
            let dimensions = []
            allIncluded = false
            let dayOfWeek = periodDate.getDay()
            if (element.restrictions && element.restrictions.day_of_week && !element.restrictions.day_of_week.includes(dayOfWeek)) {
                continue

            } else if (element.restrictions && element.restrictions.start_time && element.restrictions.end_time) {
                let restrictionStartDate = new Date(element.restrictions.start_time)
                let restrictionEndDate = new Date(element.restrictions.end_time)

                let beginPeriodDate = periodDate
                let endPeriodDate = new Date(cdr.SessionEnd)

                if (restrictionStartDate.getTime() >= beginPeriodDate.getTime()) beginPeriodDate = restrictionStartDate

                if (restrictionEndDate.getTime() >= endPeriodDate.getTime()) {
                    allIncluded = true
                } else endPeriodDate = restrictionEndDate


                for (let price_components of element.price_components) {
                    let volume = null
                    switch (price_components.type) {
                        case "ENERGY":
                            // since i don't have the timestamps of the meters i have to go with % of the charging session was done in this period and by that extrapolate the energy consumed
                            let beginCharging = new Date(cdr.ChargingStart)
                            let endCharging = new Date(cdr.ChargingEnd)
                            let chargingDurationSec = endCharging.getTime() - beginCharging.getTime()

                            let periodDuration = endPeriodDate.getTime() - beginPeriodDate.getTime()

                            volume = Utils.round((periodDuration / chargingDurationSec) * cdr.ConsumedEnergy, 4)
                            break;
                        case "TIME":
                            let starCharging = new Date(cdr.ChargingStart)
                            if (beginPeriodDate.getTime() >= starCharging.getTime()) starCharging = beginPeriodDate

                            let stopCharging = new Date(cdr.ChargingEnd)
                            if (stopCharging.getTime() >= endPeriodDate.getTime()) stopCharging = endPeriodDate

                            let chargingTimeSec = stopCharging.getTime() - starCharging.getTime()
                            volume = Utils.round(chargingTimeSec / (price_components.step_size * 1000), 4)
                            break;
                        case "PARKING_TIME":
                            let starParking = new Date(cdr.ChargingEnd)
                            if (beginPeriodDate.getTime() >= starParking.getTime()) starParking = beginPeriodDate

                            let stopParking = new Date(cdr.SessionEnd)
                            if (stopParking.getTime() >= endPeriodDate.getTime()) stopParking = endPeriodDate

                            let parkingTimeSec = stopParking.getTime() - starParking.getTime()
                            volume = Utils.round(parkingTimeSec / (price_components.step_size * 1000), 4)
                        case "FLAT":
                            volume = 1
                        default:
                            break;
                    }
                    let dimensionComponent = {
                        "type": price_components.type,
                        "volume": volume
                    }
                    dimensions.push(dimensionComponent)
                }

            } else {
                // no restrictions or just restriction of day of the week
                allIncluded = true
                for (price_components of element.price_components) {
                    let volume = null
                    switch (price_components.type) {
                        case "ENERGY":
                            volume = cdr.ConsumedEnergy
                            break;
                        case "TIME":
                            let starCharging = new Date(cdr.ChargingStart)
                            let stopCharging = new Date(cdr.ChargingEnd)
                            let chargingTimeSec = stopCharging.getTime() - starCharging.getTime()
                            volume = Utils.round(chargingTimeSec / (price_components.step_size * 1000), 4)
                            break;
                        case "PARKING_TIME":
                            let starParking = new Date(cdr.ChargingEnd)
                            let stopParking = new Date(cdr.SessionEnd)
                            let parkingTimeSec = stopParking.getTime() - starParking.getTime()
                            volume = Utils.round(parkingTimeSec / (price_components.step_size * 1000), 4)
                        case "FLAT":
                            volume = 1
                        default:
                            break;
                    }
                    let dimensionComponent = {
                        "type": price_components.type,
                        "volume": volume
                    }
                    dimensions.push(dimensionComponent)
                }

                period = {
                    "start_date_time": periodDate.toISOString(),
                    "dimensions": dimensions
                }
            }

            if (!period) {
                continue
            } else chargingPeriods.push(period)

            if (allIncluded) break
        }

        return chargingPeriods
    } catch (error) {
        console.log(`${context} getCDRChargingPeriods Error - `, error)
        return false
    }
}

function getCDRLocation(chargingSession, charger, plug) {
    const context = "[RequestsOICP getCDRLocation]"
    try {
        return {
            id: chargingSession.location_id,
            address: chargingSession.address.street,
            city: chargingSession.address.city,
            country: charger.address.country,
            postal_code: charger.address.zipCode,
            evse_uid: plug.uid,
            evse_id: plug.evse_id,
            connector_id: chargingSession.connector_id,
            connector_standard: plug.connectorType,
            connector_format: plug.connectorFormat,
            connector_power_type: plug.connectorPowerType,
            connector_voltage: plug.voltage,
            connector_amperage: plug.amperage,
            coordinates: {
                latitude: charger.geometry.coordinates[1],
                longitude: charger.geometry.coordinates[0],
            }
        }
    } catch (error) {
        console.log(`${context} checkCDRFields Error - `, error)
        return false
    }
}


function transformCDRModel(cdr, charger, session) {
    const context = "[RequestsOICP transformCDRModel]"
    try {
        if (!cdr || !charger || !session) {
            console.log(` ${context} Error - missing input fields`);
            return null
        }

        let plug = charger.plugs.find(plug => plug.plugId == session.connector_id)
        if (!plug) {
            console.log(` ${context} Error - Connector ID not found`);
            return null
        }

        let cdrLocation = getCDRLocation(session, charger, plug)
        if (!cdrLocation) {
            console.log(` ${context} Error - Can't generate CDR Location`);
            return null
        }
        // get charging total time
        let sessionStartDate = new Date(cdr.SessionStart)
        let sessionStopDate = new Date(cdr.SessionEnd)
        let chargingDuration = sessionStopDate.getTime() - sessionStartDate.getTime()

        // get parking total time
        let parkingStartDate = new Date(cdr.ChargingEnd)
        let parkingDuration = sessionStopDate.getTime() - parkingStartDate.getTime()  // this is the diference between the stopcharging time and the end of session
        let chargingPeriods = getCDRChargingPeriods(cdr, session)
        if (!chargingPeriods) {
            console.log(` ${context} Error - Can't generate CDR chargingPeriods`);
            return null
        }

        let last_updated = new Date()
        return {
            country_code: charger.country_code,
            party_id: session.party_id,
            id: cdr.SessionID,
            start_date_time: cdr.SessionStart,
            end_date_time: cdr.SessionEnd,
            session_id: cdr.SessionID,
            cdr_token: session.cdr_token,
            auth_method: "AUTH_REQUEST",
            cdr_location: cdrLocation,
            currency: "EUR",
            source: "Hubject",
            total_energy: cdr.ConsumedEnergy,
            total_time: Number(chargingDuration / 3600000),               // convert milisecond to Hours
            total_parking_time: Number(parkingDuration / 3600000),         // convert milisecond to Hours
            last_updated: last_updated.toISOString(),
            charging_periods: chargingPeriods,
            tariffs: session.tariffOPC
        }
    } catch (error) {
        console.log(` ${context} Error - `, error.message);
        return null
    }
}

function getHubjectCharger(plugID) {
    const context = "[requestOICP getHubjectCharger]"
    return new Promise(async (resolve, reject) => {
        try {
            if (!plugID) {
                console.log(`${context} Error - Missing plugID`)
                reject(null)
            }
            let params = {
                connectorID: plugID
            }
            axios.get(process.env.HostPublicNetwork + "/api/private/chargerHubject", { params }).then(function (charger) {
                if (!charger.data) resolve(null)
                else resolve(charger.data)
            }).catch(function (err) {
                console.log(` ${context} Error - `, err.message);
                reject(null)
            })
        } catch (error) {
            console.log(` ${context} Error - `, error.message);
            reject(null)
        }
    })
}


function generateHubjectMeterValue(chargingSession, meterDate, totalDurationMeter, totalEnergyConsumedMeter) {
    const context = "[requestOICP generateHubjectMeterValue ]"
    try {
        if (!chargingSession || !meterDate || (!totalDurationMeter && !totalEnergyConsumedMeter)) {
            console.log(` ${context} Error - missing input fields`);
            return null
        }

        let dimensions = []
        if (totalEnergyConsumedMeter > 0) {
            // this is the energy consumed between this and the last measurement
            let consumedEnergy = totalEnergyConsumedMeter - chargingSession.kwh

            let dimension = {
                type: "ENERGY",
                volume: consumedEnergy
            }
            dimensions.push(dimension)
        }
        if (totalDurationMeter > 0) {
            // this is the time used between this and the last measurement
            // totalDurationMeter is sent in miliseconds

            let consumedTime = ((totalDurationMeter / 1000) - chargingSession.timeCharged) / 3600      // consumedTime is in hour
            let dimension = {
                type: "TIME",
                volume: consumedTime
            }
            dimensions.push(dimension)
        }
        if (dimensions.length < 1) {
            console.log(`${context} Error - No dimensions generated from this meter value`)
            return null
        }

        return { start_date_time: meterDate.toISOString(), dimensions: dimensions }
    } catch (error) {
        console.log(` ${context} Error - `, error);
        return null
    }
}


function updateSession(session) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!session) {
                console.log(`updateSession Error- Missing session`)
                resolve(false)
            }
            let query = {
                source: "Hubject",
                roamingTransactionID: session.roamingTransactionID
            }

            //await Session.updateSession(query, session)
            Session.updateSession(query, session, (err, result) => {
                if (err) {
                    console.log(`updateSession Error - `, err);
                    resolve(false);

                } else resolve(result)
            })
        } catch (error) {
            console.log(`updateSession Error `, error);
            resolve(false)
        }
    })
}


router.post('/api/private/HubjectCreateSession', (req, res, next) => {
    const context = "POST /api/private/HubjectCreateSession";
    try {
        const data = req.body
        // console.log(`${context} just received something ... ${JSON.stringify(req.body)}`)

        if (!data) {
            console.log(`${context} Error - no Session data in request`)
            return res.status(400).send({ status: false, desc: "no Session data in request" });
        }

        let session = new Session(data)

        if (!session) {
            console.log(`${context} Error - creating Session object`)
            return res.status(400).send({ status: false, desc: "creating Session object" });
        }
        Session.create(session, (err, result) => {

            if (!result || err) return res.status(400).send({ status: false, desc: "fail saving Session" });
            else return res.status(200).send({ status: true, sessionID: session._id });
        })

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send({ status: false, desc: "catch error" });
    };
});

router.get('/api/private/getHubjectSession', (req, res, next) => {
    const context = "GET /api/private/getHubjectSession";
    try {
        const hubjectSessionID = req.query.sessionID
        // console.log(`${context} Something is here :)`,req.query)

        if (!hubjectSessionID) {
            console.log(`${context} Error- request without Session ID`)
            return res.status(500).send(false)
        }

        let query = {
            source: "Hubject",
            roamingTransactionID: hubjectSessionID
        }

        Session.findOne(query, (err, session) => {
            if (err) {
                console.log(`${context} findOne Error- `, err)
                return res.status(500).send(false)
            }
            return res.status(200).send(session)

        })

    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(false);
    }
})

router.get('/api/private/getActiveSession', (req, res, next) => {
    const context = "GET /api/private/getActiveSession";
    try {
        const id = req.query.sessionID
        // console.log(`${context} Something is here :)`,req.query)

        if (!hubjectSessionID) {
            console.log(`${context} Error- request without Session ID`)
            return res.status(500).send(false)
        }

        let query = {
            source: "Hubject",
            id: id,
            status: "ACTIVE"
        }

        Session.findOne(query, (err, session) => {
            if (err) {
                console.log(`${context} findOne Error- `, err)
                return res.status(500).send(false)
            }
            if (!session) return res.status(200).send(false)
            else return res.status(200).send(session)

        })

    } catch (error) {
        console.log(`[${context}] Error `, error)
        return res.status(500).send(false)
    }
})

router.post('/api/private/saveCDR', async (req, res, next) => {
    const context = "POST /api/private/saveCDR"
    try {
        const cdr = req.body.cdr
        const cdrID = req.body.cdrId

        if (!cdr || !cdrID) {
            console.log(`${context} Error - missing input values`)
            return res.status(500).send({ status: false, message: "missing input values" })
        }

        let session = await Utils.getHubjectSession(cdr.SessionID)
        if (!session) {
            console.log(`${context} Error - No session for this cdr ID`)
            return res.status(400).send({ status: false, message: "No session for this cdr ID" })
        }

        if (session.cdrId && session.cdrId !== "-1") {
            console.log(`${context} Warning - this session already has an cdr!`)
            return res.status(200).send({ status: true, message: "this session already has an cdr!", ocpiID: session.cdrId })
        }

        let charger = await getHubjectCharger(session.connector_id)
        if (!charger) {
            console.log(`${context} Error - Charger Not found`)
            return res.status(400).send({ status: false, message: "Charger Not found" })
        }

        // let's create the CDR object
        let cdrOCPI = transformCDRModel(cdr, charger, session)

        if (!cdrOCPI) {
            console.log(`${context} Error - Unable to create OCPI CDR format `)
            return res.status(500).send({ status: false, message: "Unable to create OCPI CDR format" })
        }
        //let cdrData = Utils.getCDRModelObj(cdrOCPI)
        const new_cdr = new CDR(cdrOCPI)
        CDR.create(new_cdr, (err, result) => {

            if (result) {
                Utils.processBillingAndPaymentRoaming(new_cdr.session_id, cdrOCPI);
                return res.status(200).send({ status: true, message: "Success", ocpiID: new_cdr._id })
            } else {
                console.log("CDR not created ", err);
                return res.status(400).send({ status: false, message: "CDR not created" })
            }
        })

    } catch (error) {
        console.log(`[${context}] Error `, error)
        return res.status(500).send({ status: false, message: error })
    }
})

router.post('/api/private/updateSessionCharge', (req, res, next) => {
    const context = "POST /api/private/updateSessionCharge";
    try {
        const chargingSession = req.body.session

        if (!chargingSession) {
            console.log(`[${context}] Error - No input values`)
            return res.status(500).send(false);
        }

        updateSession(chargingSession).then(function (result) {
            if (!result) {
                console.log(`[${context}] updateSession Error - Fail to update the charging Session`);
                return res.status(500).send(false);
            } else return res.status(200).send(true);

        }).catch(function (err) {
            console.log(`[${context}] updateSession Error `, err);
            return res.status(500).send(false);
        })
    } catch (error) {
        console.log(`[${context}] Error `, error); res.status(500).send(false);
        return res.status(500).send(false);
    }
})

router.get('/api/private/token', (req, res, next) => {
    const context = "get /api/private/token";
    try {
        const contractID = req.query.contractID
        const tokenUID = req.query.uid
        if (tokenUID) {
            Utils.getUserId(tokenUID).then(function (token) {
                return res.status(200).send(token);

            }).catch(function (err) {
                console.log(`[${context}] getUserId Error `, err);
                return res.status(500).send(false);
            })
        } else if (contractID) {
            Utils.getUserIdToken(contractID).then(function (token) {
                return res.status(200).send(token);

            }).catch(function (err) {
                console.log(`[${context}] getUserId Error `, err);
                return res.status(500).send(false);
            })

        } else {
            console.log(`[${context}] Error - No input values`)
            return res.status(500).send(false);
        }
    } catch (error) {
        console.log(`[${context}] Error `, error);
        return res.status(500).send(false);
    }
})

router.post('/api/private/tariff', async (req, res, next) => {
    const context = "post /api/private/tariff";
    try {
        const listTariff = req.body.tariff

        if (!listTariff || !Array.isArray(listTariff)) {
            console.log(`[${context}] Error - No input tariff`)
            return res.status(400).send(false);
        }
        for (let tariff of listTariff) {
            const query = {
                source: "Hubject",
                id: tariff.id,
                party_id: tariff.party_id
            }
            const del = await Tariff.deleteOne(query)
            const newTariff = new Tariff(tariff)
            // console.log("Le new Tariff :", JSON.stringify(newTariff))
            const saved = await Tariff.create(newTariff)
            console.log("new Tariff created :", newTariff.id)
        }

        return res.status(200).send(true)

    } catch (error) {
        console.log(`[${context}] Error `, error)
        return res.status(500).send(false);
    }
})

// save all the tariffs of a particular operator ID
router.post('/api/private/tariffs', async (req, res, next) => {
    const context = "post /api/private/tariff";
    try {
        const listTariff = req.body.tariffs
        const operatorID = req.body.operatorID

        if (!listTariff || !operatorID) {
            console.log(`[${context}] Error - No input tariff`)
            return res.status(400).send(false);
        }
        const query = {
            source: "Hubject",
            party_id: operatorID
        }
        const del = await Tariff.deleteMany(query)
        if (!del.ok) {
            console.log(`[${context}] Error - Fail to delete old Tariffs`, del)
            return res.status(400).send(false)
        }
        for (let tariff of listTariff) {
            const newTariff = new Tariff(tariff)
            // console.log("Le new Tariff :", JSON.stringify(newTariff))
            const saved = await Tariff.create(newTariff)
            console.log("new Tariff created :", newTariff.id)
        }
        return res.status(200).send(true)

    } catch (error) {
        console.log(`[${context}] Error `, error)
        return res.status(500).send(false);
    }
})

router.get('/api/private/tariff', async (req, res, next) => {
    const context = "get /api/private/tariff";
    try {
        const tariffId = req.query.tariff

        if (!tariffId) {
            console.log(`[${context}] Error - No input tariff`)
            return res.status(400).send(false);
        }
        const query = {
            id: tariffId,
            source: "Hubject"
        }
        const result = await Tariff.find(query)
        return res.status(200).send(result)
    } catch (error) {
        console.log(`[${context}] Error `, error)
        return res.status(500).send(false)
    }
})

router.delete('/api/private/tariff', async (req, res, next) => {
    const context = "post /api/private/tariff";
    try {
        const operatorID = req.body.operatorID

        if (!operatorID) {
            console.log(`[${context}] Error - No input operatorID`)
            return res.status(400).send(false);
        }
        const query = {
            party_id: operatorID,
            source: "Hubject"
        }
        const result = await Tariff.deleteMany(query)
        return res.status(200).send(result.ok == 1 ? true : false)
    } catch (error) {
        console.log(`[${context}] Error `, error)
        return res.status(500).send(false)
    }
})

router.get('/api/private/tariffByOperator', async (req, res, next) => {
    const context = "get /api/private/tariffByOperator"
    try {
        const operatorID = req.query.operatorID
        if (!operatorID) {
            console.log(`[${context}] Error - No input operatorID`)
            return res.status(400).send(false)
        }
        const query = {
            party_id: operatorID,
            source: "Hubject"
        }

        const result = await Tariff.find(query)
        return res.status(200).send(result)

    } catch (error) {
        console.log(`[${context}] Error `, error)
        return res.status(500).send(false)
    }
})

// this endpoit is only to be used when a new charger is beeing created or updated
router.get('/api/private/getTariffsForEVSE', async (req, res, next) => {
    const context = "[get /api/private/getTariffsForEVSE]"
    try {
        const evseID = req.query.evseID
        const operatorID = req.query.operatorID
        const priceModel = req.query.priceModel

        if (!priceModel || !evseID || !operatorID) {
            console.log(`${context} Error - Missing Input values`)
            return res.status(500).send(false)
        }
        let tariffList = []
        let query
        switch (priceModel) {
            case "Flexible/Dynamic":
                query = {
                    party_id: operatorID,
                    source: "Hubject",
                    id: {
                        $ne: + operatorID + "_Default"
                    }
                }
                tariffList = await Tariff.distinct("id", query)
                // console.log(`${context} - Le tariff: `, tariffList)
                break;
            case "ProductPricing":
                query = {
                    party_id: operatorID,
                    source: "Hubject"
                }
                tariffList = await Tariff.distinct("id", query)
                break
            case "Standard":
                break;
            default:
                console.log(`${context} - Unknown priceModel: `, context)
                break;
        }
        // the Default tariff must be the last of the tariffs
        // console.log(`${context} - Tariffs: `, tariffList)
        return res.status(200).send(tariffList)

    } catch (error) {
        console.log(`${context} Error `, error)
        return res.status(500).send(false)
    }
})


// this endpoint will validate witch tariff should be used for the charging session
router.post('/api/private/validateTariffs', async (req, res, next) => {
    const context = "[post /api/private/validateTariffs]"
    try {
        const plug = req.body.plug
        const listTariffs = req.body.listTariffs
        const startDate = new Date(req.body.startDate)
        const chargerCountryCode = req.body.country

        if (!plug || !listTariffs || !Array.isArray(listTariffs) || !startDate || !(startDate instanceof Date) || !chargerCountryCode) {
            console.log(`${context} Error - missing input fields `)
            return res.status(400).send(false)
        }

        let tariffPlug = {}
        for (let tariffID of listTariffs) {
            tariff = await Utils.getTariffOPC(tariffID)
            if (!tariff) continue

            if (!Utils.passTariffRestrictions(tariff.elements, plug.power, plug.connectorPowerType, startDate, chargerCountryCode)) continue

            tariffPlug.tariffId = tariffID
            // check if tariff is the default
            let defaultTariffName = tariff.party_id + "_Default"
            // in case is not the default we must add the elements of the default tariff for the charging session, if exist's
            if (defaultTariffName !== tariffID) {
                let tariffDefault = await Utils.getTariffOPC(defaultTariffName)
                if (tariffDefault) {
                    for (let defaultElement of tariffDefault.elements) {
                        tariff.elements.push(defaultElement)
                    }
                }
            }
            tariffPlug.tariffOPC = tariff
        }
        return res.status(200).send(tariffPlug)
    } catch (error) {
        console.log(`${context} Error `, error)
        return res.status(500).send(false)
    }
})

// this is to be used when we receive an Charging Notification of type Start
router.post('/api/private/processNotificationStart', async (req, res, next) => {
    const context = "[post /api/private/processNotificationStart ]"
    try {
        const evseID = req.body.evseID
        const hubjectSessionID = req.body.hubjectSessionID
        const sessionID = req.body.sessionID
        const chargingStart = req.body.chargingStart

        let tariffID = req.body.tariffID
        const cpoSessionID = req.body.cpoSessionID
        const meterValueStart = req.body.meterValueStart

        const chargingStartDate = chargingStart !== null ? new Date(chargingStart) : null

        if (!evseID || !hubjectSessionID || !chargingStart || (chargingStart && !(chargingStartDate instanceof Date))) {
            console.log(`${context} Error - missing input fields `)
            return res.status(400).send(false)
        }
        let query = {
            id: hubjectSessionID
        }
        Utils.chargingSessionFindOne(query).then(function (session) {
            if (!session) {
                console.log(`${context} Error - No charging Session`)
                return res.status(200).send({ status: false, message: "No charging Session" })
            }
            // validate tariff ID
            if (tariffID) {
                if (tariffID == "Standard Price" && session.roamingOperatorID) tariffID = session.roamingOperatorID + "_Default"

                if (tariffID !== session.tariffOPC.id) {
                    console.log(`${context} Error !! - TariffID doesn't match the one used in the session ! `, tariffID, " on session ID: ", session.id)
                    // TODO
                    //Should send an email to warn abou this error
                }
            }

            /* let meter = generateHubjectMeterValue(session, chargingStartDate, 0, 0)
             console.log("meter: ", meter)
             if (!meter) {
                 console.log(`${context} Error - Fail to generate New Meter for Session`)
                 return res.status(500).send({ status: false, message: "Fail to generate New Meter for Session" })
             }*/

            let startDate = new Date(chargingStart)

            session.status = "ACTIVE"
            session.start_date_time = startDate.toISOString()
            session.kwh = 0
            //   charging_periods: [meter]

            if (meterValueStart) updateValues.roamingStartEnergy = meterValueStart

            updateSession(session).then(function (result) {
                if (!result) {
                    console.log(`[${context}] updateSession Error - Fail to update the charging Session`);
                    return res.status(500).send({ status: false, message: "Fail to update the charging Session" });
                }
                // send start Notification
                Utils.updateSessionMeterValuesRoaming(result, session, true).then(function (updatedMeter) {
                    return res.status(200).send({ status: true, message: "Success" })
                })


            }).catch(function (err) {
                console.log(`[${context}] updateSession Error `, err);
                return res.status(500).send({ status: false, message: err.message });
            })
        }).catch(function (err) {
            console.log(`${context} Error `, err.message)
            return res.status(500).send({ status: false, message: err.message })
        })
    } catch (error) {
        console.log(`${context} Error `, error)
        return res.status(500).send({ status: false, message: error.message })
    }
})

router.post('/api/private/processNotificationProgress', async (req, res, next) => {
    const context = "[post /api/private/processNotificationProgress ]"
    try {
        const evseID = req.body.evseID
        const hubjectSessionID = req.body.hubjectSessionID
        const sessionID = req.body.sessionID
        const chargingStart = req.body.chargingStart
        const event = req.body.eventDate

        let tariffID = req.body.tariffID
        const cpoSessionID = req.body.cpoSessionID
        const energyConsumed = req.body.energyConsumed
        const duration = req.body.duration
        const metervalues = req.body.metervalues

        const chargingStartDate = chargingStart !== null ? new Date(chargingStart) : null
        const eventDate = event !== null ? new Date(event) : null
        console.log(`${context} - received data:  `, req.body)
        if (!evseID || !hubjectSessionID || !chargingStart || (chargingStart && !(chargingStartDate instanceof Date)) || !event || (event && !(eventDate instanceof Date)) || (!energyConsumed && !duration)) {
            console.log(`${context} Error - Missing input fields`)
            console.log(`${context} Error - `, evseID, hubjectSessionID, chargingStart, event, energyConsumed, duration)
            return res.status(200).send({ status: false, message: "Missing input fields" })
        }

        let query = {
            id: hubjectSessionID
        }
        Utils.chargingSessionFindOne(query).then(function (session) {
            if (!session) {
                console.log(`${context} Error - No charging Session`)
                return res.status(200).send({ status: false, message: "No charging Session" })
            }

            if (tariffID) {
                if (tariffID == "Standard Price" && session.roamingOperatorID) tariffID = `${session.roamingOperatorID}_Default`

                if (tariffID !== session.tariffOPC.id) {
                    console.log(`${context} Error !! - TariffID doesn't match the one used in the session ! `, tariffID, " on session ID: ", session.id)
                    // TODO
                    //Should send an email to warn abou this error
                }
            }
            let meter = generateHubjectMeterValue(session, eventDate, duration, energyConsumed)
            if (!meter) {
                console.log(`${context} Error - Fail to generate New Meter for Session`)
                return res.status(500).send({ status: false, message: "Fail to generate New Meter for Session" })
            }


            session.status = "ACTIVE"
            session.start_date_time = chargingStartDate.toISOString()
            session.charging_periods = session.charging_periods

            session.charging_periods.push(meter)
            if (duration) session.timeCharged = duration
            if (chargingStartDate) session.roamingStartEnergy = chargingStartDate.toISOString()

            // create session object OCPI

            if (energyConsumed) session.kwh = energyConsumed
            updateSession(session).then(function (result) {
                if (!result) {
                    console.log(`[${context}] updateSession Error - Fail to update the charging Session`);
                    return res.status(500).send({ status: false, message: "Fail to update the charging Session" });
                }

                Utils.updateSessionMeterValuesRoaming(result, session, true).then(function (updatedMeter) {
                    return res.status(200).send({ status: true, message: "Success" })
                }).catch(function (error) {
                    console.log(`[${context}] updateSessionMeterValuesRoaming Error `, error)
                    return res.status(500).send({ status: false, message: err.message })
                })

            }).catch(function (err) {
                console.log(`[${context}] updateSession Error `, err)
                return res.status(500).send({ status: false, message: err.message })
            })

        })
    } catch (error) {
        console.log(`${context} Error `, error)
        return res.status(500).send({ status: false, message: error.message })
    }
})

router.post('/api/private/processStopProgress', async (req, res, next) => {
    const context = "[post /api/private/processStopProgress ]"
    try {

        const evseID = req.body.evseID
        const hubjectSessionID = req.body.hubjectSessionID
        const sessionID = req.body.sessionID
        const chargingStop = req.body.chargingStop
        const tariffID = req.body.tariffID
        const cpoSessionID = req.body.cpoSessionID
        const energyConsumed = req.body.energyConsumed
        const duration = req.body.duration

        const chargingStopDate = chargingStop !== null ? new Date(chargingStop) : null

        if (!evseID || !hubjectSessionID || !chargingStop || (chargingStop && !(chargingStopDate instanceof Date))) {
            console.log(`${context} Error - Missing input fields`)
            return res.status(200).send({ status: false, message: "Missing input fields" })
        }

        let query = {
            id: hubjectSessionID
        }
        Utils.chargingSessionFindOne(query).then(function (session) {
            if (!session) {
                console.log(`${context} Error - No charging Session`)
                return res.status(200).send({ status: false, message: "No charging Session" })
            }

            let meter = null
            if (energyConsumed || duration) {
                meter = generateHubjectMeterValue(session, chargingStopDate, duration, energyConsumed)
            }
            session.endOfEnergyDate = chargingStopDate.toISOString()
            session.roamingStopCharging = chargingStopDate.toISOString()

            if (meter) session.charging_periods.push(meter)
            if (duration) session.timeCharged = duration
            if (energyConsumed) session.kwh = energyConsumed

            updateSession(session).then(function (result) {
                if (!result) {
                    console.log(`[${context}] updateSession Error - Fail to update the charging Session`);
                    return res.status(500).send({ status: false, message: "Fail to update the charging Session" });
                }
                // send start Notification
                Utils.updateSessionStopMeterValuesRoaming(result).then(async function (updatedMeter) {
                    if (!updatedMeter) {
                        //await Utils.sendStopNotification(result);
                        return res.status(200).send({ status: true, message: "Success" })
                    } else return res.status(500).send({ status: false, message: "fail to update charging Session" })

                }).catch(function (error) {
                    console.log(`[${context}] updateSessionStopMeterValuesRoaming Error `, error)
                    return res.status(500).send({ status: false, message: err.message })
                })

            }).catch(function (err) {
                console.log(`[${context}] updateSession Error `, err);
                return res.status(500).send({ status: false, message: err.message });
            })
        }).catch(function (error) {
            console.log(`[${context}] updateSession Error `, error)
            return res.status(500).send({ status: false, message: error.message })
        })
    } catch (error) {
        console.log(`${context} Error `, error)
        return res.status(500).send({ status: false, message: error.message })
    }
})

router.post('/api/private/processError', async (req, res, next) => {
    const context = "[post /api/private/processError ]"
    try {
        const evseID = req.body.evseID
        const hubjectSessionID = req.body.hubjectSessionID
        const sessionID = req.body.sessionID
        const errorType = req.body.errorType
        const errorInfo = req.body.errorInfo

        if (!evseID || !hubjectSessionID || !sessionID || !errorType) {
            console.log(`${context} Error - Missing input fields`)
            return res.status(200).send({ status: false, message: "Missing input fields" })
        }

        let query = {
            id: sessionID
        }
        Utils.chargingSessionFindOne(query).then(function (session) {
            if (!session) {
                console.log(`${context} Error - No charging Session`)
                return res.status(200).send({ status: false, message: "No charging Session" })
            }
            // add description of the error
            let message = null
            if (errorInfo) {
                message = `Error ${errorType} - ${errorInfo}`
            } else message = errorType


            let updateValues = {
                notes: message
            }

            updateSession(updateValues).then(function (result) {
                if (!result) {
                    console.log(`[${context}] updateSession Error - Fail to update the charging Session`);
                    return res.status(500).send({ status: false, message: "Fail to update the charging Session" });
                }

                return res.status(200).send({ status: true, message: "Success" })
            }).catch(function (error) {
                console.log(`[${context}] updateSession Error `, error)
                return res.status(500).send({ status: false, message: error.message })
            })
        })

    } catch (error) {
        console.log(`[${context}] updateSession Error `, error)
        return res.status(500).send({ status: false, message: error.message })
    }
})


router.post('/api/private/chargingSessionStatus', async (req, res, next) => {
    const context = "[post /api/private/chargingSessionStatus ]"
    try {

        const sessionStatus = req.body.sessionStatus
        const sessionID = req.body.sessionID

        if (!sessionID || !sessionStatus) {
            console.log(`${context} Error - Missing input fields`)
            return res.status(400).send({ status: false })
        }
        let query = {
            id: sessionID
        }
        Utils.chargingSessionFindOne(query).then(async function (session) {
            if (!session) {
                console.log(`${context} Error - Unknown sessionID `, sessionID)
                return res.status(400).send({ status: false })
            }
            let startDate = new Date()
            await Session.updateOne(query, { $set: { status: sessionStatus , start_date_time: startDate.toISOString()} })
            return res.status(200).send({ status: true })

        }).catch(function (err) {
            console.log(`[${context}] updateSession Error `, err)
            return res.status(500).send({ status: false })
        })
    } catch (error) {
        console.log(`[${context}] updateSession Error `, error)
        return res.status(500).send({ status: false })
    }
})

module.exports = router;
