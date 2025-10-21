import { describe, test, expect, jest, afterEach } from '@jest/globals';
import { deleteUserFromGroupCSUsers } from '../../v2/controllers/deleteUserFromGroupCSUsers.controller';
import * as DeleteUserService from '../../v2/services/deleteUserFromGroupCSUsers.service';
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

describe('deleteUserFromGroupCSUsers controller', () => {
    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock } as unknown as Response;

    const req = (headers = {}, body = {}) => ({
        headers,
        body,
    }) as any;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should remove user from group successfully', async () => {
        const serviceResponse = {
            status: 200,
            data: {
                auth: true,
                code: 'user_removed_successfully',
                message: 'User removed from group',
            },
        };

        jest
            .spyOn(DeleteUserService, 'deleteUserFromGroupCSUsersService')
            .mockResolvedValue(serviceResponse);

        const mockReq = req({ userid: 'user123' }, { groupId: 'group1', userIdToRemove: 'user456' });

        await deleteUserFromGroupCSUsers(mockReq, res);

        expect(DeleteUserService.deleteUserFromGroupCSUsersService).toHaveBeenCalledWith(
            { groupId: 'group1', userIdToRemove: 'user456' },
            'user123'
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(serviceResponse.data);
    });

    test('should handle service returning 400', async () => {
        const serviceResponse = {
            status: 400,
            data: {
                auth: false,
                code: 'group_or_user_not_found',
                message: 'The specified user or group was not found.',
            },
        };

        jest
            .spyOn(DeleteUserService, 'deleteUserFromGroupCSUsersService')
            .mockResolvedValue(serviceResponse);

        const mockReq = req({ userid: 'user123' }, { groupId: 'invalid', userIdToRemove: 'user456' });

        await deleteUserFromGroupCSUsers(mockReq, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith(serviceResponse.data);
    });

    test('should handle unexpected errors', async () => {
        const error = new Error('Unexpected failure');

        jest
            .spyOn(DeleteUserService, 'deleteUserFromGroupCSUsersService')
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

        const mockReq = req({ userid: 'user123' }, { groupId: 'group1', userIdToRemove: 'user456' });

        await deleteUserFromGroupCSUsers(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(mockErrorResponse);
    });
});
