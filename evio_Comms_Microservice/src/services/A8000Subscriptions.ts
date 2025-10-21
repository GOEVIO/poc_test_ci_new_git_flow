import { captureException } from '@sentry/node';
import axios from 'axios';
// Controllers
import cacheController from '../controllers/cacheController';
import controllerController from '../controllers/controllerController';
//Utils
import { getControllerByDeviceId, getEquipmentByDeviceId } from '../utils/controllersQueries';
import * as controllersQueries from '../utils/controllersQueries';
// Services
import deviceServices from './devices';
import subscriptionsServices from './subscriptions';
// Interfaces
import { DBControllerInterface, IsIEquipmentDB, IEquipmentDB } from '../interfaces/controllersInterfaces';
import {
    IDeviceInfoRequest,
    IA8000Measurements,
    IA8000DataItem,
    IA8000MeasurementsProcessed,
    IEquipmentCommsMeasurements,
    IMeasurementsComms,
} from '../interfaces/mqttSubscriptionsInterfaces';
import { ICacheObject } from '../interfaces/cacheInterface';
// Enums
import { DEVICE_TYPE } from '../utils/enums/deviceTypeEnum';
import { A8000_MEASUREMENT_ENUMS } from '../utils/enums/A8000MeasurementsEnum';
import env from '../configuration/';

const commonLog = '[A8000Subscriptions ';

function getCategoryIdType(deviceType: string): number {
    const context = `${commonLog} getDeviceType] `;
    switch (true) {
        case deviceType.startsWith('CHU'):
            return DEVICE_TYPE.charger;
        case deviceType.startsWith('PV'):
            return DEVICE_TYPE.pv;
        case deviceType.startsWith('SWB'):
            return DEVICE_TYPE.switchBoard;
        case deviceType.startsWith('PCC'):
            return DEVICE_TYPE.publicGrid;
        default:
            console.error(`${context} Error - Device type not found ${deviceType}`);
            throw new Error(`Device type not found ${deviceType}`);
    }
}

function createNewDeviceObject(controller: DBControllerInterface, deviceId: string, measurementsObjects: IA8000MeasurementsProcessed) {
    const splitDeviceId = deviceId.split('_');
    const name = splitDeviceId.slice(1).join('_');
    const categoryId = getCategoryIdType(splitDeviceId[0]);

    let switchBoardGroupId: number | undefined;
    if (categoryId === DEVICE_TYPE.charger && controller.model === env.CONTROLLER.MODELS.MODEL_SIEMENS_A8000) {
        measurementsObjects.arrayMeasurements.find((measurement) => {
            if (measurement.name === A8000_MEASUREMENT_ENUMS.Gr_ID) switchBoardGroupId = Number(measurement.value);
        });
    } else if (categoryId === DEVICE_TYPE.switchBoard && controller.model === env.CONTROLLER.MODELS.MODEL_SIEMENS_A8000) {
        switchBoardGroupId = Number(splitDeviceId[0].replace('SWB', ''));
    }
    const deviceObject: IDeviceInfoRequest = {
        name: name ? name : deviceId,
        id: deviceId,
        categoryId,
        switchBoardGroupId: switchBoardGroupId ?? undefined,
    };
    return { devices: deviceServices.newDevice(deviceObject), controllerId: String(controller.controllerId) };
}

async function processDeviceSubscription(controllerId: string, deviceName: string, payload: IA8000Measurements) {
    const context = `${commonLog} processDeviceSubscription] `;
    if (Object.keys(payload).length === 0) {
        console.log('Object is empty');
        console.error(`${context} Error - Empty payload ${controllerId} ${deviceName} `, payload);
        throw new Error(`A8000 Charger Subscription Payload is empty for device ${deviceName}`);
    }
    const measurementsObjects = convertMeasurementsPayload(payload, controllerId, deviceName);
    // check if charger was already processed or rejected
    let foundDevice: { devices: IEquipmentDB; controllerId: string; deviceId?: string } | null = null;
    const equipmentInfo = cacheController.getKey(deviceName);
    // unfortunately the charger we have to ignore the subscription of this charger for this device we can't just unsubscribe this charger
    if (equipmentInfo && !equipmentInfo.isSubscribed) return true;

    if (!equipmentInfo) {
        // first time the charger is being processed or the service just restarted and have no cache
        const controller = await getControllerByDeviceId(controllerId);
        if (!controller) {
            console.error(`${context} Error - Controller not found ${controllerId}`);
            throw new Error(`A8000 Controller not found for device ${deviceName}`);
        }
        foundDevice = await getEquipmentByDeviceId(deviceName, controller._id, null);
        let isToCreateNewDevice = true;
        if (!foundDevice) {
            // create new device
            isToCreateNewDevice = false;
            foundDevice = createNewDeviceObject(controller, deviceName, measurementsObjects);
            if (!foundDevice) {
                console.error(`${context} Error - Creating the new device`);
                throw new Error('Creating the new device');
            }
        }
        const isToSubscribe: boolean = await subscriptionsServices.sendDeviceInfoToComms(foundDevice, controller);
        cacheController.writeKey(deviceName, {
            online: false,
            lastChanged: new Date(),
            controllerId: controller._id,
            isSubscribed: isToSubscribe,
        });
        if (!isToSubscribe) {
            if (isToCreateNewDevice && IsIEquipmentDB(foundDevice)) {
                // remove Device
                if (!(await controllersQueries.deleteEquipment(foundDevice._id))) {
                    console.error(`${context} Error - Fail to remove equipment ${foundDevice._id}`);
                    throw new Error(`Fail to remove equipment ${foundDevice._id}`);
                }
            }
            return true;
        }
        if (!isToCreateNewDevice) {
            if (!(await controllersQueries.createEquipment(controller._id, foundDevice.devices))) {
                console.error(`${context} Error - Fail to create equipment ${foundDevice.devices.name}`);
                throw new Error(`Fail to create equipment ${foundDevice.devices.name}`);
            }
        }
        return true;
    }

    if (!foundDevice) {
        foundDevice = await getEquipmentByDeviceId(deviceName, null, controllerId);
        if (!foundDevice) {
            console.error(`${context} Error - Missing equipment ${deviceName} from controller ${controllerId}`, foundDevice);
            return true;
        }
    }

    const updateEquipmentMessage = constructEquipmentMeasurementsMessageA8000(measurementsObjects, foundDevice);
    //console.log(`${context} Update Equipment Message`, updateEquipmentMessage);
    if (!updateEquipmentMessage) {
        console.error(
            `${context} Error - Error creating updateEquipmentMessage ${deviceName} from controller ${controllerId}`,
            updateEquipmentMessage
        );
        captureException(`A8000 Subscription - Error creating updateEquipmentMessage ${deviceName} from controller ${controllerId}`);
        return false;
    }
    await subscriptionsServices.sendDeviceMeasurementToComms(updateEquipmentMessage);
    return true;
}

async function subscriptionHandler(topic: string, message: Buffer): Promise<void> {
    const context = `${commonLog} subscriptionHandler] `;
    //console.log(`Received message from topic: ${topic}`);
    const topicsSplit = topic.split('/');
    const controllerId = topicsSplit[2];
    if (!controllerId) {
        console.error(`${context} controllerId not found on topic ${topic}`);
        throw new Error(`A8000 controllerId not found on topic ${topic}`);
    }
    const deviceName = topicsSplit[3];
    const payload: IA8000Measurements = JSON.parse(message.toString());
    if (!deviceName) {
        console.error(`${context} Device name not found on topic ${topic}`);
        throw new Error(`A8000 Device name not found on topic ${topic}`);
    }
    switch (true) {
        case deviceName.startsWith('RTU'):
            processHeartbeat(controllerId, deviceName, payload, topic).catch((err) => {
                console.error(`${context} Error processing device ${deviceName} subscription: ${err.message}`);
                captureException(`A8000 - Error processing device ${deviceName} subscription`);
                return;
            });
            break;
        case deviceName.startsWith('CHU'):
        case deviceName.startsWith('SWB'):
        case deviceName.startsWith('PV'):
        case deviceName.startsWith('PCC'):
            processDeviceSubscription(controllerId, deviceName, payload).catch((err) => {
                console.error(`${context} Error processing device ${deviceName} subscription: ${err.message}`);
                captureException(`A8000 - Error processing device ${deviceName} subscription`);
                return;
            });
            break;
        default:
            console.log(`${context} Unknown device name`, deviceName);
            break;
    }
    return;
}

function convertMeasurementsPayload(payload: IA8000Measurements, controllerId: string, deviceName: string): IA8000MeasurementsProcessed {
    const context = `${commonLog} convertMeasurementsPayload] `;
    const { Timestamp: measurementDate, DataItems: dataItems } = payload;
    if (dataItems.length < 1) throw new Error('Payload without any dataItems');

    let arrayMeasurements: IMeasurementsComms[] = [];
    dataItems.forEach((dataItem: IA8000DataItem) => {
        const splitVariableName = dataItem.Variable.split('-');
        const variableName = A8000_MEASUREMENT_ENUMS[splitVariableName[splitVariableName.length - 1]];
        if (!variableName) {
            console.error(
                `${context} Error - Variable not found ${splitVariableName[splitVariableName.length - 1]} on controller ${controllerId} device: ${deviceName}`,
                dataItem
            );
            captureException(`A8000 Subscription - Unknown variable ${dataItem.Variable}`);
            return;
        }
        if(!dataItem.Value && (typeof dataItem.Value !== 'number' && typeof dataItem.Value !== 'boolean')){
            console.error(
                `${context} Error - Variable ${variableName} with invalid value ${dataItem.Value} on controller ${controllerId} device: ${deviceName}`,
                dataItem
            );
            captureException(`A8000 Subscription - Variable ${dataItem.Value} with invalid value`);
            return;
        }
        try {
            arrayMeasurements.push({
                name: variableName,
                unit: convertMeasurementUnit(variableName),
                valueType: convertMeasurementValueType(dataItem.Type, variableName),
                value: convertMeasurementValue(String(dataItem.Value), dataItem.Type, variableName),
            });
        } catch (error) {
            console.error(`${context} - Error `, error.message);
            // this is temporary until Siemens correct the equipment
            if (controllerId !== 'AZ_DLMS' && env.MICROSERVICE.NODE_ENV !== 'pre') {
                captureException(`Device ${deviceName} of controller ${controllerId} with error ${error.message}`);
            }
        }
    });
    return { timestamp: measurementDate, arrayMeasurements };
}

function convertMeasurementUnit(name: string): string {
    const context = `${commonLog} convertMeasurementUnit] `;
    switch (name) {
        case A8000_MEASUREMENT_ENUMS.Gr_ID:
        case A8000_MEASUREMENT_ENUMS.Op_State:
        case A8000_MEASUREMENT_ENUMS.Priority:
        case A8000_MEASUREMENT_ENUMS.Active_Sessions:
        case A8000_MEASUREMENT_ENUMS.Charging_Mode:
        case A8000_MEASUREMENT_ENUMS.Com_Fail:
        case A8000_MEASUREMENT_ENUMS.Circuit_Breaker:
        case A8000_MEASUREMENT_ENUMS.Sharing_Mode:
        case A8000_MEASUREMENT_ENUMS.Com_Fault:
        case A8000_MEASUREMENT_ENUMS.General_Alarm:
        case A8000_MEASUREMENT_ENUMS.Last_Reading:
        case A8000_MEASUREMENT_ENUMS.N_Phases:
        case A8000_MEASUREMENT_ENUMS.Factor:
            return 'n/a';
        case A8000_MEASUREMENT_ENUMS.A_Limit:
        case A8000_MEASUREMENT_ENUMS.I_Tot:
        case A8000_MEASUREMENT_ENUMS.A_Min_Solar:
        case A8000_MEASUREMENT_ENUMS.ILA:
        case A8000_MEASUREMENT_ENUMS.ILB:
        case A8000_MEASUREMENT_ENUMS.ILC:
        case A8000_MEASUREMENT_ENUMS.CB_A_Limit:
        case A8000_MEASUREMENT_ENUMS.Op_P_Margin:
        case A8000_MEASUREMENT_ENUMS.EVs_Total_Psetp:
            return 'a';
        case A8000_MEASUREMENT_ENUMS.Vavg:
            return 'v';
        case A8000_MEASUREMENT_ENUMS.P:
        case A8000_MEASUREMENT_ENUMS.B_Consumption:
            return 'kw';
        case A8000_MEASUREMENT_ENUMS.Energy:
            return 'w/h';
        default:
            console.error(`${context} Error - Unknown unit name ${name}`);
            throw new Error(`Unknown unit name ${name}`);
    }
}

function convertMeasurementValueType(type: string, variableName: string): string {
    const context = `${commonLog} convertMeasurementValueType] `;
    if (isSpecialCase(variableName) && variableName !== A8000_MEASUREMENT_ENUMS.A_Limit && variableName !== A8000_MEASUREMENT_ENUMS.A_Min_Solar)
        return 'STRING';
    if (variableName === A8000_MEASUREMENT_ENUMS.Com_Fail || variableName === A8000_MEASUREMENT_ENUMS.Circuit_Breaker) return 'BOOLEAN'; // these variables are being sent as INT16 but they are boolean
    switch (type) {
        case 'BOOL':
            return 'BOOLEAN';
        case 'INT16':
        case 'UINT16':
        case 'UINT32':
            return 'INTEGER';
        case 'DOUBLE_FLOAT':
        case 'SINGLE_FLOAT':
            return 'FLOAT';
        default:
            console.error(`${context} Error - Unknown type ${type}`);
            throw new Error(`Unknown type ${type}`);
    }
}

function convertMeasurementValue(value: string, type: string, variableName: string): string {
    const context = `${commonLog} convertMeasurementUnit] `;

    if (isSpecialCase(variableName)) {
        switch (variableName) {
            case A8000_MEASUREMENT_ENUMS.Op_State:
                return getValueOPState(value);
            case A8000_MEASUREMENT_ENUMS.Sharing_Mode:
                return getValueSharingMode(value);
            case A8000_MEASUREMENT_ENUMS.Charging_Mode:
                return getValueChargingMode(value);
            case A8000_MEASUREMENT_ENUMS.A_Limit:
            case A8000_MEASUREMENT_ENUMS.A_Min_Solar:
                return String(Number(value) / 3); // this is because it makes more logic to present the value of current limit per each phase
            default:
                console.log(`${context} Unknown special Case ${variableName}`);
                throw new Error(`Unknown special Case ${variableName}`);
        }
    }
    switch (type) {
        case 'INT16':
        case 'UINT16':
        case 'UINT32':
        case 'SINGLE_FLOAT':
        case 'DOUBLE_FLOAT':
            return value;
        case 'BOOLEAN':
            return value.toLocaleLowerCase() === 'true' || value === '1' ? 'true' : 'false';
        default:
            console.error(`${context} Error - Unknown unit ${type}`);
            throw new Error(`Unknown unit ${type}`);
    }
}

function isSpecialCase(variableName: string): boolean {
    switch (variableName) {
        case A8000_MEASUREMENT_ENUMS.Op_State:
        case A8000_MEASUREMENT_ENUMS.Sharing_Mode:
        case A8000_MEASUREMENT_ENUMS.Charging_Mode:
        case A8000_MEASUREMENT_ENUMS.A_Limit:
        case A8000_MEASUREMENT_ENUMS.A_Min_Solar:
            return true;
        default:
            return false;
    }
}

function getValueOPState(value: string): string {
    const context = `${commonLog} getValueOPState] `;
    switch (value) {
        case '0':
            return 'Communication Fault';
        case '1':
            return 'Available';
        case '2':
            return 'Charging';
        case '3':
            return 'Fault';
        case '4':
            return 'Waiting EV/Charger';
        case '5':
            return 'Cable Connected';
        default:
            console.log(`${context} Unknown OP State state ${value}`);
            throw new Error(`Unknown OP State state ${value}`);
    }
}

function getValueChargingMode(value: string): string {
    const context = `${commonLog} getValueOPState] `;
    switch (value) {
        case '1':
            return 'Solar Mode';
        case '2':
            return 'Base Mode';
        default:
            console.log(`${context} Unknown Charging Mode ${value}`);
            throw new Error(`Unknown Charging Mode ${value}`);
    }
}

function getValueSharingMode(value: string): string {
    const context = `${commonLog} getValueOPState] `;
    switch (value) {
        case '0':
            return 'No Mode';
        case '1':
            return 'FIFO';
        case '2':
            return 'Evenly Split';
        default:
            console.log(`${context} Unknown Sharing Mode state ${value}`);
            throw new Error(`Unknown Sharing Mode state ${value}`);
    }
}
function constructEquipmentMeasurementsMessageA8000(
    measurementsObject: IA8000MeasurementsProcessed,
    equipment: {
        devices: IEquipmentDB;
        controllerId: string;
        deviceId?: string;
    }
): IEquipmentCommsMeasurements {
    return {
        equipmentType: equipment.devices.deviceType,
        equipmentName: equipment.devices.name,
        arrayMeasurements: measurementsObject.arrayMeasurements,
        time: new Date(measurementsObject.timestamp),
        deviceId: equipment.devices.deviceId,
        controllerId: equipment.controllerId,
    };
}

async function processHeartbeat(controllerId: string, deviceName: string, payload: IA8000Measurements, topic: string) {
    const context = `${commonLog} processHeartbeat] `;
    let updateStatus = false;
    const controller = await getControllerByDeviceId(controllerId);
    if (!controller) {
        console.error(`${context} Error - Controller not found ${controllerId}`);
        throw new Error(`A8000 Controller not found for device ${deviceName}`);
    }
    let data = {
        deviceId: controller.deviceId,
        updateInfo: {
            serial: `A8000-${deviceName}`,
        },
    };
    let cachedDeviceObject = cacheController.getKey(deviceName) as unknown as ICacheObject;
    if (!cachedDeviceObject) {
        console.error(`${context} Error - No cache Object for device `, deviceName);
        cachedDeviceObject = { online: true, lastChanged: new Date(), controllerId: controller.controllerId };
        updateStatus = true;
    } else {
        if (!cachedDeviceObject.online) updateStatus = true;
        cachedDeviceObject.online = true;
        cachedDeviceObject.lastChanged = new Date();
    }

    if (topic.endsWith('/STA/')) {
        for (let dataItem of payload.DataItems) {
            if (dataItem.Variable.endsWith(A8000_MEASUREMENT_ENUMS.General_Alarm)) data.updateInfo['generalAlarm'] = dataItem.Value === '1';
            if (dataItem.Variable.endsWith(A8000_MEASUREMENT_ENUMS.Com_Fault)) data.updateInfo['commAlarm'] = dataItem.Value === '1';
        }
    }
    await Promise.all([
        cacheController.writeKey(deviceName, cachedDeviceObject),
        axios.patch(`${env.ENDPOINTS.CHARGERS_HOST}${env.ENDPOINTS.CHARGER_UPDATE_CONTROLLERS}`, data),
    ]);
    if (updateStatus) controllerController.updateControllersConnectionStatus([`${controller.controllerId}`], true);
}

export default {
    subscriptionHandler,
};