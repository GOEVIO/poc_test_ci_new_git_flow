import { describe, test, jest, expect, afterEach } from '@jest/globals';
import * as AlarmsController from '../../../v2/alarms/controllers/alarms.controller';
import * as AlarmsService from '../../../v2/alarms/services/alarms.service';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

describe('AlarmsController - getAlarmsController', () => {
    const jsonMock = jest.fn();
    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ json: jsonMock, send: sendMock }));
    const res = { status: statusMock } as any;

    const req = (filters = {}, sort = 'timestamp', order = 1) => ({
        query: {
            _filters: filters,
            _sort: sort,
            _order: String(order),
        }
    }) as any;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return filtered alarms successfully', async () => {
        const mockAlarms = [{
            _id: '1',
            title: {
                code: 'alarm_code',
                message: 'Alarm message'
            },
            description: {
                code: 'desc_code',
                message: 'Detailed description'
            },
            timestamp: new Date().toISOString(),
            type: 'error',
            status: 'read',
            userId: 'user1',
            hwId: 'hw1',
            plugId: 'plug1',
            data: {
                connectorId: 1,
                status: 'Faulted',
                info: 'Some info'
            }
        }];

        jest.spyOn(AlarmsService, 'getAlarms').mockResolvedValue(mockAlarms as any);

        const mockReq = req({ type: 'error' });

        await AlarmsController.getAllAlarms(mockReq, res);

        expect(AlarmsService.getAlarms).toHaveBeenCalledWith({ type: 'error' }, 'timestamp', 1);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockAlarms);
    });

    test('should handle internal server error', async () => {
        const error = new Error('Unexpected');
        jest.spyOn(AlarmsService, 'getAlarms').mockRejectedValue(error);

        const mockReq = req({});

        await AlarmsController.getAllAlarms(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error'
        }));
    });
});
