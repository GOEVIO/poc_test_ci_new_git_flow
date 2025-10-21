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

describe('ChargerTestController - delete', () => {
    let controller: ChargerTestController;

    let findByIdAndDeleteMock: jest.SpiedFunction<typeof ChargerTest.findByIdAndDelete>;

    const makeReq = (params = {}) =>
        ({ params } as unknown as Request);

    let sendMock: jest.Mock;
    let statusMock: jest.Mock;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new ChargerTestController();

        // recria spies e mocks por teste para isolamento
        findByIdAndDeleteMock = jest.spyOn(ChargerTest, 'findByIdAndDelete');

        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ send: sendMock }));
        res = { status: statusMock } as unknown as Response;

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should delete a ChargerTest successfully', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        findByIdAndDeleteMock.mockResolvedValueOnce({ _id: '1', name: 'Test Charger' } as any);

        const req = makeReq({ id: '1' });

        await controller.delete(req, res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findByIdAndDeleteMock).toHaveBeenCalledWith('1');
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'ChargerTest deleted successfully' }),
        );
    });

    test('should return 403 if feature is not enabled', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(false);

        const req = makeReq({ id: '1' });

        await controller.delete(req, res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findByIdAndDeleteMock).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Feature not enabled' }),
        );
    });

    test('should return 400 if ChargerTest is not found', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        findByIdAndDeleteMock.mockResolvedValueOnce(null);

        const req = makeReq({ id: '1' });

        await controller.delete(req, res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findByIdAndDeleteMock).toHaveBeenCalledWith('1');
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_charger_test_not_found',
            message: 'Could not find the ChargerTest record with the provided ID.',
        });
    });

    test('should return 500 if an error occurs', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        findByIdAndDeleteMock.mockRejectedValueOnce(new Error('Database error'));

        const req = makeReq({ id: '1' });

        await controller.delete(req, res as Response);

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
