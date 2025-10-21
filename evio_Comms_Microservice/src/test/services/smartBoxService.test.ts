import { describe, expect, it, jest } from '@jest/globals';

// Controllers
import mqttController from '../../controllers/mqttController';
// Services
import smartBoxService from '../../services/smartBoxService';
// interfaces
import { DBControllerInterface } from '../../interfaces/controllersInterfaces';

jest.mock('../../controllers/mqttController');

describe('publishChargingMode', () => {
    it('should publish the activate topic and deactivate the previous strategy', async () => {
        const controller = {
            deviceId: 'device1',
            listChargingModes: [
                { strategyId: 'strategy1', mode: 'mode1', active: true },
                { strategyId: 'strategy2', mode: 'mode2', active: false },
            ],
        } as DBControllerInterface;

        const chargingMode = 'mode2';

        const publishDeactivateTopic = {
            topic: 'controllers/device1/strategies/strategy1/active/set',
            message: 'false',
        };

        const publishActivateTopic = {
            topic: 'controllers/device1/strategies/strategy2/active/set',
            message: 'true',
        };
        (mqttController.publishTopics as jest.Mock).mockReturnValue(true as never);
        await smartBoxService.publishChargingMode(controller, chargingMode);
        expect(mqttController.publishTopics).toHaveBeenCalledWith([publishDeactivateTopic]);
        expect(mqttController.publishTopics).toHaveBeenCalledWith([publishActivateTopic]);
    });

    it('should throw an error if the charging mode is not valid for the controller', async () => {
        const controller = {
            deviceId: 'device1',
            listChargingModes: [
                { strategyId: 'strategy1', mode: 'mode1', active: true },
                { strategyId: 'strategy2', mode: 'mode2', active: false },
            ],
        } as DBControllerInterface;
        const chargingMode = 'invalidMode';
        await expect(smartBoxService.publishChargingMode(controller, chargingMode)).rejects.toThrowError(
            'Charging Mode value is not a valid for this controller'
        );
    });

    it('should throw an error if fail to deactivate the previous strategy', async () => {
        const controller = {
            deviceId: 'device1',
            listChargingModes: [
                { strategyId: 'strategy1', mode: 'mode1', active: true },
                { strategyId: 'strategy2', mode: 'mode2', active: false },
            ],
        } as DBControllerInterface;

        const chargingMode = 'mode2';

        const publishDeactivateTopic = {
            topic: 'controllers/device1/strategies/strategy1/active/set',
            message: 'false',
        };
        (mqttController.publishTopics as jest.Mock).mockReturnValueOnce(false as never);
        await expect(smartBoxService.publishChargingMode(controller, chargingMode)).rejects.toThrowError('Fail to deactivate strategy strategy1');
        expect(mqttController.publishTopics).toHaveBeenCalledWith([publishDeactivateTopic]);
    });

    it('should throw an error if fail to activate the new strategy', async () => {
        const controller = {
            deviceId: 'device1',
            listChargingModes: [
                { strategyId: 'strategy1', mode: 'mode1', active: true },
                { strategyId: 'strategy2', mode: 'mode2', active: false },
            ],
        } as DBControllerInterface;
        const chargingMode = 'mode2';
        const publishDeactivateTopic = {
            topic: 'controllers/device1/strategies/strategy1/active/set',
            message: 'false',
        };

        const publishActivateTopic = {
            topic: 'controllers/device1/strategies/strategy2/active/set',
            message: 'true',
        };
        (mqttController.publishTopics as jest.Mock).mockReturnValueOnce(true as never);
        (mqttController.publishTopics as jest.Mock).mockReturnValueOnce(false as never);
        await expect(smartBoxService.publishChargingMode(controller, chargingMode)).rejects.toThrowError('Fail to activate strategy strategy2');
        expect(mqttController.publishTopics).toHaveBeenCalledWith([publishDeactivateTopic]);
        expect(mqttController.publishTopics).toHaveBeenCalledWith([publishActivateTopic]);
    });
});

describe('updateChargingMode', () => {
    it('should update the charging mode', async () => {
        const controller = {
            protocol: 'MQTT',
            model: 'smartBox_v1',
            listChargingModes: [
                { strategyId: 'strategy1', mode: 'mode1', active: true },
                { strategyId: 'strategy2', mode: 'mode2', active: false },
            ],
        } as DBControllerInterface;

        const variables = [{ variable: 'Charging_Mode', value: 'mode2' }];
        (mqttController.publishTopics as jest.Mock).mockReturnValueOnce(true as never);
        (mqttController.publishTopics as jest.Mock).mockReturnValueOnce(true as never);
        const result = await smartBoxService.updateChargingMode(controller, variables);
        expect(result).toBe(true);
    });

    it('should throw an error for an invalid controller', async () => {
        const controller = {
            protocol: 'OPC-UA',
            model: 'smartbox_v2',
        } as DBControllerInterface;

        const variables = [{ variable: 'Charging_Mode', value: 'mode2' }];

        await expect(smartBoxService.updateChargingMode(controller, variables)).rejects.toThrowError('Invalid controller');
    });
});
