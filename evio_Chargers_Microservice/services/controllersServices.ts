import { captureException } from '@sentry/node';
//Interfaces
import { IControllerDocument, ICreateNewController } from '../interfaces/controllersInterfaces';
import { ILocationDocument } from '../interfaces/locationInterfaces';
import { ISwitchBoardsDocument } from '../interfaces/switchBoardsInterfaces';
// Models
import ControllerModel from '../models/controllers';
import SwitchBoards from '../models/switchBoards';
// Services
import commsServices from './commsServices';
// Enums
import { SHARING_MODES } from '../utils/enums/switchboardsEnums';
import { CONTROLLER_MODEL } from '../utils/enums/controllersEnums';

const commonLog = '[ services controllers ';

async function createController(controllerObject: ICreateNewController): Promise<{ status: boolean; controller?: IControllerDocument }> {
    const context = `${commonLog} createController ]`;
    try {
        if (!controllerObject) {
            console.error(`${context} Error - Missing controllerObject`, controllerObject);
            throw new Error('Missing controllerObject');
        }
        const savedController = await ControllerModel.createAndSave(controllerObject);
        if (!savedController) {
            console.error(`${context} Error - Error creating new controller`, savedController);
            const error = new Error('Error creating new controller');
            captureException(error);
            throw error;
        }
        console.log(`New controller was created ... ${savedController._id}`);
        commsServices.UpdateController(savedController, false);
        return { status: true, controller: savedController };
    } catch (error) {
        console.error(`${context} Error `, error);
        captureException(error.message);
        return { status: false };
    }
}

async function updateController(controllerId: string, updateControllerObject: Partial<IControllerDocument>): Promise<{ status: boolean }> {
    const context = `${commonLog} updateController ]`;
    try {
        const updateController = await ControllerModel.findOneAndUpdate({ _id: controllerId }, { $set: updateControllerObject }, { new: true });
        if (!updateController) throw new Error('Error updating Controller');

        const commsUpdated = await commsServices.UpdateController(updateController, updateController.active);
        if (!commsUpdated) throw new Error('Fail to update Comms');

        return { status: true };
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error;
    }
}

async function createSwitchBoard(location: ILocationDocument, controllerId: string): Promise<ISwitchBoardsDocument> {
    const context = `${commonLog} createSwitchBoard ]`;
    try {
        const newSwitch = new SwitchBoards({
            name: location.name,
            createUserId: location.createUserId,
            locationId: location._id,
            controllerId: controllerId,
            allowSharingModes: SHARING_MODES.NO_MODE, // this is only applicable to smartBox controllers
            sharingMode: SHARING_MODES.NO_MODE, // this is only applicable to smartBox controllers
        });
        await newSwitch.save();
        return newSwitch;
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error;
    }
}

async function getSwitchBoardConfigByControllerType(switchboard: ISwitchBoardsDocument, configObject: any) {
    const context = `${commonLog} getSwitchBoardConfigByControllerType ]`;

    const controller = await ControllerModel.findById(switchboard.controllerId);
    if (!controller) {
        console.error(`${context} Error - controller not found for controllerId ${switchboard.controllerId}`);
        throw new Error('SwitchBoard not found');
    }
    if (controller.model === CONTROLLER_MODEL.Siemens_A8000) {
        configObject.solarMinimum_energyManagement = switchboard.setMinSolarCurrent ?? 0;
        configObject.sharingMode_energyManagement = switchboard.setSharingMode ?? switchboard.sharingMode;
        configObject.allowSharingModes = switchboard.allowSharingModes ?? [switchboard.sharingMode];
    }
    configObject.currentLimit_energyManagement = switchboard.setALimit ?? switchboard.currentLimit ?? 0;
    return configObject;
}

export default {
    createController,
    updateController,
    createSwitchBoard,
    getSwitchBoardConfigByControllerType,
};
