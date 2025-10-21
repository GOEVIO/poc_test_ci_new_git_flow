import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { FacilitiesTypeController } from '../../../v2/facilitiesType/controller';
import FacilitiesType, { IFacilitiesType } from '../../../v2/facilitiesType/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('FacilitiesTypeController - createFacilitiesType', () => {
    let controller: FacilitiesTypeController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new FacilitiesTypeController();
        sendMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ send: sendMock });

        req = { body: {} };
        res = {
            status: statusMock as unknown as Response['status'],
            send: sendMock as unknown as Response['send'],
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should create a single facilities type successfully', async () => {
        req.body = { locationType: 'Mall', description: 'Shopping mall' };

        // não existe ainda
        const findOneSpy = jest.spyOn(FacilitiesType, 'findOne').mockResolvedValue(null as any);

        const facilitiesTypeMock = {
            _id: 'mocked-id-1',
            locationType: 'Mall',
            description: 'Shopping mall',
        } as IFacilitiesType;

        jest.spyOn(FacilitiesType.prototype as any, 'save').mockResolvedValue(facilitiesTypeMock as never);

        await controller.createFacilitiesType!(req as Request, res as Response);

        expect(findOneSpy).toHaveBeenCalledWith({ locationType: 'Mall' });
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                locationType: 'Mall',
                description: 'Shopping mall',
            }),
        );
    });

    test('should create multiple facilities types successfully', async () => {
        const facilitiesTypes = [
            { locationType: 'Mall', description: 'Shopping mall' },
            { locationType: 'Parking', description: 'Public parking' },
        ];

        const findOneSpy = jest.spyOn(FacilitiesType, 'findOne').mockResolvedValue(null as any);

        for (const payload of facilitiesTypes) {
            req.body = payload;

            const facilitiesTypeMock = {
                _id: `mocked-id-${Math.random()}`,
                ...payload,
            } as IFacilitiesType;

            jest
                .spyOn(FacilitiesType.prototype as any, 'save')
                .mockResolvedValueOnce(facilitiesTypeMock as never);

            await controller.createFacilitiesType!(req as Request, res as Response);

            expect(findOneSpy).toHaveBeenCalledWith({ locationType: payload.locationType });
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    locationType: payload.locationType,
                    description: payload.description,
                }),
            );
        }
    });

    test('should return 400 when locationType already exists', async () => {
        req.body = { locationType: 'Mall', description: 'Shopping mall' };

        // já existe
        jest.spyOn(FacilitiesType, 'findOne').mockResolvedValue({ _id: 'exists' } as any);

        await controller.createFacilitiesType!(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_location_type_already_exists',
            message: 'The location type already exists.',
        });
    });

    test('should handle unexpected errors (500) and report to Sentry', async () => {
        req.body = { locationType: 'Gym', description: 'Fitness center' };
        const error = new Error('Unexpected database error');

        // não existe, mas o save dá erro
        jest.spyOn(FacilitiesType, 'findOne').mockResolvedValue(null as any);
        jest.spyOn(FacilitiesType.prototype as any, 'save').mockRejectedValue(error);

        await controller.createFacilitiesType!(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
