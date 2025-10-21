import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import * as SalesTariffController from '../controllers/salesTariff.controller';
import * as TariffService from '../services/salesTariff.service';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

describe('SalesTariffController', () => {
    const sendMock = jest.fn();
    const statusMock = jest.fn(() => ({ send: sendMock }));
    const res = { status: statusMock } as any;

    const req = (body = {}, headers = {}) => ({
        body,
        headers,
    }) as any;

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getTariffs', () => {
        test('should return sales tariffs successfully', async () => {
            const tariffs = [{ name: 'Test Tariff' }];
            jest.spyOn(TariffService, 'getSalesTariffs').mockResolvedValue(tariffs);

            const mockReq = req({}, { userid: 'user1' });

            await SalesTariffController.getTariffs(mockReq, res);

            expect(TariffService.getSalesTariffs).toHaveBeenCalledWith('user1');
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(sendMock).toHaveBeenCalledWith(tariffs);
        });

        test('should handle errors in getTariffs', async () => {
            const error = new Error('Unexpected');
            jest.spyOn(TariffService, 'getSalesTariffs').mockRejectedValue(error);

            const mockReq = req({}, { userid: 'user1' });

            await SalesTariffController.getTariffs(mockReq, res);

            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
                auth: false,
                code: 'internal_server_error',
                message: 'Internal server error',
            }));
        });
    });

    describe('addTariff', () => {
        test('should add sales tariff successfully', async () => {
            const created = { _id: '123', name: 'New Tariff' };
            jest.spyOn(TariffService, 'addSalesTariff').mockResolvedValue(created);

            const mockReq = req({ name: 'New Tariff' }, { userid: 'user1' });

            await SalesTariffController.addTariff(mockReq, res);

            expect(TariffService.addSalesTariff).toHaveBeenCalledWith(mockReq);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(sendMock).toHaveBeenCalledWith(created);
        });

        test('should handle errors in addTariff', async () => {
            const error = new Error('Creation failed');
            jest.spyOn(TariffService, 'addSalesTariff').mockRejectedValue(error);

            const mockReq = req({}, { userid: 'user1' });

            await SalesTariffController.addTariff(mockReq, res);

            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
                auth: false,
                code: 'internal_server_error',
                message: 'Internal server error',
            }));
        });
    });

    describe('editTariff', () => {
        test('should edit sales tariff successfully', async () => {
            const updated = { _id: '123', name: 'Updated Tariff' };
            jest.spyOn(TariffService, 'editSalesTariff').mockResolvedValue(updated);

            const mockReq = req({ _id: '123', name: 'Updated Tariff' }, { userid: 'user1' });

            await SalesTariffController.editTariff(mockReq, res);

            expect(TariffService.editSalesTariff).toHaveBeenCalledWith(mockReq);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(sendMock).toHaveBeenCalledWith(updated);
        });

        test('should handle errors in editTariff', async () => {
            const error = new Error('Edit failed');
            jest.spyOn(TariffService, 'editSalesTariff').mockRejectedValue(error);

            const mockReq = req({ _id: '123' }, { userid: 'user1' });

            await SalesTariffController.editTariff(mockReq, res);

            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
                auth: false,
                code: 'internal_server_error',
                message: 'Internal server error',
            }));
        });
    });

    describe('deleteTariff', () => {
        test('should delete sales tariff successfully', async () => {
            const result = {
                auth: true,
                code: 'server_successfully_deleted',
                message: 'Tariff successfully deleted.',
            };
            jest.spyOn(TariffService, 'deleteSalesTariff').mockResolvedValue(result);

            const mockReq = req({ _id: '123' }, { userid: 'user1' });

            await SalesTariffController.deleteTariff(mockReq, res);

            expect(TariffService.deleteSalesTariff).toHaveBeenCalledWith(mockReq);
            expect(statusMock).toHaveBeenCalledWith(200);
            expect(sendMock).toHaveBeenCalledWith(result);
        });

        test('should handle errors in deleteTariff', async () => {
            const error = new Error('Delete failed');
            jest.spyOn(TariffService, 'deleteSalesTariff').mockRejectedValue(error);

            const mockReq = req({ _id: '123' }, { userid: 'user1' });

            await SalesTariffController.deleteTariff(mockReq, res);

            expect(Sentry.captureException).toHaveBeenCalledWith(error);
            expect(statusMock).toHaveBeenCalledWith(500);
            expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
                auth: false,
                code: 'internal_server_error',
                message: 'Internal server error',
            }));
        });
    });
});
