import { describe, test, jest, expect, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { getActiveSessionsForMyChargers } from '../../../v2/chargingSessions/chargingSessions.controller';
import * as chargingSessionsService from '../../../v2/chargingSessions/chargingSessions.service';

describe('ChargingSessionsController - getActiveSessionsForMyChargers', () => {
    let req: Partial<Request>;
    let res: Response;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        req = {
            headers: { userid: 'user123' }
        };
        jsonMock = jest.fn();
        statusMock = jest.fn(() => ({ json: jsonMock }));
        res = { status: statusMock } as unknown as Response;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return sessions successfully', async () => {
        const fakeSessions = [
            {
                userName: 'Gabriel Coelho',
                reservedAmount: 0,
                sessionId: 123,
                sessionPrice: -1,
                sessionSync: false,
                startDate: '2025-05-20T07:29:38.000Z',
                timeZone: 'Europe/Lisbon',
                status: '20',
                timeCharged: 7506,
                location: {
                    clientName: 'EVIO',
                    address: {
                        _id: 'addressId',
                        street: 'Rua do Campo Alegre',
                        number: '830',
                        zipCode: '4150-177',
                        city: 'Porto',
                        state: 'Porto',
                        country: 'Portugal',
                        countryCode: 'PT'
                    },
                    _id: 'infrastructureId',
                    CPE: '',
                    imageContent: 'image.jpg',
                    name: 'Modivas',
                    additionalInformation: 'informação adicional'
                },
                charger: {
                    _id: 'chargerId',
                    name: 'Posto 4',
                    hwId: 'EVI_LAC_PT_PRT_00004',
                    address: {
                        _id: 'addressId',
                        street: 'Rua do Campo Alegre',
                        number: '830',
                        zipCode: '4150-177',
                        city: 'Porto',
                        state: 'Porto',
                        country: 'Portugal',
                        countryCode: 'PT'
                    },
                    endpoint: 'ws://30.0.4.240/EVI_LAC_PT_PRT_00004',
                    facilitiesTypes: [{ facility: 'ParkingLot' }],
                    accessType: 'Restrict',
                    active: true,
                    rating: 0,
                    numberOfSessions: 0,
                    status: '10',
                    stationIdentifier: 'EVI_LAC_PT_PRT_00004',
                    CPE: ''
                },
                plug: {
                    _id: 'plugId',
                    plugId: '1',
                    connectorType: 'Type 2',
                    qrCodeId: '000646',
                    status: '20',
                    subStatus: 'CHARGING',
                    voltage: 400,
                    amperage: 32,
                    power: 22,
                    createdAt: '2025-05-20T09:56:18.222Z',
                    updatedAt: '2025-05-20T09:56:18.222Z',
                    hasRemoteCapabilities: true,
                    active: true
                },
                tariff: {
                    _id: 'tariffId',
                    billingType: 'billingTypeForImportingCosts',
                    name: 'Tarifa interna',
                    tariff: {
                        activationFee: 0,
                        bookingAmount: { uom: '', value: null },
                        chargingAmount: { uom: 'kwh', value: 0 },
                        parkingAmount: { uom: 'min', value: 0 },
                        parkingDuringChargingAmount: { uom: 'min', value: 0 }
                    },
                    tariffType: 'Energy Based'
                },
                lastReadingPoint: {
                    _id: 'readingPointId',
                    instantAmperage: 15.914,
                    instantPower: 10709,
                    instantVoltage: 224.933333,
                    readDate: '2025-05-20T09:34:44.000Z',
                    totalPower: 22294
                },
                totalPrice: {
                    _id: 'priceId',
                    excl_vat: 0,
                    incl_vat: 0
                },
                estimatedPrice: 0
            }
        ];

        jest.spyOn(chargingSessionsService.ChargingSessionService, 'getActiveSessions').mockResolvedValue(fakeSessions);

        await getActiveSessionsForMyChargers(req as Request, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({ sessions: fakeSessions });
    });

    test('should return 400 if userId is missing', async () => {
        req.headers = {};
        await getActiveSessionsForMyChargers(req as Request, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({ message: 'User ID is required in headers.' });
    });

    test('should handle internal server error', async () => {
        jest.spyOn(chargingSessionsService.ChargingSessionService, 'getActiveSessions')
            .mockRejectedValue(new Error('Test error'));

        await getActiveSessionsForMyChargers(req as Request, res);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
});
