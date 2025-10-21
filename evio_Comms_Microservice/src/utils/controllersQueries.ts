import { ObjectId, Types } from 'mongoose';
import { DeleteResult } from 'mongodb';
import Controllers from '../models/controllerModel';
import * as controllersInterfaces from '../interfaces/controllersInterfaces';
const commonLog = '[ Utils controllersQueries';

export async function getControllerById(controllerId: ObjectId): Promise<controllersInterfaces.DBControllerInterface | null> {
    const context = ` ${commonLog} getControllerById ] `;
    try {
        return await Controllers.findOne({ controllerId: controllerId });
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

export async function updateDeviceSetPoint(controllerId: ObjectId, deviceName: string, updateObject: object): Promise<boolean> {
    const context = ` ${commonLog} updateDeviceSetPoint ] `;
    try {
        if (!controllerId || !deviceName || !updateObject) {
            console.error(`${context} Error - Missing input data `, controllerId, deviceName, updateObject);
            throw new Error('Missing input data');
        }
        const query = {
            _id: controllerId,
            'devices.name': deviceName,
        };
        const update = { $set: { 'devices.$.listSetPoints': updateObject } };
        console.log(`${context} query - `, query);
        console.log(`${context} update - `, update);
        await Controllers.updateOne(query, update);
        return true;
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

export async function getControllerByDeviceId(deviceId: string): Promise<controllersInterfaces.DBControllerInterface | null> {
    const context = ` ${commonLog} getControllerByDeviceId ] `;
    try {
        if (!deviceId) {
            console.error(`${context} Error - Missing controllerId data `, deviceId);
            throw new Error('Missing controllerId data');
        }
        return await Controllers.findOne({ deviceId });
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

export async function getMQTTControllers(): Promise<controllersInterfaces.DBControllerInterface[]> {
    const context = `${commonLog} getMQTTControllers ]`;
    try {
        return await Controllers.find({ protocol: 'MQTT' });
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

export async function removeDeviceByControllerId(controllerId: string): Promise<boolean> {
    const context = `${commonLog} removeDeviceByControllerId ]`;
    try {
        if (!controllerId) {
            console.error(`${context} Error - Missing deviceId data `, controllerId);
            throw new Error('Missing deviceId data');
        }
        const result: DeleteResult = await Controllers.deleteOne({ deviceId: controllerId });
        return result ? result.acknowledged : false;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

export async function updateController(controller_id: ObjectId, updateObject: object): Promise<controllersInterfaces.DBControllerInterface> {
    const context = `${commonLog} updateController ]`;
    try {
        if (!Types.ObjectId.isValid(String(controller_id)) || !updateObject) {
            console.error(`${context} Error - Missing input data `, controller_id, updateObject);
            throw new Error('Missing input data');
        }
        const updateDevice: controllersInterfaces.DBControllerInterface | null = await Controllers.findOneAndUpdate(
            { _id: controller_id },
            { $set: updateObject },
            { new: true }
        );
        if (!updateDevice) throw new Error(`Error updating controller ${controller_id}`);
        return updateDevice;
    } catch (error) {
        console.error(`${context} Error - ${error.message}`);
        throw error;
    }
}

export async function deleteEquipment(equipmentId: ObjectId): Promise<boolean> {
    const context = `${commonLog} deleteEquipment]`;
    try {
        if (!equipmentId) {
            console.error(`${context} Error - Missing equipmentId ${equipmentId}`);
            throw new Error('Missing equipmentId');
        }
        const result = await Controllers.updateOne({ _id: equipmentId }, { $pull: { devices: { _id: equipmentId } } });
        return result.acknowledged;
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

export async function deactivateAllChargingModes(deviceId: string): Promise<boolean> {
    const context = `${commonLog} deactivateAllChargingModes]`;
    try {
        if (!deviceId) {
            console.error(`${context} Error - Missing input data ${deviceId}`);
            throw new Error('Missing input data');
        }
        const result = await Controllers.updateOne({ deviceId }, { $set: { 'listChargingModes.$[].active': false } });
        return result.acknowledged;
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

export async function updateChargingModes(deviceId: string, strategyId: string, status: boolean): Promise<boolean> {
    const context = `${commonLog} updateChargingModes]`;
    try {
        if (!deviceId || !strategyId) {
            console.error(`${context} Error - Missing input data ${deviceId} ${strategyId}`);
            throw new Error('Missing input data');
        }
        const result = await Controllers.updateOne(
            { deviceId },
            { $set: { 'listChargingModes.$[x].active': status } },
            { arrayFilters: [{ 'x.strategyId': strategyId }] }
        );
        return result.acknowledged;
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

export async function createEquipment(controllerId: ObjectId, equipment: controllersInterfaces.IEquipmentDB): Promise<boolean> {
    const context = `${commonLog} createEquipment]`;
    try {
        if (!equipment || !controllerId) {
            console.error(`${context} Error - Missing input data ${equipment} ${controllerId}`);
            throw new Error('Missing equipment');
        }
        const result = await Controllers.updateOne({ _id: controllerId }, { $push: { devices: equipment } });
        return result.acknowledged;
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

export async function getEquipmentByDeviceId(
    equipmentId: string,
    controllerId: ObjectId | null,
    deviceId: string | null
): Promise<{ devices: controllersInterfaces.IEquipmentDB; controllerId: string; deviceId?: string } | null> {
    const context = `${commonLog} getDeviceByDeviceId]`;
    try {
        if (!equipmentId || (!controllerId && !deviceId)) {
            console.error(`${context} Error - Missing input data ${equipmentId} ${controllerId} ${deviceId}`);
            throw new Error('Missing input data');
        }
        let query;
        if (controllerId) {
            query = {
                _id: controllerId,
                devices: { $elemMatch: { deviceId: equipmentId } },
            };
        } else {
            query = {
                deviceId,
                devices: { $elemMatch: { deviceId: equipmentId } },
            };
        }
        const queryResult: controllersInterfaces.IEquipmentFindQuery | null = await Controllers.findOne(query, {
            _id: 0,
            'devices.$': 1,
            controllerId: 1,
        });
        if (!queryResult?.devices || queryResult?.devices?.length < 1) return null;
        return { devices: queryResult.devices[0], controllerId: queryResult.controllerId, deviceId: queryResult.deviceId };
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}
export async function updateListChargingModes(
    deviceId: string,
    arrayStrategies: controllersInterfaces.IChargingModeInterface[] | []
): Promise<boolean> {
    const context = `${commonLog} updateListChargingModes ]`;
    try {
        if (!deviceId) {
            console.error(`${context} Error - Missing deviceId !! ${deviceId}`);
            throw new Error('Missing deviceId');
        }
        const updated = await Controllers.updateOne({ deviceId }, { $set: { listChargingModes: arrayStrategies } });
        return updated.acknowledged;
    } catch (error) {
        console.error(`${context} Error - ${error}`);
        throw error;
    }
}

export default {
    getControllerById,
    getMQTTControllers,
    removeDeviceByControllerId,
    updateController,
    deleteEquipment,
    createEquipment,
    getEquipmentByDeviceId,
    updateListChargingModes,
    deactivateAllChargingModes,
    updateChargingModes,
    getControllerByDeviceId,
    updateDeviceSetPoint,
};
