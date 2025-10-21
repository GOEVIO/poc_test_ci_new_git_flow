import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { CostTariffsController } from '../../../v2/costTariffs/controller';
import CostTariff from '../../../v2/costTariffs/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('CostTariffsController - updateCostTariff', () => {
    let controller: CostTariffsController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new CostTariffsController();

        sendMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ send: sendMock });

        req = { body: {} };
        res = {
            status: statusMock as unknown as Response['status'],
            send: sendMock as unknown as Response['send'],
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should update a cost tariff successfully', async () => {
        req.body = { _id: 'mocked-id-1', name: 'Updated Tariff' };
        const updatedTariffMock = { _id: 'mocked-id-1', name: 'Updated Tariff' };

        const spy = jest
            .spyOn(CostTariff, 'findByIdAndUpdate')
            .mockResolvedValue(updatedTariffMock as any);

        await controller.updateCostTariff(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith('mocked-id-1', { name: 'Updated Tariff' }, { new: true });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(updatedTariffMock);
    });

    test('should return 400 if ID is not provided', async () => {
        req.body = { name: 'Updated Tariff' };

        await controller.updateCostTariff(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_cost_tariff_id_is_required',
            message: 'Cost tariff ID is required',
        });
    });

    test('should return 400 if cost tariff not found', async () => {
        req.body = { _id: 'mocked-id-1', name: 'Updated Tariff' };

        const spy = jest.spyOn(CostTariff, 'findByIdAndUpdate').mockResolvedValue(null);

        await controller.updateCostTariff(req as Request, res as Response);

        expect(spy).toHaveBeenCalledWith('mocked-id-1', { name: 'Updated Tariff' }, { new: true });
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_cost_tariff_not_found',
            message: 'Cost tariff not found for the given ID.',
        });
    });

    test('should return 500 on unexpected error', async () => {
        req.body = { _id: 'mocked-id-1', name: 'Updated Tariff' };
        const error = new Error('Unexpected database error');

        jest.spyOn(CostTariff, 'findByIdAndUpdate').mockRejectedValue(error as any);

        await controller.updateCostTariff(req as Request, res as Response);

        expect(Sentry.captureException).toHaveBeenCalledWith(error);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    });
});
