import { filterDuplicates, get, equals, isIncluded, isNotUndefined } from 'evio-library-commons/dist/src/util/function';

import { ProjectedUserType } from '../repository/users.repository';
import { ProjectedBillingProfileType } from '../repository/billing-profiles.repository';
import { ProjectedChargingSessionType } from '../repository/charging-sessions.repository';
import { ProjectedChargerType } from '../repository/chargers.repository';
import { OverviewDtoType } from '../types/overview-dto.type';
import YesNo from '../types/yes-no.type';
import YesNoDash from '../types/yes-no-dash.type';

export type ToOverviewDtoParams = {
    users: Record<string, ProjectedUserType>;
    billingProfiles: Record<string, ProjectedBillingProfileType>;
    clients: string[];
    salesTariffs: string[];
    chargingSessions: Record<string, ProjectedChargingSessionType>;
};

function getTariffIdsFromCharger(charger: ProjectedChargerType): Array<string> {
    return filterDuplicates(charger.plugs.flatMap(get('tariff')).filter(isNotUndefined).map(get('tariffId')).filter(isNotUndefined));
}

export const toOverviewDto =
    ({ users, billingProfiles, clients, salesTariffs, chargingSessions }: ToOverviewDtoParams) =>
    (charger: ProjectedChargerType): OverviewDtoType => {
        const owner = users[charger.createUser];
        const ownerBillingProfile = billingProfiles[charger.createUser];
        const usersWithOwnerAsClient = clients.filter(equals(charger.createUser));
        const tariffIds = getTariffIdsFromCharger(charger);
        return {
            _id: charger._id,
            hwId: charger.hwId,
            createUser: charger.createUser,
            createdAt: charger.createdAt,
            numberOfPlugs: charger.plugs.length,
            clientName: charger.clientName,
            operationalStatus: charger.operationalStatus,
            status: charger.status,
            isActive: YesNo.fromBoolean(charger.status === process.env.ChargePointStatusEVIO),
            lastHeartBeat: charger.heartBeat,
            B2B2C: YesNoDash.fromLength(usersWithOwnerAsClient.length),
            monetization: YesNo.fromBoolean(tariffIds.some(isIncluded(salesTariffs))),
            customerName: owner?.name,
            customerEmail: owner?.email,
            customerNif: ownerBillingProfile?.nif,
            lastMonetizationSession: chargingSessions[charger.hwId]?.startDate,
        };
    };
