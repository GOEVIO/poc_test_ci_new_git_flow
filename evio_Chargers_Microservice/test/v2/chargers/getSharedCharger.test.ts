import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import axios from 'axios';
import * as ChargerV2Controller from '@/v2/chargers/controllers/sharedChargers.controller';
import Charger from '../../../models/charger';
import Infrastructure from '../../../models/infrastructure';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
jest.mock('axios');
const Sentry = require('@sentry/node');

describe('ChargerV2Controller - getSharedChargers', () => {
    let controller;
    const findMock = jest.spyOn(Charger, 'find');
    const findByIdMock = jest.spyOn(Infrastructure, 'findById');
    const mockAxiosGet = jest.mocked(axios.get);

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

    // Tests for _getGroupsCSUsersMap
    test('should return groups data on success', async () => {
        const userId = 'user1';
        const mockResponseData = [{ groupId: 'group1' }, { groupId: 'group2' }];

        mockAxiosGet.mockResolvedValueOnce({ data: mockResponseData });

        const result = await controller._getGroupsCSUsersMap(userId);

        expect(mockAxiosGet).toHaveBeenCalledWith(
            `${process.env.HostUser}${process.env.PathGetGroupCSUsersMap}`,
            { headers: { userid: userId } }
        );
        expect(result).toEqual(mockResponseData);
    });

    test('should return an empty array on error', async () => {
        const userId = 'user1';
        mockAxiosGet.mockRejectedValueOnce(new Error('Network Error'));

        const result = await controller._getGroupsCSUsersMap(userId);

        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(result).toEqual([]);
    });


    // Tests for _getEVsMap
    test('should return fleet IDs on success', async () => {
        const userId = 'user1';
        const mockResponseData = [{ fleet: 'fleet1' }, { fleet: 'fleet2' }];

        mockAxiosGet.mockResolvedValueOnce({ data: mockResponseData });

        const result = await controller._getEVsMap(userId);

        expect(mockAxiosGet).toHaveBeenCalledWith(
            `${process.env.HostEvs}${process.env.PathGetAllEVsByUser}`,
            { headers: { userid: userId } }
        );
        expect(result).toEqual(['fleet1', 'fleet2']);
    });

    test('should return an empty array when response data is empty', async () => {
        const userId = 'user1';
        mockAxiosGet.mockResolvedValueOnce({ data: [] });

        const result = await controller._getEVsMap(userId);

        expect(result).toEqual([]);
    });

    test('should return an empty array on error', async () => {
        const userId = 'user1';
        mockAxiosGet.mockRejectedValueOnce(new Error('Network Error'));

        const result = await controller._getEVsMap(userId);

        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(result).toEqual([]);
    });


    // Tests for getSharedChargers
    test('should return a list of shared chargers', async () => {
        const userId = 'user1';
        const mockGroups = ['group1', 'group2'];
        const mockFleets = ['fleet1'];

        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce(mockGroups);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce(mockFleets);

        const mockChargers = [
            {
                name: 'Charger1',
                hwId: 'hw1',
                active: true,
                accessType: 'Public',
                status: 'Available',
                infrastructure: 'infra1',
                plugs: [
                    {
                        plugId: 'plug1',
                        qrCodeId: 'qr1',
                        status: 'In Use',
                        statusChangeDate: new Date().toISOString(),
                    },
                ],
            },
        ];

        findMock.mockResolvedValueOnce(mockChargers);
        findByIdMock.mockResolvedValueOnce({ name: 'Location1' });

        const mockRequest = req({ page: '1', limit: '10', sort: 'name', order: 'asc' }, { userid: userId });
        await controller.getSharedChargers(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.any(Array),
                totalChargers: 1,
                totalPlugs: 1,
            })
        );
    });

    test('should return 400 if userId is missing', async () => {
        const mockRequest = req({}, {});

        await controller.getSharedChargers(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({ message: 'User ID is required' });
    });

    test('should return empty list if no groups or fleets are found', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockResolvedValueOnce([]);
        jest.spyOn(controller, '_getEVsMap').mockResolvedValueOnce([]);

        const mockRequest = req({}, { userid: 'user1' });
        await controller.getSharedChargers(mockRequest, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: [],
                totalChargers: 0,
                totalPlugs: 0,
            })
        );
    });

    test('should handle errors gracefully', async () => {
        jest.spyOn(controller, '_getGroupsCSUsersMap').mockRejectedValueOnce(new Error('Test Error'));

        const mockRequest = req({}, { userid: 'user1' });
        await controller.getSharedChargers(mockRequest, res);

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
