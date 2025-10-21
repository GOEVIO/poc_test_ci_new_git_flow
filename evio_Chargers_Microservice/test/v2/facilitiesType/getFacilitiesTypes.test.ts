import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { FacilitiesTypeController } from '../../../v2/facilitiesType/controller';
import FacilitiesType, { IFacilitiesType } from '../../../v2/facilitiesType/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

// Mock Sentry
jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('FacilitiesTypeController - getFacilitiesTypes', () => {
    let controller: FacilitiesTypeController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new FacilitiesTypeController();
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

    test('should return a list of facilities types successfully', async () => {
        const facilitiesTypesMock: IFacilitiesType[] = [
            { _id: 'mocked-id-1', locationType: 'Mall', description: 'Shopping mall' } as IFacilitiesType,
            { _id: 'mocked-id-2', locationType: 'Parking', description: 'Public parking' } as IFacilitiesType,
        ];

        const findSpy = jest.spyOn(FacilitiesType, 'find').mockResolvedValue(facilitiesTypesMock as any);

        await controller.getFacilitiesTypes(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({}); // sem filtros
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(facilitiesTypesMock);
    });

    test('should apply filters from query (locationType & description)', async () => {
        req.query = { locationType: 'Mall', description: 'Shopping mall' };

        const filteredMock: IFacilitiesType[] = [
            { _id: 'mocked-id-1', locationType: 'Mall', description: 'Shopping mall' } as IFacilitiesType,
        ];

        const findSpy = jest.spyOn(FacilitiesType, 'find').mockResolvedValue(filteredMock as any);

        await controller.getFacilitiesTypes(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({ locationType: 'Mall', description: 'Shopping mall' });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(filteredMock);
    });

    test('should return an empty list if no facilities types exist', async () => {
        const findSpy = jest.spyOn(FacilitiesType, 'find').mockResolvedValue([] as any);

        await controller.getFacilitiesTypes(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({});
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith([]);
    });

    test('should handle unexpected errors', async () => {
        const error = new Error('Database connection failed');
        jest.spyOn(FacilitiesType, 'find').mockRejectedValue(error as any);

        await controller.getFacilitiesTypes(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
