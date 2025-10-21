import { describe, test, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { Request, Response } from 'express';
import { LocationsV2Controller } from '../../../v2/locations/controller';
import Infrastructure from '../../../models/infrastructure';
import IdentityLib from 'evio-library-identity';

jest.mock('evio-library-identity');

// Mock de `saveImageContent`
const saveImageMock = jest.fn(async (infrastructure: any) => {
    if (!infrastructure || typeof infrastructure !== 'object') {
        throw new Error('Invalid infrastructure object');
    }
    return { ...infrastructure, imageContent: 'https://mocked.image.url' };
});

// Mock de `Infrastructure`
const mockFindById = jest.spyOn(Infrastructure, 'findById');
const mockFindByIdAndUpdate = jest.spyOn(Infrastructure, 'findByIdAndUpdate');

describe('LocationsV2Controller - update', () => {
    let controller;
    let req;
    let res;

    beforeEach(() => {
        controller = new LocationsV2Controller(Infrastructure, saveImageMock);

        req = {
            body: {
                _id: '65a5c7a07f1b3c001e6c3c4d',
                name: 'Updated Name',
                address: 'Updated Address',
                CPE: '12345',
                additionalInformation: 'Updated Info',
                imageContent: 'data:image/jpeg;base64,somebase64string'
            },
            headers: {
                userid: 'user123'
            }
        } as unknown as Request;

        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn()
        } as unknown as Response;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return 400 if user ID is missing in headers', async () => {
        req.headers.userid = undefined;

        await controller.update(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({ message: 'User ID is required in headers.' });
    });

    test('should return 404 if infrastructure is not found', async () => {
        mockFindById.mockResolvedValue(null);

        await controller.update(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'server_infrastructure_not_found',
            message: 'Infrastructure not found for given parameters'
        });
    });

    test('should return 404 if infrastructure is not found', async () => {
        mockFindById.mockResolvedValue(null);

        await controller.update(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'server_infrastructure_not_found',
            message: 'Infrastructure not found for given parameters'
        });
    });

    test('should update infrastructure and return 200', async () => {
        const mockInfrastructure = { _id: req.body._id, createUserId: 'user123', imageContent: '' };
        mockFindById.mockResolvedValue(mockInfrastructure);
        saveImageMock.mockResolvedValue({
            ...mockInfrastructure,
            imageContent: 'https://mocked.image.url'
        });
        mockFindByIdAndUpdate.mockResolvedValue({
            ...mockInfrastructure,
            ...req.body,
            imageContent: 'https://mocked.image.url'
        });

        await controller.update(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(saveImageMock).toHaveBeenCalled();
        expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
            _id: '65a5c7a07f1b3c001e6c3c4d',
            name: 'Updated Name',
            address: 'Updated Address',
            CPE: '12345',
            additionalInformation: 'Updated Info',
            imageContent: 'https://mocked.image.url'
        }));
    });
});
