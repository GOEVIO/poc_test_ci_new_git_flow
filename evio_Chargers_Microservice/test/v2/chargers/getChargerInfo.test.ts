import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import * as Controller from '../../../v2/chargers/controllers/chargerInfo.controller';
import Charger from '../../../models/charger';
import ChargingSession from '../../../models/chargingSession';
import Infrastructure from '../../../models/infrastructure';
import SwitchBoards from '../../../models/switchBoards';
import ChargeModel from '../../../v2/chargerModels/model';
import AssetType from '../../../v2/assetType/model';
import CostTariff from '../../../v2/costTariffs/model';
import FacilitiesType from '../../../v2/facilitiesType/model';
import ParkingType from '../../../v2/parkingType/model';
import DurationHelper from '../../../v2/chargers/helpers/durationHelper';
import * as AccessGroups from '../../../v2/chargers/helpers/buildAccessGroups';

jest.mock('@sentry/node', () => ({
    captureException: jest.fn(),
}));
const Sentry = require('@sentry/node');

const makeReq = (query: any = {}, headers: any = {}) =>
    ({ query, headers } as any);

describe('ChargerV2Controller - getChargerInfo', () => {
    let sendMock: jest.Mock;
    let statusMock: jest.Mock;
    let res: any;

    // spies
    let findOneCharger: jest.SpiedFunction<typeof Charger.findOne>;
    let existsSession: jest.SpiedFunction<typeof ChargingSession.exists>;
    let findByIdInfra: jest.SpiedFunction<typeof Infrastructure.findById>;
    let findOneChargeModel: jest.SpiedFunction<typeof ChargeModel.findOne>;
    let findOneParking: jest.SpiedFunction<typeof ParkingType.findOne>;
    let findOneAsset: jest.SpiedFunction<typeof AssetType.findOne>;
    let findOneFacility: jest.SpiedFunction<typeof FacilitiesType.findOne>;
    let findOneCostTariff: jest.SpiedFunction<typeof CostTariff.findOne>;
    let buildAccessGroupsSpy: jest.SpiedFunction<typeof AccessGroups.buildAccessGroups>;
    let formatDurationSpy: jest.SpiedFunction<typeof DurationHelper.formatDuration>;

    beforeEach(() => {
        sendMock = jest.fn();
        statusMock = jest.fn(() => ({ send: sendMock }));
        res = { status: statusMock };

        findOneCharger = jest.spyOn(Charger, 'findOne');
        existsSession = jest.spyOn(ChargingSession, 'exists');
        findByIdInfra = jest.spyOn(Infrastructure, 'findById');
        findOneChargeModel = jest.spyOn(ChargeModel, 'findOne');
        findOneParking = jest.spyOn(ParkingType, 'findOne');
        findOneAsset = jest.spyOn(AssetType, 'findOne');
        findOneFacility = jest.spyOn(FacilitiesType, 'findOne');
        findOneCostTariff = jest.spyOn(CostTariff, 'findOne');
        buildAccessGroupsSpy = jest.spyOn(AccessGroups, 'buildAccessGroups');
        formatDurationSpy = jest.spyOn(DurationHelper, 'formatDuration');
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('400 when chargerId is missing', async () => {
        const req = makeReq({}, { userid: 'user1' });
        await Controller.getChargerInfo(req, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_charger_id_required',
            message: 'Charger Id is required',
        });
        expect(findOneCharger).not.toHaveBeenCalled();
    });

    test('400 when charger is not found', async () => {
        findOneCharger.mockResolvedValueOnce(null as any);

        const req = makeReq({ chargerId: 'HW123' }, { userid: 'user1' });
        await Controller.getChargerInfo(req, res);

        expect(findOneCharger).toHaveBeenCalledWith({ hwId: 'HW123' });
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'server_error_charger_not_found',
            message: 'Charger not found for given parameters',
        });
    });

    test('200 when model/vendor is not found (fallback to charger fields)', async () => {
        const chargerMock: any = {
            hwId: 'HW123',
            name: 'Name',
            infrastructure: 'infra1',
            vendor: 'VendorX',
            model: 'ModelY',
            address: null,
            accessType: 'public',
            firmwareVersion: '1.0',
            mapVisibility: true,
            allowRFID: true,
            offlineNotification: false,
            offlineEmailNotification: '',
            rating: 4,
            geometry: { coordinates: [10, 20] },
            vehiclesType: [],
            facilitiesTypes: [],
            plugs: [],
            switchBoardId: null,
            purchaseTariff: null,
        };

        findOneCharger.mockResolvedValueOnce(chargerMock);
        existsSession.mockResolvedValueOnce(false as any);
        findByIdInfra.mockResolvedValueOnce(null as any);
        findOneChargeModel.mockResolvedValueOnce(null as any); // model/vendor not found

        // prevent unintended DB calls:
        findOneParking.mockResolvedValueOnce(null as any); // ParkingType.findOne
        findOneCostTariff.mockResolvedValueOnce(null as any); // CostTariff.findOne
        jest.spyOn(SwitchBoards, 'findOne').mockResolvedValueOnce(null as any); // SwitchBoards.findOne

        buildAccessGroupsSpy.mockResolvedValueOnce([] as any);

        const req = makeReq({ chargerId: 'HW123' }, { userid: 'user1' });
        await Controller.getChargerInfo(req, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    manufacturer: 'VendorX',
                    model: 'ModelY',
                }),
            }),
        );
    });

    test('200 success with full structure', async () => {
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now);

        const chargerMock: any = {
            hwId: 'HW123',
            name: 'Main Charger',
            infrastructure: 'infra1',
            vendor: 'VendorX',
            model: 'ModelY',
            address: {
                street: 'Street',
                city: 'City',
                state: 'State',
                country: 'Country',
            },
            accessType: 'public',
            firmwareVersion: '1.2.3',
            mapVisibility: true,
            allowRFID: false,
            offlineNotification: true,
            offlineEmailNotification: 'alerts@example.com',
            rating: 5,
            geometry: { coordinates: [-9.14, 38.72] },
            vehiclesType: [{ vehicle: 'car' }],
            facilitiesTypes: [{ facility: 'mall' }],
            plugs: [
                {
                    plugId: 'P1',
                    evseId: 'EVSE-1',
                    internalRef: 'INT-1',
                    connectorType: 'Type2',
                    connectorFormat: 'socket',
                    subStatus: 'Available',
                    powerType: 'AC',
                    power: 22,
                    voltage: 230,
                    amperage: 32,
                    qrCodeId: 'QR-1',
                    statusTime: '2025-01-01T00:00:00Z',
                    statusChangeDate: new Date(now - 60 * 1000).toISOString(),
                },
            ],
            switchBoardId: 'switch-123',
            purchaseTariff: { name: 'Tariff A' },
        };

        findOneCharger.mockResolvedValueOnce(chargerMock);
        existsSession.mockResolvedValueOnce(true as any);
        findByIdInfra.mockResolvedValueOnce({ _id: 'infra1', name: 'Location', imageContent: 'http://img/location.jpg' } as any);
        findOneChargeModel.mockResolvedValueOnce({ manufacturer: 'VendorX', models: [{ model: 'ModelY' }] } as any);
        findOneParking.mockResolvedValueOnce({ parkingType: 'Underground' } as any);
        findOneAsset.mockResolvedValueOnce({ vehicleType: 'Car' } as any);
        findOneFacility.mockResolvedValueOnce({ locationType: 'Shopping Mall' } as any);
        findOneCostTariff.mockResolvedValueOnce({ name: 'Tariff A' } as any);
        jest.spyOn(SwitchBoards, 'findOne').mockResolvedValueOnce({ _id: 'switch-123' } as any);

        buildAccessGroupsSpy.mockResolvedValueOnce([{ id: 'g1', name: 'Group 1', type: 'group', plugs: [] }] as any);
        formatDurationSpy.mockReturnValueOnce('1m');

        const req = makeReq({ chargerId: 'HW123' }, { userid: 'user-xyz' });
        await Controller.getChargerInfo(req, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: 'Main Charger',
                    hwId: 'HW123',
                    manufacturer: 'VendorX',
                    model: 'ModelY',
                    connectors: [expect.objectContaining({ duration: '1m' })],
                    accessGroups: [{ id: 'g1', name: 'Group 1', type: 'group', plugs: [] }],
                }),
            }),
        );
    });

    test('500 on unexpected error', async () => {
        findOneCharger.mockRejectedValueOnce(new Error('Boom'));

        const req = makeReq({ chargerId: 'HW123' }, { userid: 'user1' });
        await Controller.getChargerInfo(req, res);

        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(sendMock).toHaveBeenCalledWith({
            auth: false,
            code: 'internal_server_error',
            message: 'Internal server error',
        });
    });
});
