import axios from 'axios';
import env from '../configuration/index';

// interfaces
import { IDeviceInfoToComms, IEquipmentCommsMeasurements } from '../interfaces/mqttSubscriptionsInterfaces';
import { IEquipmentDB, DBControllerInterface } from '../interfaces/controllersInterfaces';

const commonLog = '[Service subscriptions ';

function normalizeDeviceType(deviceType: string): string {
    switch (deviceType) {
        case 'Grid':
            return 'SwitchboardMeter';
        default:
            return deviceType;
    }
}

async function sendDeviceInfoToComms(
    equipment: {
        devices: IEquipmentDB;
        controllerId: string;
    },
    controller: DBControllerInterface
): Promise<boolean> {
    const context = `${commonLog} sendDeviceInfoToComms ]`;
    const sendObject: IDeviceInfoToComms = {
        name: equipment.devices.name,
        deviceDescription: equipment.devices.deviceDescription ?? null,
        deviceId: equipment.devices.deviceId,
        protocol: equipment.devices.protocol,
        deviceType: normalizeDeviceType(equipment.devices.deviceType),
        controllerId: controller.controllerId,
        switchBoardGroupId: equipment.devices.switchBoardGroupId ?? undefined,
    };
    const response = await axios.patch(`${env.ENDPOINTS.CHARGERS_HOST}${env.ENDPOINTS.CHARGER_UPDATE_DEVICE_INFO}`, sendObject);
    return response?.data?.status && response?.data?.isToSubscribe;
}

async function sendDeviceMeasurementToComms(updateEquipmentMessage: IEquipmentCommsMeasurements): Promise<boolean> {
    const context = `${commonLog} sendDeviceMeasurementToComms ]`;
    const response = await axios.patch(`${env.ENDPOINTS.CHARGERS_HOST}${env.ENDPOINTS.CHARGER_UPDATE_DEVICE_MEASUREMENTS}`, updateEquipmentMessage);
    if (!response?.data?.status) {
        console.error(`${context} Error - Fail to process Measurements`);
        throw new Error('Fail to process Measurements');
    }
    return true;
}

export default {
    sendDeviceInfoToComms,
    sendDeviceMeasurementToComms,
};
