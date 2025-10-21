import {fetchUserFleets} from "./fetchUserFleets";

export async function buildAccessGroups(charger: any, userId: string) {
    const plugs = charger.plugs || [];
    const fleetIds = (charger.listOfFleets || []).map(f => f.fleetId);

    const userFleets = await fetchUserFleets(userId);

    const accessGroups: {
        id: string;
        name: string;
        type: 'Internal' | 'External';
        plugs: {
            plugId: string;
            tariffId: string;
            name: string;
        }[];
    }[] = [];

    for (const fleet of charger.listOfFleets || []) {
        const fullFleetInfo = userFleets.find(f => f._id === fleet.fleetId);

        const isInternal = fullFleetInfo?.createUserId === userId;

        accessGroups.push({
            id: fleet.fleetId,
            name: fleet.fleetName,
            type: isInternal ? 'Internal' : 'External',
            plugs: plugs.map(plug => {
                const tariff = plug.tariff?.find(t => t.fleetId === fleet.fleetId);
                return {
                    plugId: plug.plugId,
                    tariffId: tariff?.tariffId || '',
                    name: tariff?.name || 'No tariff'
                };
            })
        });
    }

    for (const group of charger.listOfGroups || []) {
        accessGroups.push({
            id: group.groupId,
            name: group.groupName,
            type: 'External',
            plugs: plugs.map(plug => {
                const tariff = plug.tariff?.find(t => t.groupId === group.groupId);
                return {
                    plugId: plug.plugId,
                    tariffId: tariff?.tariffId || '',
                    name: tariff?.name || 'No tariff'
                };
            })
        });
    }

    return accessGroups;
}
