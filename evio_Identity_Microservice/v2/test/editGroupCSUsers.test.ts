import { describe, test, jest, expect, afterEach } from '@jest/globals';
import { editGroupCSUsers } from '../controllers/editGroupCSUsers.controller';
import * as EditService from '../../v2/services/editGroupCSUsers.service';
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

describe('editGroupCSUsers controller', () => {
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

    test('should edit group successfully', async () => {
        const serviceResponse = {
            status: 200,
            data: { message: 'Group edited successfully' },
        };

        jest
            .spyOn(EditService, 'editGroupCSUsersService')
            .mockResolvedValue(serviceResponse);

        const mockReq = req({ userid: 'user123' }, { _id: 'group1', name: 'New name' });

        await editGroupCSUsers(mockReq, res);

        expect(EditService.editGroupCSUsersService).toHaveBeenCalledWith({ _id: 'group1', name: 'New name' }, 'user123');
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(serviceResponse.data);
    });

    test('should handle unexpected errors', async () => {
        const error = new Error('Unexpected failure');

        jest
            .spyOn(EditService, 'editGroupCSUsersService')
            .mockRejectedValue(error);

        const mockErrorResponse = {
            auth: false,
            code: 'internal_server_error',
            message: 'Unexpected failure',
        };

        (ErrorUtils.errorResponse as jest.MockedFunction<typeof ErrorUtils.errorResponse>).mockImplementation(
            (res: Response, _err, _ctx) => {
                return res.status(500).send(mockErrorResponse);
            }
        );

        const mockReq = req({ userid: 'user123' }, { _id: 'group1', name: 'New name' });

        await editGroupCSUsers(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(mockErrorResponse);
    });
});
