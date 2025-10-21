// Controller
import mqttController from '../controllers/mqttController';
// utils
import constants from '../configuration/index';
// interfaces
import { IPublishMessageType } from '../interfaces/mqttSubscriptionsInterfaces';
import { DBControllerInterface } from '../interfaces/controllersInterfaces';
// Util
import { SMART_BOX_VARIABLES_PUB_ENUM } from '../utils/enums/smartBoxPublishVariablesEnum';

const commonLog = '[ Service SmartBoxService ';
async function updateChargingMode(controller: DBControllerInterface, variables: Array<{ variable: string; value: string }>): Promise<boolean> {
    const context = `${commonLog} updateChargingMode ]`;
    if (controller.protocol !== constants.CONTROLLER.PROTOCOL.PROTOCOL_MQTT || controller.model !== constants.CONTROLLER.MODELS.MODEL_SMARTBOX_V1) {
        console.error(`${context} Error - Invalid controller`);
        throw new Error(`Invalid controller`);
    }
    for (const variable of variables) {
        switch (variable.variable) {
            case SMART_BOX_VARIABLES_PUB_ENUM.Charging_Mode:
                await publishChargingMode(controller, variable.value);
                break;
            // in the future probably will have more variables
            default:
                continue;
        }
    }
    return true;
}

async function publishChargingMode(controller: DBControllerInterface, chargingMode: string): Promise<void> {
    const context = `${commonLog} publishChargingMode ]`;
    const strategyToActivate = controller.listChargingModes.find((strat) => strat.mode === chargingMode);
    if (!strategyToActivate) {
        console.error(`${context} Error - Charging Mode value is not a valid for this controller ${chargingMode}`);
        throw new Error(`Charging Mode value is not a valid for this controller`);
    }
    const strategyToDeactivate = controller.listChargingModes.find((strat) => strat.active && strat.mode !== chargingMode);
    if (strategyToDeactivate) {
        const publishDeactivateTopic: IPublishMessageType = {
            topic: `controllers/${controller.deviceId}/strategies/${strategyToDeactivate.strategyId}/active/set`,
            message: 'false',
        };
        if (!(await mqttController.publishTopics([publishDeactivateTopic]))) {
            console.error(`${context} Error - Fail to deactivate strategy ${strategyToDeactivate.strategyId}`);
            throw new Error(`Fail to deactivate strategy ${strategyToDeactivate.strategyId}`);
        }
    }
    const publishActivateTopic: IPublishMessageType = {
        topic: `controllers/${controller.deviceId}/strategies/${strategyToActivate.strategyId}/active/set`,
        message: 'true',
    };
    if (!(await mqttController.publishTopics([publishActivateTopic]))) {
        console.error(`${context} Error - Fail to activate strategy ${strategyToActivate.strategyId}`);
        throw new Error(`Fail to activate strategy ${strategyToActivate.strategyId}`);
    }
}

export default {
    updateChargingMode,
    publishChargingMode,
};
