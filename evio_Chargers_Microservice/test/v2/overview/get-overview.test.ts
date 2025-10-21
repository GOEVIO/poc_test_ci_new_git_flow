import { describe, test, afterEach, jest, expect, beforeEach } from '@jest/globals';
import IdentityMock, { ClientMock, UserMock, BillingProfileMock } from './mocks/identity.mock';
import ChargersMock, { ChargerMock, ChargingSessionMock } from './mocks/chargers.mock';
import TariffsMock, { SalesTariffMock } from './mocks/tariffs.mock'

jest.mock('evio-library-identity', () => IdentityMock);
jest.mock('evio-library-chargers', () => ChargersMock);
jest.mock('evio-library-tariffs', () => TariffsMock);

import { mockResponse } from '../../test-utils/response.mock';
import { getOverview } from '../../../v2/overview/controller';
import {
    BaseOverviewMock,
    UsersOverviewMock,
    BillingProfileOverviewMock,
    ClientOverviewMock,
    ClientsOverviewMock,
    TariffsOverviewMock,
    ChargingSessionOverviewMock,
} from './mocks/overview.mock';

function wrapResult(results) {
    return {
        filters: expect.any(Object),
        results,
        total: results.length,
    }
}

describe('v2/overview/controller.ts getOverview', () => {
    let ResponseMock: ReturnType<typeof mockResponse>

    beforeEach(() => {
        ResponseMock = mockResponse()
    })
    
    afterEach(() => {
        jest.resetAllMocks();
    });

    test.each([
        [[], [], [], [], [], [], []],
        [[ChargerMock], [], [], [], [], [], [BaseOverviewMock]],
        [[ChargerMock], [UserMock], [], [], [], [], [UsersOverviewMock]],
        [[ChargerMock], [UserMock], [BillingProfileMock], [], [], [], [BillingProfileOverviewMock]],
        [[ChargerMock], [UserMock], [BillingProfileMock], [ClientMock], [], [], [ClientOverviewMock]],
        [[ChargerMock], [UserMock], [BillingProfileMock], [ClientMock, ClientMock], [], [], [ClientsOverviewMock]],
        [[ChargerMock], [UserMock], [BillingProfileMock], [ClientMock, ClientMock], [SalesTariffMock], [], [TariffsOverviewMock]],
        [[ChargerMock], [UserMock], [BillingProfileMock], [ClientMock, ClientMock], [SalesTariffMock], [ChargingSessionMock], [ChargingSessionOverviewMock]],
    ])(
        'Given chargers %o, users %o, billingProfiles %o, users clients %o and \
         tariffs %o, then getOverview should return %o',
        async (chargers: any, users, billingProfiles, clients, tariffs, sessions, expected) => {
            // Given
            ChargersMock.aggregatePrivateChargers.mockResolvedValueOnce(chargers);
            ChargersMock.aggregateChargingSessions.mockResolvedValueOnce(sessions);
            IdentityMock.findUsersByIds.mockResolvedValueOnce(users);
            IdentityMock.findBillingProfiles.mockResolvedValueOnce(billingProfiles);
            IdentityMock.findUsers.mockResolvedValueOnce(clients);
            TariffsMock.findSalesTariffs.mockResolvedValueOnce(tariffs);

            // then
            await getOverview({ query: {}} as any, ResponseMock as any);

            // should
            expect(ChargersMock.aggregatePrivateChargers).toBeCalledTimes(1)
            expect(ChargersMock.aggregateChargingSessions).toBeCalledTimes(chargers.length ? 1 : 0)
            expect(IdentityMock.findUsersByIds).toBeCalledTimes(chargers.length ? 1 : 0)
            expect(IdentityMock.findBillingProfiles).toBeCalledTimes(chargers.length ? 1 : 0)
            expect(IdentityMock.findUsers).toBeCalledTimes(users.length ? 1 : 0)
            expect(TariffsMock.findSalesTariffs).toBeCalledTimes(chargers[0]?.plugs.length ? 1 : 0)
            expect(ResponseMock.status).toBeCalledWith(200)
            expect(ResponseMock.send).toBeCalledWith(expect.objectContaining(wrapResult(expected)))
        }
    );
});
