import { Document, Model } from 'mongoose';

export interface IPublicGridDocument extends Document {
    name: string;
    deviceId: string;
    locationId: string;
    controllerId: string;
    controllerDeviceId: string;
    createUserId: string;
    locationConsumption: number;
    currentLimit?: number;
    setCurrentLimit?: number;
    power?: number;
    totalCurrent?: number;
    i1?: number;
    i2?: number;
    i3?: number;
    v1?: number;
    v2?: number;
    v3?: number;
    totalVoltage?: number;
    exportPower?: number;
    importPower?: number;
    measurementDate?: Date;
}

export interface IPutPublicGridExternalAPI {
    id: string;
    i1?: number;
    i2?: number;
    i3?: number;
    v1?: number;
    v2?: number;
    v3?: number;
    iTot?: number;
    vTot?: number;
    exportPower?: number;
    importPower?: number;
    measurementDate: string;
}
export interface IPublicGridModel extends Model<IPublicGridDocument> {
    getByControllerIdAndDeviceId(controllerId: string, deviceId: string): Promise<IPublicGridDocument | null>;
    updatePublicGrid(
        controllerId: string,
        deviceId: string,
        updateObject: Partial<IPublicGridDocument>
    ): Promise<{ n: number; nModified: number; ok: number }>;
    updateOrCreateExternalAPI(deviceId: string, updateObject: Partial<IPublicGridDocument>, createUserId: string): Promise<boolean>;
}
