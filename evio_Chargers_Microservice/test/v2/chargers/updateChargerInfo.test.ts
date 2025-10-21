import { describe, test, jest, expect, afterEach, beforeEach } from '@jest/globals';
import * as ChargerV2Controller from '@/v2/chargers/controllers/chargerInfo.controller';
import Charger from '../../../models/charger';
import Infrastructure from '../../../models/infrastructure';
import CostTariff from '../../../v2/costTariffs/model';
import ParkingType from '../../../v2/parkingType/model';
import FacilitiesType from '../../../v2/facilitiesType/model';
import AssetType from '../../../v2/assetType/model';
import SwitchBoard from '../../../models/switchBoards';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

const makeReq = (body = {}, query = {}) => ({ body, query, headers: {} } as any);

describe('ChargerV2Controller - updateChargerInfo', () => {
    let controller: typeof ChargerV2Controller;

    let findOneCharger: jest.SpiedFunction<typeof Charger.findOne>;
    let findByIdInfra: jest.SpiedFunction<typeof Infrastructure.findById>;
    let findOneCostTariff: jest.SpiedFunction<typeof CostTariff.findOne>;
    let findOneParking: jest.SpiedFunction<typeof ParkingType.findOne>;
    let findOneFacilities: jest.SpiedFunction<typeof FacilitiesType.findOne>;
    let findOneAsset: jest.SpiedFunction<typeof AssetType.findOne>;
    let findByIdSwitch: jest.SpiedFunction<typeof SwitchBoard.findById>;

    const saveMock = jest.fn();

    let sendMock: jest.Mock;
    let statusMock: jest.Mock;
    let res: any;

    beforeEach(() => {
        controller = ChargerV2Controller;

        findOneCharger = jest.spyOn(Charger, 'findOne');
        findByIdInfra = jest.spyOn(Infrastructure, 'findById');
        findOneCostTariff = jest.spyOn(CostTariff, 'findOne');
        findOneParking = jest.spyOn(ParkingType, 'findOne');
        findOneFacilities = jest.spyOn(FacilitiesType, 'findOne');
        findOneAsset = jest.spyOn(AssetType, 'findOne');
        findByIdSwitch = jest.spyOn(SwitchBoard, 'findById');

        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ send: sendMock }));
        res = { status: statusMock };
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('should return 400 if chargerId is not provided', async () => {
        const req = makeReq({}, {});
        await controller.updateChargerInfo(req, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_charger_id_required',
            message: 'Charger Id is required',
        });
    });

    test('should return 400 if charger is not found', async () => {
        findOneCharger.mockResolvedValueOnce(null as any);

        const req = makeReq({}, { chargerId: 'charger1' });
        await controller.updateChargerInfo(req, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_charger_not_found',
            message: 'Charger not found for given parameters',
        });
    });

    test('should update charger name successfully', async () => {
        const mockCharger: any = { hwId: 'charger1', name: 'Old Name', plugs: [], save: saveMock };
        findOneCharger.mockResolvedValueOnce(mockCharger);

        const req = makeReq({ name: 'Updated Name' }, { chargerId: 'charger1' });
        await controller.updateChargerInfo(req, res);

        expect(mockCharger.name).toBe('Updated Name');
        expect(saveMock).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Charger info updated successfully' }),
        );
    });

    test('should update charger location and address successfully', async () => {
        const validLocationId = '507f1f77bcf86cd799439011';
        const mockCharger: any = {
            hwId: 'charger1',
            infrastructure: 'OldLocationId',
            address: { street: 'Old St', city: 'Old City', state: 'Old State', country: 'Old Country' },
            plugs: [],
            save: saveMock,
        };
        findOneCharger.mockResolvedValueOnce(mockCharger);
        findByIdInfra.mockResolvedValueOnce({ _id: validLocationId } as any);

        const req = makeReq(
            {
                locationId: validLocationId,
                address: { street: 'New St', city: 'New City', state: 'New State', country: 'New Country' },
            },
            { chargerId: 'charger1' },
        );
        await controller.updateChargerInfo(req, res);

        expect(mockCharger.infrastructure).toBe(validLocationId);
        expect(mockCharger.address).toEqual({
            street: 'New St',
            city: 'New City',
            state: 'New State',
            country: 'New Country',
        });
        expect(saveMock).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Charger info updated successfully' }),
        );
    });

    test('should update hardware details successfully', async () => {
        const mockCharger: any = {
            hwId: 'charger1',
            vendor: 'Old Brand',
            model: 'Old Model',
            serialNumber: 'OldSN',
            firmwareVersion: '1.0.0', // não é atualizado pelo controller
            meterType: 'Analog',
            plugs: [],
            save: saveMock,
        };
        findOneCharger.mockResolvedValueOnce(mockCharger);

        const req = makeReq(
            {
                brand: 'New Brand',
                model: 'New Model',
                serialNumber: 'NewSN',
                firmwareVersion: '2.0.0', // ignorado
                meterType: 'Digital',
            },
            { chargerId: 'charger1' },
        );
        await controller.updateChargerInfo(req, res);

        expect(mockCharger.vendor).toBe('New Brand');
        expect(mockCharger.model).toBe('New Model');
        expect(mockCharger.serialNumber).toBe('NewSN');
        expect(mockCharger.firmwareVersion).toBe('1.0.0'); // permanece igual
        expect(mockCharger.meterType).toBe('Digital');
        expect(saveMock).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Charger info updated successfully' }),
        );
    });

    test('should update cost tariff successfully', async () => {
        const mockCharger: any = { hwId: 'charger1', purchaseTariff: { name: 'Old Tariff' }, plugs: [], save: saveMock };
        findOneCharger.mockResolvedValueOnce(mockCharger);

        const mockCostTariff: any = { _id: 'newTariffId', name: 'New Tariff' };
        findOneCostTariff.mockResolvedValueOnce(mockCostTariff);

        const req = makeReq({ costTariff: 'New Tariff' }, { chargerId: 'charger1' });
        await controller.updateChargerInfo(req, res);

        expect(mockCharger.purchaseTariff.name).toBe('New Tariff');
        expect(saveMock).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Charger info updated successfully' }),
        );
    });

    test('should update ALL sections at once (except firmware)', async () => {
        const validInfraId = '507f1f77bcf86cd799439011';
        const validSwitchId = '507f1f77bcf86cd799439012';

        const mockCharger: any = {
            hwId: 'charger1',
            name: 'Old Name',
            infoPoints: 'Old Info',
            infrastructure: 'OldInfra',
            address: { street: '', city: '', state: '', country: '' },
            parkingType: null,
            vehiclesType: [],
            facilitiesTypes: [],
            purchaseTariff: {},
            switchBoardId: null,
            geometry: { type: 'Point', coordinates: [0, 0] },
            vendor: 'Old Brand',
            model: 'Old Model',
            serialNumber: 'OldSN',
            firmwareVersion: '1.0.0',
            meterType: 'Analog',
            voltageLevel: 'OldVoltage',
            internalInfo: '',
            plugs: [],
            save: saveMock,
        };
        findOneCharger.mockResolvedValueOnce(mockCharger);

        findByIdInfra.mockResolvedValueOnce({ _id: validInfraId } as any);
        findOneParking.mockResolvedValueOnce({ parkingType: 'Underground' } as any);
        findOneAsset.mockResolvedValueOnce({ vehicleType: 'Car' } as any);
        findOneFacilities.mockResolvedValueOnce({ locationType: 'Shopping' } as any);
        findOneCostTariff.mockResolvedValueOnce({ name: 'Tariff X' } as any);
        findByIdSwitch.mockResolvedValueOnce({ _id: validSwitchId } as any);

        const req = makeReq(
            {
                name: 'New Name',
                additionalInformation: 'New InfoPoints',
                locationId: validInfraId,
                parkingType: 'Underground',
                vehicleType: ['Car'],
                locationType: ['Shopping'], // precisa ser array
                costTariff: 'Tariff X',
                switchboard: validSwitchId,
                address: {
                    street: 'New Street',
                    city: 'New City',
                    state: 'New State',
                    country: 'New Country',
                },
                coordinates: {
                    latitude: 12.3456,
                    longitude: -98.7654,
                },
                brand: 'New Brand',
                model: 'New Model',
                serialNumber: 'NewSN',
                firmwareVersion: '2.0.0', // ignorado
                meterType: 'Digital',
                voltageLevel: 'High Voltage',
                internalInformation: 'Some internal info',
            },
            { chargerId: 'charger1' },
        );

        await controller.updateChargerInfo(req, res);

        expect(mockCharger.name).toBe('New Name');
        expect(mockCharger.infoPoints).toBe('New InfoPoints');
        expect(mockCharger.infrastructure).toBe(validInfraId);
        expect(mockCharger.parkingType).toBe('Underground');
        expect(mockCharger.vehiclesType).toEqual([{ vehicle: 'Car' }]);
        expect(mockCharger.facilitiesTypes).toEqual([{ facility: 'Shopping' }]);
        expect(mockCharger.purchaseTariff.name).toBe('Tariff X');
        expect(mockCharger.switchBoardId).toBe(validSwitchId);
        expect(mockCharger.address).toEqual({
            street: 'New Street',
            city: 'New City',
            state: 'New State',
            country: 'New Country',
        });
        expect(mockCharger.geometry.coordinates).toEqual([-98.7654, 12.3456]);
        expect(mockCharger.vendor).toBe('New Brand');
        expect(mockCharger.model).toBe('New Model');
        expect(mockCharger.serialNumber).toBe('NewSN');
        expect(mockCharger.firmwareVersion).toBe('1.0.0'); // inalterado
        expect(mockCharger.meterType).toBe('Digital');
        expect(mockCharger.voltageLevel).toBe('High Voltage');
        expect(mockCharger.internalInfo).toBe('Some internal info');

        expect(saveMock).toHaveBeenCalled();
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'Charger info updated successfully' }),
        );
    });

    test('should handle unexpected errors', async () => {
        findOneCharger.mockRejectedValueOnce(new Error('Test Error'));

        const req = makeReq({}, { chargerId: 'charger1' });
        await controller.updateChargerInfo(req, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Test Error',
        });
    });
});
