import { ServerError, BadRequest, errorResponse } from '../utils/errorHandling';
import { Request, Response } from 'express';
import env from '../configuration/index';
// controller
import mqttController from './mqttController';
// DB
import { ObjectId } from 'mongoose';
import * as controllersQueries from '../utils/controllersQueries';
//interfaces
import * as deviceControllersInterfaces from '../interfaces/deviceControllersInterfaces';
import { DBControllerInterface, IEquipmentDB } from '../interfaces/controllersInterfaces';
import { IPublishMessageType } from '../interfaces/mqttSubscriptionsInterfaces';

const commonLog = '[deviceController';

function invalidDeviceSetPointEndpointInput(
    deviceId: string,
    controllerId: ObjectId,
    hwId: string,
    updateObject: object
): deviceControllersInterfaces.IResponseDefault {
    const context = `${commonLog} validateSetPointEndpointInput]`;
    try {
        if (!deviceId) return { status: false, message: 'Missing deviceId', code: 'Missing deviceId' };
        if (!controllerId) return { status: false, message: 'Missing controllerId', code: 'Missing controllerId' };
        if (!hwId) return { status: false, message: 'Missing hwId', code: 'Missing hwId' };
        if (!updateObject) return { status: false, message: 'Missing updateObject', code: 'Missing updateObject' };

        return { status: true, message: 'Success', code: 'Success' };
    } catch (error) {
        console.error(`${context} Error - `, error);
        return { status: false, message: error.message, code: 'internal_error' };
    }
}

function convertObjectToArray(updateObject: object): Array<{ key: string; value: string }> {
    return Object.entries(updateObject).map(([key, value]) => ({ key, value }));
}

function createArrayOfPublishTopicsSetPoints(
    updateArray: Array<{ key: string; value: string }>,
    device: IEquipmentDB,
    deviceIdController: string
): IPublishMessageType[] {
    const context = `${commonLog} createArrayOfPublishTopics]`;
    try {
        if (!updateArray || !device || !deviceIdController) {
            console.error(`${context} Error - Missing input`, updateArray, device, deviceIdController);
            throw new Error('Missing input');
        }
        let publishArray: IPublishMessageType[] = [];
        const topic = `controllers/${deviceIdController}/devices/${device.deviceId}/setpoint/set`;
        let values: object[] = [];
        for (const variable of updateArray) {
            if (!variable.value) {
                console.error(`${context} Error - Missing controlType value`);
                throw new Error('Missing controlType value');
            }
            switch (variable.key) {
                case 'controlType':
                    continue;
                    values.push({
                        action: 'SET',
                        type: 'CONTROL_TYPE',
                        target: 'FIXED',
                        value: variable.value,
                        priority: 1,
                        validForTime: 120000,
                    });

                    break;
                case 'minActivePower':
                    values.push(
                        {
                            action: 'SET',
                            type: 'POWER_ACTIVE',
                            target: 'MIN',
                            phaseType: 'L1',
                            value: variable.value,
                            priority: 1,
                            validForTime: 120000,
                        },
                        {
                            action: 'SET',
                            type: 'POWER_ACTIVE',
                            target: 'MIN',
                            phaseType: 'L2',
                            value: variable.value,
                            priority: 1,
                            validForTime: 120000,
                        },
                        {
                            action: 'SET',
                            type: 'POWER_ACTIVE',
                            target: 'MIN',
                            phaseType: 'L3',
                            value: variable.value,
                            priority: 1,
                            validForTime: 120000,
                        }
                    );

                    break;
                case 'setCurrentLimit':
                    values.push(
                        {
                            action: 'SET',
                            type: 'CURRENT',
                            target: 'MAX',
                            phaseType: 'L1',
                            value: variable.value,
                            priority: 1,
                            validForTime: 120000,
                        },
                        {
                            action: 'SET',
                            type: 'CURRENT',
                            target: 'MAX',
                            phaseType: 'L2',
                            value: variable.value,
                            priority: 1,
                            validForTime: 120000,
                        },
                        {
                            action: 'SET',
                            type: 'CURRENT',
                            target: 'MAX',
                            phaseType: 'L3',
                            value: variable.value,
                            priority: 1,
                            validForTime: 120000,
                        }
                    );
                    break;
                default:
                    console.error(`${context} Error - Unknown key`, variable.key);
                    continue;
            }
        }
        if (!values.length) {
            console.error(`${context} Error -No publish values`);
            throw new Error('No publish values');
        }
        publishArray.push({ topic, message: JSON.stringify({ values }) });
        return publishArray;
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

async function updateSetPointsOnDevice(
    controllerId: ObjectId,
    device: IEquipmentDB,
    updateArray: Array<{ key: string; value: string }>
): Promise<deviceControllersInterfaces.IResponseDefault> {
    const context = `${commonLog} updateSetPointsOnDevice]`;
    try {
        if (!controllerId || !device) {
            console.error(`${context} Error - Missing input`, controllerId, device, updateArray);
            throw new Error('Missing input');
        }
        if (updateArray.length < 1) return { status: true, message: 'Success', code: 'Success' };
        let updateSetpoints = device.listSetPoints;
        for (const variable of updateArray) {
            if (!updateSetpoints) {
                updateSetpoints = [{ name: variable.key, value: variable.value }];
                continue;
            }
            const index = updateSetpoints.findIndex((setPoint) => setPoint.name === variable.key);
            index == -1 ? updateSetpoints.push({ name: variable.key, value: variable.value }) : (updateSetpoints[index].value = variable.value);
        }

        if (!updateSetpoints) {
            console.error(`${context} Error - Missing updateSetpoints `, updateSetpoints);
            throw new Error('Missing updateSetpoints');
        }
        await controllersQueries.updateDeviceSetPoint(controllerId, device.name, updateSetpoints);
        return { status: true, message: 'Success', code: 'Success' };
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

async function setPointDevicesSmartBox(
    controller: DBControllerInterface,
    updateObject: object,
    deviceId: string,
    hwId: string
): Promise<deviceControllersInterfaces.IResponseDefault> {
    const context = `${commonLog} setPointByDevice] `;
    try {
        if (!controller || !updateObject || !deviceId || !hwId) {
            console.error(`${context} Error - Missing input`, controller, updateObject, deviceId, hwId);
            throw new Error('Missing input');
        }
        const device = controller.devices.find((device) => device.name === hwId);
        if (!device) {
            console.error(`${context} Error - Device not found ${deviceId}`);
            return { status: false, message: 'Device not found', code: 'Missing device' };
        }

        const updateArray = convertObjectToArray(updateObject);
        const publishArray = createArrayOfPublishTopicsSetPoints(updateArray, device, controller.deviceId);
        if (!publishArray.length) {
            console.error(`${context} Error - No publish array`);
            throw new Error('No publish array');
        }
        await mqttController.publishTopics(publishArray);

        await updateSetPointsOnDevice(controller._id, device, updateArray);
        return { status: true, message: 'Success', code: 'Success' };
    } catch (error) {
        console.error(`${context} Error - `, error);
        throw error;
    }
}

async function setPointByDevice(req: Request, res: Response) {
    const context = `${commonLog} setPointByDevice] `;
    try {
        const { deviceId, controllerId, hwId, updateObject } = req.body as deviceControllersInterfaces.ISetPointByDeviceRequest;
        const resultValidate = invalidDeviceSetPointEndpointInput(deviceId, controllerId, hwId, updateObject);
        if (!resultValidate.status) {
            console.error(`${context} Error - Missing required values`, resultValidate);
            return errorResponse(res, BadRequest(resultValidate.message), `${req.method} ${req.path}`);
        }

        const controller = await controllersQueries.getControllerById(controllerId);
        if (!controller) {
            console.error(`${context} Error - Controller not found`, controllerId);
            return errorResponse(res, BadRequest('Controller not found'), `${req.method} ${req.path}`);
        }
        let handleObject: deviceControllersInterfaces.IResponseDefault | null = null;
        switch (controller.model) {
            case env.CONTROLLER.MODELS.MODEL_SMARTBOX_V1:
                handleObject = await setPointDevicesSmartBox(controller, updateObject, deviceId, hwId);
                break;
            default:
                console.error(`${context} Error - Unknown controller model`, controller.model);
                return errorResponse(res, ServerError('Unknown controller mode'), `${req.method} ${req.path}`);
        }
        if (!handleObject?.status) {
            console.error(`${context} Error - `, handleObject);
            return errorResponse(res, BadRequest(handleObject.message), `${req.method} ${req.path}`);
        }
        return res.status(200).send({ status: true });
    } catch (error) {
        console.error(`${context} Error - `, error);
        return errorResponse(res, ServerError(error.message), `${req.method} ${req.path}`);
    }
}
export default { setPointByDevice };
