import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import * as service from '../../../v2/chargers/delete/service';
import * as repository from '../../../v2/chargers/delete/repository';
import ChargingSession from '../../../models/chargingSession';
import { Request, Response } from 'express';
import { deleteChargerController } from '../../../v2/chargers/delete/controller';
import axios from 'axios';

jest.mock('axios', () => ({
    post: jest.fn(),
}));

const fakeCharger = {
    _id: 'charger123',
    hwId: 'HW123',
    createUser: 'user123',
    infrastructure: 'infra123',
    hasInfrastructure: true,
    plugs: [],
    chargerType: '002',
};

describe('deleteCharger service', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.HostSonOff = 'https://sonoff-host/';
        process.env.PathRemoveSonOff = 'remove';
        process.env.HostEVIOBox = 'https://eviobox-host/';
        process.env.PathRemoveEVIOBOx = 'removeBox';
        process.env.PlugsStatusInUse = 'IN_USE';

        jest.spyOn(axios, 'post').mockResolvedValue({} as any);
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should return 400 if charger not found', async () => {
        const spy = jest.spyOn(repository, 'findByIdAndUser').mockResolvedValue(null);

        const result = await service.deleteCharger('user123', 'charger123');

        expect(spy).toHaveBeenCalledWith('charger123', 'user123');
        expect(result.status).toBe(400);
        expect(result.data).toEqual({
            auth: false,
            code: 'server_error_charger_not_found',
            message: 'Charger not found for given parameters',
        });
    });

    test('should return 400 if charger has plugs in use', async () => {
        jest.spyOn(repository, 'findByIdAndUser').mockResolvedValue({
            ...fakeCharger,
            plugs: [{ status: process.env.PlugsStatusInUse }],
        } as any);

        const result = await service.deleteCharger('user123', 'charger123');

        expect(result.status).toBe(400);
        expect(result.data).toEqual({
            auth: false,
            code: 'server_error_charger_plugs_in_use',
            message: 'Charger cannot be deleted as it has plugs currently in use',
        });
    });

    test('should deactivate charger if it has sessions', async () => {
        jest.spyOn(repository, 'findByIdAndUser').mockResolvedValue(fakeCharger as any);
        jest.spyOn(ChargingSession, 'exists').mockResolvedValue(true as any);
        const deactivateSpy = jest.spyOn(repository, 'deactivateCharger').mockResolvedValue({} as any);

        const result = await service.deleteCharger('user123', 'charger123');

        expect(deactivateSpy).toHaveBeenCalledWith('charger123');
        expect(result.status).toBe(200);
        expect(result.data).toEqual({
            message: 'Charger disabled due to existing sessions',
            chargerId: 'charger123',
        });
        // não deve tentar remover no fornecedor externo quando desativa
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('should call external removal (SonOff) and delete charger when no sessions exist', async () => {
        jest.spyOn(repository, 'findByIdAndUser').mockResolvedValue(fakeCharger as any);
        jest.spyOn(ChargingSession, 'exists').mockResolvedValue(false as any);
        const deleteSpy = jest
            .spyOn(repository, 'deleteChargerById')
            .mockResolvedValue({ deletedCount: 1 } as any);

        const result = await service.deleteCharger('user123', 'charger123');

        // chamou o endpoint externo correto para chargerType '002'
        expect(axios.post).toHaveBeenCalledWith('https://sonoff-host/remove', { hwId: 'HW123' });
        expect(deleteSpy).toHaveBeenCalledWith('charger123');
        expect(result.status).toBe(200);
        expect(result.data).toEqual({
            message: 'Charger successfully deleted',
            chargerId: 'charger123',
        });
    });

    test('should return 400 if repository delete returns deletedCount = 0', async () => {
        jest.spyOn(repository, 'findByIdAndUser').mockResolvedValue(fakeCharger as any);
        jest.spyOn(ChargingSession, 'exists').mockResolvedValue(false as any);
        jest.spyOn(axios, 'post').mockResolvedValue({} as any);
        jest.spyOn(repository, 'deleteChargerById').mockResolvedValue({ deletedCount: 0 } as any);

        const result = await service.deleteCharger('user123', 'charger123');

        expect(result.status).toBe(400);
        expect(result.data).toEqual({
            auth: false,
            code: 'server_error_charger_deletion_failed',
            message: 'Charger could not be deleted',
        });
    });
});

describe('deleteChargerController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let statusMock: jest.Mock;
    let sendMock: jest.Mock;

    beforeEach(() => {
        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ send: sendMock, json: sendMock }));
        res = { status: statusMock } as unknown as Response;

        req = {
            headers: { userid: 'user123' } as any,
            body: { _id: 'charger123' },
        };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should return status/data from service (200)', async () => {
        jest.spyOn(service, 'deleteCharger').mockResolvedValue({
            status: 200,
            data: { message: 'Charger successfully deleted', chargerId: 'charger123' },
        });

        await deleteChargerController(req as Request, res as Response);

        expect(service.deleteCharger).toHaveBeenCalledWith('user123', 'charger123');
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith({
            message: 'Charger successfully deleted',
            chargerId: 'charger123',
        });
    });

    test('should pass through non-200 status/data from service', async () => {
        jest.spyOn(service, 'deleteCharger').mockResolvedValue({
            status: 400,
            data: {
                auth: false,
                code: 'server_error_charger_plugs_in_use',
                message: 'Charger cannot be deleted as it has plugs currently in use',
            },
        });

        await deleteChargerController(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_charger_plugs_in_use',
            message: 'Charger cannot be deleted as it has plugs currently in use',
        });
    });

    test('should handle service error and return 500', async () => {
        jest.spyOn(service, 'deleteCharger').mockRejectedValue(new Error('Unexpected error'));

        await deleteChargerController(req as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    });
});
