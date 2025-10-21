import env from '../configuration/index';
import axios from 'axios';
import { captureException } from '@sentry/node';
// Handler
import mqttHandler from './mqttController';
// Controllers
import mqttController from './mqttController';
import cacheController from './cacheController';
import controllerController from './controllerController';
//DB
import * as ControllersQueries from '../utils/controllersQueries';
//Utils
import { getControllerByDeviceId, getEquipmentByDeviceId, deleteEquipment, createEquipment } from '../utils/controllersQueries';
// Interfaces
import {
    IControllerInfo,
    isIControllerInfoRequest,
    IControllerInfoRequest,
    IEquipmentDB,
    IMeasurements,
    IsIEquipmentDB,
    IChargingModeInterface,
    IChargingModeInterfaceDB,
    DBControllerInterface,
} from '../interfaces/controllersInterfaces';
import {
    IDeviceInfoRequest,
    IsIDeviceInfoRequest,
    IMeasurementsRequest,
    IsIDeviceMeasurementTopic,
    IDeviceMeasurementTopic,
    IMeasurementsComms,
    IEquipmentCommsMeasurements,
    IsArrayIStrategiesListPayload,
    IStrategiesListObjectPayload,
    IPublishMessageType,
} from '../interfaces/mqttSubscriptionsInterfaces';
// Enum
import { CHARGING_MODE_STRATEGY } from '../utils/enums/chargingModesStrategyEnum';
// Services
import subscriptionsServices from '../services/subscriptions';
import deviceServices from '../services/devices';

const allowChargerMeasurements = [
    'ERROR',
    'ERROR_COMMUNICATION',
    'CURRENT_L1',
    'CURRENT_L2',
    'CURRENT_L3',
    'VOLTAGE_L1',
    'VOLTAGE_L2',
    'VOLTAGE_L3',
    'STATE_NAME',
    'POWER_ACTIVE_MAX',
    'POWER_ACTIVE',
    'SOC_MAX',
    'CONTROL_TYPE',
    'POWER_ACTIVE_MIN',
    'CURRENT_PHASE_SETPOINT',
];
const allowPvMeasurements = [
    'EXPORT_ENERGY_ACTIVE',
    'EXPORT_POWER_ACTIVE',
    'ERROR_COMMUNICATION',
    'POWER_ACTIVE',
    'IMPORT_POWER_ACTIVE',
    'CONTROL_TYPE',
];
const allowGridMeterMeasurements = [
    'IMPORT_ENERGY_ACTIVE',
    'IMPORT_POWER_ACTIVE',
    'EXPORT_ENERGY_ACTIVE',
    'EXPORT_POWER_ACTIVE',
    'VOLTAGE_L3',
    'VOLTAGE_L2',
    'VOLTAGE_L1',
    'CURRENT_L1',
    'CURRENT_L2',
    'CURRENT_L3',
    'POWER_ACTIVE',
    'ERROR_COMMUNICATION',
];

const commonLog = '[ handler smartBoxSubscriptions ';
function createControllerInfoObject(message: IControllerInfoRequest): IControllerInfo {
    const context = `${commonLog} createControllerInfoObject ]`;
    try {
        return {
            serial: message.CPUSerial,
            localIp: message.ethernetIp,
            osVersion: message.osVersion,
            softwareVersion: message.softwareVersion,
            hwVersion: message.hwVersion,
        } as IControllerInfo;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function handleControllerIdentifier(deviceId: string, message: object): Promise<boolean> {
    const context = `${commonLog} handleControllerIdentifies ]`;
    try {
        if (!deviceId) {
            console.error(`${context} Error - Missing deviceId ${deviceId}`);
            throw new Error(`Missing deviceId`);
        }
        if (!isIControllerInfoRequest(message)) {
            console.error(`${context} Error - Missing message `, message);
            throw new Error(`Missing controllerId`);
        }
        const controller = await getControllerByDeviceId(deviceId);
        if (!controller) {
            console.error(`${context} Error - Controller doesn't exist ??! ${deviceId}`);
            throw new Error(`Controller doesn't exist ${deviceId}`);
        }
        const controllerData: IControllerInfo = createControllerInfoObject(message);
        const updatedController = await axios.patch(`${env.ENDPOINTS.CHARGERS_HOST}${env.ENDPOINTS.CHARGER_UPDATE_CONTROLLERS}`, {
            deviceId,
            updateInfo: controllerData,
        });
        if (!updatedController?.data?.status) {
            console.error(`${context} Error - Error Updating controller info`, controllerData);
            captureException(new Error(`Updating controller info deviceId: ${deviceId}`));
        }

        return await updateDeviceStatusOnCache(deviceId);
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function updateDeviceStatusOnCache(deviceId: string): Promise<boolean> {
    const context = `${commonLog} updateDeviceStatusOnCache ]`;
    try {
        if (!deviceId) {
            console.error(`${context} Error - Missing input deviceId ${deviceId}`);
            throw new Error('Missing input deviceId');
        }
        let updateObject = cacheController.getKey(deviceId);
        if (updateObject) {
            updateObject['lastChanged'] = new Date();
            if (!updateObject.online) controllerController.updateControllersConnectionStatus([deviceId], true);
        } else {
            const controller = await ControllersQueries.getControllerByDeviceId(deviceId);
            if (!controller) {
                console.error(`${context} Error - No controller for deviceId ${deviceId}`);
                throw new Error(`No controller for deviceId ${deviceId}`);
            }
            updateObject = { online: true, lastChanged: new Date(), controllerId: controller.controllerId };
        }
        cacheController.writeKey(deviceId, updateObject);
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

async function handleDevicesInfo(controllerDeviceId: string, deviceId: string, message: object): Promise<boolean> {
    const context = `${commonLog} handleDevicesInfo ]`;
    try {
        if (!message || !IsIDeviceInfoRequest(message)) {
            console.error(`${context} Error - Message in the wrong format`, message);
            throw new Error(`Message in the wrong format`);
        }
        const controller = await getControllerByDeviceId(controllerDeviceId);
        if (!controller) {
            console.error(`${context} Error - Controller doesn't exist ??! ${deviceId}`);
            throw new Error(`Controller doesn't exist ${deviceId}`);
        }
        let foundDevice = await getEquipmentByDeviceId(deviceId, controller._id, null);
        let deviceFound = true;
        if (!foundDevice) {
            // create new device
            deviceFound = false;
            foundDevice = { devices: deviceServices.newDevice(message), controllerId: String(controller.chargerControllerId) };
            if (!foundDevice) {
                console.error(`${context} Error - Creating the new device`);
                throw new Error('Creating the new device');
            }
        }
        const isToSubscribe: boolean = await subscriptionsServices.sendDeviceInfoToComms(foundDevice, controller);
        if (!isToSubscribe) {
            if (deviceFound && IsIEquipmentDB(foundDevice)) {
                // remove Device
                if (!(await deleteEquipment(foundDevice._id))) {
                    console.error(`${context} Error - Fail to remove equipment ${foundDevice._id}`);
                    throw new Error(`Fail to remove equipment ${foundDevice._id}`);
                }
            }
            return true;
        }
        if (!deviceFound) {
            if (!(await createEquipment(controller._id, foundDevice.devices))) {
                console.error(`${context} Error - Fail to create equipment ${foundDevice.devices.name}`);
                throw new Error(`Fail to create equipment ${foundDevice.devices.name}`);
            }
        }
        // create new subscriptions to this device
        const newTopic = `controllers/${controller.deviceId}/devices/${deviceId}/#`;
        if (!(await mqttController.addNewSubscriptions([newTopic], controller.controllerId))) {
            console.error(`${context} Error - Fail to add new subscription ${newTopic}`);
            throw new Error(`Fail to add new subscription ${newTopic}`);
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function unsubscribeFromEquipment(equipmentId: string, deviceId: string) {
    const context = `${commonLog} unsubscribeFromEquipment ]`;
    try {
        const topic = [
            `controllers/${deviceId}/devices/${equipmentId}/readout`,
            `controllers/${deviceId}/devices/${equipmentId}/setpoint`,
            `controllers/${deviceId}/devices/${equipmentId}/#`,
        ];
        return await mqttController.unsubscribeTopics(topic);
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

function getStateNameNormalized(state) {
    const context = `${commonLog} getStateNameNormalized ]`;
    try {
        switch (state) {
            case 'EV_NOT_CONNECTED':
                return 'available';
            case 'Bulk':
            case 'CHARGING':
                return 'charging';
            case 'EV_CONNECTED':
                return 'cable connected';
            default:
                console.error(`${context} Error - Unknown plug state !!${state}`);
                return 'unknown';
        }
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

function getNormalizedValue(variableName: string, value: string): string {
    const context = `${commonLog} getNormalizedValue ]`;
    try {
        switch (variableName) {
            case 'STATE_NAME':
                return getStateNameNormalized(value);
            default:
                return value;
        }
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

function normalizeEquipmentNames(deviceType) {
    switch (deviceType) {
        case 'Grid':
            return 'Grid meter';
            break;
        default:
            return deviceType;
    }
}

function constructEquipmentMeasurementsMessage(
    equipment: IEquipmentDB,
    measurementMessage: IDeviceMeasurementTopic,
    deviceId: string,
    controllerId: string
): IEquipmentCommsMeasurements | null {
    const context = `${commonLog} constructEquipmentMeasurementsMessage ]`;
    try {
        if (measurementMessage.values.length < 1) {
            console.error(`${context} Error - No measurements to send to Comms`);
            throw new Error('No measurements to send to Comms');
        }
        let allowMeasurements: string[] = [];
        // to only send needed measurements to charger (reduce the amount of data sent to charger Microservice)
        switch (equipment.deviceType) {
            case 'Charger':
                allowMeasurements = allowChargerMeasurements;
                break;
            case 'PV':
                allowMeasurements = allowPvMeasurements;
                break;
            case 'Grid':
                allowMeasurements = allowGridMeterMeasurements;
                break;
            // TODO:  'Meter
            default:
                console.log('equipment: ', equipment);
                break;
        }
        if (allowMeasurements.length < 1) return null;

        let arrayMeasurementsComms: IMeasurementsComms[] = [];
        for (let measurement of measurementMessage.values) {
            // FIXME: BUG da smartBox - não envia o dataTypeId do Power_Active nem declara a measurment na info do carregador. ( só esta aqui ate ser corrigido por parte da smartBox)
            let measurementType;
            if (!measurement.dataTypeId && !allowMeasurements.includes(measurement.dataTypeEnum)) continue;
            else if (!measurement.dataTypeId) {
                measurementType = {
                    name: measurement.dataTypeEnum,
                    unit: '',
                    valueType: 'STRING',
                    value: String(measurement.value),
                };
            } else {
                if (!measurement.dataTypeId || measurement.value === null) continue;

                measurementType = equipment.listMeasurementsTypes?.find((e) => e.measurementId === measurement.dataTypeId?.toString());
                if (!measurementType || !allowMeasurements.includes(measurementType.name)) {
                    if (!measurementType) console.error(`${context} Error - Missing measurement type : ${measurement.dataTypeId}`);
                    continue;
                }
            }
            const normalizedValue: string = getNormalizedValue(measurementType.name, String(measurement.value));
            arrayMeasurementsComms.push({
                name: measurementType.name,
                unit: measurementType.unit,
                valueType: measurementType.valueType,
                value: normalizedValue,
            });
        }
        return {
            equipmentType: normalizeEquipmentNames(equipment.deviceType),
            equipmentName: equipment.name,
            arrayMeasurements: arrayMeasurementsComms,
            time: new Date(measurementMessage.time),
            deviceId,
            controllerId,
        };
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function handleDevicesReadMeasurements(deviceId: string, equipmentId: string, message: object): Promise<boolean> {
    const context = `${commonLog} handleDevicesReadMeasurements ]`;
    try {
        if (!deviceId || !equipmentId) {
            console.error(`${context} Error - Missing Topic !! '${deviceId}' ${equipmentId} ${message}`);
            throw new Error('Error Missing Topic');
        }
        if (!IsIDeviceMeasurementTopic(message)) {
            console.error(`${context} Error - Message in the wrong format`, JSON.stringify(message));
            throw new Error(`Message in the wrong format`);
        }
        if (message.values.length < 1) {
            // publishing this topic without measurements ( it should not happen but is better to prevent unnecessary process)
            return true;
        }
        const equipment = await getEquipmentByDeviceId(equipmentId, null, deviceId);
        if (!equipment) {
            console.error(`${context} Error - Missing equipment ${equipmentId} from controller ${deviceId}`, equipment);
            await unsubscribeFromEquipment(equipmentId, deviceId);
            return true;
        }
        const updateEquipmentMessage = constructEquipmentMeasurementsMessage(equipment.devices, message, deviceId, equipment.controllerId);
        if (!updateEquipmentMessage) {
            console.error(
                `${context} Error - Error creating updateEquipmentMessage ${equipmentId} from controller ${deviceId}`,
                updateEquipmentMessage
            );
            captureException(`A8000 Subscription - Error creating updateEquipmentMessage ${equipmentId} from controller ${deviceId}`);
            return false;
        }
        await subscriptionsServices.sendDeviceMeasurementToComms(updateEquipmentMessage);
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

function isValidStrategy(strategyName: string | null): boolean {
    return !strategyName || env.CONTROLLER.STRATEGIES.ALLOW_STRATEGIES.includes(strategyName);
}

function getChargingModeStrategy(name: string): string {
    const context = `${commonLog} getChargingModeStrategy ]`;
    try {
        switch (name) {
            case CHARGING_MODE_STRATEGY.SOLARMODE:
                return env.CONTROLLER.CHARGINGMODES.CHARGINGMODE_SOLAR;
            case CHARGING_MODE_STRATEGY.BASEMODE:
                return env.CONTROLLER.CHARGINGMODES.CHARGINGMODE_BASE;
            default:
                return env.CONTROLLER.CHARGINGMODES.CHARGINGMODE_UNKNOWN;
        }
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

function constructArrayStrategies(listStrategies: IStrategiesListObjectPayload[], controllerId: string): IChargingModeInterface[] | [] {
    const context = `${commonLog} constructArrayStrategies ]`;
    try {
        let arrayStrategies: IChargingModeInterface[] = [];
        for (const strategy of listStrategies) {
            const arrayName = strategy.name.split('_');
            if (arrayName.length < 1) continue;

            const chargingMode = arrayName[arrayName.length - 1];
            if (!isValidStrategy(chargingMode)) {
                console.error(`${context} Warning - Invalid Strategy on device ${controllerId} --> `, chargingMode);
                continue;
            }
            arrayStrategies.push({
                name: strategy.name,
                mode: getChargingModeStrategy(chargingMode),
                active: strategy.active,
                strategyId: String(strategy.id),
            });
        }
        return arrayStrategies;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

function constructMessageUpdateChargingModes(deviceId: string, arrayStrategies: IChargingModeInterface[] | []) {
    const context = `${commonLog} constructMessageUpdateChargingModes ]`;
    try {
        if (!deviceId) {
            console.error(`${context} Error - Missing deviceId !! ${deviceId}`);
            throw new Error('Missing deviceId');
        }
        let chargingModes: string[] = [];
        let activeChargingMode = env.CONTROLLER.CHARGINGMODES.CHARGINGMODE_NO;
        arrayStrategies.forEach((strategy) => {
            chargingModes.push(strategy.mode);
            if (strategy.active) activeChargingMode = strategy.mode;
        });
        if (arrayStrategies.length == 0) chargingModes.push(env.CONTROLLER.CHARGINGMODES.CHARGINGMODE_NO);
        return {
            deviceId,
            chargingModes,
            activeChargingMode,
        };
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function updateSwitchboardChargingModes(deviceId: string, arrayStrategies: IChargingModeInterface[] | []): Promise<boolean> {
    const context = `${commonLog} updateSwitchboardChargingModes ]`;
    try {
        if (!deviceId) {
            console.error(`${context} Error - Missing deviceId !! ${deviceId}`);
            throw new Error('Missing deviceId');
        }

        const data = constructMessageUpdateChargingModes(deviceId, arrayStrategies);
        const response = await axios.patch(`${env.ENDPOINTS.CHARGERS_HOST}${env.ENDPOINTS.CHARGER_UPDATE_SWITCHBOARDS_LISTCHARGINGMODES}`, data);
        if (!response.data) {
            console.error(`${context} Error - Missing response from charger Microservice to update Charging List Mode !! `);
            throw new Error('Missing response from charger Microservice to update Charging List Mode');
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function subscribeStrategies(controllerId: string, arrayStrategies: IChargingModeInterface[]): Promise<boolean> {
    const context = `${commonLog} subscribeStrategies ]`;
    try {
        if (!controllerId) {
            console.error(`${context} Error - Missing Input !! '${controllerId}' ${arrayStrategies}`);
            throw new Error('Missing Input');
        }
        let arraySubscribeTopics: string[] = [];
        arrayStrategies.forEach((strategy) => {
            arraySubscribeTopics.push(`controllers/${controllerId}/strategies/${strategy.strategyId}/#`);
        });
        return await mqttController.subscribeTopics(arraySubscribeTopics);
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function handleStrategiesList(controllerId: string, listStrategies: object): Promise<boolean> {
    const context = `${commonLog} handleStrategiesList ]`;
    try {
        if (!controllerId || !Array.isArray(listStrategies)) {
            console.error(`${context} Error - Missing Input !! '${controllerId}' ${listStrategies}`);
            throw new Error('Missing Input');
        }
        if (!IsArrayIStrategiesListPayload(listStrategies)) {
            console.error(`${context} Error - payload is not an IStrategiesListPayload --> '${JSON.stringify(listStrategies)}' `);
            throw new Error('payload is not an IStrategiesListPayload');
        }

        const arrayStrategies: IChargingModeInterface[] | [] = constructArrayStrategies(listStrategies, controllerId);

        if (!(await ControllersQueries.updateListChargingModes(controllerId, arrayStrategies))) {
            console.error(`${context} Error - Fail to update listChargingModes from controller ${controllerId}`);
            throw new Error(`Fail to update listChargingModes from  controller ${controllerId}`);
        }

        if (!(await updateSwitchboardChargingModes(controllerId, arrayStrategies))) {
            console.error(`${context} Error - Fail to update allowChargingModes of Switchboards`);
            throw new Error('Fail to update allowChargingModes of Switchboards');
        }
        //subscribe to strategies
        if (arrayStrategies.length > 0) {
            if (!(await subscribeStrategies(controllerId, arrayStrategies))) {
                console.error(`${context} Error - Fail to update allowChargingModes of Switchboards`);
                throw new Error('Fail to update allowChargingModes of Switchboards');
            }
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function deactivateAllStrategies(listChargerModes: IChargingModeInterfaceDB[], controllerId: string): Promise<boolean> {
    const context = `${commonLog} deactivateAllStrategies ]`;
    try {
        if (!controllerId || listChargerModes.length < 1) {
            console.error(`${context} Error - Missing input data `, controllerId, listChargerModes);
            throw new Error('Missing input data');
        }
        // check if needs to deactivate all strategies
        const listStrategiesToDeactivate: IPublishMessageType[] = listChargerModes
            .filter((mode) => mode.active)
            .map((mode) => ({
                topic: `controllers/${controllerId}/strategies/${mode.strategyId}/active/set`,
                message: 'false',
            }));

        if (listStrategiesToDeactivate.length > 0) {
            if (!(await mqttHandler.publishTopics(listStrategiesToDeactivate))) {
                console.error(`${context} Error - Fail to publish Deactivate strategies`);
                throw new Error('Fail to publish Deactivate strategies');
            }
            if (!(await ControllersQueries.deactivateAllChargingModes(controllerId))) {
                console.error(`${context} Error - Fail deactivate all chargingModes of ${controllerId}`);
                throw new Error(`Fail deactivate all chargingModes of ${controllerId}`);
            }
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function updateSwitchboardsChargingMode(
    controller: DBControllerInterface,
    chargingMode: IChargingModeInterfaceDB,
    chargingModeStatus: boolean
): Promise<boolean> {
    const context = `${commonLog} updateSwitchboardsChargingMode ]`;
    try {
        if (!controller) {
            console.error(`${context} Error - Missing controllerId `, controller);
            throw new Error('Missing controllerId');
        }
        const data = {
            chargingMode: chargingModeStatus ? chargingMode.mode : env.CONTROLLER.CHARGINGMODES.CHARGINGMODE_NO,
            controllerId: controller.controllerId,
        };
        const response = await axios.patch(`${env.ENDPOINTS.CHARGERS_HOST}${env.ENDPOINTS.CHARGER_UPDATE_SWITCHBOARDS_CHARGINGMODES}`, data);
        if (!response.data) {
            console.error(`${context} Error - Missing response from charger Microservice to update Charging Mode !! `);
            throw new Error('Missing response from charger Microservice to update Charging Mode');
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function handleStrategiesActiveMessage(controllerId: string, payload: object, strategyId: string): Promise<boolean> {
    const context = `${commonLog} handleStrategiesActiveMessage ]`;
    try {
        if (!controllerId || typeof payload !== 'boolean' || !strategyId) {
            console.error(`${context} Error - Missing Input !! ${controllerId} ${payload} ${strategyId}`);
            throw new Error('Missing Input');
        }
        const controller = await getControllerByDeviceId(controllerId);
        if (!controller) {
            console.error(`${context} Error - Unknown controller ?? ${controllerId}`);
            throw new Error('Fail to update allowChargingModes of Switchboards');
        }
        const chargingMode = controller.listChargingModes.find((chargingMode) => chargingMode.strategyId == strategyId);
        if (!chargingMode) {
            console.error(`${context} Error - unknown strategy ${strategyId}`);
            return true;
        }
        const strategyStatus = Boolean(payload);
        if (chargingMode.active === strategyStatus) return true; // variable is already with the received value
        if (strategyStatus) {
            if (!(await deactivateAllStrategies(controller.listChargingModes, controllerId))) {
                console.error(`${context} Error - Fail to deactivateAllStrategies`);
                throw new Error('Fail to deactivateAllStrategies');
            }
        }
        // update chargingModes on controllers in DB
        if (!(await ControllersQueries.updateChargingModes(controllerId, strategyId, strategyStatus))) {
            console.error(`${context} Error - Fail to update Charging Mode`);
            throw new Error('Fail to Fail to update Charging Mode');
        }
        // update switchboards Charging Modes
        if (!(await updateSwitchboardsChargingMode(controller, chargingMode, strategyStatus))) {
            console.error(`${context} Error - Fail to update Switchboard ChargingMode`);
            throw new Error('Fail to update Switchboard ChargingMode');
        }
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function handleKeepAlive(deviceId: string, data: object | null): Promise<boolean> {
    const context = `${commonLog} handleKeepAlive ]`;
    try {
        if (!deviceId) {
            console.error(`${context} Error - No controller Id ${deviceId}`);
            throw new Error(`No controller Id ${deviceId}`);
        }
        return await updateDeviceStatusOnCache(deviceId);
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

async function subscribeTopicHandle(topic: string, message: Buffer): Promise<boolean> {
    const context = `${commonLog} subscribeTopicHandle ]`;
    try {
        const topicsSplit = topic.split('/');
        const controllerId = topicsSplit[1];
        const payload: object | null = JSON.parse(message.toString());

        // topic: controllers/{controllerId}/identifier -> message with controller information
        if (topic.endsWith('/identifier') && payload) {
            handleControllerIdentifier(controllerId, payload).catch((error) => {
                console.error(`${context} Error - ${error.message}`);
                captureException(error);
            });
            return true;
        }
        // topic:  controllers/{controllerId}/keepAlive -> KeepAlive
        if (topic.endsWith('/keepAlive')) {
            handleKeepAlive(controllerId, payload).catch((error) => {
                console.error(`${context} Error - ${error.message}`);
                captureException(error);
            });
            return true;
        }
        // topic: controllers/{controllerId}/devices/{deviceId}/info ->  message with device information
        if (topic.endsWith('/info') && topic.includes('/devices/') && payload) {
            const deviceId = topicsSplit[3];
            handleDevicesInfo(controllerId, deviceId, payload).catch((error) => {
                console.error(`${context} Error - ${error.message}`);
                captureException(error);
            });
            return true;
        }
        // topic: controllers/{controllerId}/devices/{deviceId}/readout -> message with device read measurements
        if (topic.endsWith('/readout') && topic.includes('/devices/') && payload) {
            const deviceId = topicsSplit[3];
            handleDevicesReadMeasurements(controllerId, deviceId, payload).catch((error) => {
                console.error(`${context} Error - ${error.message}`);
                // FIXME: Remove the comment capture of Sentry when the measurements from etrel charger is fixed
                //captureException(error);
            });
            return true;
        }
        // topic:  controllers/{controllerId}/strategies/list ->  message with list of all strategies that the controller has
        if (topic.endsWith('/strategies/list') && payload) {
            handleStrategiesList(controllerId, payload).catch((error) => {
                console.error(`${context} Error - ${error.message}`);
                captureException(error);
            });
            return true;
        }
        // topic:  controllers/{controllerId}/strategies/{strategyId}/active -> message with status strategy (ON/OFF)
        if (topic.endsWith('/active') && topic.includes('/strategies/') && typeof payload == 'boolean') {
            const strategyId = topicsSplit[3];
            handleStrategiesActiveMessage(controllerId, payload, strategyId).catch((error) => {
                console.error(`${context} Error - ${error.message}`);
                captureException(error);
            });
            return true;
        }
        console.log(`${context} Received message on topic '${topic}'`);
        //console.log(`${context} Received message on topic '${topic}': ${message.toString()}`);
        return true;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

export default {
    subscribeTopicHandle,
};
