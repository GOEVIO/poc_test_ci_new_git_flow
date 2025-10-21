import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { SwitchBoardController } from '../../../v2/switchboards/controller';
import SwitchBoard from '../../../models/switchBoards';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('SwitchBoardController - getSwitchBoard', () => {
    let controller: SwitchBoardController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new SwitchBoardController();
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

    test('should return a list of switchboards successfully (no filters)', async () => {
        const switchBoardsMock = [
            { _id: 'mocked-id-1', name: 'SwitchBoard 1', controllerId: 'controller-123' },
            { _id: 'mocked-id-2', name: 'SwitchBoard 2', controllerId: 'controller-456' },
        ];

        const findSpy = jest.spyOn(SwitchBoard, 'find').mockResolvedValue(switchBoardsMock as any);

        await controller.getSwitchBoard(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({});
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(switchBoardsMock);
    });

    test('should apply filters from query (name & controllerId)', async () => {
        req.query = { name: 'SwitchBoard 1', controllerId: 'controller-123' };

        const filtered = [{ _id: 'mocked-id-1', name: 'SwitchBoard 1', controllerId: 'controller-123' }];
        const findSpy = jest.spyOn(SwitchBoard, 'find').mockResolvedValue(filtered as any);

        await controller.getSwitchBoard(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({ name: 'SwitchBoard 1', controllerId: 'controller-123' });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(filtered);
    });

    test('should return an empty list if no switchboards exist', async () => {
        const findSpy = jest.spyOn(SwitchBoard, 'find').mockResolvedValue([] as any);

        await controller.getSwitchBoard(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({});
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith([]);
    });

    test('should handle unexpected errors', async () => {
        const error = new Error('Database connection failed');
        jest.spyOn(SwitchBoard, 'find').mockRejectedValue(error as any);

        await controller.getSwitchBoard(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
