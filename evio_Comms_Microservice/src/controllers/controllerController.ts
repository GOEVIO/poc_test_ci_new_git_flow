import axios from 'axios';
import { ObjectId } from 'mongoose';
import { captureException } from '@sentry/node';
import { Request, Response } from 'express';
import mqttHandler from './mqttController';
import env from '../configuration/index';
// BD
import Controller from '../models/controllerModel';
import controllersQueries from '../utils/controllersQueries';
// interfaces
import { NewControllerInterface, DBControllerInterface } from '../interfaces/controllersInterfaces';
// Services
import A8000PublishTopics from '../services/A8000PublishTopics';
import smartBoxService from '../services/smartBoxService';

const commonLog = '[ handler controller ';

async function connectController(controller: DBControllerInterface): Promise<boolean> {
    const context = `${commonLog} connectController ]`;
    try {
        // this will grow in the future (i hope)
        switch (controller.protocol) {
            case 'MQTT':
                // async process to not delay response
                return await mqttHandler.createSubscriptionsToController([controller]);
            default:
                console.error(`${context} Error - Unknown protocol type ${controller.protocol}`);
                throw new Error(`Unknown protocol type ${controller.protocol}`);
        }
    } catch (error) {
        console.error(`${context} Error - `, error.message);
        throw error;
    }
}
async function CreateNewController(controllerObject: NewControllerInterface): Promise<NewControllerInterface> {
    const context = `${commonLog} CreateNewController] `;
    try {
        if (
            !controllerObject?.controllerId ||
            !controllerObject?.model ||
            !env.CONTROLLER.PROTOCOL.ALLOW_PROTOCOLS.includes(controllerObject?.protocol)
        ) {
            console.log(
                `${context} Error - Missing input values: `,
                controllerObject?.controllerId,
                controllerObject?.model,
                controllerObject?.protocol
            );
            throw new Error('Missing input values');
        }

        const newDevice = new Controller(controllerObject);
        await newDevice.save();

        if (!(await connectController(newDevice))) {
            console.log(`${context} Error - Fail to connect to the new controller`);
            throw new Error('Fail to connect to the new controller');
        }
        return newDevice;
    } catch (error) {
        console.log(`${context} Error - `, error.message);
        throw error;
    }
}

async function handleDeactivationFromProtocol(controller: DBControllerInterface): Promise<boolean> {
    const context = `${commonLog} handleDeactivationFromProtocol] `;
    try {
        if (!controller) {
            console.log(`${context} Error - Missing input controller`, controller);
            throw new Error('Missing input controller');
        }
        switch (controller.protocol) {
            case 'MQTT':
                if (!(await mqttHandler.unsubscribeControllers([controller]))) {
                    console.log(`${context} MQTT unsubscribeControllers Error - Fail to unsubscribe topics from controller ${controller.deviceId}`);
                    throw new Error(`Fail to unsubscribe topics from controller ${controller.deviceId}`);
                }
                break;

            default:
                console.log(`${context} Error - Unknown protocol ${controller.protocol}`);
                throw new Error(`Unknown protocol ${controller.protocol}`);
        }
        return true;
    } catch (error) {
        console.log(`${context} Error - `, error.message);
        throw error;
    }
}

async function RemoveController(controller: DBControllerInterface): Promise<boolean> {
    const context = `${commonLog} RemoveController] `;
    try {
        if (!controller) {
            console.log(`${context} Error - Missing input controller`, controller);
            throw new Error('Missing input controller');
        }
        if (!(await handleDeactivationFromProtocol(controller))) {
            console.log(`${context} handleDeactivationFromProtocol Error - Removing controller ${controller.deviceId} from BD`);
            throw new Error(`Error removing controller ${controller.deviceId} from BD`);
        }
        if (!(await controllersQueries.removeDeviceByControllerId(controller.deviceId))) {
            console.log(`${context} removeDeviceByControllerId Error - Removing controller ${controller.deviceId} from BD`);
            throw new Error(`Error removing controller ${controller.deviceId} from BD`);
        }
        return true;
    } catch (error) {
        console.log(`${context} Error - `, error.message);
        throw error;
    }
}

async function UpdateController(controller: DBControllerInterface, updateFields: object): Promise<DBControllerInterface> {
    const context = `${commonLog} UpdateController] `;
    try {
        if (!controller || !updateFields) {
            console.log(`${context} Error - Missing input controller`, controller);
            throw new Error('Missing input controller');
        }

        if (!(await handleDeactivationFromProtocol(controller))) {
            console.log(`${context} handleDeactivationFromProtocol Error - Removing controller ${controller.deviceId} from BD`);
            throw new Error(`Error removing controller ${controller.deviceId} from BD`);
        }
        const updatedDevice = await controllersQueries.updateController(controller._id, updateFields);
        if (!updatedDevice) {
            console.log(`${context} updateController Error - Updating the ${controller.deviceId}`);
            throw new Error(`Updating the ${controller.deviceId}`);
        }
        return updatedDevice;
    } catch (error) {
        console.log(`${context} Error - `, error.message);
        throw error;
    }
}

async function updateControllersConnectionStatus(arrayDevicesIds: string[], isOnline: boolean): Promise<void> {
    const context = `${commonLog} updateControllersConnectionStatus] `;
    try {
        if (arrayDevicesIds.length < 1) return undefined;

        const data = {
            arrayDevicesIds,
            isOnline,
        };
        const response = await axios.post(`${env.ENDPOINTS.CHARGERS_HOST}${env.ENDPOINTS.CHARGER_UPDATE_CONTROLLER_CONNECTION_STATUS}`, data);
        if (response?.status !== 204) {
            console.error(`${context} Error - Unexpected response from charger microservice`, response);
            captureException(response);
        }
    } catch (error) {
        console.error(`${context} Error - `, error.message);
        captureException(error);
    }
}

async function publishTopic(req: Request, res: Response) {
    const context = `${commonLog} publishTopic ]`;
    try {
        const {
            controllerId,
            variables,
            deviceId,
        }: { controllerId: ObjectId; variables: Array<{ variable: string; value: string }>; deviceId: string } = req.body;
        const controller = await controllersQueries.getControllerById(controllerId);
        if (!controller) {
            console.error(`${context} Error - Unknown controller Id ${controllerId}`);
            return res.status(400).send({ status: true, code: 'unknown_controller', message: 'Unknown controller' });
        }
        let response = false;
        switch (controller.model) {
            case env.CONTROLLER.MODELS.MODEL_SMARTBOX_V1:
                response = await smartBoxService.updateChargingMode(controller, variables);
                break;

            case env.CONTROLLER.MODELS.MODEL_SIEMENS_A8000:
                response = await A8000PublishTopics.publishTopic(controller, variables, deviceId);
                break;

            default:
                console.error(`${context} Error - Device model still not implemented ${controller.model}`);
                return res.status(500).send({ auth: false, code: 'error_deviceModel', message: 'Device model still not implemented' });
                break;
        }
        if (!response) return res.status(500).send({ auth: false, code: 'publishTopic_error', message: 'Fail to publish topic' });
        return res.status(200).send({ status: true });
    } catch (error) {
        console.error(`${context} Error - `, error.message);
        res.status(500).send({ auth: false, code: 'internal_error', message: 'Internal error' });
    }
}

export default {
    CreateNewController,
    UpdateController,
    RemoveController,
    updateControllersConnectionStatus,
    publishTopic,
    connectController,
};
