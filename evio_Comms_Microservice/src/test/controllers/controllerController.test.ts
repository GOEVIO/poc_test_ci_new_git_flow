import { afterEach, describe, expect, it, jest } from '@jest/globals';

// Controller
import controllersController from '../../controllers/controllerController';
import mqttController from '../../controllers/mqttController';
// interface
import { DBControllerInterface, } from '../../interfaces/controllersInterfaces';

jest.mock('../../controllers/mqttController');

describe('connectController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should call mqttHandler.createSubscriptionsToController with the correct controller', async () => {
        const controller = {
            protocol: 'MQTT',
        } as DBControllerInterface;
        await controllersController.connectController(controller);
        expect(mqttController.createSubscriptionsToController).toHaveBeenCalledWith([controller]);
    });

    it('should throw an error if the protocol type is unknown', async () => {
        const controller = {
            protocol: 'OPC-UA',
        } as DBControllerInterface;
        await expect(controllersController.connectController(controller)).rejects.toThrow('Unknown protocol type OPC-UA');
    });
});

