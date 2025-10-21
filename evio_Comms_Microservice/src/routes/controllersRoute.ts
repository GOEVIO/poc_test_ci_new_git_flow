import express, { Request, Response } from 'express';
import { Types, ObjectId } from 'mongoose';
const router = express.Router();
import { getControllerById } from '../utils/controllersQueries';
import { IsDBController, IsNewController } from '../interfaces/controllersInterfaces';
import { ServerError, BadRequest, errorResponse } from '../utils/errorHandling';
import ControllersHandling from '../controllers/controllerController';
import mqttHandler from '../controllers/mqttController';
import env from '../configuration/index';
import controllersQueries from '../utils/controllersQueries';
// Services
import A8000PublishTopics from '../services/A8000PublishTopics';
import smartBoxService from '../services/smartBoxService';
// Enums
import { A8000VariablesPubEnum } from '../utils/enums/A8000PublishVariablesEnum';
import { SMART_BOX_VARIABLES_PUB_ENUM } from '../utils/enums/smartBoxPublishVariablesEnum';
// Middleware
import controllersMiddleware from '../middleware/controllersMiddleware';

const commonLog = '[ routes controllers ';

//========== POST ==========
//Create/Update new devices
type TPostRequest = {
    controllerId: ObjectId;
    deviceId: string;
    protocol: string;
    name: string | null;
    model: string | null;
    active: boolean;
    connectionURL: string | null;
};

router.post('/api/private/controller', async (req: Request, res: Response) => {
    const context = `${commonLog} POST  /api/private/controller]`;
    try {
        const controller = req.body as TPostRequest;
        if (!Types.ObjectId.isValid(String(controller.controllerId))) {
            console.error(`${context} Error - controllerId is not ObjectId `, controller.controllerId);
            return errorResponse(res, BadRequest('controllerId with invalid format'), `${req.method} ${req.path}`);
        }
        if (typeof controller.active !== 'boolean') {
            console.error(`${context} Error - Missing active values `, controller.active);
            return errorResponse(res, BadRequest('Missing active values'), `${req.method} ${req.path}`);
        }
        if (!controller.deviceId) {
            console.error(`${context} Error - Missing deviceId value`, controller.deviceId);
            return errorResponse(res, BadRequest('Missing deviceId value'), `${req.method} ${req.path}`);
        }

        // check if device exists
        const existingController = await getControllerById(controller.controllerId);
        if (!controller.active) {
            // remove device
            if (!existingController) return res.status(200).send({ status: true }); // device already removed

            if (!(await ControllersHandling.RemoveController(existingController))) {
                console.error(`${context} Error - Removing the controller ${controller.deviceId}`);
                return errorResponse(res, ServerError(`Removing the controller ${controller.deviceId}`), `${req.method} ${req.path}`);
            }
            return res.status(200).send({ status: true });
        }

        if (existingController && IsDBController(existingController)) {
            if (controller.protocol && !env.CONTROLLER.PROTOCOL.ALLOW_PROTOCOLS.includes(controller.protocol)) {
                console.error(`${context}  Error - Unknown input controller protocol `, controller.protocol);
                return errorResponse(res, BadRequest('Unknown input controller protocol'), `${req.method} ${req.path}`);
            }
            if (controller.model && !env.CONTROLLER.MODELS.ALLOW_MODELS.includes(controller.model)) {
                console.error(`${context}  Error - Unknown input controller model `, controller.model);
                return errorResponse(res, BadRequest(' Unknown input controller model'), `${req.method} ${req.path}`);
            }
            // need to unsubscribe to the device first
            if (!(await mqttHandler.unsubscribeControllers([existingController]))) {
                console.error(`${context} Error - Fail unsubscribe to the Controller`);
                return errorResponse(res, ServerError('Fail unsubscribe to the Controller'), `${req.method} ${req.path}`);
            }
            const updatedDevice = await ControllersHandling.UpdateController(existingController, controller);
            if (!updatedDevice) {
                console.error(`${context} Error - Fail to update Controller`, updatedDevice);
                return errorResponse(res, ServerError('Fail to update Controller'), `${req.method} ${req.path}`);
            }
            // need to subscribe to the device
            if (!(await mqttHandler.createSubscriptionsToController([updatedDevice]))) {
                console.error(`${context} Error - Fail to subscribe back to Controller`, updatedDevice);
                return errorResponse(res, ServerError('Fail to subscribe back to Controller'), `${req.method} ${req.path}`);
            }
            return res.status(200).send({ status: true, controller: updatedDevice });
        }
        // new device
        if (!IsNewController(controller)) {
            if (!controller.name) {
                console.error(`${context} Error - Missing name on new device`);
                return errorResponse(res, BadRequest('Missing name on new device'), `${req.method} ${req.path}`);
            }
            if (!controller.model) {
                console.error(`${context} Error - Missing model on new device`);
                return errorResponse(res, BadRequest('Missing model on new device'), `${req.method} ${req.path}`);
            }

            console.error(`${context} Error - Missing input variables`, controller);
            return errorResponse(res, BadRequest('Missing input variables'), `${req.method} ${req.path}`);
        }

        if (!env.CONTROLLER.PROTOCOL.ALLOW_PROTOCOLS.includes(controller.protocol)) {
            console.error(`${context}  Error - Missing/Unknown input controller protocol `, controller.protocol);
            return errorResponse(res, BadRequest('Missing/Unknown input controller protocol'), `${req.method} ${req.path}`);
        }
        if (!env.CONTROLLER.MODELS.ALLOW_MODELS.includes(controller.model)) {
            console.error(`${context}  Error - Missing/Unknown input controller model `, controller.model);
            return errorResponse(res, BadRequest('Missing/Unknown input controller model'), `${req.method} ${req.path}`);
        }
        const controllerCreated = await ControllersHandling.CreateNewController(controller);
        if (!controllerCreated) {
            console.error(`${context} Error - Fail to create new controller`);
            return errorResponse(res, ServerError('Fail to create new controller'), `${req.method} ${req.path}`);
        }
        return res.status(200).send({ status: true, controller: controllerCreated });
    } catch (error) {
        console.error(`${context} Error - `, error);
        return errorResponse(res, ServerError(error.message), `${req.method} ${req.path}`);
    }
});

//========== PATCH ==========
// Update charging modes
type TUpdateChargingModeRequest = {
    controllerId: ObjectId;
    chargingMode: string;
    deviceId: string;
};
//TODO: THis endpoint needs to be deprecated and change for a more general publish topics for both equipments
router.patch('/api/private/controller/ChargingMode', async (req: Request, res: Response) => {
    const context = `${commonLog} POST  /api/private/controller]`;
    try {
        const updateRequestObject = req.body as TUpdateChargingModeRequest;
        if (!updateRequestObject.chargingMode) {
            console.error(`${context} Error - Missing charging Mode`);
            return errorResponse(res, BadRequest('Fail to create new controller'), `${req.method} ${req.path}`);
        }
        if (!env.CONTROLLER.CHARGINGMODES.ALLOW_CHARGINGMODES.includes(updateRequestObject.chargingMode)) {
            console.error(`${context} Error - Invalid charging mode not allowed`);
            return errorResponse(res, BadRequest('Invalid charging mode not allowed'), `${req.method} ${req.path}`);
        }
        const controller = await controllersQueries.getControllerById(updateRequestObject.controllerId);
        if (!controller) {
            console.error(`${context} Error - Unknown controller Id ${updateRequestObject.controllerId}`);
            return errorResponse(res, BadRequest('Unknown controller Id'), `${req.method} ${req.path}`);
        }
        let response: boolean;
        switch (controller.model) {
            case env.CONTROLLER.MODELS.MODEL_SMARTBOX_V1:
                response = await smartBoxService.updateChargingMode(controller, [
                    { variable: SMART_BOX_VARIABLES_PUB_ENUM.Charging_Mode, value: updateRequestObject.chargingMode }, // this is endpoint will be removed when the development is finished
                ]);
                break;
            case env.CONTROLLER.MODELS.MODEL_SIEMENS_A8000:
                const variables = [
                    {
                        variable: A8000VariablesPubEnum.Charging_Mode, // this is hardcoded but the this method will need to be deprecated in future
                        value: updateRequestObject.chargingMode,
                    },
                ];
                response = await A8000PublishTopics.publishTopic(controller, variables, updateRequestObject.deviceId);
                break;
            default:
                console.error(`${context} Error - Device model still not implemented ${controller.model}`);
                return errorResponse(
                    res,
                    ServerError(new Error(`Device model still not implemented ${controller.model}`)),
                    `${req.method} ${req.path}`
                );
                break;
        }
        if (!response) return errorResponse(res, ServerError('Fail to Update Charging Mode'), `${req.method} ${req.path}`);
        return res.status(200).send({ status: true });
    } catch (error) {
        console.error(`${context} Error - `, error);
        return errorResponse(res, ServerError(error.message), `${req.method} ${req.path}`);
    }
});

router.post('/api/private/controller/publishTopic', controllersMiddleware.validatePublishTopic, ControllersHandling.publishTopic);

export default router;
