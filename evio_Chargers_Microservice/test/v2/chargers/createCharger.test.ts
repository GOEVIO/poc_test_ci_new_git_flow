import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import * as ChargerV2Controller from '@/v2/chargers/controllers/createCharger.controller';
import Charger from '../../../models/charger';
import Infrastructure from '../../../models/infrastructure';
import ChargeModel from '../../../v2/chargerModels/model';
import { saveImageContent } from '../../../utils/saveImage';

jest.mock('../../../utils/saveImage', () => ({
    saveImageContent: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

const Sentry = require('@sentry/node');

describe('ChargerV2Controller - create', () => {
    let controller;

    const saveMock = jest.fn();
    const findByIdMock = jest.spyOn(Infrastructure, 'findById');
    const findOneMock = jest.spyOn(ChargeModel, 'findOne');

    const req = (body = {}, userid = 'userid', clientname = 'clientname') => ({
        body,
        headers: { userid, clientname },
    });

    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock };

    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        controller = ChargerV2Controller;
    });

    test('should create a charger successfully', async () => {
        const mockChargerModel = {
            _id: 'mockModelId',
            manufacturer: 'VendorName',
            models: [{ model: 'ModelName' }],
        }

        findByIdMock.mockResolvedValueOnce({ _id: 'mockInfrastructureId', name: 'Test Infra' }); // Complete mock
        findOneMock.mockResolvedValueOnce(mockChargerModel as any); // Complete mock
        jest.spyOn(Charger.prototype, 'save').mockResolvedValueOnce({});
        jest.mocked(saveImageContent).mockResolvedValueOnce('/path/to/image.jpg');

        const mockRequest = req({
            vendor: 'VendorName',
            model: 'ModelName',
            name: 'Test Charger',
            infrastructure: 'infrastructureId',
            imageContent: ['base64ImageContent'],
        }) as unknown as Request;

        await controller.create(mockRequest, res as unknown as Response);

        expect(findByIdMock).toHaveBeenCalledWith('infrastructureId');
        expect(findOneMock).toHaveBeenCalledWith({ manufacturer: 'VendorName', 'models.model': 'ModelName' });
        expect(saveImageContent).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Charger created successfully' }));
    });

    test('should return 400 if infrastructure does not exist', async () => {
        findByIdMock.mockResolvedValueOnce(null); // Infrastructure does not exist

        const mockRequest = req({
            vendor: 'VendorName',
            model: 'ModelName',
            name: 'Test Charger',
            infrastructure: 'infrastructureId',
        }) as unknown as Request;

        await controller.create(mockRequest, res as unknown as Response);

        expect(findByIdMock).toHaveBeenCalledWith('infrastructureId');
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            "auth": false,
            "code": "server_error_infrastructure_not_found",
            "message": "Infrastructure not found for given parameters"
        }));
    });

    test('should return 400 if model does not exist', async () => {
        findByIdMock.mockResolvedValueOnce({ _id: 'mockInfrastructureId', name: 'Test Infra' });
        findOneMock.mockResolvedValueOnce(null); // Model does not exist

        const mockRequest = req({
            vendor: 'VendorName',
            model: 'ModelName',
            name: 'Test Charger',
            infrastructure: 'infrastructureId',
        }) as unknown as Request;

        await controller.create(mockRequest, res as unknown as Response);

        expect(findByIdMock).toHaveBeenCalledWith('infrastructureId');
        expect(findOneMock).toHaveBeenCalledWith({ manufacturer: 'VendorName', 'models.model': 'ModelName' });
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining( {
            "auth": false,
            "code": "server_error_model_or_vendor_not_found",
            "message": "The specified model or vendor could not be found."
        }));
    });

    test('should return 500 if saveImageContent fails', async () => {
        const mockChargerModel = {
            _id: 'mockModelId',
            manufacturer: 'VendorName',
            models: [{ model: 'ModelName' }],
        };

        findByIdMock.mockResolvedValueOnce({ _id: 'mockInfrastructureId', name: 'Test Infra' });
        findOneMock.mockResolvedValueOnce(mockChargerModel as any);
        jest.mocked(saveImageContent).mockRejectedValueOnce(new Error('Image save failed'));

        const mockRequest = req({
            vendor: 'VendorName',
            model: 'ModelName',
            name: 'Test Charger',
            infrastructure: 'infrastructureId',
            imageContent: ['base64ImageContent'],
        }) as unknown as Request;

        await controller.create(mockRequest, res as unknown as Response);

        expect(saveImageContent).toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            "auth": false,
            "code": "internal_server_error",
            "message": "Internal server error"
        }));
    });

    test('should return 500 if saving charger fails', async () => {
        const mockModel = {
            _id: 'mockModelId',
            manufacturer: 'VendorName',
            models: [{ model: 'ModelName' }],
        };

        findByIdMock.mockResolvedValueOnce({ _id: 'mockInfrastructureId', name: 'Test Infra' });
        findOneMock.mockResolvedValueOnce(mockModel as any);
        jest.spyOn(Charger.prototype, 'save').mockRejectedValueOnce(new Error('Save failed'));

        const mockRequest = req({
            vendor: 'VendorName',
            model: 'ModelName',
            name: 'Test Charger',
            infrastructure: 'infrastructureId',
        }) as unknown as Request;

        await controller.create(mockRequest, res as unknown as Response);

        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            "auth": false,
            "code": "internal_server_error",
            "message": "Internal server error"
        }));
    });
});
