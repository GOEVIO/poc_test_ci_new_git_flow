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

describe('ChargerTestController - update', () => {
    let controller: ChargerTestController;

    let findByIdAndUpdateMock: jest.SpiedFunction<typeof ChargerTest.findByIdAndUpdate>;

    const makeReq = (params = {}, body = {}) =>
        ({ params, body } as unknown as Request);

    let sendMock: jest.Mock;
    let statusMock: jest.Mock;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new ChargerTestController();

        findByIdAndUpdateMock = jest.spyOn(ChargerTest, 'findByIdAndUpdate');

        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ send: sendMock }));
        res = { status: statusMock } as unknown as Response;
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should update a ChargerTest successfully', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        findByIdAndUpdateMock.mockResolvedValueOnce({ _id: '1', name: 'Updated Test Charger' } as any);

        const req = makeReq({ id: '1' }, { name: 'Updated Test Charger' });

        await controller.update(req, res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findByIdAndUpdateMock).toHaveBeenCalledWith('1', { name: 'Updated Test Charger' }, { new: true });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'ChargerTest updated successfully',
                data: expect.objectContaining({ _id: '1', name: 'Updated Test Charger' }),
            }),
        );
    });

    test('should return 403 if feature is not enabled', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(false);

        const req = makeReq({ id: '1' }, { name: 'Updated Test Charger' });

        await controller.update(req, res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findByIdAndUpdateMock).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Feature not enabled',
            }),
        );
    });

    test('should return 400 if ChargerTest is not found', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        findByIdAndUpdateMock.mockResolvedValueOnce(null);

        const req = makeReq({ id: '1' }, { name: 'Updated Test Charger' });

        await controller.update(req, res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findByIdAndUpdateMock).toHaveBeenCalledWith('1', { name: 'Updated Test Charger' }, { new: true });
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_charger_test_not_found',
            message: 'Could not find the ChargerTest record with the provided ID.',
        });
    });

    test('should return 500 if an error occurs', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        findByIdAndUpdateMock.mockRejectedValueOnce(new Error('Database error'));

        const req = makeReq({ id: '1' }, { name: 'Updated Test Charger' });

        await controller.update(req, res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    });
});
