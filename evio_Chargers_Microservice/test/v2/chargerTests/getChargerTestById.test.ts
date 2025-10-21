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

describe('ChargerTestController - getAll', () => {
    let controller: ChargerTestController;

    let findMock: jest.SpiedFunction<typeof ChargerTest.find>;

    const makeReq = () => ({} as unknown as Request);

    let sendMock: jest.Mock;
    let statusMock: jest.Mock;
    let res: Partial<Response>;

    beforeEach(() => {
        controller = new ChargerTestController();

        // cria um spy fresco por teste
        findMock = jest.spyOn(ChargerTest, 'find');

        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ send: sendMock }));
        res = { status: statusMock } as unknown as Response;
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should retrieve all ChargerTests successfully', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);

        findMock.mockResolvedValueOnce([
            { _id: '1', name: 'Test Charger 1' },
            { _id: '2', name: 'Test Charger 2' },
        ] as any);

        await controller.getAll(makeReq(), res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findMock).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'ChargerTests retrieved successfully',
                data: expect.arrayContaining([
                    expect.objectContaining({ _id: '1', name: 'Test Charger 1' }),
                    expect.objectContaining({ _id: '2', name: 'Test Charger 2' }),
                ]),
            }),
        );
    });

    test('should return 403 if feature is not enabled', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(false);

        await controller.getAll(makeReq(), res as Response);

        expect(toggle.isEnable).toHaveBeenCalledWith('charge-118');
        expect(findMock).not.toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Feature not enabled',
            }),
        );
    });

    test('should return 500 if find fails', async () => {
        jest.mocked(toggle.isEnable).mockResolvedValueOnce(true);
        findMock.mockRejectedValueOnce(new Error('Database query failed'));

        await controller.getAll(makeReq(), res as Response);

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
