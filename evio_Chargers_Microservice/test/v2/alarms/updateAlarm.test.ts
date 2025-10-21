import { describe, test, jest, expect, afterEach } from '@jest/globals';
import * as AlarmsController from '../../../v2/alarms/controllers/alarms.controller';
import * as AlarmsService from '../../../v2/alarms/services/alarms.service';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

describe('AlarmsController - patchAlarmStatus', () => {
    const sendMock = jest.fn();
    const jsonMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock, json: jsonMock }));
    const res = { status: statusMock } as any;

    const req = (params = {}, body = {}) => ({
        params,
        body,
    }) as any;

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should update alarm status successfully', async () => {
        const updatedAlarm = {
            id: 123,
            title: {
                code: 'alarm_error_meter_stop_lower_meter_start_title',
                message: 'Invalid meterStop value',
            },
            description: {
                code: 'alarm_error_meter_stop_lower_meter_start_description',
                message:
                    'Invalid meterStop value. Final reading cannot be lower than meterStart. Please contact your operator or maintenance partner to check the equipment',
            },
            timestamp: new Date(),
            type: 'error',
            status: 'unread',
            userId: 'user123',
            hwId: 'hw456',
            plugId: 'plug789',
            data: {
                connectorId: 2,
                errorCode: 'PowerSwitchFailure',
                info: 'Power switch error',
                status: 'Faulted',
                vendorErrorCode: '102',
            },
        };

        jest.spyOn(AlarmsService, 'updateAlarmStatus').mockResolvedValue(updatedAlarm as any);

        const mockReq = req({ id: '123' }, { status: 'read' });

        await AlarmsController.updateAlarm(mockReq, res);

        expect(AlarmsService.updateAlarmStatus).toHaveBeenCalledWith('123', 'read');
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(updatedAlarm);
    });

    test('should return 404 if alarm not found', async () => {
        jest.spyOn(AlarmsService, 'updateAlarmStatus').mockResolvedValue(null);

        const mockReq = req({ id: '999' }, { status: 'read' });

        await AlarmsController.updateAlarm(mockReq, res);

        expect(AlarmsService.updateAlarmStatus).toHaveBeenCalledWith('999', 'read');
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_alarm_not_found',
            message: 'Alarm not found',
        });
    });

    test('should handle internal server error', async () => {
        const error = new Error('Database failed');
        jest.spyOn(AlarmsService, 'updateAlarmStatus').mockRejectedValue(error);

        const mockReq = req({ id: '123' }, { status: 'unread' });

        await AlarmsController.updateAlarm(mockReq, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        }));
    });
});
