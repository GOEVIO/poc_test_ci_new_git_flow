import { describe, expect, it, beforeEach } from '@jest/globals';
// Services
import publicGridServices from '../../services/publicGridServices';
// interfaces
import { IPutPublicGridExternalAPI } from '../../interfaces/publicGridInterfaces';

describe('createExternalAPIUpdateObject', () => {
    let meter: IPutPublicGridExternalAPI;
    beforeEach(() => {
        meter = {
            id: 'meterTeste',
            i1: 18,
            i2: 5,
            i3: -1,
            v1: 230,
            v2: 221,
            v3: 220,
            iTot: 15,
            vTot: 230,
            exportPower: 15,
            importPower: 0,
            measurementDate: '2024-05-27T13:48',
        };
    });

    it('Validating with all data filled', () => {
        const result = publicGridServices.createExternalAPIUpdateObject(meter, 'UserIdTeste');
        expect(result).toEqual({
            createUserId: 'UserIdTeste',
            name: 'meterTeste',
            deviceId: 'meterTeste',
            id: 'meterTeste',
            i1: 18,
            i2: 5,
            i3: -1,
            v1: 230,
            v2: 221,
            v3: 220,
            iTot: 15,
            vTot: 230,
            exportPower: 15,
            importPower: 0,
            measurementDate: new Date('2024-05-27T13:48'),
            totalCurrent: 15,
            totalVoltage: 230,
            power: -15,
        });
    });

    it('Validating with missing vTot', () => {
        meter.vTot = undefined;
        const result = publicGridServices.createExternalAPIUpdateObject(meter, 'UserIdTeste');
        expect(result).toEqual({
            createUserId: 'UserIdTeste',
            name: 'meterTeste',
            deviceId: 'meterTeste',
            id: 'meterTeste',
            i1: 18,
            i2: 5,
            i3: -1,
            v1: 230,
            v2: 221,
            v3: 220,
            iTot: 15,
            exportPower: 15,
            importPower: 0,
            measurementDate: new Date('2024-05-27T13:48'),
            totalCurrent: 15,
            totalVoltage: 387,
            power: -15,
        });
    });

    it('Validating with missing iTot', () => {
        delete meter.iTot;
        const result = publicGridServices.createExternalAPIUpdateObject(meter, 'UserIdTeste');
        expect(result).toEqual({
            createUserId: 'UserIdTeste',
            name: 'meterTeste',
            deviceId: 'meterTeste',
            id: 'meterTeste',
            i1: 18,
            i2: 5,
            i3: -1,
            v1: 230,
            v2: 221,
            v3: 220,
            exportPower: 15,
            importPower: 0,
            measurementDate: new Date('2024-05-27T13:48'),
            totalCurrent: 22,
            totalVoltage: 230,
            power: -15,
            vTot: 230,
        });
    });

    it('Validating with missing monoPhase meter', () => {
        delete meter.iTot;
        delete meter.i1;
        delete meter.i3;
        delete meter.v3;
        delete meter.v1;
        delete meter.vTot;
        meter.importPower = 20;
        const result = publicGridServices.createExternalAPIUpdateObject(meter, 'UserIdTeste');
        expect(result).toEqual({
            createUserId: 'UserIdTeste',
            name: 'meterTeste',
            deviceId: 'meterTeste',
            id: 'meterTeste',
            i2: 5,
            v2: 221,
            v1: 0,
            v3: 0,
            exportPower: 15,
            importPower: 20,
            measurementDate: new Date('2024-05-27T13:48'),
            totalCurrent: 5,
            totalVoltage: 221,
            power: 5,
        });
    });
});
