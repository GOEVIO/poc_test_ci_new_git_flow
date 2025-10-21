import { describe, test, beforeEach, afterEach, jest, expect } from '@jest/globals';
import { Request, Response } from 'express';
import { LocationsV2Controller } from '../../../v2/locations/controller';
import Infrastructure from '../../../models/infrastructure';
import Charger from '../../../models/charger';
import ChargingSession from '../../../models/chargingSession';

jest.mock('evio-library-identity');

const mockFindById = jest.spyOn(Infrastructure, 'findById');
const mockDeleteOne = jest.spyOn(Infrastructure, 'deleteOne');
const mockChargerFind = jest.spyOn(Charger, 'find');
const mockSessionFind = jest.spyOn(ChargingSession, 'find');
const mockChargerDeleteOne = jest.spyOn(Charger, 'deleteOne');
const mockChargerUpdateOne = jest.spyOn(Charger, 'updateOne');

describe('LocationsV2Controller - delete', () => {
    let controller: LocationsV2Controller;
    let req: Request;
    let res: Response;

    beforeEach(() => {
        controller = new LocationsV2Controller(Infrastructure as any);

        process.env.PlugsStatusInUse = 'InUse';
        process.env.OperationalStatusRemoved = 'Removed';
        process.env.ChargePointStatusEVIOFaulted = 'Faulted';

        req = {
            body: {
                _id: '65a5c7a07f1b3c001e6c3c4d',
            },
            headers: {
                userid: 'user123',
            },
        } as unknown as Request;

        res = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
            json: jest.fn().mockReturnThis(),
        } as unknown as Response;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should delete infrastructure and return 200', async () => {
        mockFindById.mockResolvedValue({ _id: req.body._id, createUserId: 'user123' });
        mockChargerFind.mockResolvedValue([]); // sem carregadores vinculados
        mockDeleteOne.mockResolvedValue({ deletedCount: 1 } as any);

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith({
            auth: true,
            code: 'server_infrastructure_removed',
            message: 'Infrastructure removed successfully',
        });
    });

    test('should return 400 if infrastructure ID is missing', async () => {
        (req.body as any)._id = undefined;

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_infrastructure_id_is_required',
            message: 'Infrastructure ID is required.',
        });
    });

    test('should return 400 if user ID is missing in headers', async () => {
        (req.headers as any).userid = undefined;

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_user_id_required',
            message: 'User Id required',
        });
    });

    test('should return 400 if delete operation fails (deletedCount = 0)', async () => {
        mockFindById.mockResolvedValue({ _id: req.body._id, createUserId: 'user123' });
        mockChargerFind.mockResolvedValue([]);
        mockDeleteOne.mockResolvedValue({ deletedCount: 0 } as any);

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_infrastructure_not_found',
            message: 'Infrastructure not found for given parameters',
        });
    });

    test('should return 400 if infrastructure is not found or not owned by user', async () => {
        mockFindById.mockResolvedValue(null);

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_infrastructure_not_found',
            message: 'Infrastructure not found for given parameters',
        });
    });

    test('should return 400 if chargers are in use', async () => {
        mockFindById.mockResolvedValue({ _id: req.body._id, createUserId: 'user123' });

        mockChargerFind.mockResolvedValue([
            {
                _id: 'charger1',
                hwId: 'HW-1',
                plugs: [{ status: process.env.PlugsStatusInUse }],
            },
        ] as any);

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.send).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_infrastructure_cannot_be_removed_chargers_in_use',
            message: 'Infrastructure cannot be removed because it has chargers currently in use.',
        });
    });

    test('should remove associated chargers (no active sessions) before deleting infrastructure', async () => {
        mockFindById.mockReset();
        mockChargerFind.mockReset();
        mockSessionFind.mockReset();
        mockChargerDeleteOne.mockReset();
        mockChargerUpdateOne.mockReset();
        mockDeleteOne.mockReset();

        mockFindById.mockResolvedValue({
            _id: req.body._id,
            createUserId: 'user123',
            imageContent: '',
        } as any);

        const chargers = [
            { _id: '65a5c7a07f1b3c001e6c3c4e', hwId: 'HW-1', plugs: [{ status: 'Available' }] },
            { _id: '65a5c7a07f1b3c001e6c3c4f', hwId: 'HW-2', plugs: [{ status: 'Available' }] },
        ];

        mockChargerFind.mockImplementationOnce(async (filter: any) => {
            expect(String(filter?.infrastructure)).toBeDefined();
            return chargers as any;
        });

        mockSessionFind
            .mockResolvedValueOnce([] as any)
            .mockResolvedValueOnce([] as any);

        mockChargerDeleteOne
            .mockResolvedValueOnce({ deletedCount: 1 } as any)
            .mockResolvedValueOnce({ deletedCount: 1 } as any);

        mockDeleteOne.mockResolvedValue({ deletedCount: 1 } as any); // infra

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith({
            auth: true,
            code: 'server_infrastructure_removed',
            message: 'Infrastructure removed successfully',
        });

        expect(mockChargerDeleteOne).toHaveBeenCalledTimes(2);
        expect(mockChargerUpdateOne).not.toHaveBeenCalled();
    });

    test('should detach/disable chargers (with active sessions) instead of deleting them, then delete infrastructure', async () => {
        // Arrange
        mockFindById.mockReset();
        mockChargerFind.mockReset();
        mockSessionFind.mockReset();
        mockChargerDeleteOne.mockReset();
        mockChargerUpdateOne.mockReset();
        mockDeleteOne.mockReset();

        mockFindById.mockResolvedValue({
            _id: req.body._id,
            createUserId: 'user123',
            imageContent: '',
        } as any);

        const chargers = [
            { _id: '65a5c7a07f1b3c001e6c3c50', hwId: 'HW-1', plugs: [{ status: 'Available' }] },
            { _id: '65a5c7a07f1b3c001e6c3c51', hwId: 'HW-2', plugs: [{ status: 'Available' }] },
        ];

        mockChargerFind.mockImplementationOnce(async () => chargers as any);

        mockSessionFind
            .mockResolvedValueOnce([{ _id: 'sess-1' }] as any)
            .mockResolvedValueOnce([{ _id: 'sess-2' }] as any);

        mockChargerUpdateOne
            .mockResolvedValueOnce({ acknowledged: true, modifiedCount: 1 } as any)
            .mockResolvedValueOnce({ acknowledged: true, modifiedCount: 1 } as any);

        mockDeleteOne.mockResolvedValue({ deletedCount: 1 } as any); // infra

        await controller.delete(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith({
            auth: true,
            code: 'server_infrastructure_removed',
            message: 'Infrastructure removed successfully',
        });

        expect(mockChargerUpdateOne).toHaveBeenCalledTimes(2);
        expect(mockChargerDeleteOne).not.toHaveBeenCalled();
    });

});
