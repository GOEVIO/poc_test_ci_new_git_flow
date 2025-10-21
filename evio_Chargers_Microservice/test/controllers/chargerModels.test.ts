import { Request, Response, Send } from 'express';
import { StatusCodes } from 'http-status-codes';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Controllers
import chargerModelsController from '../../controllers/chargerModels';
// Models
import ChargerModel from '../../models/chargerModels';

jest.mock('../../models/chargerModels');

describe('Testing createNewModel()', () => {
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    const req = {
        method: 'POST',
        path: '/api/private/chargers/chargerModels',
        body: {
            manufacturer: 'Efacec',
            modelName: 'HV 160',
            active: false,
            protocol: 'OCPP',
            protocolVersion: '1.6',
            core: 'OK',
            remoteUnlock: 'OK',
            lockDetection: 'OK',
            remoteFirmwareUpdate: 'OK',
            autoCharge: 'OK',
            plugAndCharge: 'OK',
            remoteEnergyManagement: 'OK',
            localEnergyManagement: 'OK',
            confluenceLink: 'www.teste.com',
            firmwareVersion: '1.0',
            testDate: new Date(),
        },
    } as unknown as Request;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Request sent already have an model and manufacturer been created before', async () => {
        (ChargerModel.findModel as jest.Mock).mockReturnValueOnce({ manufacturer: 'Efacec' });

        await chargerModelsController.createNewModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'chargerModel_already_exists',
            message: 'Charger model already exists',
        });
    });

    it('There should been an server error creating the new Charger Model', async () => {
        (ChargerModel.findModel as jest.Mock).mockReturnValueOnce({});
        (ChargerModel.createNewModel as jest.Mock).mockReturnValueOnce(null);

        await chargerModelsController.createNewModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'chargerModel_creation_failed',
            message: 'Failed to create charger model',
        });
    });

    it('it should create the new charger model and return the created object', async () => {
        (ChargerModel.findModel as jest.Mock).mockReturnValueOnce({});
        (ChargerModel.createNewModel as jest.Mock).mockReturnValueOnce(req.body);

        await chargerModelsController.createNewModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.send).toHaveBeenCalledWith(req.body);
    });
});


describe('Testing updateChargerModel()', () => {
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    const req = {
        method: 'PUT',
        path: '/api/private/chargers/chargerModels/:_id',
        params: {
            _id: 'some_valid_id',
        },
        body: {
            manufacturer: 'New Manufacturer',
            modelName: 'New Model Name',
            active: true,
            listProtocol: [
                {
                    protocol: 'New Protocol',
                    protocolVersion: '1.0',
                    core: 'OK',
                    remoteUnlock: 'OK',
                    lockDetection: 'OK',
                    remoteFirmwareUpdate: 'OK',
                    autoCharge: 'OK',
                    plugAndCharge: 'OK',
                    remoteEnergyManagement: 'OK',
                    localEnergyManagement: 'OK',
                    confluenceLink: 'www.example.com',
                    firmwareVersion: '2.0',
                    testDate: new Date(),
                },
            ],
        },
    } as unknown as Request;

    let existingModel: any;

    beforeEach(() => {
        jest.clearAllMocks();

        existingModel = {
            _id: '6637a84d49fe4603288a7ee7',
            manufacturer: 'Efacec',
            modelName: 'HV 160',
            listProtocol: [
                {
                    _id: '6637a84d49fe4603288a7ee8',
                    protocol: 'OCPP',
                    protocolVersion: '1.6',
                    core: 'OK',
                    remoteUnlock: 'OK',
                    lockDetection: 'OK',
                    remoteFirmwareUpdate: 'OK',
                    autoCharge: 'Failed',
                    plugAndCharge: 'Failed',
                    remoteEnergyManagement: 'Failed',
                    localEnergyManagement: 'Failed',
                    confluenceLink: 'www.teste.com',
                    firmwareVersion: '12.05.25',
                    testDate: new Date('2024-02-05T15:30:54.420Z')
                }
            ],
            active: false
        };
    });

    it('Should return 200 and the updated charger model if update is successful', async () => {
        const updatedModel = {
            _id: 'some_valid_id',
            manufacturer: 'ChargeAmps',
            modelName: 'Dawn v1.3.5',
            listProtocol: [
                {
                    protocol: 'OCPP',
                    protocolVersion: '1.6',
                    core: 'OK',
                    remoteUnlock: 'OK',
                    lockDetection: 'OK',
                    remoteFirmwareUpdate: 'OK',
                    autoCharge: 'OK',
                    plugAndCharge: 'OK',
                    remoteEnergyManagement: 'OK',
                    localEnergyManagement: 'OK',
                    confluenceLink: 'https://evio.atlassian.net/wiki/spaces/EVIO/pages/163676183/DAWN+v1.3.5',
                    firmwareVersion: '1.3.5',
                    testDate: new Date(),
                },
            ],
            active: false,
        };

        (ChargerModel.findByIdModel as jest.Mock).mockReturnValueOnce(updatedModel);
        (ChargerModel.updateChargerModel as jest.Mock).mockReturnValueOnce(updatedModel);

        await chargerModelsController.updateChargerModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.send).toHaveBeenCalledWith(updatedModel);
    });

    it('Should return 404 Not Found if the charger model does not exist', async () => {
        (ChargerModel.findByIdModel as jest.Mock).mockReturnValueOnce(null);

        await chargerModelsController.updateChargerModel(req, res);

        expect(res.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'chargerModel_id_does_not_exists',
            message: `Id of Charger model id does not exists`,
        });
    });

    it('Should return 400 Bad Request if trying to update to a charger model with existing manufacturer and model name combination', async () => {
        (ChargerModel.findByIdModel as jest.Mock).mockReturnValueOnce(existingModel);
        (ChargerModel.findOne as jest.Mock).mockReturnValueOnce(existingModel);

        await chargerModelsController.updateChargerModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'chargerModel_already_exists',
            message: `manufacturer and modelName combination already exists`,
        });
    });

    it('Should update charger model without adding new entry to listProtocol if relevant fields are not changed', async () => {
        const updatedModel = {
            _id: '6637a84d49fe4603288a7ee7',
            manufacturer: 'Efacec',
            modelName: 'HV 160',
            listProtocol: [
                {
                    _id: '6637a84d49fe4603288a7ee8',
                    protocol: 'OCPP',
                    protocolVersion: '1.6',
                    core: 'Failed',
                    remoteUnlock: 'Failed',
                    lockDetection: 'OK',
                    remoteFirmwareUpdate: 'OK',
                    autoCharge: 'Failed',
                    plugAndCharge: 'OK',
                    remoteEnergyManagement: 'Failed',
                    localEnergyManagement: 'Failed',
                    confluenceLink: ' www.teste.com',
                    firmwareVersion: '12.05.25',
                    testDate: new Date('2024-02-05T15:30:54.420Z')
                }
            ],
            active: true
        };

        (ChargerModel.findByIdModel as jest.Mock).mockReturnValueOnce(existingModel);
        (ChargerModel.updateChargerModel as jest.Mock).mockReturnValueOnce(updatedModel);

        await chargerModelsController.updateChargerModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.send).toHaveBeenCalledWith(updatedModel);
    });

    it('Should add a new entry to listProtocol if relevant fields are changed', async () => {
        const updatedModel = {
            _id: '6637a84d49fe4603288a7ee7',
            manufacturer: 'Efacec',
            modelName: 'HV 160',
            listProtocol: [
                {
                    _id: '6637a84d49fe4603288a7ee8',
                    protocol: 'OCPI',
                    protocolVersion: '2.1',
                    core: 'Failed',
                    remoteUnlock: 'Failed',
                    lockDetection: 'OK',
                    remoteFirmwareUpdate: 'OK',
                    autoCharge: 'Failed',
                    plugAndCharge: 'OK',
                    remoteEnergyManagement: 'Failed',
                    localEnergyManagement: 'Failed',
                    confluenceLink: ' www.teste.com',
                    firmwareVersion: '12.05.25',
                    testDate: new Date('2024-02-05T15:30:54.420Z')
                }
            ],
            active: true
        };

        (ChargerModel.findByIdModel as jest.Mock).mockReturnValueOnce(existingModel);
        (ChargerModel.updateChargerModel as jest.Mock).mockReturnValueOnce(updatedModel);

        await chargerModelsController.updateChargerModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
        expect(res.send).toHaveBeenCalledWith(updatedModel);
    });

    it('Should return 500 Internal Server Error if there was an error updating the charger model', async () => {
        (ChargerModel.findByIdModel as jest.Mock).mockReturnValueOnce(existingModel);
        (ChargerModel.updateChargerModel as jest.Mock).mockReturnValueOnce(null);

        await chargerModelsController.updateChargerModel(req, res);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'chargerModel_update_failed',
            message: 'Failed to update charger model',
        });
    });

});

