import { describe, test, jest, expect, beforeEach } from '@jest/globals';
import { AssetTypeController } from '../../../v2/assetType/controller';
import AssetType, { IAssetType } from '../../../v2/assetType/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('AssetTypeController - createAssetType', () => {
    let controller: AssetTypeController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new AssetTypeController();

        sendMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ send: sendMock });

        req = { body: {} };
        res = {
            status: statusMock as unknown as Response['status'],
            send: sendMock as unknown as Response['send'],
        };

        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should create an asset type successfully when it does not exist', async () => {
        req.body = { vehicleType: 'Car', description: 'A four-wheeled vehicle' };

        const findOneSpy = jest.spyOn(AssetType, 'findOne').mockResolvedValue(null as any);

        const assetTypeMock = {
            _id: 'mocked-id-1',
            vehicleType: 'Car',
            description: 'A four-wheeled vehicle',
        } as unknown as IAssetType;

        const saveSpy = jest
            .spyOn(AssetType.prototype as any, 'save')
            .mockResolvedValue(assetTypeMock as never);

        await controller.createAssetType(req as Request, res as Response);

        expect(findOneSpy).toHaveBeenCalledWith({ vehicleType: 'Car' });
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                vehicleType: 'Car',
                description: 'A four-wheeled vehicle',
            }),
        );
        expect(saveSpy).toHaveBeenCalled();
    });

    test('should return 400 when vehicleType already exists', async () => {
        req.body = { vehicleType: 'Car', description: 'Duplicate attempt' };

        jest.spyOn(AssetType, 'findOne').mockResolvedValue({ _id: 'existing-id' } as any);

        await controller.createAssetType(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_vehicle_type_exists',
            message: 'A vehicle with the given type already exists.',
        });
    });

    test('should handle unexpected errors and report to Sentry', async () => {
        req.body = { vehicleType: 'Truck', description: 'Heavy vehicle' };
        const error = new Error('Unexpected database error');

        jest.spyOn(AssetType, 'findOne').mockResolvedValue(null as any);
        jest.spyOn(AssetType.prototype as any, 'save').mockRejectedValue(error);

        await controller.createAssetType(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
