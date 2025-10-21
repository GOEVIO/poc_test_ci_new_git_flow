import { describe, test, jest, expect, beforeEach } from '@jest/globals';
import { CostTariffsController } from '../../../v2/costTariffs/controller';
import CostTariff, { ICostTariff } from '../../../v2/costTariffs/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('CostTariffsController - createCostTariff', () => {
    let controller: CostTariffsController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new CostTariffsController();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ send: jsonMock });

        req = { body: {} };
        res = {
            status: statusMock as unknown as Response['status'],
            send: jsonMock as unknown as Response['send'],
        };

        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should create a cost tariff successfully', async () => {
        req.body = { name: 'Tariff A', tariffType: 'Fixed', userId: 'user-123', weekSchedule: [], purchaseTariffId: 'purchase-456' };

        const costTariffMock = {
            _id: 'mocked-id-1',
            ...req.body,
        } as ICostTariff;

        jest.spyOn(CostTariff.prototype, 'save').mockResolvedValue(costTariffMock as never);

        await controller.createCostTariff(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'Tariff A' }));
    });

    test('should return 500 on unexpected error during creation', async () => {
        req.body = { name: 'Tariff B' };
        const error = new Error('Unexpected database error');

        jest.spyOn(CostTariff.prototype, 'save').mockRejectedValue(error);

        await controller.createCostTariff(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
            "auth": false,
             "code": "internal_server_error",
            "message": "Internal server error"
        });
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
