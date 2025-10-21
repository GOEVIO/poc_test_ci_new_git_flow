import { Request, Response } from 'express';
// Utils
import { BadRequest, errorResponse } from '../utils/errorHandling';
// Services
import controllersServices from '../services/controllersServices';
import switchBoardsServices from '../services/switchBoardsServices';
// Models
import switchboardModel from '../models/switchBoards';
// interfaces
import { ISwitchBoardsDocument } from '../interfaces/switchBoardsInterfaces';
// controllers
import switchBoardController from './switchBoardController';

const commonLog = '[ switchboardsController ';

async function getConfigs(req: Request, res: Response) {
    const context = `${commonLog} getConfigs ]`;
    try {
        const { id } = req.params;

        const switchboard = await switchboardModel.findById(id);
        if (!switchboard) {
            throw BadRequest({
                status: false,
                code: 'switchboard_not_found',
                message: 'Switchboard not found',
            });
        }
        let returnObject = {
            id: switchboard._id,
            general_name: switchboard.name,
            general_cpe: switchboard.dpc ?? '',
            chargingMode_energyManagement: switchboard.setChargingMode ?? switchboard.chargingMode,
            allowChargingModes: switchboard.allowChargingModes,
        };
        if (switchboard.controllerId) {
            // some controllers have variables and functionalities that are not present in others
            returnObject = await controllersServices.getSwitchBoardConfigByControllerType(switchboard, returnObject);
        }

        return res.status(200).send(returnObject);
    } catch (error) {
        if (!error.status) console.error(`${context} Error `, error);
        return errorResponse(res, error, context);
    }
}

async function patchSwitchboard(req: Request, res: Response) {
    const context = `${commonLog} patchSwitchboard ]`;
    try {
        const { id } = req.params;
        const { cpe, ...rest } = req.body;
        const patchObject: Partial<ISwitchBoardsDocument> = { ...rest, dpc: cpe };
        const switchboard = await switchBoardsServices.validateSwitchboardUpdate(id, patchObject);
        const updateObject = switchBoardsServices.constructPatchObject(patchObject);
        const updatedSwitchboard = await switchboardModel.updateSwitchBoardById(id, updateObject);
        if (updatedSwitchboard.controllerId) {
            await switchBoardsServices.updateSwitchBoardSetPoints(switchboard, updateObject);
        }
        const formattedSwitchboard = await switchBoardController.formatSwitchboardForMySwitchboards([updatedSwitchboard]);
        return res.status(200).send(formattedSwitchboard);
    } catch (error) {
        console.error(`${context} Error `, error.message);
        return errorResponse(res, error, context);
    }
}
export default {
    getConfigs,
    patchSwitchboard,
};
