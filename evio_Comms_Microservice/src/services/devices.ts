// interfaces
import { IDeviceInfoRequest } from '../interfaces/mqttSubscriptionsInterfaces';
import { IEquipmentDB, IMeasurements } from '../interfaces/controllersInterfaces';
import { IMeasurementsRequest } from '../interfaces/mqttSubscriptionsInterfaces';
const commonLog = '[Service devices ';

function getDeviceType(categoryId: Number): string {
    const context = `${commonLog} getDeviceType ]`;
    switch (categoryId) {
        case 2:
            return 'Charger';
        case 3:
            return 'PV';
        case 4:
            return 'Battery';
        case 6:
            return 'Grid';
        case 8:
            return 'SwitchBoard';
        case 9:
            return 'PublicGrid';
        default:
            console.error(`${context} Error - Unknown categoryId ${categoryId}`);
            throw new Error(`Unknown categoryId ${categoryId}`);
            break;
    }
}

function newDevice(newDevice: IDeviceInfoRequest): IEquipmentDB {
    return {
        name: newDevice.name,
        deviceDescription: newDevice.type?.enumeration ?? undefined,
        deviceId: newDevice.id.toString(),
        protocol: 'MQTT',
        deviceType: getDeviceType(newDevice.categoryId),
        listMeasurementsTypes: newDevice.dataTypes ? getListMeasurementsTypes(newDevice.dataTypes) : undefined,
        switchBoardGroupId: newDevice.switchBoardGroupId ?? undefined,
    } as IEquipmentDB;
}

function getListMeasurementsTypes(listDataTypes: IMeasurementsRequest[]): IMeasurements[] {
    let listData: IMeasurements[] = [];
    for (let dataType of listDataTypes) {
        listData.push({
            measurementId: String(dataType.id),
            name: dataType.enumeration,
            description: dataType.name,
            unit: dataType.unit,
            valueType: dataType.valueType,
        });
    }
    return listData;
}

export default {
    getListMeasurementsTypes,
    newDevice,
    getDeviceType,
};
