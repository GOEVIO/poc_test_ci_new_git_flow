import { describe, test, jest, expect, afterEach } from '@jest/globals';
import { addGroupCSUsers } from '../controllers/addGroupCSUsers.controller';
import * as AddService from '../../v2/services/addGroupCSUsers.service';
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

describe('addGroupCSUsers controller', () => {
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

    test('should create group successfully', async () => {
        const serviceResponse = {
            status: 200,
            data: {
                _id: 'group123',
                name: 'Grupo CS',
                listOfUsers: [],
            },
        };

        jest
            .spyOn(AddService, 'addGroupCSUsersService')
            .mockResolvedValue(serviceResponse);

        const mockReq = req({ userid: 'user123', clientname: 'clientA' }, { name: 'Grupo CS', listOfUsers: [] });

        await addGroupCSUsers(mockReq, res);

        expect(AddService.addGroupCSUsersService).toHaveBeenCalledWith(
            { name: 'Grupo CS', listOfUsers: [] },
            'user123',
            'clientA'
        );
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(serviceResponse.data);
    });

    test('should handle service rejection with a structured error', async () => {
        const error = {
            message: 'Group not created',
            code: 'server_group_not_created',
        };

        jest
            .spyOn(AddService, 'addGroupCSUsersService')
            .mockRejectedValue(error);

        const mockErrorResponse = {
            auth: false,
            code: 'internal_server_error',
            message: 'Group not created',
        };

        (ErrorUtils.errorResponse as jest.MockedFunction<typeof ErrorUtils.errorResponse>).mockImplementation(
            (res: Response, _err, _ctx) => {
                return res.status(500).send(mockErrorResponse);
            }
        );

        const mockReq = req({ userid: 'user123', clientname: 'clientA' }, { name: 'Grupo CS' });

        await addGroupCSUsers(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(mockErrorResponse);
    });

    test('should handle unexpected errors', async () => {
        const error = new Error('Unexpected failure');

        jest
            .spyOn(AddService, 'addGroupCSUsersService')
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

        const mockReq = req({ userid: 'user123', clientname: 'clientA' }, { name: 'Grupo CS' });

        await addGroupCSUsers(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(mockErrorResponse);
    });
});
