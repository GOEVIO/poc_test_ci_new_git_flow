import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import * as ChargerV2Controller from '@/v2/chargers/controllers/sharedChargers.controller';
import Charger from '../../../models/charger';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

// Mock for database methods
const findOneMock = jest.spyOn(Charger, 'findOne');

describe('ChargerV2Controller - getSharedChargerQRCode', () => {
    let controller;

    const req = (query = {}, headers = {}) => ({
        query,
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

    test('should return QR code details if a valid QR Code ID is provided', async () => {
        const mockQRCodeId = 'qr1';
        const mockUserId = 'user1';

        const mockSharedCharger = {
            hwId: 'hw1',
            plugs: [
                {
                    qrCodeId: mockQRCodeId,
                    connectorId: 'connector1',
                },
            ],
        };

        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce(mockSharedCharger);

        const mockRequest = req({ qrCodeId: mockQRCodeId }, { userid: mockUserId });

        await controller.getSharedChargerQRCode(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith({
            qrCodeId: mockQRCodeId,
            link: `${process.env.BaseURL}/sharedchargers/qrcode/${mockQRCodeId}`,
            chargerId: mockSharedCharger.hwId,
            connectorId: 'connector1',
        });
    });

    test('should return 400 if userId is missing', async () => {
        const mockRequest = req({ qrCodeId: 'qr1' }, {});

        await controller.getSharedChargerQRCode(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'User ID is required' });
    });

    test('should return 400 if QR Code ID is missing', async () => {
        const mockRequest = req({}, { userid: 'user1' });

        await controller.getSharedChargerQRCode(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'QR Code ID is required' });
    });

    test('should return 404 if no shared chargers are found for the user', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce([]);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce([]);

        const mockRequest = req({ qrCodeId: 'qr1' }, { userid: 'user1' });

        await controller.getSharedChargerQRCode(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(sendMock).toHaveBeenCalledWith({ message: 'No shared chargers found for this user' });
    });

    test('should return 404 if shared charger is not found for the provided QR Code ID', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce(null);

        const mockRequest = req({ qrCodeId: 'qr1' }, { userid: 'user1' });

        await controller.getSharedChargerQRCode(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Shared charger not found for the provided QR Code ID' });
    });

    test('should return 404 if no plug is associated with the QR Code ID', async () => {
        const mockQRCodeId = 'qr1';

        const mockSharedCharger = {
            hwId: 'hw1',
            plugs: [
                {
                    qrCodeId: 'qr2', // Different QR Code ID
                    connectorId: 'connector1',
                },
            ],
        };

        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce(mockSharedCharger);

        const mockRequest = req({ qrCodeId: mockQRCodeId }, { userid: 'user1' });

        await controller.getSharedChargerQRCode(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Plug associated with this QR Code not found' });
    });

    test('should handle unexpected errors gracefully', async () => {
        const mockError = new Error('Test Error');

        jest.spyOn(controller, '_getGroupsCSUsersMap').mockRejectedValueOnce(mockError);

        const mockRequest = req({ qrCodeId: 'qr1' }, { userid: 'user1' });

        await controller.getSharedChargerQRCode(mockRequest, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(mockError);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            message: 'Unexpected error',
            error: mockError.message,
        });
    });
});
