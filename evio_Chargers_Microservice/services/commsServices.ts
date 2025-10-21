import axios from 'axios';
import Constants from '../utils/constants';
// interfaces
import { IControllerDocument } from '../interfaces/controllersInterfaces';
const commonLog = '[ services commsServices ';

async function UpdateController(controller: IControllerDocument, isToRemove: boolean): Promise<boolean> {
    const context = `${commonLog} updateComms ]`;
    try {
        if (!controller) {
            console.error(`${context} Missing input - `, controller);
            throw new Error('Missing input controller');
        }
        const updateCommsObject = {
            controllerId: controller._id,
            deviceId: controller.deviceId,
            name: controller.name,
            model: controller.model,
            active: isToRemove ? false : controller.active,
            connectionURL: controller.connectionURL,
            protocol: controller.interface,
        };
        const updateCommsURL = `${Constants.comms_endpoints.HostComms}${Constants.comms_endpoints.UpdateCommsDevices}`;
        const updateComms = await axios.post(updateCommsURL, updateCommsObject);
        if (!updateComms?.data?.status) throw new Error('Fail to update comms controller');
        return true;
    } catch (error) {
        console.error(`${context} Error `, error.message);
        throw error;
    }
}

export default {
    UpdateController,
};
