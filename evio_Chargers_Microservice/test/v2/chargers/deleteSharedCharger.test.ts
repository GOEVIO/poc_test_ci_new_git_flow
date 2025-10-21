import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import * as ChargerV2Controller from '@/v2/chargers/controllers/sharedChargers.controller';
import Charger from '../../../models/charger';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

// Mock for database methods
const deleteOneMock = jest.spyOn(Charger, 'deleteOne');
const findOneMock = jest.spyOn(Charger, 'findOne');

describe('ChargerV2Controller - deleteSharedCharger', () => {
    let controller;

    const req = (body = {}, headers = {}) => ({
        body,
        headers,
    });

    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock };

    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        controller = ChargerV2Controller;
    });

    test('should delete a shared charger successfully', async () => {
        const mockChargerId = 'charger1';
        const mockUserId = 'user1';

        const mockSharedCharger = {
            _id: mockChargerId,
            listOfGroups: [{ groupId: 'group1' }],
            active: true,
            plugs: [],
        };

        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce(mockSharedCharger);
        deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });

        const mockRequest = req({ _id: mockChargerId }, { userid: mockUserId });

        await controller.deleteSharedCharger(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Shared charger deleted successfully' });
        expect(deleteOneMock).toHaveBeenCalledWith({ _id: mockChargerId });
    });

    test('should return 400 if userId is missing', async () => {
        const mockRequest = req({ _id: 'charger1' }, {});

        await controller.deleteSharedCharger(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'User ID is required' });
    });

    test('should return 400 if charger ID is missing', async () => {
        const mockRequest = req({}, { userid: 'user1' });

        await controller.deleteSharedCharger(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Charger ID (_id) is required in the request body' });
    });

    test('should return 404 if shared charger is not found or unauthorized', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce(null);

        const mockRequest = req({ _id: 'charger1' }, { userid: 'user1' });

        await controller.deleteSharedCharger(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Shared charger not found or unauthorized access' });
    });

    test('should return 400 if any plug is in use', async () => {
        const mockChargerId = 'charger1';
        const mockUserId = 'user1';

        const mockSharedCharger = {
            _id: mockChargerId,
            listOfGroups: [{ groupId: 'group1' }],
            active: true,
            plugs: [
                { plugId: 'plug1', status: process.env.PlugsStatusInUse },
            ],
        };

        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce(mockSharedCharger);

        const mockRequest = req({ _id: mockChargerId }, { userid: mockUserId });

        await controller.deleteSharedCharger(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            message: 'Charger cannot be deleted as it has plugs currently in use',
        });
    });

    test('should handle unexpected errors gracefully', async () => {
        const mockError = new Error('Test Error');

        jest.spyOn(controller, '_getGroupsCSUsersMap').mockRejectedValueOnce(mockError);

        const mockRequest = req({ _id: 'charger1' }, { userid: 'user1' });

        await controller.deleteSharedCharger(mockRequest, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            message: 'Unexpected error',
            error: mockError.message,
        });
    });
});
