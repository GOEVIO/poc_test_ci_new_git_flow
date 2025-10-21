import { describe, test, jest, expect, afterEach } from '@jest/globals';
import * as AlarmsController from '../../../v2/alarms/controllers/alarms.controller';
import * as AlarmsService from '../../../v2/alarms/services/alarms.service';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

describe('AlarmsController', () => {
    const sendMock = jest.fn();
    const jsonMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock, json: jsonMock }));
    const res = { status: statusMock } as any;

    const req = (body = {}) => ({ body } as any);

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createAlarms', () => {
        test('should create an alarm successfully', async () => {
            const newAlarm = {
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

            jest.spyOn(AlarmsService, 'createAlarm').mockResolvedValue(newAlarm as any);

            const mockReq = req(newAlarm);

            await AlarmsController.createAlarms(mockReq, res);

            expect(AlarmsService.createAlarm).toHaveBeenCalledWith(newAlarm);
            expect(statusMock).toHaveBeenCalledWith(201);
            expect(jsonMock).toHaveBeenCalledWith(newAlarm);
        });

        test('should handle errors when creating an alarm', async () => {
            const error = new Error('DB write failed');
            jest.spyOn(AlarmsService, 'createAlarm').mockRejectedValue(error);

            const mockReq = req({
                title: { code: 'test_code', message: 'test message' },
                description: { code: 'test_code', message: 'test message' },
                timestamp: new Date(),
                type: 'error',
                status: 'unread',
                userId: 'user123',
                hwId: 'hw456',
                plugId: 'plug789',
                data: {},
            });

            await AlarmsController.createAlarms(mockReq, res);

            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
                auth: false,
                code: 'internal_server_error',
                message: 'Internal server error',
            }));
        });
    });
});
