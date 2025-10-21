import axios from 'axios';
// Interfaces
import { ISwitchBoardsDocument } from '../interfaces/switchBoardsInterfaces';
import { IControllerDocument } from '../interfaces/controllersInterfaces';
import { IDeviceInfoObject } from '../interfaces/commsInterfaces';
// Models
import Switchboards from '../models/switchBoards';
import Charger from '../models/charger';
import ControllerModel from '../models/controllers';
// Enums
import { CHARGING_MODES } from '../utils/enums/switchboardsEnums';
// Utils
import { BadRequest } from '../utils/errorHandling';
import constants from '../utils/constants';
import { COMMS_SET_POINTS } from '../utils/enums/commsDevicesSetPointsNames';

const commonLog = '[ services switchBoards ';

export async function validateIdsSwitchBoard(arraySwitchBoardIds: string[]): Promise<{ status: boolean; code?: string; message?: string }> {
    const context = `${commonLog} validateIdsSwitchBoard ]`;
    try {
        const query = {
            _id: arraySwitchBoardIds.length === 1 ? arraySwitchBoardIds : { $in: arraySwitchBoardIds },
        };
        const numberOfSwitchBoards = await Switchboards.count(query);
        if (numberOfSwitchBoards !== arraySwitchBoardIds.length) {
            return { status: false, code: 'energyManagement_switchboards_invalidId', message: 'Invalid Switchboard ID' };
        }
        return { status: true };
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return { status: true, code: 'Server_error', message: error.message };
    }
}

async function assignSwitchboardsToLocations(arrayOfSwitchboardsIds: string[], locationId: string): Promise<boolean> {
    const context = `${commonLog} assignSwitchboardsToLocations ]`;
    try {
        if (!Array.isArray(arrayOfSwitchboardsIds) || arrayOfSwitchboardsIds.length < 1) {
            console.error(`${context} Error - Missing arrayOfSwitchboardsIds`, arrayOfSwitchboardsIds);
            throw new Error('Missing arrayOfSwitchboardsIds');
        }
        if (!locationId) {
            console.error(`${context} Error - Missing locationId`, locationId);
            throw new Error('Missing locationId');
        }
        const query = {
            _id: arrayOfSwitchboardsIds.length === 1 ? arrayOfSwitchboardsIds : { $in: arrayOfSwitchboardsIds },
        };
        const updatedSwitch = await Switchboards.updateMany(query, { $set: { locationId: locationId } });
        return updatedSwitch.nModified > 0;
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return false;
    }
}

export async function createNewSwitchBoardA8000(
    controller: IControllerDocument,
    deviceInfoObject: IDeviceInfoObject,
    chargerId: string
): Promise<ISwitchBoardsDocument> {
    const context = `${commonLog} createNewSwitchBoardA8000 ]`;
    const newSwitchBoard = new Switchboards({
        name: deviceInfoObject.switchBoardGroupId
            ? `SWB${Number(deviceInfoObject.switchBoardGroupId).toLocaleString('en-US', {
                  minimumIntegerDigits: 2,
                  useGrouping: false,
              })}`
            : `SWB${controller.name}`,
        controllerId: controller._id,
        arrayChargersId: [chargerId],
        locationId: controller.locationId,
        createUserId: controller.createUserId,
        allowChargingModes: [CHARGING_MODES.Base_Mode, CHARGING_MODES.Solar_Mode],
        chargingMode: CHARGING_MODES.Base_Mode,
        meterType: 'A8000',
        meterDescription: 'A8000',
        switchBoardGroupId: deviceInfoObject.switchBoardGroupId ?? undefined,
    });
    await Promise.all([newSwitchBoard.save(), Charger.updateOne({ _id: chargerId }, { $set: { switchBoardId: newSwitchBoard._id } })]);
    return newSwitchBoard;
}

export async function addChargerToSwitchBoard(switchBoardId: string, chargerId: string): Promise<boolean> {
    await Promise.all([
        Switchboards.updateOne({ _id: switchBoardId }, { $push: { arrayChargersId: chargerId } }),
        Charger.updateOne({ _id: chargerId }, { $set: { switchBoardId: switchBoardId } }),
    ]);
    return true;
}

async function validateSwitchboardUpdate(switchBoardId: string, updateObject: Partial<ISwitchBoardsDocument>): Promise<ISwitchBoardsDocument> {
    const context = `${commonLog} validateSwitchboardUpdate ]`;

    const switchboard = await Switchboards.findById(switchBoardId);
    if (!switchboard) {
        throw BadRequest(
            {
                status: false,
                code: 'switchboard_not_found',
                message: 'Switchboard not found',
            },
            context
        );
    }
    if (updateObject.sharingMode && switchboard.allowSharingModes && !switchboard.allowSharingModes.includes(updateObject.sharingMode)) {
        throw BadRequest(
            {
                status: false,
                code: 'sharing_mode_not_allowed',
                message: 'Sharing mode not allowed for this switchboard',
            },
            context
        );
    }
    if (updateObject.chargingMode && switchboard.allowChargingModes && !switchboard.allowChargingModes.includes(updateObject.chargingMode)) {
        throw BadRequest(
            {
                status: false,
                code: 'charging_mode_not_allowed',
                message: 'Charging mode not allowed for this switchboard',
            },
            context
        );
    }
    return switchboard;
}

function constructPatchObject(patchObject: Partial<ISwitchBoardsDocument>): Partial<ISwitchBoardsDocument> {
    let updateObject = { ...patchObject };
    if (updateObject.currentLimit) updateObject.setALimit = updateObject.currentLimit;

    if (updateObject.chargingMode) updateObject.setChargingMode = updateObject.chargingMode;

    if (updateObject.sharingMode) updateObject.setSharingMode = updateObject.sharingMode;

    if (updateObject.minSolarCurrent) updateObject.setMinSolarCurrent = updateObject.minSolarCurrent;
    return updateObject;
}
async function updateSwitchBoardSetPoints(switchboard: ISwitchBoardsDocument, updateObject: Partial<ISwitchBoardsDocument>): Promise<boolean> {
    const context = `${commonLog} updateSwitchBoardSetPoints ]`;
    // validate if there were updates on any setpoint variable
    let variablesToUpdate: Array<{ variable: string; value: string }> = [];
    if (updateObject.setChargingMode && updateObject.setChargingMode !== switchboard.setChargingMode) {
        variablesToUpdate.push({
            variable: COMMS_SET_POINTS.Charging_Mode,
            value: updateObject.setChargingMode,
        });
    }
    if (updateObject.setSharingMode && updateObject.setSharingMode !== switchboard.setSharingMode) {
        variablesToUpdate.push({
            variable: COMMS_SET_POINTS.Sharing_Mode,
            value: updateObject.setSharingMode,
        });
    }
    if (updateObject.setALimit && updateObject.setALimit !== switchboard.setALimit) {
        variablesToUpdate.push({
            variable: COMMS_SET_POINTS.A_Limit,
            value: updateObject.setALimit.toString(),
        });
    }
    if (updateObject.setMinSolarCurrent && updateObject.setMinSolarCurrent !== switchboard.setMinSolarCurrent) {
        variablesToUpdate.push({
            variable: COMMS_SET_POINTS.A_Min_Solar,
            value: updateObject.setMinSolarCurrent.toString(),
        });
    }
    if (variablesToUpdate.length > 0 && switchboard.controllerId) {
        const controller = await ControllerModel.findById(switchboard.controllerId);
        if (!controller) {
            console.error(`${context} Error - controller not found for controllerId ${switchboard.controllerId}`);
            throw new Error('Controller not found');
        }
        const requestBody = {
            deviceId: switchboard.deviceId,
            controllerId: controller._id,
            variables: variablesToUpdate,
        };
        const response = await axios.post(`${constants.comms_endpoints.HostComms}${constants.comms_endpoints.UpdateCommsSetpoints}`, requestBody);
        if (response.status !== 200 || !response.data.status) {
            console.error(`${context} Error - Error updating setpoints on controller`, response.data);
            throw new Error('Error updating setpoints on controller');
        }
    }
    return true;
}

export default {
    validateIdsSwitchBoard,
    assignSwitchboardsToLocations,
    createNewSwitchBoardA8000,
    addChargerToSwitchBoard,
    validateSwitchboardUpdate,
    constructPatchObject,
    updateSwitchBoardSetPoints,
};
