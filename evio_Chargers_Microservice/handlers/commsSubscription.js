import { captureMessage, captureException } from '@sentry/node';
import constants from '../utils/constants';
// Services
import { createNewSwitchBoardA8000, addChargerToSwitchBoard } from '../services/switchBoardsServices';
import { handlePublicGridInfo, handlePublicGridMeasurements } from '../services/publicGridServices';
// Enums
import { CHARGING_MODES, SHARING_MODES } from '../utils/enums/switchboardsEnums';
import { GRID_MEASUREMENTS, PV_MEASUREMENTS, PLUG_MEASUREMENTS } from '../utils/enums/devicesMeasurementsEnums'
// Utils
import { assignMeasurement } from '../utils/assignMeasurements'
// Models
import solarPvModel from '../models/solarPvs';
require("dotenv-safe").load();
//BD
const ObjectID = require("mongodb").ObjectId
const Chargers = require("../models/charger");
const Location = require("../models/locations")
const SwitchBoards = require("../models/switchBoards")
const Controllers = require("../models/controllers")

const commonLog = '[ handler commsSubscription ';

async function getChargerByHwId(hwId, createUser) {

    if (!hwId || !ObjectID.isValid(createUser)) {
        console.error(`[${context}] Error - Missing input data `, hwId, createUser);
        throw new Error('Missing input data')
    }
    return await Chargers.findOne({ hwId, createUser })
}

async function getControllerById(controllerId = null, deviceId = null) {
    const context = `${commonLog} getControllerById ]`
    try {
        if (!controllerId && !deviceId) {
            console.error(`${context} Error - Missing controllerId/deviceId input`, controllerId, deviceId)
            throw new Error('Missing controllerId/deviceId input')
        }
        const query = controllerId ? { _id: controllerId } : { deviceId };
        return await Controllers.findOne(query)
    } catch (error) {
        console.error(`${context} Error `, error);
        throw error
    }
}

async function updateInfoToCharger(deviceInfoObject, chargerId, controllerId) {
    const context = `${commonLog} updateInfoToCharger]`
    try {
        if (!deviceInfoObject || !ObjectID.isValid(chargerId)) {
            console.error(`[${context}] Error - Missing input data `, deviceInfoObject, chargerId);
            throw new Error('Missing input data')
        }
        const updateObject = {
            controllerId,
            energyManagementEnable: true,
            energyManagementInterface: deviceInfoObject.protocol,
            "balancingInfo.isOnline": true
        }
        const update = await Chargers.updateOne({ _id: chargerId }, { $set: updateObject })
        if (!update.ok) {
            console.error(`[${context}] Error - Fail to update Charger info`);
            throw new Error("Fail to update Charger info")
        }
        return true
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function getLocationById(locationId) {
    const context = `${commonLog} getLocationById]`
    try {
        if (!ObjectID.isValid(locationId)) {
            console.error(`[${context}] Error - Missing input locationId `, locationId);
            throw new Error('Missing input locationId')
        }
        return await Location.findOne({ _id: locationId })
    } catch (error) {
        console.error(`${context} Error `, error);
        throw error
    }
}

async function addChargerToSwitchboard(switchboardId, chargerId) {
    const context = `${commonLog} addChargerToSwitchboard]`
    try {
        if (!ObjectID.isValid(switchboardId) || !ObjectID.isValid(chargerId)) {
            console.error(`${context} Error - Missing input data `, switchboardId, chargerId);
            throw new Error('Missing input data')
        }
        const updated = await SwitchBoards.updateOne({ _id: switchboardId }, { $addToSet: { arrayChargersId: chargerId } })
        return updated.ok ?? false
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function getSwitchBoard(switchboardId = null, controllerId, switchBoardGroupId) {
    const context = `${commonLog} getSwitchBoard]`
    try {
        if (!switchboardId && !controllerId) {
            console.error(`${context} Error - Missing input data `, switchboardId, controllerId);
            throw new Error('Missing input data')
        }
        let query;
        if (switchboardId) query = { _id: switchboardId }
        else if (switchBoardGroupId) query = { controllerId, switchBoardGroupId }
        else query = { controllerId }

        return await SwitchBoards.findOne(query, { _id: 1 })
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function updateSwitchBoardMeterInfo(switchBoardId, meterDescription, meterType) {
    const context = `${commonLog} updateSwitchBoardMeterInfo]`
    try {
        if (!switchBoardId || !meterDescription || !meterType) {
            console.error(`${context} Error - Missing input data `, switchboardId, meterDescription, meterType);
            throw new Error('Missing input data')
        }
        const updated = await SwitchBoards.updateOne({ _id: switchBoardId }, { $set: { meterType, meterDescription } })
        return updated.ok
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function updatePV(updateObject, pvId) {
    const context = `${commonLog} updatePV]`
    if (!updateObject || !pvId) {
        console.error(`[${context}] Error - Missing input data `, updateObject, pvId);
        throw new Error('Missing input data')
    }
    const response = await solarPvModel.updateOne({ _id: pvId }, { $set: updateObject })
    if (!response?.ok) {
        console.error(`[${context}] Error - Missing input data `, deviceId, createdBy);
        throw new Error('Missing input data')
    }
}

async function handlerPVInfo(controller, deviceInfoObject) {
    const context = `${commonLog} handlerPVInfo]`
    try {
        if (!controller || !deviceInfoObject) {
            console.error(`[${context}] Error - Missing input data `, controller, deviceInfoObject);
            throw new Error('Missing input data')
        }
        let pv = await solarPvModel.getPvByHwId(deviceInfoObject.name, controller.createUserId)
        if (!pv) {
            const location = await getLocationById(controller.locationId);
            if (!location) {
                console.error(`[${context}] Error - Fail to get this location `, controller.locationId);
                throw new Error('Fail to get this location')
            }
            // create new PV
            pv = new solarPvModel({
                name: deviceInfoObject.name,
                deviceId: deviceInfoObject.name,
                description: deviceInfoObject.deviceDescription,
                controllerDeviceId: controller.deviceId,
                locationID: location._id,
                controllerId: deviceInfoObject.controllerId,
                createdBy: controller.createUserId,
            });
            if (controller.model === process.env.ControllerModelSmartBoxV1 && location.listOfSwitchboardsIds?.length > 0) pv.switchBoardId = location.listOfSwitchboardsIds[0]
            await pv.save()
        } else {
            let updateObject = {}
            if (deviceInfoObject.name && deviceInfoObject.name !== pv.name) updateObject.name = deviceInfoObject.name
            if (deviceInfoObject.deviceDescription && deviceInfoObject.deviceDescription !== pv.description) updateObject.description = deviceInfoObject.deviceDescription
            if (updateObject) await updatePV(updateObject, pv._id)
        }
        return { status: true, isToSubscribe: true };
    } catch (error) {
        console.error(`${context} Error `, error);
        throw error
    }
}


async function handleChargerInfo(controller, deviceInfoObject) {
    const context = `${commonLog} handleChargerInfo]`
    try {
        if (!controller || !deviceInfoObject) {
            console.error(`[${context}] Error - Missing input data `, controller, deviceInfoObject);
            throw new Error('Missing input data')
        }
        const charger = await getChargerByHwId(deviceInfoObject.name, controller.createUserId)
        if (!charger) {
            // I was told to not create a new charger
            console.log(`${context} Warning - the charger ${deviceInfoObject.name} doesn't exist or the user who created is wrong ${controller.createUserId}`, deviceInfoObject);
            captureMessage(`Comms Subscription - Charger ${deviceInfoObject.name} doesn't exist or the user who created is wrong ${controller.createUserId}`, "warning")
            return { status: true, isToSubscribe: false }
        }
        // update info from charger
        const chargerUpdated = await updateInfoToCharger(deviceInfoObject, charger._id, controller._id)
        // a bit of hard coded to add chargers to the switchboard for this kind of devices
        if (controller.model == constants.controllers.model.SmartBox_v1 && controller.locationId) {
            const location = await getLocationById(controller.locationId);
            if (!location) {
                console.error(`[${context}] Error - Fail to get this location `, controller.locationId);
                throw new Error('Fail to get this location')
            }
            // it is expected for this kind of devices in this protocol to only have 1 switchboard, 
            // because otherwise it will be impossible to change the charging modes since this equipments don't have the concept of switchboards and this switchboard is a "virtualization"
            // of an device that doesn't really exist.
            if (location.listOfSwitchboardsIds.length == 1) {
                const updates = await addChargerToSwitchBoard(location.listOfSwitchboardsIds[0], charger._id)
                if (!updates) {
                    console.error(`[${context}] Error - Fail to get this location `, controller.locationId);
                    throw new Error('Fail to get this location')
                }

            } else {
                console.error(`[${context}] Error - Something is wrong with this location ${location._id} and/or controller ${controller._id}`);
                captureMessage(`Something is wrong with this location ${location._id} and/or controller ${controller._id}`, "warning")
            }
            // check if charger is already attributed to a correct switchboard
        } else if (controller.model == constants.controllers.model.Siemens_A8000 && controller.locationId && deviceInfoObject.switchBoardGroupId) {
            const switchBoard = await SwitchBoards.getByGroupId(deviceInfoObject.switchBoardGroupId, controller._id)
            if (!switchBoard) {
                await createNewSwitchBoardA8000(controller, deviceInfoObject, charger._id)

            } else if (!switchBoard.arrayChargersId.find(chargerId => chargerId === charger._id.toString())) {
                await addChargerToSwitchBoard(switchBoard._id, charger._id)
            }

        }
        return chargerUpdated ? { status: true, isToSubscribe: true } : { status: false, isToSubscribe: false }
    } catch (error) {
        console.error(`${context} Error `, error);
        throw error
    }
}

async function handlerSwitchboardMeterInfo(controller, meterInfoObject) {
    const context = `${commonLog} handlerSwitchboardMeterInfo]`
    try {
        if (!controller || !meterInfoObject?.controllerId) {
            console.error(`[${context}] Error - Missing input data `, controller, meterInfoObject);
            throw new Error('Missing input data')
        }
        const switchBoard = await getSwitchBoard(null, meterInfoObject.controllerId, null)
        if (!switchBoard) {
            console.error(`${context} Error- Missing switchBoard for controller: ${meterInfoObject.controllerId} `);
            throw new Error(`Missing switchBoard for controller: ${meterInfoObject.controllerId}`)
        }
        const updated = await updateSwitchBoardMeterInfo(switchBoard._id, meterInfoObject.deviceDescription, meterInfoObject.name)
        return { status: updated, isToSubscribe: updated }
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

function calculateTotalCurrent(arrayCurrent) {
    const context = `${commonLog} calculateTotalCurrent]`
    try {
        if (!Array.isArray(arrayCurrent) || arrayCurrent.length < 1) {
            console.error(`[${context}] Error - arrayCurrent is not an Array or is empty `, arrayCurrent);
            return null
        }
        if (arrayCurrent.length > 3) {
            console.error(`[${context}] Error - arrayCurrent have too many elements `, arrayCurrent);
            return null
        }
        let sumCurrentPerPhase = 0
        arrayCurrent.forEach((current) => {
            const currentValue = Number(current)
            if (!isNaN(currentValue) && currentValue > 0) sumCurrentPerPhase += currentValue;
        })
        // return Number(Number(Math.sqrt(sumCurrentPerPhase)).toFixed(2)) tensão composta
        return Number(sumCurrentPerPhase).toFixed(2);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

// this function will give an average tension between the phases
function calculateTotalTension(arrayTension) {
    const context = `${commonLog} calculateTotalTension]`
    try {
        if (!Array.isArray(arrayTension) || arrayTension.length < 1) {
            console.error(`[${context}] Error - arrayTension is not an Array or is empty ${arrayTension} `);
            return null
        }
        let totalTension = 0
        let numberOfPhases = 0
        arrayTension.forEach((tension) => {
            if (!isNaN(tension) && tension > 0) {
                numberOfPhases++
                totalTension += Number(tension)
            }
        })
        // return Number(Number((totalTension / numberOfPhases)* Math.sqrt(3)).toFixed(2))  // tensão composta
        return Number(totalTension / numberOfPhases).toFixed(2);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null
    }
}

function createPlugBalancingMeasurements(arrayMeasurements) {
    const context = `${commonLog} createPlugBalancingMeasurements]`
    try {
        if (!arrayMeasurements) {
            console.error(`[${context}] Error - Missing arrayMeasurements `, arrayMeasurements);
            throw new Error('Missing arrayMeasurements')
        }
        let plugUpdateData = { isOnline: true, lastMeasurement: new Date() }
        for (const measurement of arrayMeasurements) {
            if (!measurement.name || !measurement.valueType) continue
            switch (measurement.name) {
                case 'ERROR':
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, null, null, true, PLUG_MEASUREMENTS, null)
                    break;
                case 'ERROR_COMMUNICATION':
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, null, null, false, PLUG_MEASUREMENTS, null)
                    break;
                case "CURRENT_L1":
                case "CURRENT_L2":
                case "CURRENT_L3":
                case 'CURRENT_LIMIT':
                case 'TOTAL_CURRENT':
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, "a", 1000, "*", PLUG_MEASUREMENTS, null)
                    break;
                case 'VOLTAGE_L1':
                case 'VOLTAGE_L2':
                case 'VOLTAGE_L3':
                case 'VOLTAGE':
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, "v", 1000, "*", PLUG_MEASUREMENTS, null)
                    break;
                case 'POWER_ACTIVE':
                case 'POWER_ACTIVE_MAX':
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, "kw", 1000, "/", PLUG_MEASUREMENTS, null)
                    break;
                case 'POWER_ACTIVE_MIN':
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, "w", 1000, "*", PLUG_MEASUREMENTS, null)
                    break;
                case 'STATE_NAME':
                case 'CONTROL_TYPE':
                case "PRIORITY":
                case "NUMBER_OF_PHASES":
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, null, null, null, PLUG_MEASUREMENTS, false)
                    break;
                case "ENERGY":
                    plugUpdateData = assignMeasurement(measurement, plugUpdateData, "kw/h", 1000, "/", PLUG_MEASUREMENTS, null)
                    break;
                default:
                    continue
            }
        }
        return calculateMissingMeasurementsPlugs(plugUpdateData)
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}

function calculateMissingMeasurementsPlugs(plugUpdateData) {
    // Get the number variables that are > 0
    const positiveCurrents = [plugUpdateData.current1, plugUpdateData.current2, plugUpdateData.current3].filter(value => typeof value === 'string' && Number(value) > 0);
    // calculate number of phases being used
    if (positiveCurrents.length && !plugUpdateData.numberOfPhases) {
        plugUpdateData.numberOfPhases = positiveCurrents.length > 0 ? String(positiveCurrents.length) : '0'
    }

    // check for total current
    if ((!plugUpdateData.totalCurrent && plugUpdateData.totalCurrent !== 0) && positiveCurrents.length) {
        plugUpdateData.totalCurrent = calculateTotalCurrent([plugUpdateData.current1, plugUpdateData.current2, plugUpdateData.current3])
    }

    // check for "total Voltage"
    if ((!plugUpdateData.voltage && plugUpdateData.voltage !== 0) && (plugUpdateData.voltage1 || plugUpdateData.voltage2 || plugUpdateData.voltage3)) {
        plugUpdateData.voltage = calculateTotalTension([plugUpdateData.voltage1, plugUpdateData.voltage2, plugUpdateData.voltage3])
    }
    // calculate missing measurements if possible
    // Calculate currents
    if ((!plugUpdateData.totalCurrent && plugUpdateData.totalCurrent !== 0) && plugUpdateData.voltage > 0 && plugUpdateData.power > 0 && plugUpdateData.numberOfPhases > 0) {
        plugUpdateData.totalCurrent = plugUpdateData.numberOfPhases === 1 ? Number(plugUpdateData.power / plugUpdateData.voltage).toFixed(2) : Number(plugUpdateData.power / (plugUpdateData.voltage * plugUpdateData.numberOfPhases)).toFixed(2);
    }

    if (plugUpdateData.totalCurrent && plugUpdateData.numberOfPhases == 3 &&
        (
            (!plugUpdateData.current1 || plugUpdateData.current1 == 0) &&
            (!plugUpdateData.current2 || plugUpdateData.current2 == 0) &&
            (!plugUpdateData.current3 || plugUpdateData.current3 == 0)
        )) {
        // gonna assume the circuit is balanced
        plugUpdateData.current1 = plugUpdateData.current2 = plugUpdateData.current3 = Number(plugUpdateData.totalCurrent / 3).toFixed(2)
    }

    if (plugUpdateData.current1 || plugUpdateData.current2 || plugUpdateData.current3) {
        plugUpdateData.currentPerPhase = ((Number(plugUpdateData.current1 ?? 0) + Number(plugUpdateData.current2 ?? 0) + Number(plugUpdateData.current3 ?? 0)) / plugUpdateData.numberOfPhases).toFixed(2)
    } else if (plugUpdateData.totalCurrent) {
        plugUpdateData.currentPerPhase = Number(plugUpdateData.numberOfPhases) > 0 ? Number(plugUpdateData.totalCurrent / plugUpdateData.numberOfPhases).toFixed(2) : '0'
    }

    // Calculate Voltage
    if ((!plugUpdateData.voltage || plugUpdateData.voltage == 0) && plugUpdateData.power > 0 &&
        (plugUpdateData.totalCurrent > 0 || plugUpdateData.currentPerPhase > 0 && plugUpdateData.numberOfPhases >= 0)) {
        plugUpdateData.voltage = plugUpdateData.totalCurrent ? Number(plugUpdateData.power / plugUpdateData.totalCurrent).toFixed(2) : Number(plugUpdateData.power / (plugUpdateData.currentPerPhase * plugUpdateData.numberOfPhases)).toFixed(2)
    }

    if (plugUpdateData.voltage && plugUpdateData.numberOfPhases == 3 &&
        (
            (!plugUpdateData.voltage1 || plugUpdateData.voltage1 == 0) &&
            (!plugUpdateData.voltage2 || plugUpdateData.voltage2 == 0) &&
            (!plugUpdateData.voltage3 || plugUpdateData.voltage3 == 0)
        )) {            // gonna assume the circuit is balanced
        plugUpdateData.voltage1 = plugUpdateData.voltage2 = plugUpdateData.voltage3 = plugUpdateData.voltage
    }

    // Calculate Power
    if (!plugUpdateData.power && plugUpdateData.totalCurrent > 0 && plugUpdateData.voltage > 0 && plugUpdateData.numberOfPhases >= 0) {
        plugUpdateData.power = Number(plugUpdateData.totalCurrent * plugUpdateData.voltage).toFixed(2)
    }
    return plugUpdateData
}

async function updatePlugBalancingInfo(hwId, balancingInfo) {
    const context = `${commonLog} updatePlugBalancingInfo]`
    try {
        if (!hwId || !balancingInfo) {
            console.error(`[${context}] Error - Missing input data ${hwId} `, balancingInfo);
            throw new Error('Missing input data')
        }
        let updateInfo = {}
        for (const [key, value] of Object.entries(balancingInfo)) {
            updateInfo[`plugs.$[].balancingInfo.${key}`] = value
        }
        if (!updateInfo) {
            console.error(`[${context}] Error - Fail to create updateInfo `, updateInfo);
            throw new Error('Fail to create updateInfo')
        }
        const update = await Chargers.findOneAndUpdate({ hwId }, { $set: updateInfo })
        if (!update) {
            console.error(`[${context}] Error - Fail to update balancingInfo in charger ${hwId} `);
            throw new Error(`Fail to update balancingInfo in charger ${hwId}`)
        }
        return true
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        throw error
    }
}

async function handleChargersMeasurements(hwId, arrayMeasurements, time) {
    const context = `${commonLog} handleChargersMeasurements]`
    try {
        if (!hwId || !Array.isArray(arrayMeasurements) || !time) {
            console.error(`[${context}] Error - Missing input data ${hwId} ${arrayMeasurements}`);
            throw new Error('Missing input data')
        }
        if (arrayMeasurements.length < 1) return true
        const plugBalancingObject = createPlugBalancingMeasurements(arrayMeasurements)
        if (!plugBalancingObject) {
            console.error(`[${context}] Error - Fail to create plugBalancingObject`);
            throw new Error('Fail to create plugBalancingObject')
        }
        if (!(await updatePlugBalancingInfo(hwId, plugBalancingObject))) {

        }
        return true
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

function createPVMeasurementsObject(arrayMeasurements) {
    const context = `${commonLog} createPVMeasurementsObject]`
    try {
        if (!arrayMeasurements) {
            console.error(`[${context}] Error - Missing arrayMeasurements `, arrayMeasurements);
            throw new Error('Missing arrayMeasurements')
        }
        let pvUpdateData = { isOnline: true }
        for (const measurement of arrayMeasurements) {
            if (!measurement.name || !measurement.valueType) continue
            switch (measurement.name) {
                case "LAST_READING":
                    pvUpdateData.lastReading = new Date(measurement.value * 1000)
                    break;
                case "ERROR_COMMUNICATION":
                    pvUpdateData = assignMeasurement(measurement, pvUpdateData, null, null, true, PV_MEASUREMENTS, null)
                    break;
                case "POWER_ACTIVE":
                case "EXPORT_POWER_ACTIVE":
                case "IMPORT_POWER_ACTIVE":
                    pvUpdateData = assignMeasurement(measurement, pvUpdateData, "w", 1000, "*", PV_MEASUREMENTS, null)
                    break;
                case "EXPORT_ENERGY_ACTIVE":
                    pvUpdateData = assignMeasurement(measurement, pvUpdateData, "wh", 1000, "*", PV_MEASUREMENTS, null)
                    break;
                case "CONTROL_TYPE":
                    pvUpdateData = assignMeasurement(measurement, pvUpdateData, null, null, null, PV_MEASUREMENTS, true)
                    break;
                default:
                    continue
            }
        }
        return pvUpdateData
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function updatePvMeasurements(plugBalancingObject, deviceId, controllerDeviceId, controllerId) {
    const context = `${commonLog} updatePvMeasurements]`
    try {
        if (!plugBalancingObject || !controllerDeviceId || !deviceId) {
            console.error(`[${context}] Error - Missing input data ${plugBalancingObject} ${controllerDeviceId} ${deviceId}`);
            throw new Error('Missing input data')
        }
        let query = {
            deviceId,
        }
        controllerId ? query.controllerId = controllerId : query.controllerDeviceId = controllerDeviceId
        return await solarPvModel.findOneAndUpdate(query, { $set: plugBalancingObject })
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

function createGridMeterMeasurementsObject(arrayMeasurements) {
    const context = `${commonLog} createGridMeterMeasurementsObject]`
    try {
        if (!arrayMeasurements) {
            console.error(`[${context}] Error - Missing arrayMeasurements data ${arrayMeasurements}`);
            throw new Error(' Missing arrayMeasurements data')
        }
        let gridMeter = {}
        for (const measurement of arrayMeasurements) {
            if (!measurement.name || !measurement.valueType) continue
            switch (measurement.name) {
                case "ERROR_COMMUNICATION":
                case "SHARING_MODE":
                case "CHARGING_MODE":
                case "OPERATIONAL_MARGIN":
                case "CIRCUIT_BREAKER":
                case "ACTIVE_SESSIONS":
                    gridMeter = assignMeasurement(measurement, gridMeter, null, null, null, GRID_MEASUREMENTS, null)
                    break;
                case "IMPORT_ENERGY_ACTIVE":
                case "EXPORT_ENERGY_ACTIVE":
                    gridMeter = assignMeasurement(measurement, gridMeter, "wh", 1000, "*", GRID_MEASUREMENTS, null)
                    break;
                case "EXPORT_POWER_ACTIVE":
                case "IMPORT_POWER_ACTIVE":
                case "IMPORT_POWER_ACTIVE":
                case "POWER_ACTIVE":
                case "CURRENT_DISTRIBUTED_EACH_VEHICLE":
                    gridMeter = assignMeasurement(measurement, gridMeter, "w", 1000, "*", GRID_MEASUREMENTS, null)
                    break;
                case "VOLTAGE_L1":
                case "VOLTAGE_L2":
                case "VOLTAGE_L3":
                case "VOLTAGE":
                    gridMeter = assignMeasurement(measurement, gridMeter, "v", 1000, "/", GRID_MEASUREMENTS, null)
                    break;
                case "CURRENT_L1":
                case "CURRENT_L2":
                case "CURRENT_L3":
                case "MIN_SOLAR_CURRENT":
                case "CURRENT_LIMIT":
                case "SW_CURRENT_LIMIT":
                    gridMeter = assignMeasurement(measurement, gridMeter, "a", 1000, "/", GRID_MEASUREMENTS, null)
                    break;
                default:
                    console.log(`[${context}] Warning - Unknown measurement ${measurement.name}`)
                    continue
            }
        }
        return gridMeter
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function updateSwitchBoardMeasurements(meterBalancingObject, controllerId) {
    const context = `${commonLog} updateSwitchBoardMeasurements]`
    try {
        if (!meterBalancingObject || !controllerId) {
            console.error(`[${context}] Error - Missing input data ${meterBalancingObject} ${controllerId}`);
            throw new Error('Missing input data')
        }
        const update = await SwitchBoards.updateOne({ controllerId }, { $set: meterBalancingObject })
        return update?.ok
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function handleGridMeterMeasurements(name, arrayMeasurements, time, controllerId) {
    const context = `${commonLog} handleGridMeterMeasurements]`
    try {
        if (!name || !Array.isArray(arrayMeasurements) || !time || !controllerId) {
            console.error(`[${context}] Error - Missing input data ${name} ${arrayMeasurements}`);
            throw new Error('Missing input data')
        }
        if (arrayMeasurements.length < 1) return true
        const meterBalancingObject = createGridMeterMeasurementsObject(arrayMeasurements)
        if (!meterBalancingObject) {
            console.error(`[${context}] Error - Fail to create plugBalancingObject`);
            throw new Error('Fail to create plugBalancingObject')
        }
        return await updateSwitchBoardMeasurements(meterBalancingObject, controllerId)
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

async function handlePVMeasurements(name, arrayMeasurements, time, deviceId, controllerId) {
    const context = `${commonLog} handlePVMeasurements]`
    try {
        if (!name || !Array.isArray(arrayMeasurements) || !time || !deviceId) {
            console.error(`[${context}] Error - Missing input data ${name} ${arrayMeasurements}`);
            throw new Error('Missing input data')
        }
        if (arrayMeasurements.length < 1) return true
        const plugBalancingObject = createPVMeasurementsObject(arrayMeasurements)
        if (!plugBalancingObject) {
            console.error(`[${context}] Error - Fail to create plugBalancingObject`);
            throw new Error('Fail to create plugBalancingObject')
        }
        await updatePvMeasurements(plugBalancingObject, name, deviceId, controllerId)
        return true
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error
    }
}

// TODO: Convert to TypeScript
async function handleDevicesMeasurements(req, res) {
    const context = `${commonLog} handleDevicesMeasurements]`
    try {
        const { equipmentType, equipmentName, arrayMeasurements, time, deviceId, controllerId } = req.body
        if (!equipmentType || !equipmentName || !Array.isArray(arrayMeasurements) || !time || !deviceId) {
            console.error(`${context} Error - Missing Input data ${equipmentType} ${equipmentName} ${Array.isArray(arrayMeasurements)} ${time} ${deviceId}`);
            return res.status(400).send({ "status": false, "code": "missing_input_data", "message": "Missing Input data" });
        }
        if (arrayMeasurements.length < 1) {
            console.log(`${context} Warning - No measurements sent ${arrayMeasurements}`)
            return res.status(200).send({ "status": true });
        }
        let response;
        switch (equipmentType) {
            case "Charger":
                response = await handleChargersMeasurements(equipmentName, arrayMeasurements, time);
                break;
            case "PV":
                response = await handlePVMeasurements(equipmentName, arrayMeasurements, time, deviceId, controllerId);
                break;
            case 'Grid meter':
            case "SwitchBoard":
                response = await handleGridMeterMeasurements(equipmentName, arrayMeasurements, time, controllerId);
                break;
            case 'PublicGrid':
                response = await handlePublicGridMeasurements(equipmentName, arrayMeasurements, time, controllerId);
                break;
            default:
                console.error("Unknown device type: ", req.body)
                captureMessage(`Unknown device type ${equipmentType}`, 'error')
                return res.status(500).send({ "status": false });
        }
        if (!response) {
            console.error(`${context} Error - Fail to update charger ${equipmentName}`)
            return res.status(500).send({ "status": false, "code": "server_error", "message": "Internal Error" });
        }
        return res.status(200).send({ "status": true });

    } catch (error) {
        console.error(`${context} Error `, error);
        return res.status(500).send({ "status": false, "code": "server_error", "message": "Internal Error" });
    }
}

async function handleSwitchBoardInfo(controller, switchBoardInfo) {
    const context = `${commonLog} handleSwitchBoardInfo]`

    if (!controller || !switchBoardInfo) {
        console.error(`[${context}] Error - Missing input data `, controller, switchBoardInfo);
        throw new Error('Missing input data')
    }
    if (controller.model === constants.controllers.model.Siemens_A8000) {
        const switchBoard = await getSwitchBoard(null, switchBoardInfo.controllerId, switchBoardInfo.switchBoardGroupId)
        const splitName = switchBoardInfo.deviceId.split('_')
        if (!switchBoard) {
            // create new switchboard
            const newSwitchBoard = new SwitchBoards({
                name: splitName[0],
                controllerId: controller._id,
                createUserId: controller.createUserId,
                locationId: controller.locationId,
                switchBoardGroupId: Number(splitName[0].replace('SWB', '')),
                allowChargingModes: [CHARGING_MODES.Solar_Mode, CHARGING_MODES.Base_Mode, CHARGING_MODES.No_Mode],
                allowSharingModes: [SHARING_MODES.FIFO, SHARING_MODES.EVENLY_SPLIT],
                deviceId: switchBoardInfo.deviceId
            })
            newSwitchBoard.save()
        } else if (switchBoard) {
            const updateSwitchBoard = {
                deviceId: switchBoardInfo.deviceId,
                switchBoardGroupId: Number(splitName[0].replace('SWB', '')),
            }
            await SwitchBoards.updateOne({ _id: switchBoard._id }, { $set: updateSwitchBoard })
        }
    }

    return { status: true, isToSubscribe: true }
}

// TODO: Convert to TypeScript
async function handleDevicesInfo(req, res) {
    const context = `${commonLog} handleDevicesInfo]`
    try {
        const device = req.body
        //console.log(`${context} - Device info`, JSON.stringify(device));
        // TODO: Add middleware to do this validation and more
        if (!device || !ObjectID.isValid(device.controllerId) || !device.deviceType || !device.name) {
            console.error(`${context} Error - Missing device input`, device)
            return res.status(400).send({ "status": false, "code": "missing_input", "message": "Missing device input" });
        }
        const controller = await getControllerById(device.controllerId, null)
        if (!controller) {
            console.error(`${context} Error - Controller not found!`)
            captureException(new Error(` Controller not found for  ${device.controllerId}`))
            return res.status(500).send({ "status": false, "isToSubscribe": false });
        }
        let responseStatus
        switch (device.deviceType) {
            case "Charger":
                responseStatus = await handleChargerInfo(controller, device)
                break;
            case 'PV':
                responseStatus = await handlerPVInfo(controller, device)
                break;
            case 'SwitchboardMeter':
                responseStatus = await handlerSwitchboardMeterInfo(controller, device)
                break;
            case 'SwitchBoard':
                responseStatus = await handleSwitchBoardInfo(controller, device)
                break;
            case 'PublicGrid':
                responseStatus = await handlePublicGridInfo(controller, device)
                break;
            default:
                console.log(`${context} - Device type still not implemented ${device.deviceType}`);
                console.log(`${context} - Device`, JSON.stringify(device));
                captureMessage(`Device type still not implemented ${device.deviceType}`, 'warning')
                responseStatus = { status: true, isToSubscribe: false }
        }
        return res.status(200).send(responseStatus)
    } catch (error) {
        console.error(`${context} Error `, error);
        captureException(error)
        return res.status(500).send({ "status": false, "code": "server_error", "message": "Internal Error" });
    }
}


module.exports = {
    handleDevicesMeasurements,
    handleDevicesInfo,
    createPlugBalancingMeasurements,
    calculateMissingMeasurementsPlugs
}