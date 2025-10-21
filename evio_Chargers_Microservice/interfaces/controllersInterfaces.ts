import { Document, Model } from 'mongoose';
// enums
import { CONTROLLER_MODEL, CONTROLLER_INTERFACE } from '../utils/enums/controllersEnums';

export interface IUpdateInfo {
    serial: string;
    localIp: string;
    osVersion: string;
    softwareVersion: string;
    hwVersion: string;
}

export interface IControllerDocument extends Omit<Document, 'model'> {
    interface: CONTROLLER_INTERFACE;
    name: string;
    generalAlarm: boolean;
    communicationFaultAlarm: boolean;
    model: CONTROLLER_MODEL;
    active: boolean;
    locationId: string;
    createUserId: string;
    deviceId: string;
    updateInfo: IUpdateInfo;
    connectionURL?: string;
}

export interface ICreateNewController {
    locationId: string;
    deviceId: string;
    createUserId: string;
    interface: CONTROLLER_INTERFACE;
    model: CONTROLLER_MODEL;
    name: string;
    connectionURL?: string;
    active?: boolean;
}

export interface IControllerModel extends Model<IControllerDocument> {
    createAndSave(controller: ICreateNewController): Promise<IControllerDocument>;
    unsetLocationId(controllerId: string): Promise<{ status: boolean }>;
}
