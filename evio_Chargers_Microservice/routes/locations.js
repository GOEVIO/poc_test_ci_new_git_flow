const express = require('express');
const router = express.Router();
require("dotenv-safe").load();
const Sentry = require("@sentry/node");
// handlers 
const commsSubscriptionHandler = require('../handlers/commsSubscription')
// BD
const ObjectID = require("mongodb").ObjectId
const Locations = require('../models/locations')
const Switchboards = require('../models/switchBoards')
const Controllers = require('../models/controllers')
const locationController = require('../controllers/locationController')
const globalContext = "[ route/locations"

router.post('/api/private/chargers/locations/allOffline', locationController.offlineAllLocations)

router.post('/api/private/chargers/locations/connectionStatus', locationController.updateConnectionStatus)

//========== GET ==========
router.get('/api/private/chargers/locations/:locationId', (req, res, next) => {
    const context = `${globalContext} Post /api/private/locations ]`
    try {
        const locationId = req.params.locationId
        const userId = req.headers['userid'];

        if (!locationId || !ObjectID.isValid(locationId)) {
            console.log(`${context} Warning - Id of location with wrong format`)
            return res.status(400).send({ "status": false, "code": "location_id_invalid", "message": "Location id with is invalid" });
        }
        if (!userId) {
            console.log(`${context} Warning - Missing user Id`)
            return res.status(400).send({ "status": false, "code": "location_userId_missing", "message": "Missing user identification" });
        }
        const query = {
            createUserId: userId,
            _id: locationId
        }
        Locations.findOne(query, { __v: 0 }).then((location) => {
            return res.status(200).send(location);
        })
    } catch (error) {
        console.error(`${context} Error `, error);
        return res.status(500).send({ "status": false, "code": "server_error", "message": "Internal Error" });
    }
})


//========== PATCH ==========

router.patch('/api/private/chargers/locations/chargingModes', async (req, res, next) => {
    const context = `${globalContext} Patch /api/private/chargers/locations/chargingModes ]`
    try {
        const { controllerId, chargingMode } = req.body
        if (!controllerId || !chargingMode) {
            console.error(`${context} Missing input data `, controllerId, chargingMode)
            return res.status(400).send({ "status": false, "message": "Missing input data" });
        }
        const arrayAllowChargingModes = process.env.SwitchboardAllowChargingModes.split("|")
        if (!arrayAllowChargingModes.includes(chargingMode)) {
            console.error(`${context}Error - Charging Mode not allow `, chargingMode)
            return res.status(400).send({ "status": false, "message": "Charging Mode not allow" });
        }

        const controller = await getControllerById(controllerId, null)
        if (!controller) {
            console.error(`${context} Error - Missing controller`);
            return res.status(400).send({ "status": false, "message": "Missing controller" });
        }
        if (controller.model == process.env.ControllerModelSmartBoxV1) {
            const updated = await updateAllSwitchBoardsFromController(chargingMode, controller.locationId)
            if (!updated) {
                console.error(`${context} Error - Missing controller`)
                return res.status(500).send({ "status": false, "message": "Internal Error" });
            }
            return res.status(200).send({ "status": updated })

        }
        return res.status(400).send({ "status": false, "message": "method not implemented for this model" })
    } catch (error) {
        console.error(`${context} Error `, error);
        return res.status(500).send({ "status": false, "message": "Internal Error" });
    }
})

// will update switchboards with listChargingModes
router.patch('/api/private/chargers/locations/listChargingModes', async (req, res, next) => {
    const context = `${globalContext} Patch /api/private/chargers/locations/listChargingModes ]`
    try {
        const { deviceId, chargingModes, activeChargingMode } = req.body
        if (!deviceId || !Array.isArray(chargingModes) || !activeChargingMode) {
            console.log(`${context} Missing input data `, deviceId, chargingModes, activeChargingMode)
            return res.status(400).send({ "status": false, "message": "Missing input data" });
        }

        const controller = await getControllerById(null, deviceId)
        if (!controller) {
            console.error(`${context} Error - Missing controller`);
            Sentry.captureException(error);
            return res.status(400).send({ "status": false, "message": "Missing controller" });
        }

        const updated = await updateAllowChargingModesOnAllSwitchFromController(chargingModes, activeChargingMode, controller.locationId)
        return res.status(200).send({ "status": updated })
    } catch (error) {
        console.error(`${context} Error `, error);
        return res.status(500).send({ "status": false, "message": "Internal Error" });
    }
})

async function getControllerById(controllerId = null, deviceId = null) {
    const context = `${globalContext} getControllerById ]`
    try {
        if (!controllerId && !deviceId) {
            console.error(`${context} Error - Missing controllerId/deviceId input`, controllerId, deviceId)
            throw new Error('Missing controllerId/deviceId input')
        }
        let query
        if (controllerId) query = { _id: controllerId }
        else query = { deviceId }

        return await Controllers.findOne(query)
    } catch (error) {
        console.error(`${context} Error `, error);
        throw error
    }
}

async function updateAllSwitchBoardsFromController(chargingMode, locationId) {
    const context = `${globalContext} updateAllSwitchBoardsFromController ]`
    if (!chargingMode || !locationId) {
        console.log(`${context} Missing input data`, chargingMode, locationId)
        const error = new Error(`${context} - Error Missing input data `)
        Sentry.captureException(error);
        throw error
    }
    const update = await Switchboards.updateMany({ locationId }, { $set: { chargingMode } })
    return update?.ok

}

async function updateAllowChargingModesOnAllSwitchFromController(arrayChargingModes, activeChargingMode, locationId) {
    const context = `${globalContext} updateAllSwitchFromController ]`
    try {
        if (!Array.isArray(arrayChargingModes) || !activeChargingMode || !locationId) {
            console.log(`${context} Error - Missing input data`, arrayChargingModes, activeChargingMode, locationId)
            throw new Error('Missing input data')
        }
        const update = await Switchboards.updateMany({ locationId }, { $set: { allowChargingModes: arrayChargingModes, chargingMode: activeChargingMode } })
        return update?.ok
    } catch (error) {
        console.error(`${context} Error `, error);
        throw error
    }
}

router.patch('/api/private/chargers/locations/device/info', commsSubscriptionHandler.handleDevicesInfo)
router.patch('/api/private/chargers/locations/device/measurements', commsSubscriptionHandler.handleDevicesMeasurements)
    
module.exports = router;