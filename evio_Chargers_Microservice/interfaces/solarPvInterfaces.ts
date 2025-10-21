import { Document, Model } from 'mongoose';

export interface ISolarPvModelDocument extends Document {
    name: string;
    deviceId: string;
    description: string;
    lastReading: Date;
    controllerDeviceId: string;
    powerProduction: number;
    locationID: string;
    switchBoardId: string;
    createdBy: string;
    exportEnergyActive?: number;
    exportPowerActive?: number;
    importPowerActive?: number;
    isOnline?: boolean;
}

export interface IPvModel extends Model<ISolarPvModelDocument> {
    getPvByHwId(deviceId: string, createdBy: string): Promise<ISolarPvModelDocument | null>;
    getPV(createdBy: string, _id?: string): Promise<ISolarPvModelDocument[]>;
}
