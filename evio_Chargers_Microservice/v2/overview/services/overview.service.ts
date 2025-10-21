import { filterDuplicates, get, isNotUndefined } from 'evio-library-commons/dist/src/util/function';

import { getBillingProfiles } from '../repository/billing-profiles.repository';
import { getChargers, ProjectedChargerType } from '../repository/chargers.repository';
import { getChargingSessions } from '../repository/charging-sessions.repository';
import { getSalesTariffs } from '../repository/sales-tariffs.repository';
import { getClients } from '../repository/clients.repository';
import { getUsersMap, ProjectedUserType } from '../repository/users.repository';
import { toOverviewDto } from './overview-dto.service';
import { FiltersType } from '../types/filters.type';
import { OverviewDtoType } from '../types/overview-dto.type';

async function getUsersAndClients(userIds: string[]): Promise<[Record<string, ProjectedUserType>, Array<string>]> {
    const users = await getUsersMap(userIds);
    const clients = await getClients(Object.keys(users));
    return [users, clients];
}

function getTariffIdsFromChargers(chargers: ProjectedChargerType[]): Array<string> {
    return filterDuplicates(chargers.flatMap(get('plugs')).flatMap(get('tariff')).filter(isNotUndefined).map(get('tariffId')).filter(isNotUndefined));
}

function getCleanStringValueFromChargers(chargers: ProjectedChargerType[], value: 'createUser' | 'hwId'): Array<string> {
    return filterDuplicates(chargers.map(get(value)).filter(isNotUndefined));
}

export async function getChargersOverview(filters: FiltersType): Promise<Array<OverviewDtoType>> {
    const chargers = await getChargers(filters);
    const userIds = getCleanStringValueFromChargers(chargers, 'createUser');
    const hwIds = getCleanStringValueFromChargers(chargers, 'hwId');
    const tariffsIds = getTariffIdsFromChargers(chargers);

    const [[users, clients], billingProfiles, salesTariffs, chargingSessions] = await Promise.all([
        getUsersAndClients(userIds),
        getBillingProfiles(userIds),
        getSalesTariffs(tariffsIds),
        getChargingSessions(hwIds),
    ]);

    return chargers.map(toOverviewDto({ users, billingProfiles, clients, salesTariffs, chargingSessions }));
}
