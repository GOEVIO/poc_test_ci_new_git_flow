import { ObjectId } from 'mongoose';

export interface IResponseDefault {
    status: boolean;
    message: string;
    code: string;
}

export interface ISetPointByDeviceRequest {
    deviceId: string;
    controllerId: ObjectId;
    hwId: string;
    updateObject: object;
}
