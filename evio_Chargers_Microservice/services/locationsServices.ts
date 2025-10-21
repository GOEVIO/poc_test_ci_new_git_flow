import { captureException } from '@sentry/node';
// Services
import switchBoardsServices from '../services/switchBoardsServices';
import controllersServices from '../services/controllersServices';
// Interfaces
import { ICreateLocationRequest, ILocationDocument, IUpdateLocationRequest } from '../interfaces/locationInterfaces';
import { ICreateNewController } from '../interfaces/controllersInterfaces';
// Enum
import { CONTROLLER_MODEL, CONTROLLER_INTERFACE } from '../utils/enums/controllersEnums';
// Models
import switchBoardsModel from '../models/switchBoards';
import controllersModel from '../models/controllers';
import locationModel from '../models/locations';
// Utils
import { ServerError } from '../utils/errorHandling';

const commonLog = '[ services locations ';

export async function validateIdsOfEquipments(
    createUser: string,
    listOfSwitchboardsIds: string[]
): Promise<{ status: boolean; code?: string; message?: string }> {
    const context = `${commonLog} validateIdsOfEquipments ]`;
    try {
        const validSwitches = await switchBoardsServices.validateIdsSwitchBoard(listOfSwitchboardsIds);
        if (!validSwitches.status) {
            console.error(`${context} Error - `, validSwitches);
            return {
                status: false,
                code: validSwitches.code ? validSwitches.code : 'server_error',
                message: validSwitches.message ? validSwitches.message : 'Internal Error',
            };
        }
        return { status: true };
    } catch (error) {
        console.error(`${context} Error `, error.message);
        captureException(error);
        return { status: false, code: 'server_error', message: error.message };
    }
}

async function assignEquipmentsToLocation(
    request: ICreateLocationRequest | IUpdateLocationRequest,
    location: ILocationDocument,
    createUserId: string
): Promise<{
    status: boolean;
    code?: any;
    message?: any;
    controllerId?: string;
    switchBoardId?: string;
}> {
    const context = `${commonLog} assignEquipmentsToLocation ]`;
    try {
        let promiseArray: Promise<any>[] = [];

        if (request.listOfSwitchboardsIds)
            promiseArray.push(switchBoardsServices.assignSwitchboardsToLocations(request.listOfSwitchboardsIds, location._id));
        if (request.energyManagementEnable && !location.controllerId) {
            if (!request.energyManagementInterface || !request.equipmentModel || !request.deviceId) {
                console.error(`${context} Error - Missing parameters for creating new controller `, request);
                throw new Error('[ Charger assignEquipmentsToLocation ]- Missing parameters for creating new controller');
            }
            // create new controller
            const createControllerObject: ICreateNewController = {
                locationId: location._id,
                deviceId: request.deviceId,
                createUserId,
                interface: request.energyManagementInterface as CONTROLLER_INTERFACE,
                model: request.equipmentModel as CONTROLLER_MODEL,
                name: location.name,
            };
            promiseArray.push(controllersServices.createController(createControllerObject));
        } else if (typeof request?.energyManagementEnable == 'boolean' && location.controllerId) {
            // update controller
            let updateControllerObject: Partial<ICreateNewController> = {
                locationId: location._id,
            };
            if (request.name) updateControllerObject.name = request.name;
            if (request.energyManagementInterface) updateControllerObject.interface = request.energyManagementInterface as CONTROLLER_INTERFACE;
            if (request.equipmentModel) updateControllerObject.model = request.equipmentModel as CONTROLLER_MODEL;
            if (request.deviceId) updateControllerObject.deviceId = request.deviceId;
            if (typeof request.energyManagementEnable == 'boolean') updateControllerObject.active = request.energyManagementEnable;
            promiseArray.push(controllersServices.updateController(location.controllerId, updateControllerObject));
        }
        const promisesResponses = await Promise.all(promiseArray);
        if (!promisesResponses) {
            console.error(`${context} Error - No promisesResponses Saving: `, promisesResponses);
            throw new Error('No promisesResponses Saving');
        }
        // check the responses
        let controllerId: string | undefined;
        let switchBoardId: string | undefined;
        for (const resp of promisesResponses) {
            if (!resp.status) {
                console.error(`${context} Error - `, resp.code, resp.message);
                return { status: false, code: resp.code, message: resp.message };
            }
            if (resp.controller?._id) {
                controllerId = resp.controller._id as string;
                if (
                    location.listOfSwitchboardsIds?.length < 1 &&
                    request.energyManagementInterface == CONTROLLER_INTERFACE.MQTT &&
                    request.equipmentModel == CONTROLLER_MODEL.smartBox_v1
                ) {
                    // needs to create an SwitchBoard because this equipments don't have that concept (smartbox v1)
                    const newSwitchBoard = await controllersServices.createSwitchBoard(location, controllerId);
                    if (!newSwitchBoard || !newSwitchBoard._id) {
                        console.error(`${context} Error - Error creating new Switchboard `, newSwitchBoard);
                        throw new Error('Error creating new Switchboard');
                    }
                    switchBoardId = newSwitchBoard._id;
                }
            }
        }
        return { status: true, controllerId, switchBoardId, code: 'success', message: 'success' };
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error;
    }
}

async function updateEquipmentsOfLocation(
    location: ILocationDocument,
    request: IUpdateLocationRequest,
    createUser: string
): Promise<{ status: boolean; controllerId?: string; switchboardId?: string }> {
    const context = `${commonLog} updateEquipmentsOfLocation ]`;

    let switchesToRemove: string[] = [];
    const isToDeleteController = typeof request.energyManagementEnable === 'boolean' ? request.energyManagementEnable : false;

    if (request.listOfSwitchboardsIds && location.listOfSwitchboardsIds) {
        switchesToRemove = location.listOfSwitchboardsIds.filter(
            (id) => request.listOfSwitchboardsIds && !request.listOfSwitchboardsIds.includes(id)
        );
    }

    if (switchesToRemove.length > 0 || isToDeleteController) {
        const removeResponse = await removeEquipments(location, switchesToRemove, isToDeleteController);
        if (!removeResponse.status) {
            console.error(`${context} Error - Missing Input fields `, removeResponse.code, removeResponse.message);
            throw ServerError({
                status: false,
                code: removeResponse.code ?? 'server_error',
                message: removeResponse.message ?? 'Internal Error',
            });
        }
    }

    const assignResponse = await assignEquipmentsToLocation(request, location, createUser);
    if (!assignResponse.status) {
        console.error(`${context} Error - assignEquipmentsToLocation failed: ${assignResponse} `);
        throw ServerError({
            status: false,
            code: assignResponse.code ?? 'server_error',
            message: assignResponse.message ?? 'Server Error',
        });
    }

    return { status: true, controllerId: assignResponse.controllerId, switchboardId: assignResponse.switchBoardId };
}

async function removeEquipments(
    location: ILocationDocument,
    switchesToRemove: string[],
    isToDeleteController: boolean
): Promise<{ status: boolean; code?: string; message?: string }> {
    let arrayPromises: Promise<{ status: boolean }>[] = [];

    if (switchesToRemove) arrayPromises.push(switchBoardsModel.unsetLocationIds(switchesToRemove));
    if (isToDeleteController && location.controllerId) arrayPromises.push(controllersModel.unsetLocationId(location.controllerId));

    const promisesResponses = await Promise.all(arrayPromises);
    for (const resp of promisesResponses) {
        if (!resp.status) throw new Error(`Server Error: ${resp}`);
    }
    if (!promisesResponses.every((resp) => resp.status)) {
        throw new Error('[removeEquipments] - Error removing equipments');
    }
    return { status: true };
}

async function updateLocationDB(
    locationId: string,
    request: IUpdateLocationRequest,
    controllerId: string | undefined,
    newSwitchBoardId: string | undefined
): Promise<{ status: boolean; location: ILocationDocument }> {
    const context = `${commonLog} updateLocationDB ]`;

    let updateVariables: Partial<ILocationDocument> = {};
    let unsetObject: Object = {};
    if (request.name) updateVariables.name = request.name;
    if (request.listOfSwitchboardsIds) updateVariables.listOfSwitchboardsIds = request.listOfSwitchboardsIds;
    if (newSwitchBoardId && !request.listOfSwitchboardsIds) updateVariables.listOfSwitchboardsIds = [newSwitchBoardId];
    if (typeof request.energyManagementEnable == 'boolean') updateVariables.energyManagementEnable = request.energyManagementEnable;
    if (request.energyManagementEnable && request.energyManagementInterface)
        updateVariables.energyManagementInterface = request.energyManagementInterface as CONTROLLER_INTERFACE;
    if (request.energyManagementEnable === false) {
        unsetObject = {
            energyManagementInterface: 1,
            controllerId: 1,
        };
    }
    if (controllerId) updateVariables.controllerId = controllerId;

    const updateObject = unsetObject ? { $set: updateVariables, $unset: unsetObject } : { $set: updateVariables };
    const location = await locationModel.findOneAndUpdate({ _id: locationId }, updateObject, { new: true });
    if (!location) throw new Error('Fail to update Location');
    return { status: true, location };
}

export default {
    validateIdsOfEquipments,
    assignEquipmentsToLocation,
    updateEquipmentsOfLocation,
    updateLocationDB,
};
