const axios = require('axios');
require("dotenv-safe").load();
const { captureException } = require("@sentry/node");
const ObjectID = require("mongodb").ObjectId

//CONTROLLER
const chargersController = require('../controllers/chargersHandler');
//DB 
const Switchboard = require('../models/switchBoards');
const Controllers = require('../models/controllers');
const Locations = require('../models/locations')
const Charger = require('../models/charger');
// Enums
const { SHARING_MODES, CHARGING_MODES } = require('../utils/enums/switchboardsEnums')
const commonLog = '[ switchBoardController ';

const ALLOWED_CHARGING_MODES = process.env.SwitchboardAllowChargingModes.split('|');

async function getSwitchboardsExternalAPI(req, res) {
    const context = `${commonLog} getSwitchboardsExternalAPI ]`;
    try {
        const userId = req.headers['userid'];
        const filterObject = req.query
        if (!userId) {
            return res.status(400).send({ auth: false, code: 'missing_userId', message: "Missing userId" })
        }

        const switchBoards = await getSwitchboards(userId, filterObject)
        if (!switchBoards) return res.status(200).send([])
        const returnObject = await formatSwitchboardForExternalAPI(switchBoards)
        return res.status(200).send(returnObject)
    } catch (error) {
        console.error(`${context} Error -`, error.message);
        return res.status(500).send({ auth: false, code: 'server_error', message: "Internal Error" })
    }
}

async function formatSwitchboardForExternalAPI(switchBoard) {
    const context = `${commonLog} formatSwitchboardForExternalAPI ]`;
    if (!switchBoard) {
        console.error(`${context} Error - Missing switchBoard `, switchBoard);
        throw new Error('Missing switchBoard')
    }
    return await Promise.all(switchBoard.map(async switchBoard => {
        return {
            id: switchBoard._id,
            name: switchBoard.name,
            deliveryPoint: switchBoard.dpc,
            exportPowerLim: switchBoard.exportPowerLim,
            importPowerLim: switchBoard.importPowerLim,
            iLim: switchBoard.setALimit,
            operationalMode: switchBoard.chargingMode,
            allowOperationalModes: switchBoard.allowChargingModes,
            parentSwitchBoard: switchBoard.parentSwitchBoard,
            updatedAt: switchBoard.updatedAt,
            listChargers: await getChargersForSwitchboard(switchBoard.arrayChargersId)
        }
    }));
}

async function formatSwitchboardForMySwitchboards(listSwitchBoards) {
    const context = `${commonLog} formatSwitchboardForMySwitchboards ]`;
    try {
        if (!listSwitchBoards) {
            console.error(`${context} Error - Missing input `, listSwitchBoards);
            throw new Error('Missing input')
        }
        let switchBoardList = []
        let listLocations = []    // variable to reduce the number of queries to bd in case of multiple switchBoars of already pull location from BD
        for (const switchBoard of listSwitchBoards) {
            let switchboardObject = {
                id: switchBoard._id,
                locationId: switchBoard.locationId,
                name: switchBoard.name,
                allowChargingModes: switchBoard.allowChargingModes,
                listChargers: await getListChargers(switchBoard.arrayChargersId),
                currentLimit: switchBoard.currentLimit,
                minSolarCurrent: switchBoard.minSolarCurrent ?? 0,
                chargingMode: switchBoard.chargingMode ?? CHARGING_MODES.Unknown_Mode,
                sharingMode: switchBoard.sharingMode ?? SHARING_MODES.NO_MODE
            }

            if (!switchBoard.locationId) {
                console.error(`[${context}] Error - Missing locationId for switchBoard ${switchBoard}`);
                captureException(new Error(`Missing locationId for switchBoard ${switchBoard}`))
                continue
            }
            let location
            if (listLocations.length > 0) {
                // will try to find the controller in the list of already query controllers ( try to minimize the number of queries to DB)
                location = listLocations.find((loc) => loc._id == switchBoard.locationId)
            }

            if (!location) {
                // will get the location from the BD
                location = await getLocationById(switchBoard.locationId)
                if (!location) {
                    console.error(`${context} Error - Error finding location id ${switchBoard.locationId}`);
                    captureException(new Error(`Error finding location id ${switchBoard.locationId}`))
                    continue
                }
            }

            switchboardObject.online = typeof location.online == "boolean" ? location.online : false
            switchboardObject.lastUpdateStatus = getLastUpdateStatus(switchboardObject.online, location.onlineStatusChangedDate)
            switchBoardList.push(switchboardObject)
            listLocations.push(location)
        }
        return switchBoardList
    } catch (error) {
        console.error(`${context} Error -`, error.message);
        throw error
    }
}

function getLastUpdateStatus(isOnline, connectionDate) {
    if (isOnline) return new Date()
    return connectionDate
}

async function getLocationById(locationId) {
    const context = "[route Switchboards getLocationById]";
    try {
        if (!ObjectID.isValid(locationId)) {
            console.error(`${context} Error - Missing/Wrong input locationId ${locationId}`);
            throw new Error("Missing/Wrong input locationId")
        }
        return await Locations.findOne({ _id: locationId })
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}

async function getListChargers(listChargersIds) {
    const context = "[route Switchboards getListChargers]";
    try {
        if (!listChargersIds) return []

        const query = {
            _id: { $in: listChargersIds }
        }
        const filter = {
            name: 1,
            hwId: 1,
            status: 1,
            energyManagementInterface: 1,
            energyManagementEnable: 1,
            operationalStatus: 1,
            'plugs._id': 1,
            'plugs.plugId': 1,
            'plugs.subStatus': 1,
            'plugs.status': 1,
            'plugs.connectorType': 1,
            'plugs.qrCodeId': 1,
            'plugs.balancingInfo.operationalState': 1,
            'plugs.balancingInfo.totalCurrent': 1,
            'plugs.balancingInfo.power': 1,
            'plugs.balancingInfo.voltage': 1,
            'plugs.balancingInfo.energy': 1,
            'plugs.balancingInfo.priority': 1,
            'plugs.balancingInfo.controlType': 1,
            'plugs.balancingInfo.minActivePower': 1,
            'plugs.balancingInfo.setCurrentLimit': 1,
            'plugs.balancingInfo.currentPerPhase': 1
        }
        let listChargers = await Charger.find(query, filter)
        // This is just here because we are not changing our front end to use the new field, so i had to do this
        if (listChargers?.plugs?.balancingInfo?.currentPerPhase) listChargers.plugs.balancingInfo.totalCurrent = listChargers.plugs.balancingInfo.currentPerPhase
        return listChargers

    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return error
    }
}

async function getChargersForSwitchboard(objectArrayChargerIds) {
    const context = `${commonLog} getChargersForSwitchboard ]`;
    try {
        if (!objectArrayChargerIds) {
            console.error(`${context} Error - Missing arrayChargersId `, objectArrayChargerIds);
            throw new Error('Missing arrayChargersId')
        }
        const arrayChargersId = objectArrayChargerIds.map(charger => charger);
        const query = {
            _id: { $in: arrayChargersId }
        }
        return chargersController.getChargerExternalApi(query)
    } catch (error) {
        console.error(`${context} Error -`, error.message);
        throw error
    }
}

async function getSwitchboards(createUserId, filterObject) {
    const context = `${commonLog} getSwitchboards ]`;
    try {
        if (!createUserId) {
            console.error(`${context} Error - Missing input `, createUserId);
            throw new Error('Missing userId')
        }

        let query = { createUserId }
        if (filterObject?.id) query._id = { $in: Array.isArray(filterObject.id) ? filterObject.id : Array(filterObject.id) }
        if (filterObject?.deliveryPoint) query.dpc = { $in: Array.isArray(filterObject.deliveryPoint) ? filterObject.deliveryPoint : Array(filterObject.deliveryPoint) }
        return await Switchboard.find(query).lean()
    } catch (error) {
        console.error(`${context} Error -`, error.message);
        throw error
    }
}
async function patchSwitchboardExternalAPI(req, res) {
    const context = `${commonLog} patchSwitchboardExternalAPI ]`;
    try {
        const userId = req.headers['userid'];
        const { switchBoardId } = req.params;
        const { operationalMode } = req.body;
        if (!userId) return res.status(400).send({ auth: false, code: 'missing_userId', message: "Missing userId" })
        if (!switchBoardId) return res.status(400).send({ auth: false, code: 'missing_switchBoardId', message: "Missing switchBoardId" })
        if (!operationalMode) return res.status(400).send({ auth: false, code: 'missing_operationalMode', message: "Missing operationalMode" })
        if (!ALLOWED_CHARGING_MODES.includes(operationalMode)) return res.status(400).send({ auth: false, code: 'invalid_operationalMode', message: "Invalid operationalMode" })

        const switchBoard = await getSwitchboard(switchBoardId, userId)
        if (!switchBoard) return res.status(400).send({ auth: false, code: 'switchBoard_not_found', message: "Switchboard not found" })

        if (switchBoard.chargingMode === operationalMode) return res.status(200).send({ auth: true, switchBoard: patchSwitchboardExternalAPIResponseObject(switchBoard) })

        const updatedSwitchBoard = await updateSwitchboard(switchBoardId, userId, { chargingMode: operationalMode })
        if (!updatedSwitchBoard) {
            console.error(`${context} Error - Fail to update switchboard`);
            return res.status(500).send({ auth: false, code: 'server_error', message: 'Internal server error' });
        }

        if (!(await updateControllerChargingMode(operationalMode, updatedSwitchBoard.locationId, updatedSwitchBoard.deviceId))) {
            console.error(`${context} Error - Fail to update charging mode on Comms`);
            return res.status(500).send({ auth: false, code: 'server_error', message: 'Internal server error' });
        }

        return res.status(200).send({ auth: true, switchBoard: patchSwitchboardExternalAPIResponseObject(updatedSwitchBoard) });
    } catch (error) {
        console.error(`${context} Error -`, error);
        return res.status(500).send({ auth: false, code: 'server_error', message: "Internal Error" })
    }
}

function patchSwitchboardExternalAPIResponseObject(switchBoard) {
    return {
        id: switchBoard._id,
        name: switchBoard.name,
        deliveryPoint: switchBoard.dpc,
        exportPowerLim: switchBoard.exportPowerLim,
        importPowerLim: switchBoard.importPowerLim,
        iLim: switchBoard.setALimit,
        operationalMode: switchBoard.chargingMode,
        allowOperationalModes: switchBoard.allowChargingModes,
        parentSwitchBoard: switchBoard.parentSwitchBoard,
        updatedAt: switchBoard.updatedAt,
    }
}

async function getSwitchboard(switchBoardId, userId) {
    const context = `${commonLog} getSwitchboard ]`;
    if (!userId || !switchBoardId) {
        console.error(`${context} Error - Missing input `, userId, switchBoardId);
        throw new Error('Missing userId or switchBoardId')
    }

    return Switchboard.findOne({ _id: switchBoardId, createUserId: userId }).lean()
}

async function updateSwitchboard(switchBoardId, userId, updateObject) {
    const context = `${commonLog} updateSwitchboard ]`;
    if (!userId || !switchBoardId || !updateObject) {
        console.error(`${context} Error - Missing input `, userId, switchBoardId, updateObject);
        throw new Error('Missing userId or switchBoardId or updateObject')
    }
    return await Switchboard.findOneAndUpdate({ _id: switchBoardId, createUserId: userId }, { $set: updateObject }, { new: true })
}

async function getControllerByLocationId(locationId) {
    const context = "[route Switchboards getControllerByLocationId]";
    try {
        if (!locationId) {
            console.error(`${context} Error - Missing locationId  ${locationId}`);
            throw new Error(`Missing locationId`)
        }
        return await Controllers.findOne({ locationId })
    } catch (error) {
        console.error(`[${context}] Error `);
        throw error
    }
}

// TODO: This will be deprecated for one endpoint that allow to update all variables of switchboard
async function updateControllerChargingMode(chargingMode, locationId, switchboardDeviceId) {
    const context = "[route Switchboards updateControllerChargingMode]";
    try {
        if (!chargingMode || !locationId) {
            console.error(`${context} Error - Missing input  ${chargingMode} ${locationId}`);
            throw new Error(`Missing input`)
        }
        const controller = await getControllerByLocationId(locationId)
        if (!controller) {
            console.error(`${context} Error - Missing controller for location ${locationId}`);
            throw new Error(`Missing controller`)
        }
        const data = {
            chargingMode,
            controllerId: controller._id,
            deviceId: switchboardDeviceId
        }
        const response = await axios.patch(`${process.env.HostComms}${process.env.UpdateCommsChargingMode}`, data)
        if (!response?.data) {
            console.error(`${context} Error - Missing response from Comms microservice`);
            throw new Error(`Missing response from Comms microservice`)
        }
        return response.data.status
    } catch (error) {
        console.error(`${context} Error `, error);
        throw error
    }
}

module.exports = {
    getSwitchboardsExternalAPI,
    patchSwitchboardExternalAPI,
    updateControllerChargingMode,
    formatSwitchboardForExternalAPI,
    formatSwitchboardForMySwitchboards
}