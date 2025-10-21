import { describe, expect, it } from '@jest/globals';
// Services
import solarPVService from '../../services/solarPVService';
// Interface
import { ISolarPvModelDocument } from '../../interfaces/solarPvInterfaces';

describe('formatExternalAPISolarPVs', () => {
    it('should format external API solar PVs correctly', () => {
        const date = new Date('2011-11-23T12:00:00.000Z');
        const solarPvs = [
            {
                _id: '1',
                name: 'Solar PV 1',
                description: 'Description 1',
                locationID: 'Location 1',
                exportEnergyActive: 155,
                exportPowerActive: 255,
                importPowerActive: 0,
                powerProduction: 100,
                isOnline: true,
                lastReading: date,
                deviceId: 'teste',
                controllerDeviceId: '12',
                switchBoardId: '11',
                createdBy: '15',
            },
            {
                _id: '2',
                name: 'Solar PV 2',
                description: 'Description 2',
                locationID: 'Location 2',
                exportEnergyActive: 155,
                exportPowerActive: 255,
                importPowerActive: 0,
                powerProduction: 200,
                isOnline: true,
                lastReading: date,
                deviceId: 'teste',
                controllerDeviceId: 'teste',
                switchBoardId: '151',
                createdBy: '515',
            },
        ] as ISolarPvModelDocument[];

        const expectedFormattedPvs = [
            {
                id: '1',
                name: 'Solar PV 1',
                description: 'Description 1',
                locationID: 'Location 1',
                exportEnergyActive: 155,
                exportPowerActive: 255,
                importPowerActive: 0,
                powerActive: 100,
                isOnline: true,
                updatedAt: date.toISOString(),
            },
            {
                id: '2',
                name: 'Solar PV 2',
                description: 'Description 2',
                locationID: 'Location 2',
                exportEnergyActive: 155,
                exportPowerActive: 255,
                importPowerActive: 0,
                powerActive: 200,
                isOnline: true,
                updatedAt: date.toISOString(),
            },
        ];

        const formattedPvs = solarPVService.formatExternalAPISolarPVs(solarPvs);
        expect(formattedPvs).toEqual(expectedFormattedPvs);
    });
});
