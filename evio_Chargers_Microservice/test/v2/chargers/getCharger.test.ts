import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import * as ChargerV2Controller from '@/v2/chargers/filter/controller';
import Charger from '../../../models/charger';
import Infrastructure from '../../../models/infrastructure';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

describe('ChargerV2Controller - getChargers', () => {
    let controller;
    const findMock = jest.spyOn(Charger, 'find');
    const distinctMock = jest.spyOn(Charger, 'distinct');
    const findByIdMock = jest.spyOn(Infrastructure, 'findById');

    const req = (query = {}) => ({
        query,
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

    beforeEach(() => {
        distinctMock.mockImplementation((field) => {
            const mockData = {
                state: ['Active', 'Inactive'],
                accessType: ['Public', 'Private'],
                status: ['Available', 'Unavailable'],
                'plugs.status': ['Charging', 'Disconnected'],
            };
            return Promise.resolve(mockData[field] || []);
        });
    });

    test('should return chargers filtered by state and accessibility', async () => {
        findMock.mockResolvedValue([{
            hwId: '123',
            name: 'Charger1',
            active: true,
            accessType: 'Public',
            status: 'Available',
            infrastructure: 'infra1',
            plugs: [{ status: 'Charging' }],
        }]);

        findByIdMock.mockResolvedValue({ name: 'Location1' });

        const mockRequest = req({ state: 'Active', accessibility: 'Public' });
        await controller.get(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ totalChargers: 1 }));
    });

    test('should return chargers filtered by chargerStatus and connectorStatus', async () => {
        findMock.mockResolvedValue([{
            hwId: '456',
            name: 'Charger2',
            active: false,
            accessType: 'Private',
            status: 'Unavailable',
            infrastructure: 'infra2',
            plugs: [{ status: 'Disconnected' }],
        }]);

        findByIdMock.mockResolvedValue({ name: 'Location2' });

        const mockRequest = req({ chargerStatus: 'Unavailable', connectorStatus: 'Disconnected' });
        await controller.get(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ totalChargers: 1 }));
    });

    test('should return chargers filtered by state only', async () => {
        findMock.mockResolvedValue([{
            hwId: '789',
            name: 'Charger3',
            active: true,
            accessType: 'Public',
            status: 'Available',
            infrastructure: 'infra3',
            plugs: [{ status: 'Charging' }],
        }]);

        findByIdMock.mockResolvedValue({ name: 'Location3' });

        const mockRequest = req({ state: 'Active' });
        await controller.get(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ totalChargers: 1 }));
    });

    test('should return all chargers when no filters are applied', async () => {
        findMock.mockResolvedValue([
            { hwId: '111', name: 'ChargerA', plugs: [] },
            { hwId: '222', name: 'ChargerB', plugs: [] },
        ]);

        findByIdMock.mockResolvedValue({ name: 'LocationA' });

        const mockRequest = req({});
        await controller.get(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ totalChargers: 2 }));
    });

    test('should handle 500 error gracefully', async () => {
        const errorMessage = 'Unexpected error';

        findMock.mockImplementation(() => {
            throw new Error(errorMessage);
        });

        const mockRequest = req({ page: '1', limit: '10', userId: 'user1' });
        await controller.get(mockRequest, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Unexpected error',
                error: errorMessage,
            })
        );
    });
});
