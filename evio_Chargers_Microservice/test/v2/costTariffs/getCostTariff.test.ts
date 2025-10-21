import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { CostTariffsController } from '../../../v2/costTariffs/controller';
import CostTariff from '../../../v2/costTariffs/model';
import Sentry from '@sentry/node';
import { Request, Response } from 'express';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));

describe('CostTariffsController - getCostTariff', () => {
    let controller: CostTariffsController;
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        controller = new CostTariffsController();

        jsonMock = jest.fn();
        sendMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });

        req = { query: {} };
        res = {
            status: statusMock as unknown as Response['status'],
            json: jsonMock as unknown as Response['json'],
            send: sendMock as unknown as Response['send'],
        };

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should get cost tariffs successfully with a search filter', async () => {
        req.query = { search: 'Tariff' };

        const costTariffMock = [{ _id: 'mocked-id-1', name: 'Tariff A' }];

        const findSpy = jest.spyOn(CostTariff, 'find').mockResolvedValue(costTariffMock as any);

        await controller.getCostTariff(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({ search: 'Tariff' });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(costTariffMock);
        expect(sendMock).not.toHaveBeenCalled();
    });

    test('should get cost tariffs successfully without filters', async () => {
        const costTariffMock = [
            { _id: 'mocked-id-1', name: 'Tariff A' },
            { _id: 'mocked-id-2', name: 'Tariff B' },
        ];

        const findSpy = jest.spyOn(CostTariff, 'find').mockResolvedValue(costTariffMock as any);

        await controller.getCostTariff(req as Request, res as Response);

        expect(findSpy).toHaveBeenCalledWith({}); // filtro vazio quando não há query
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(costTariffMock);
        expect(sendMock).not.toHaveBeenCalled();
    });

    test('should return 500 on unexpected error during retrieval', async () => {
        const error = new Error('Unexpected retrieval error');

        jest.spyOn(CostTariff, 'find').mockRejectedValue(error as any);

        await controller.getCostTariff(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
        expect(jsonMock).not.toHaveBeenCalled();
        expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });
});
