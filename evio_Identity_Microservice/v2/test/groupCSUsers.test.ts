import { describe, test, jest, expect, afterEach } from '@jest/globals';
import * as GroupCSUsersController from '../../v2/controllers/groupCSUsers.controller';
import * as GroupCSUsersService from '../../v2/services/groupCSUsers.service';
import * as ErrorUtils from '../../utils';
import { Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

// ✅ Mock para tornar errorResponse testável
jest.mock('../../utils', () => {
    const actual = jest.requireActual<typeof import('../../utils')>('../../utils');
    return {
        ...actual,
        errorResponse: jest.fn(),
    };
});

describe('GroupCSUsersController', () => {
    const jsonMock = jest.fn();
    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ json: jsonMock, send: sendMock }));
    const res = { status: statusMock } as unknown as Response;

    const req = (headers = {}) => ({
        headers,
    }) as any;

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getGroupCSUsers', () => {
        test('should return groupCSUsers successfully', async () => {
            const mockGroups = [
                {
                    _id: 'group1',
                    name: 'Group One',
                    createUser: 'user123',
                    imageContent: 'base64img',
                    listOfUsers: [
                        { _id: 'user1', name: 'Raquel', userId: 'user1', mobile: '91234', internationalPrefix: '+351', admin: false },
                    ],
                },
            ];

            jest
                .spyOn(GroupCSUsersService, 'getGroupCSUsersService')
                .mockResolvedValue(mockGroups);

            const mockReq = req({ userid: 'user123' });

            await GroupCSUsersController.getGroupCSUsers(mockReq, res);

            expect(GroupCSUsersService.getGroupCSUsersService).toHaveBeenCalledWith('user123');
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(mockGroups);
        });

        test('should handle errors in getGroupCSUsers', async () => {
            const error = new Error('Database error');

            jest
                .spyOn(GroupCSUsersService, 'getGroupCSUsersService')
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

            const mockReq = req({ userid: 'user123' });

            await GroupCSUsersController.getGroupCSUsers(mockReq, res);

            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(sendMock).toHaveBeenCalledWith(mockErrorResponse);
        });
    });
});
