import { ObjectId } from 'mongoose';

interface IDefault {
    id: number;
    name: string;
    enumeration: string;
}

export type IMeasurementsRequest = {
    id: number;
    name: string;
    unit: string;
    valueType: string;
    measurementType: string;
    extType: string;
    aggregationType: string;
    enumeration: string;
};

export interface IDeviceInfoRequest {
    id: number | string;
    name: string;
    typeId?: number;
    type?: IDefault;
    category?: IDefault;
    categoryId: number;
    energyLocationId?: number;
    energyLocation?: IDefault;
    energyDirectionId?: number;
    energyDirection?: IDefault;
    pollingDelayRead?: number;
    pollingDelayWrite?: number;
    persistSchedule?: string;
    importExportInvert?: boolean;
    dataTypes?: IMeasurementsRequest[];
    switchBoardGroupId?: number; // only used by the for A8000
}

export function IsIDeviceInfoRequest(object: any): object is IDeviceInfoRequest {
    return object.id && object.name && object.type && object.category && object.energyLocation && object.dataTypes;
}

export interface IDeviceInfoToComms {
    name: string;
    deviceDescription: string | null;
    deviceId: string;
    protocol: 'MQTT' | 'OPC-UA';
    deviceType: string;
    controllerId: ObjectId;
    switchBoardGroupId?: string; // only used by the for A8000
}

export interface IValuesMeasurementsTopic {
    deviceId: number;
    dataTypeId: number | null;
    dataTypeEnum: string;
    time: number;
    value: number | string | null;
}
export interface IDeviceMeasurementTopic {
    time: number;
    values: IValuesMeasurementsTopic[];
}

export interface IMeasurementsComms {
    name: string;
    unit: string;
    valueType: string;
    value: string;
}
export interface IEquipmentCommsMeasurements {
    equipmentType: string;
    equipmentName: string;
    arrayMeasurements: IMeasurementsComms[];
    time: Date;
    deviceId: string;
    controllerId: string;
}

export interface IStrategiesListObjectPayload {
    id: number;
    typeId: number;
    type: {
        id: number;
        name: string;
        enumeration: string;
        config: object;
    };
    name: string;
    persistSchedule: string;
    priority: number;
    active: boolean;
    config: object;
    dataTypes: object[];
}

export interface IPublishMessageType {
    topic: string;
    message: string;
}

export interface IA8000DataItem {
    Variable: string;
    Value: string;
    Type: string;
    QualityCode: string;
}

export interface IA8000Measurements {
    Timestamp: Date;
    DataItems: IA8000DataItem[];
}

export interface IA8000MeasurementsProcessed {
    timestamp: Date;
    arrayMeasurements: IMeasurementsComms[]; 
}

function IsIStrategiesListObjectPayload(object: any): object is IStrategiesListObjectPayload {
    return object.id && object.typeId && object.name && object.persistSchedule && object.priority && typeof object.active == 'boolean';
}
export function IsArrayIStrategiesListPayload(object: any): object is IStrategiesListObjectPayload[] {
    if (!Array.isArray(object)) return false;
    return object.every((item) => IsIStrategiesListObjectPayload(item));
}

function IsIValuesMeasurementsTopic(object: any): object is IValuesMeasurementsTopic {
    return object.deviceId && object.dataTypeEnum && object.time;
}

export function IsIDeviceMeasurementTopic(object: any): object is IDeviceMeasurementTopic {
    return object.time && object.values && Array.isArray(object.values) && object.values.every(IsIValuesMeasurementsTopic);
}
