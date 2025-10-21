import { ObjectId } from 'mongoose';

export interface IMeasurements {
    measurementId: string;
    name: string;
    description: string | null;
    unit: string;
    valueType: string;
}

export interface IMeasurementsDB extends IMeasurements {
    _id: ObjectId;
}

export interface ISetPoint {
    name: string;
    value: string;
}
export interface IEquipment {
    name: string;
    deviceDescription?: string;
    deviceId: string;
    protocol: 'MQTT' | 'OPC-UA';
    deviceType: string;
    listMeasurementsTypes?: IMeasurementsDB[] | IMeasurements[];
    switchBoardGroupId?: string;
    listSetPoints?: ISetPoint[];
}

export interface IEquipmentDB extends IEquipment {
    _id: ObjectId;
}

export function IsIEquipment(object: any): object is IEquipment {
    return object.name && object.deviceId && ['MQTT', 'OPC-UA'].includes(object.protocol) && ['Charger', 'PV', 'Meter'].includes(object.deviceType);
}
export function IsIEquipmentDB(object: any): object is IEquipmentDB {
    return object._id && IsNewController(object);
}
export interface NewControllerInterface {
    controllerId: ObjectId;
    chargerControllerId: ObjectId;
    deviceId: string;
    name: string;
    protocol: 'MQTT' | 'OPC-UA';
    model: string;
    connectionURL: string | null;
    active: boolean | null;
}

export interface IControllerInfo {
    serial: string | null;
    localIp: string | null;
    osVersion: string | null;
    softwareVersion: string | null;
    hwVersion: string | null;
}

export interface IControllerInfoRequest {
    unitId: string;
    unitIdFormatted: string;
    CPUSerial: string;
    EMMCSerial: string;
    ethernetMAC: string | null;
    ethernetIp: string | null;
    wirelessMAC: string | null;
    wirelessIp: string | null;
    osVersion: string;
    softwareVersion: string;
    hwVersion: string;
    hasWifiModule: boolean | null;
}
export interface IDevice {
    deviceId: string;
    deviceName: string;
}

export interface IChargingModeInterface {
    name: string;
    mode: string;
    active: boolean;
    strategyId: string | null;
}
export interface IChargingModeInterfaceDB extends IChargingModeInterface {
    id: ObjectId;
}

export interface DBControllerInterface extends NewControllerInterface {
    _id: ObjectId;
    devices: IEquipmentDB[];
    listChargingModes: IChargingModeInterfaceDB[];
}
export interface IDBControllerInterface {
    id: ObjectId;
}

export interface IEquipmentFindQuery {
    devices: IEquipmentDB[] | null;
    controllerId: string;
    deviceId?: string;
    _id: ObjectId;
}

export function IsNewController(object: any): object is NewControllerInterface {
    return object?.controllerId && object?.deviceId && object?.name && object?.protocol && object?.model;
}

export function IsDBController(object: any): object is DBControllerInterface {
    return object._id && IsNewController(object);
}

export function isIControllerInfoRequest(object: any): object is IControllerInfoRequest {
    return object.unitId && object.unitIdFormatted && object.CPUSerial && object.EMMCSerial && object.softwareVersion;
}
