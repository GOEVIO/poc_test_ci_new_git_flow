import { captureException, captureMessage } from '@sentry/node';
import { Request, Response } from 'express';
// Interfaces
import { ICreateLocationRequest, IUpdateLocationRequest } from '../interfaces/locationInterfaces';
// Models
import Locations from '../models/locations';
// Utils
import { BadRequest, ServerError, errorResponse } from '../utils/errorHandling';
// Services
import locationServices from '../services/locationsServices';

const commonLog = '[ controller locations ';

async function createNewLocation(req: Request, res: Response) {
    const context = `${commonLog} createNewLocation ]`;
    try {
        const createUserId = req.headers['userid'] as string;
        const { name, listOfSwitchboardsIds, energyManagementEnable, energyManagementInterface, equipmentModel, deviceId } =
            req.body as ICreateLocationRequest;

        if (await Locations.getLocationByNameOrId(createUserId, name, null)) {
            throw BadRequest({
                auth: false,
                code: 'location_error_create',
                message: `Location already exists`,
            });
        }

        // validate the id's of switchboards
        if (listOfSwitchboardsIds) {
            const checkIds = await locationServices.validateIdsOfEquipments(createUserId, listOfSwitchboardsIds);
            if (!checkIds?.status) {
                console.error(`${context} Error - `, checkIds.code, checkIds.message);
                throw BadRequest({
                    auth: false,
                    code: checkIds.code,
                    message: checkIds.message,
                });
                return { status: false, code: checkIds.code, message: checkIds.message };
            }
        }

        let newLocationObject = new Locations({
            name,
            listOfSwitchboardsIds,
            energyManagementEnable,
            energyManagementInterface,
            equipmentModel,
            deviceId,
            createUserId,
        });
        // associate the new location iD to the switchBoard/Infrastructures
        if (listOfSwitchboardsIds !== undefined || energyManagementEnable) {
            const assignEquipmentsResponse = await locationServices.assignEquipmentsToLocation(req.body, newLocationObject, createUserId);
            if (!assignEquipmentsResponse.status) {
                console.error(`${context} Error - `, assignEquipmentsResponse.message?? 'Error assigning equipments to Location');
                captureException(new Error(assignEquipmentsResponse.message?? 'Error assigning equipments to Location'));
                throw BadRequest({
                    auth: false,
                    code: assignEquipmentsResponse.code,
                    message: assignEquipmentsResponse.message,
                });
            }
            if (assignEquipmentsResponse.controllerId) newLocationObject.controllerId = assignEquipmentsResponse.controllerId;
            if (assignEquipmentsResponse.switchBoardId) newLocationObject.listOfSwitchboardsIds = [assignEquipmentsResponse.switchBoardId];
        }

        const newLocation = await newLocationObject.save();
        if (!newLocation?._id) {
            console.error(`${context} Error - Error saving new Location`, newLocation);
            captureException(new Error(' Error saving new Location'));
            throw ServerError({
                auth: false,
                code: 'Server_error',
                message: 'Error saving new Location',
            });
        }
        res.status(201).json({ status: true, location: newLocation });
    } catch (error) {
        return errorResponse(
            res,
            error.error ??
                ServerError({
                    auth: false,
                    code: 'internal_error',
                    message: 'Server internal error',
                }),
            context
        );
    }
}

async function updateNewLocation(req: Request, res: Response) {
    const context = `${commonLog} updateNewLocation ]`;
    try {
        const userId = req.headers['userid'] as string;
        const locationId = req.params.id;
        const { name, listOfSwitchboardsIds, energyManagementEnable, energyManagementInterface, equipmentModel, deviceId } =
            req.body as IUpdateLocationRequest;

        const location = await Locations.getLocationByNameOrId(userId, null, locationId);
        if (!location) {
            throw BadRequest({
                status: false,
                code: 'location_unknown',
                message: 'Unknown location',
            });
        }

        let newControllerId: string | undefined;
        let newSwitchBoardId: string | undefined;
        if (listOfSwitchboardsIds || location.controllerId || typeof energyManagementEnable == 'boolean') {
            // validate the id's of switchboards exists
            if (listOfSwitchboardsIds) {
                const checkIds = await locationServices.validateIdsOfEquipments(userId, listOfSwitchboardsIds);
                if (!checkIds.status) {
                    throw BadRequest({
                        status: false,
                        code: checkIds.code ?? 'location_validate_switchboardsIds',
                        message: checkIds.message ?? 'Error validating ids of equipments',
                    });
                }
            }

            // assign/remove equipments
            const updatedEquipments = await locationServices.updateEquipmentsOfLocation(location, req.body, userId);
            if (!updatedEquipments.status) {
                console.error(`${context} Error - `, updatedEquipments, req.body);
                captureMessage(`Error updating equipments of location`);
                throw ServerError({
                    status: false,
                    code: 'server_error',
                    message: 'server internal error',
                });
            }

            if (updatedEquipments.controllerId) newControllerId = updatedEquipments.controllerId;
            if (updatedEquipments.switchboardId) newSwitchBoardId = updatedEquipments.switchboardId;
        }
        // update Location
        const updatedLocation = await locationServices.updateLocationDB(locationId, req.body, newControllerId, newSwitchBoardId);
        if (!updatedLocation?.status) {
            console.error(`${context} Error - `, updatedLocation);
            captureMessage(`Error updating on locationDB`);
            throw ServerError({
                status: false,
                code: 'server_error',
                message: 'server internal error',
            });
        }

        return res.status(200).send({ status: true, location: updatedLocation.location });
    } catch (error) {
        return errorResponse(
            res,
            error.error ??
                ServerError({
                    auth: false,
                    code: 'internal_error',
                    message: 'Server internal error',
                }),
            context
        );
    }
}

export default {
    createNewLocation,
    updateNewLocation,
};
