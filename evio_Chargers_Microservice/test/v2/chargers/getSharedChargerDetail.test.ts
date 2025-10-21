import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import * as ChargerV2Controller from '@/v2/chargers/controllers/sharedChargers.controller';
import Charger from '../../../models/charger';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

describe('ChargerV2Controller - getSharedChargerDetail', () => {
    let controller;
    const findOneMock = jest.spyOn(Charger, 'findOne');

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

    test('should return 400 if userId is missing', async () => {
        const mockRequest = req({ chargerId: 'charger1' }, {});

        await controller.getSharedChargerDetail(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'User ID is required' });
    });

    test('should return 400 if chargerId is missing', async () => {
        const mockRequest = req({}, { userid: 'user1' });

        await controller.getSharedChargerDetail(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Charger ID is required' });
    });

    test('should return 404 if no groups or fleets are found', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce([]);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce([]);

        const mockRequest = req({ chargerId: 'charger1' }, { userid: 'user1' });

        await controller.getSharedChargerDetail(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(sendMock).toHaveBeenCalledWith({ message: 'No shared chargers found for this user' });
    });

    test('should return 404 if charger is not found', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce(null);

        const mockRequest = req({ chargerId: 'charger1' }, { userid: 'user1' });

        await controller.getSharedChargerDetail(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Charger not found or unauthorized access' });
    });

    test('should return 400 if model or vendor is not found', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce({
            hwId: 'charger1',
            vendor: 'vendor1',
            model: 'model1',
            hasInfrastructure: true,
            active: true,
        });

        jest.spyOn(controller, '_getModelByVendorAndModel').mockResolvedValueOnce(null);

        const mockRequest = req({ chargerId: 'charger1' }, { userid: 'user1' });

        await controller.getSharedChargerDetail(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'Model or vendor not found' });
    });

    test('should return charger details on success', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(['group1']);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(['fleet1']);

        findOneMock.mockResolvedValueOnce({
            hwId: 'charger1',
            vendor: 'vendor1',
            model: 'model1',
            hasInfrastructure: true,
            active: true,
            address: {
                street: '123 Main St',
                city: 'Anytown',
                state: 'State',
                country: 'Country',
            },
            geometry: { coordinates: [10, 20] },
            infrastructure: 'Infra1',
            facilitiesTypes: [{ facility: 'Facility1' }],
            parkingType: 'Garage',
            plugs: [
                {
                    plugId: 'plug1',
                    imageUrl: 'image.jpg',
                    current: '10A',
                    voltage: '220V',
                    power: '2.2kW',
                },
            ],
        });

        jest.spyOn(controller, '_getModelByVendorAndModel').mockResolvedValueOnce({
            manufacturer: 'VendorName',
            models: [{ model: 'model1' }],
        });

        const mockRequest = req({ chargerId: 'charger1' }, { userid: 'user1' });

        await controller.getSharedChargerDetail(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    chargerId: 'charger1',
                    address: '123 Main St, Anytown, State, Country',
                    latitude: 20,
                    longitude: 10,
                }),
            })
        );
    });

    test('should handle unexpected errors', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockRejectedValueOnce(new Error('Test Error'));

        const mockRequest = req({ chargerId: 'charger1' }, { userid: 'user1' });

        await controller.getSharedChargerDetail(mockRequest, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Unexpected error',
                error: 'Test Error',
            })
        );
    });
});
