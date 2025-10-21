import { describe, test, jest, expect, afterEach } from '@jest/globals';
import { deleteGroupCSUsers } from '../controllers/deleteGroupCSUsers.controller';
import * as DeleteService from '../../v2/services/deleteGroupCSUsers.service';
import * as ErrorUtils from '../../utils';
import { Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

jest.mock('../../utils', () => {
    const actual = jest.requireActual<typeof import('../../utils')>('../../utils');
    return {
        ...actual,
        errorResponse: jest.fn(),
    };
});

describe('deleteGroupCSUsers controller', () => {
    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock } as any;

    const req = (headers = {}, body = {}) => ({
        headers,
        body,
    }) as any;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should delete group successfully', async () => {
        const serviceResponse = {
            status: 200,
            data: {
                auth: true,
                code: 'server_groupCSUsers_successfully_removed',
                message: 'Group of charger station users successfully removed',
            },
        };

        jest
            .spyOn(DeleteService, 'deleteGroupCSUsersService')
            .mockResolvedValue(serviceResponse);

        const mockReq = req({ userid: 'user123' }, { _id: 'group1' });

        await deleteGroupCSUsers(mockReq, res);

        expect(DeleteService.deleteGroupCSUsersService).toHaveBeenCalledWith({ _id: 'group1' }, 'user123');
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(serviceResponse);
    });

    test('should handle service returning 400', async () => {
        const serviceResponse = {
            status: 400,
            data: {
                auth: false,
                code: 'server_group_drivers_not_found',
                message: 'Group drivers not found for given parameters',
            },
        };

        jest
            .spyOn(DeleteService, 'deleteGroupCSUsersService')
            .mockResolvedValue(serviceResponse);

        const mockReq = req({ userid: 'user123' }, { _id: 'nonexistent' });

        await deleteGroupCSUsers(mockReq, res);

        expect(DeleteService.deleteGroupCSUsersService).toHaveBeenCalledWith({ _id: 'nonexistent' }, 'user123');
        expect(statusMock).toHaveBeenCalledWith(200); // Controller always returns 200
        expect(sendMock).toHaveBeenCalledWith(serviceResponse);
    });

    test('should handle unexpected errors', async () => {
        const error = new Error('Unexpected failure');

        jest
            .spyOn(DeleteService, 'deleteGroupCSUsersService')
            .mockRejectedValue(error);

        const mockErrorResponse = {
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        };

        (ErrorUtils.errorResponse as jest.MockedFunction<typeof ErrorUtils.errorResponse>).mockImplementation(
            (res: Response, _err, _ctx) => {
                return res.status(500).send(mockErrorResponse);
            }
        );

        const mockReq = {
            headers: { userid: 'user123' },
            body: { _id: 'group1' },
        } as any;

        const sendMock = jest.fn();
        const statusMock = jest.fn(() => ({ send: sendMock }));
        const res = { status: statusMock } as any;

        await deleteGroupCSUsers(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(mockErrorResponse);
    });
});
