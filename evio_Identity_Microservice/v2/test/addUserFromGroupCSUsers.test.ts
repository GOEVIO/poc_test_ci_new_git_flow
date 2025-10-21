import { describe, test, jest, expect, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { addUserFromGroupCSUsers } from '../controllers/addUserFromGroupCSUsers.controller';
import * as service from '../services/addUserFromGroupCSUsers.service';
import * as ErrorUtils from '../../utils';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

jest.mock('../../utils', () => {
    const actual = jest.requireActual<typeof import('../../utils')>('../../utils');
    return {
        ...actual,
        errorResponse: jest.fn(),
        ServerError: jest.fn((message: string, context: string) => ({ message, context })),
    };
});

describe('addUserFromGroupCSUsers controller', () => {
    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock } as unknown as Response;

    const req = (headers = {}, body = {}): Request =>
        ({
            headers,
            body,
        } as unknown as Request);

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should respond with status and data from service', async () => {
        const serviceResponse = {
            status: 200,
            data: { success: true },
        };

        jest
            .spyOn(service, 'addUserFromGroupCSUsersService')
            .mockResolvedValue(serviceResponse);

        const mockReq = req({ userid: 'user123' }, { _id: 'group123' });

        await addUserFromGroupCSUsers(mockReq, res);

        expect(service.addUserFromGroupCSUsersService).toHaveBeenCalledWith(
            { _id: 'group123' },
            'user123'
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith({ success: true });
    });

    test('should handle unexpected errors and return errorResponse', async () => {
        const error = new Error('Something went wrong');

        jest
            .spyOn(service, 'addUserFromGroupCSUsersService')
            .mockRejectedValue(error);

        const mockErrorResponse = {
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        };

        (ErrorUtils.errorResponse as jest.MockedFunction<typeof ErrorUtils.errorResponse>).mockImplementation(
            (_res, _err, _ctx) => {
                return res.status(500).send(mockErrorResponse);
            }
        );

        const mockReq = req({ userid: 'user123' }, { _id: 'group123' });

        await addUserFromGroupCSUsers(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(ErrorUtils.ServerError).toHaveBeenCalledWith('Something went wrong', 'PUT /api/private/groupCSUsers');
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(mockErrorResponse);
    });
});
