import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import ChargerTest from '../../../v2/chargerTests/model';
import { ChargerTestController } from '../../../v2/chargerTests/controller';
import toggle from 'evio-toggle';
import Sentry from '@sentry/node';

jest.mock('evio-toggle', () => ({
    isEnable: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('ChargerTestController - create', () => {
    let controller: ChargerTestController;

    const saveMock = jest.fn();
    const findByIdMock = jest.spyOn(ChargerTest, 'findById');

    const req = (body = {}) => ({
        body,
    }) as unknown as Request;

    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock } as unknown as Response;

    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        controller = new ChargerTestController();
    });

    test('should create a ChargerTest successfully', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        jest.spyOn(ChargerTest.prototype, 'save').mockResolvedValueOnce({});

        const mockRequest = req({ testName: 'Test Charger' });

        await controller.create(mockRequest, res);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'ChargerTest created successfully',
            })
        );
    });

    test('should return 403 if feature is not enabled', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(false);

        const mockRequest = req({ testName: 'Test Charger' });

        await controller.create(mockRequest, res);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Feature not enabled',
            })
        );
    });

    test('should return 500 if save fails', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        jest.spyOn(ChargerTest.prototype, 'save').mockRejectedValueOnce(new Error('Save failed'));

        const mockRequest = req({ testName: 'Test Charger' });

        await controller.create(mockRequest, res);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                "auth": false,
                "code": "internal_server_error",
                "message": "Internal server error"
            })
        );
    });
});
