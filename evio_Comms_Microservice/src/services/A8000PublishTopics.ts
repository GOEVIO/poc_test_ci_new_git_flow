import { captureException } from '@sentry/node';
// controller
import mqttController from '../controllers/mqttController';
// Interfaces
import { DBControllerInterface, IEquipmentDB } from '../interfaces/controllersInterfaces';
// Utils
import { A8000VariablesPubEnum, A8000ChargingModesValuesEnum, A8000SharingModesValuesEnum } from '../utils/enums/A8000PublishVariablesEnum';

const commonLog = '[ services A8000PublishTopics ';

async function publishTopic(
    controller: DBControllerInterface,
    variables: Array<{ variable: string; value: string }>,
    deviceId: string
): Promise<boolean> {
    const context = `${commonLog} publishTopic]`;

    const device = controller.devices.find((device) => device.deviceId === deviceId);
    if (!device) {
        console.error(`${context} Error - Device not found in controller`, deviceId);
        return false;
    }
    let deviceName = device.deviceId.split('_')[0];
    const topic = `Controller/A8000/${controller.deviceId}/${device.deviceId}/STP`;
    let DataItems: Array<{ Variable: string; Value: number; Type: string; QualityCode: string }> = [];
    for (let variable of variables) {
        let setPoint;
        let name = '';
        switch (variable.variable) {
            case A8000VariablesPubEnum.A_Limit:
                name = `${deviceName}-STP-${A8000VariablesPubEnum.A_Limit}`;
                setPoint = (Number(variable.value) * 3).toFixed(2);
                break;
            case A8000VariablesPubEnum.A_Min_Solar:
                setPoint = (Number(variable.value) * 3).toFixed(2);
                name = `${deviceName}-STP-${A8000VariablesPubEnum.A_Min_Solar}`;
                break;
            case A8000VariablesPubEnum.Charging_Mode:
                setPoint = Number(A8000ChargingModesValuesEnum[variable.value]);
                if(!setPoint) {
                    console.error(`${context} Error - Charging mode not found in A8000ChargingModesValuesEnum`, variable.value);
                    captureException(`Charging mode value not found in A8000ChargingModesValuesEnum for device ${controller.deviceId}`);
                    throw new Error('Charging mode value not found in A8000ChargingModesValuesEnum');
                }
                name = `${deviceName}-STP-${A8000VariablesPubEnum.Charging_Mode}`;
                break;
            case A8000VariablesPubEnum.SHARING_MODE:
                setPoint = Number(A8000SharingModesValuesEnum[variable.value]);
                if(!setPoint) {
                    console.error(`${context} Error - Sharing mode not found in A8000SharingModesValuesEnum`, variable.value);
                    captureException(`Sharing mode value not found in A8000SharingModesValuesEnum for device ${controller.deviceId}`);
                    throw new Error('Sharing mode value not found in A8000SharingModesValuesEnum');
                }
                name = `${deviceName}-STP-${A8000VariablesPubEnum.SHARING_MODE}`;
                break;
            case A8000VariablesPubEnum.Priority:
                setPoint = Number(variable.value);
                name = `${deviceName}-STP-${A8000VariablesPubEnum.Priority}`;
                break;
            default:
                console.error(`${context} Error - Variable not found in A8000SwitchboardPubEnum`, variable);
                throw new Error('Variable not found in A8000SwitchboardPubEnum');
                break;
        }
        DataItems.push({
            Variable: name,
            Value: setPoint,
            Type: getTypeOfVariable(variable.variable),
            QualityCode: 'GOOD',
        });
    }
    return await mqttController.publishTopics([{ topic, message: JSON.stringify({ DataItems }) }]);
}

function getTypeOfVariable(variable: string): string {
    switch (variable) {
        case A8000VariablesPubEnum.A_Limit:
        case A8000VariablesPubEnum.A_Min_Solar:
        case A8000VariablesPubEnum.Charging_Mode:
        case A8000VariablesPubEnum.SHARING_MODE:
        case A8000VariablesPubEnum.Priority:
            return 'SINGLE_FLOAT';
        default:
            console.error(`${commonLog} Error - Variable not found in A8000SwitchboardPubEnum`, variable);
            throw new Error(`Variable not found in A8000SwitchboardPubEnum ${variable}`);
    }
}

export default {
    publishTopic,
};