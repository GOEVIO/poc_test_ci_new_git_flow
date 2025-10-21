import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { ParkingTypeController } from '../../../v2/parkingType/controller';
import ParkingType, { IParkingType } from '../../../v2/parkingType/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

// Mock Sentry
jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('ParkingTypeController - getParkingTypes', () => {
    let controller: ParkingTypeController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new ParkingTypeController();
        sendMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ send: sendMock });

        req = { query: {} };
        res = {
            status: statusMock as unknown as Response['status'],
            send: sendMock as unknown as Response['send'],
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should return a list of parking types successfully (no filters)', async () => {
        const parkingTypesMock: IParkingType[] = [
            { _id: 'mocked-id-1', parkingType: 'Public', description: 'Public parking lot' } as IParkingType,
            { _id: 'mocked-id-2', parkingType: 'Private', description: 'Private parking space' } as IParkingType,
        ];

        const findSpy = jest.spyOn(ParkingType, 'find').mockResolvedValue(parkingTypesMock as any);

        await controller.getParkingTypes(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({});
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(parkingTypesMock);
    });

    test('should apply filters from query (parkingType & description)', async () => {
        req.query = { parkingType: 'Public', description: 'Public parking lot' };

        const filteredMock: IParkingType[] = [
            { _id: 'mocked-id-1', parkingType: 'Public', description: 'Public parking lot' } as IParkingType,
        ];

        const findSpy = jest.spyOn(ParkingType, 'find').mockResolvedValue(filteredMock as any);

        await controller.getParkingTypes(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({ parkingType: 'Public', description: 'Public parking lot' });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(filteredMock);
    });

    test('should return an empty list if no parking types exist', async () => {
        const findSpy = jest.spyOn(ParkingType, 'find').mockResolvedValue([] as any);

        await controller.getParkingTypes(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({});
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith([]);
    });

    test('should handle unexpected errors', async () => {
        const error = new Error('Database connection failed');
        jest.spyOn(ParkingType, 'find').mockRejectedValue(error as any);

        await controller.getParkingTypes(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
