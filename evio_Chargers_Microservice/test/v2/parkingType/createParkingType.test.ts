import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { ParkingTypeController } from '../../../v2/parkingType/controller';
import ParkingType, { IParkingType } from '../../../v2/parkingType/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('ParkingTypeController - createParkingType', () => {
    let controller: ParkingTypeController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new ParkingTypeController();
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

    test('should create a single parking type successfully', async () => {
        req.body = { parkingType: 'Public', description: 'Public parking lot' };

        // não existe duplicado
        const findOneSpy = jest.spyOn(ParkingType, 'findOne').mockResolvedValue(null as any);

        const parkingTypeMock = {
            _id: 'mocked-id-1',
            parkingType: 'Public',
            description: 'Public parking lot',
        } as IParkingType;

        jest.spyOn(ParkingType.prototype as any, 'save').mockResolvedValue(parkingTypeMock as never);

        await controller.createParkingType(req as Request, res as Response);

        expect(findOneSpy).toHaveBeenCalledWith({ parkingType: 'Public' });
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                parkingType: 'Public',
                description: 'Public parking lot',
            })
        );
    });

    test('should create multiple parking types successfully', async () => {
        const parkingTypes = [
            { parkingType: 'Public', description: 'Public parking lot' },
            { parkingType: 'Private', description: 'Private parking space' },
        ];

        const findOneSpy = jest.spyOn(ParkingType, 'findOne').mockResolvedValue(null as any);

        for (const payload of parkingTypes) {
            req.body = payload;

            const parkingTypeMock = {
                _id: `mocked-id-${Math.random()}`,
                ...payload,
            } as IParkingType;

            jest
                .spyOn(ParkingType.prototype as any, 'save')
                .mockResolvedValueOnce(parkingTypeMock as never);

            await controller.createParkingType(req as Request, res as Response);

            expect(findOneSpy).toHaveBeenCalledWith({ parkingType: payload.parkingType });
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    parkingType: payload.parkingType,
                    description: payload.description,
                })
            );
        }
    });

    test('should return 400 when parkingType already exists', async () => {
        req.body = { parkingType: 'Public', description: 'dup' };
        jest.spyOn(ParkingType, 'findOne').mockResolvedValue({ _id: 'exists' } as any);

        await controller.createParkingType(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_parking_type_already_exists',
            message: 'A parking type with the given name already exists.',
        });
    });

    test('should handle unexpected errors', async () => {
        req.body = { parkingType: 'Private', description: 'Reserved space' };
        const error = new Error('Unexpected database error');

        jest.spyOn(ParkingType, 'findOne').mockResolvedValue(null as any);
        jest.spyOn(ParkingType.prototype as any, 'save').mockRejectedValue(error);

        await controller.createParkingType(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
