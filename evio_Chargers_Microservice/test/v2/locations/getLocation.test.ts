import {describe, test, afterEach, jest, expect, beforeEach} from '@jest/globals';
import { Request, Response } from 'express';
import mongoose from 'mongoose';

import { LocationsV2Controller } from '../../../v2/locations/controller';
import Infrastructure from '../../../models/infrastructure';
import Charger from '../../../models/charger';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

jest.mock('evio-library-identity');

describe('v2/locations/controller.ts LocationsV2Controller.getLocations', () => {
    let controller;
    const findMock = jest.spyOn(Infrastructure, 'find');
    const chargerFindMock = jest.spyOn(Charger, 'find');

    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock };

    const req = (query = {}, userid = 'userid') => ({
        query,
        headers: {
            userid,
        },
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
        controller = new LocationsV2Controller();
    });

    test('should return filters when inputText is provided', () => {
        const inputText = 'charger123';
        const result = controller['_InputTextLocationsFilters'](inputText);

        expect(result).toEqual([
            { name: { $regex: inputText, $options: 'i' } },
            { CPE: { $regex: inputText, $options: 'i' } },
            { 'listChargers.hwId': { $regex: inputText, $options: 'i' } },
            { 'listChargers.name': { $regex: inputText, $options: 'i' } },
            { 'listChargers.plugs.qrCodeId': { $regex: inputText, $options: 'i' } },
        ]);
    });

    test('should return empty filter object when inputText is empty', () => {
        const inputText = '';
        const result = controller['_InputTextLocationsFilters'](inputText);

        expect(result).toEqual([{}]);
    });

    test('Should return locations with chargers and plugs, including total filters and locations', async () => {
        const locations = [
            {
                _id: 'loc1',
                name: 'Location 1',
                CPE: 'CPE1',
                address: 'Address 1',
                imageContent: 'image1.jpg',
                listChargers: [{ chargerId: 'charger1' }],
                createUserId: 'userid',
            },
        ];

        const chargers = [
            {
                _id: 'charger1',
                status: 'Active',
                plugs: [{ plugId: 'plug1', status: 'Available', subStatus: 'Operational' }],
            },
        ];

        findMock.mockResolvedValue(locations);
        chargerFindMock.mockResolvedValue(chargers);

        await controller.getLocations(req(), res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                totalLocations: 1,
                totalChargers: 1,
                totalPlugs: 1,
                data: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Location 1',
                        chargers: expect.arrayContaining([
                            expect.objectContaining({
                                status: 'Active',
                            }),
                        ]),
                    }),
                ]),
            })
        );
    });

    test('Should return 400 if userid is missing in headers', async () => {
        const request = { query: {} , headers: {} };

        await controller.getLocations(request, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'User ID is required in headers.' })
        );
    });

    test('When an error occurs, should send 500', async () => {
        findMock.mockRejectedValue(new Error('Database error'));

        await controller.getLocations(req(), res);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Unexpected error',
                error: 'Database error',
            })
        );
        expect(Sentry.captureException).toHaveBeenCalled();
    });
});
