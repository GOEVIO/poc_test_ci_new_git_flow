import { Request, Response, Send } from 'express';
import { StatusCodes } from 'http-status-codes';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
// Middlewares
import chargerModelsMiddleware from '../../middleware/chargerModelsMiddleware';

function testingVariableOnValidateCreateChargerModel(
    variableName: string,
    variableValue: any,
    req: Request,
    res: Response,
    next,
    expectedObject: Object,
    expectedStatus: StatusCodes
) {
    req.body[variableName] = variableValue;
    chargerModelsMiddleware.validateCreateChargerModel(req, res, next);
    expect(res.status).toHaveBeenCalledWith(expectedStatus);
    expect(res.send).toHaveBeenCalledWith(expectedObject);
}
describe('validateCreateChargerModel', () => {
    const next = jest.fn();
    const res = {} as unknown as Response;
    res.send = jest.fn() as Send;
    res.status = jest.fn(() => res);
    const req = {
        method: 'POST',
        path: '/api/private/chargers/chargerModels',
        body: {},
    } as unknown as Request;

    beforeEach(() => {
        req.body = {
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
        };
    });

    it('should call next if all required fields are present', async () => {
        chargerModelsMiddleware.validateCreateChargerModel(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should send bad request because of missing body information', () => {
        req.body = {};
        chargerModelsMiddleware.validateCreateChargerModel(req, res, next);
        expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'chargerModel_body_required',
            message: 'Missing body in request',
        });
    });

    it('testing error cases for manufacturer variable', () => {
        const expectedObject = {
            auth: false,
            code: 'chargerModel_manufacturer_required',
            message: 'Missing manufacturer',
        };
        testingVariableOnValidateCreateChargerModel('manufacturer', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for modelName variable', () => {
        const expectedObject = {
            auth: false,
            code: 'chargerModel_modelName_required',
            message: 'Missing modelName',
        };
        testingVariableOnValidateCreateChargerModel('modelName', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for protocol variable', () => {
        const expectedObject = {
            auth: false,
            code: 'chargerModel_protocol_required',
            message: 'Missing protocol',
        };
        testingVariableOnValidateCreateChargerModel('protocol', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for protocolVersion variable', () => {
        const expectedObject = {
            auth: false,
            code: 'chargerModel_protocolVersion_required',
            message: 'Missing protocolVersion',
        };
        testingVariableOnValidateCreateChargerModel('protocolVersion', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for protocolVersion core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_core_required',
            message: 'Missing core test value',
        };
        testingVariableOnValidateCreateChargerModel('core', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_core_bad_value',
            message: 'Invalid value for core test result',
        };
        testingVariableOnValidateCreateChargerModel('core', 'NOP', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });
    it('testing error cases for remoteUnlock core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_remoteUnlock_required',
            message: 'Missing remoteUnlock test value',
        };
        testingVariableOnValidateCreateChargerModel('remoteUnlock', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_remoteUnlock_bad_value',
            message: 'Invalid value for remoteUnlock test result',
        };
        testingVariableOnValidateCreateChargerModel('remoteUnlock', 'Test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for lockDetection core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_lockDetection_required',
            message: 'Missing lockDetection test value',
        };
        testingVariableOnValidateCreateChargerModel('lockDetection', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_lockDetection_bad_value',
            message: 'Invalid value for lockDetection test result',
        };
        testingVariableOnValidateCreateChargerModel('lockDetection', 'Test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for remoteFirmwareUpdate core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_remoteFirmwareUpdate_required',
            message: 'Missing remoteFirmwareUpdate test value',
        };
        testingVariableOnValidateCreateChargerModel('remoteFirmwareUpdate', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_remoteFirmwareUpdate_bad_value',
            message: 'Invalid value for remoteFirmwareUpdate test result',
        };
        testingVariableOnValidateCreateChargerModel('remoteFirmwareUpdate', 'Test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for autoCharge core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_autoCharge_required',
            message: 'Missing autoCharge test value',
        };
        testingVariableOnValidateCreateChargerModel('autoCharge', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_autoCharge_bad_value',
            message: 'Invalid value for autoCharge test result',
        };
        testingVariableOnValidateCreateChargerModel('autoCharge', 'Test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for plugAndCharge core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_plugAndCharge_required',
            message: 'Missing plugAndCharge test value',
        };
        testingVariableOnValidateCreateChargerModel('plugAndCharge', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_plugAndCharge_bad_value',
            message: 'Invalid value for plugAndCharge test result',
        };
        testingVariableOnValidateCreateChargerModel('plugAndCharge', 'Test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for remoteEnergyManagement core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_remoteEnergyManagement_required',
            message: 'Missing remoteEnergyManagement test value',
        };
        testingVariableOnValidateCreateChargerModel('remoteEnergyManagement', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_remoteEnergyManagement_bad_value',
            message: 'Invalid value for remoteEnergyManagement test result',
        };
        testingVariableOnValidateCreateChargerModel('remoteEnergyManagement', 'Test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for localEnergyManagement core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_localEnergyManagement_required',
            message: 'Missing localEnergyManagement test value',
        };
        testingVariableOnValidateCreateChargerModel('localEnergyManagement', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        // since this is an enum type, we can test the invalid value
        expectedObject = {
            auth: false,
            code: 'chargerModel_localEnergyManagement_bad_value',
            message: 'Invalid value for localEnergyManagement test result',
        };
        testingVariableOnValidateCreateChargerModel('localEnergyManagement', 'Test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for testDate core', () => {
        let expectedObject = {
            auth: false,
            code: 'chargerModel_testDate_required',
            message: 'Missing testDate',
        };
        testingVariableOnValidateCreateChargerModel('testDate', null, req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        expectedObject = {
            auth: false,
            code: 'chargerModel_testDate_wrong_format',
            message: 'testDate must be a valid date in format YYYY-MM-DD',
        };
        // only allows date format  YYYY-MM-DD
        testingVariableOnValidateCreateChargerModel('testDate', 'test', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
        testingVariableOnValidateCreateChargerModel('testDate', '20-10-2021', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for confluenceLink variable', () => {
        const expectedObject = {
            auth: false,
            code: 'chargerModel_confluenceLink_required',
            message: 'Missing confluenceLink to test report',
        };
        testingVariableOnValidateCreateChargerModel('confluenceLink', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });

    it('testing error cases for active variable', () => {
        const expectedObject = {
            auth: false,
            code: 'chargerModel_active_required',
            message: 'Missing active',
        };
        testingVariableOnValidateCreateChargerModel('active', '', req, res, next, expectedObject, StatusCodes.BAD_REQUEST);
    });
});
