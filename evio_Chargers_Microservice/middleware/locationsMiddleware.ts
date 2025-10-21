import { NextFunction, Request, Response } from 'express';
import { ObjectId as ObjectID } from 'mongodb';
// Interfaces
import { ICreateLocationRequest, IUpdateLocationRequest } from '../interfaces/locationInterfaces';
// Utils
import { BadRequest, errorResponse } from '../utils/errorHandling';
import { isArrayIdsInvalid } from '../utils/arrayVerifications';
// Enums
import { CONTROLLER_MODEL, CONTROLLER_INTERFACE } from '../utils/enums/controllersEnums';

const commonLogs = '[ middleware/locations ';

function validateCreateLocation(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLogs} validateCreateChargerModel ]`;
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw BadRequest({
                status: false,
                code: 'request_body_required',
                message: `Missing body in request`,
            });
        }
        const createUser = req.headers['userid'];
        const { name, listOfSwitchboardsIds, energyManagementEnable, energyManagementInterface, equipmentModel, deviceId } =
            req.body as ICreateLocationRequest;

        if (!createUser || Array.isArray(createUser) || !ObjectID.isValid(createUser)) {
            throw BadRequest({
                status: false,
                code: 'server_user_id_required',
                message: 'User id is required',
            });
        }
        if (!name) {
            console.log(`${context} Missing body input ...`);
            throw BadRequest({
                status: false,
                code: 'location_name',
                message: 'Missing name for Location',
            });
        }

        if (listOfSwitchboardsIds && listOfSwitchboardsIds.length < 1) {
            throw BadRequest({
                status: false,
                code: 'switchboardsList_format',
                message: 'Wrong Switchboards List format',
            });
        }
        if (typeof energyManagementEnable !== 'undefined' && typeof energyManagementEnable !== 'boolean') {
            throw BadRequest({
                status: false,
                code: 'energyManagement_management_enable_format',
                message: 'Wrong Energy Management Enable with wrong format',
            });
        }
        // in case of energyManagementEnable is sent at true it needs to have energyManagementInterface && deviceId && equipmentModel
        if (!energyManagementEnable && (energyManagementInterface || deviceId || equipmentModel)) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_management_enable_missing',
                message: 'Missing Energy Management Enable',
            });
        }
        if (energyManagementEnable && !energyManagementInterface) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_managementInterface_missing',
                message: 'Missing Energy Management Interface',
            });
        }
        if (energyManagementEnable && !deviceId) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_deviceId_missing',
                message: 'Missing device Id',
            });
        }
        if (energyManagementEnable && !equipmentModel) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_management_enable_missing_model',
                message: 'Missing equipment model',
            });
        }

        if (energyManagementInterface && !Object.values(CONTROLLER_INTERFACE).includes(energyManagementInterface as CONTROLLER_INTERFACE)) {
            throw BadRequest({ status: false, code: 'energyManagement_bad_protocol', message: 'Unknown Communication Protocol' });
        }

        if (equipmentModel && !Object.values(CONTROLLER_MODEL).includes(equipmentModel as CONTROLLER_MODEL)) {
            throw BadRequest({ status: false, code: 'energyManagement_model_unknown', message: 'Unknown Communication Protocol' });
        }
        next();
    } catch (error) {
        console.error(`${context} Error `, error);
        return errorResponse(res, error, context);
    }
}

function validateUpdateLocation(req: Request, res: Response, next: NextFunction) {
    const context = `${commonLogs} validateUpdateLocation ]`;
    try {
        const locationId = req.params.id;
        if (!locationId || !ObjectID.isValid(locationId)) {
            {
                throw BadRequest({
                    status: false,
                    code: 'location_id_missing',
                    message: 'Location with missing id',
                });
            }
        }
        const userId = req.headers['userid'];
        if (!userId || Array.isArray(userId) || !ObjectID.isValid(userId)) {
            throw BadRequest({
                status: false,
                code: 'server_user_id_required',
                message: 'User id is required',
            });
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            throw BadRequest({
                status: false,
                code: 'request_body_required',
                message: 'Missing body in request',
            });
        }
        const { name, listOfSwitchboardsIds, energyManagementEnable, energyManagementInterface, equipmentModel, deviceId } =
            req.body as IUpdateLocationRequest;
        // optional fields
        if (listOfSwitchboardsIds) {
            if (!Array.isArray(listOfSwitchboardsIds) || listOfSwitchboardsIds.length < 1) {
                throw BadRequest({
                    status: false,
                    code: 'switchboardsList_format',
                    message: 'Wrong Switchboards List format',
                });
            }
            if(isArrayIdsInvalid(listOfSwitchboardsIds)) {
                throw BadRequest({
                    status: false,
                    code: 'switchboardsList_invalid',
                    message: 'Invalid Switchboards List format',
                });
            }
        }

        if (!energyManagementEnable && energyManagementInterface) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_management_enable_missing',
                message: 'Missing Energy Management Enable',
            });
        }

        if (energyManagementEnable && !Object.values(CONTROLLER_INTERFACE).includes(energyManagementInterface as CONTROLLER_INTERFACE)) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_bad_protocol',
                message: 'Unknown Communication Protocol',
            });
        }
        if (energyManagementEnable && !equipmentModel) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_management_enable_missing_model',
                message: 'Missing equipment model',
            });
        }
        if (equipmentModel && !Object.values(CONTROLLER_MODEL).includes(equipmentModel as CONTROLLER_MODEL)) {
            throw BadRequest({
                status: false,
                code: 'energyManagement_model_unknown',
                message: 'Unknown Communication Protocol',
            });
        }

        next();
    } catch (error) {
        console.error(`${context} Error `, error);
        return errorResponse(res, error, context);
    }
}

export default {
    validateCreateLocation,
    validateUpdateLocation,
};
