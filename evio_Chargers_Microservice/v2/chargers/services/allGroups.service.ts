import axios from 'axios';
import Constants from '../../../utils/constants';

const USERS_SERVICE_URL = `${Constants.hosts.users}${Constants.paths.getGroupCSUsersV2}`;
const EVS_SERVICE_URL = `${Constants.hosts.evs}${Constants.paths.getToAddOnChargerB2B}`;

export const fetchAllGroups = async (userId: string) => {
    const headers = { userid: userId };

    let groupCSUsersRes, fleetsRes;

    try {
        [groupCSUsersRes, fleetsRes] = await Promise.all([
            axios.get(USERS_SERVICE_URL, { headers }),
            axios.get(EVS_SERVICE_URL, { headers }),
        ]);
    } catch (err) {
        console.error('[fetchAllGroups] Failed to fetch data from dependent services:', err);
        throw new Error('Failed to retrieve group and fleet data.');
    }

    const rawUsersData = groupCSUsersRes?.data;
    const groupCSUsersRaw = Array.isArray(rawUsersData)
        ? rawUsersData
        : Array.isArray(rawUsersData?.groups)
            ? rawUsersData.groups
            : [];

    const groupCSUsers = groupCSUsersRaw
        .filter((g: any) => g && typeof g === 'object')
        .map((g: any) => ({
            _id: g._id ?? g.id ?? null,
            name: (g.name ?? g.groupName ?? g.title ?? '').trim(),
            imageContent: g.imageContent || '',
            listOfUsers: Array.isArray(g.listOfUsers) ? g.listOfUsers : [],
        }))
        .filter((g: any) => !!g._id && g.name !== '');

    const fleets = Array.isArray(fleetsRes?.data) ? fleetsRes.data : [];

    const internalFleets = fleets.filter((f: any) => String(f.createUserId) === String(userId));
    const externalFleets = fleets.filter((f: any) => String(f.createUserId) !== String(userId));

    const internalGroups = internalFleets.map((fleet: any) => ({
        _id: fleet._id,
        name: fleet.name,
        imageContent: fleet.imageContent,
        type: 'fleet',
        details: Array.isArray(fleet.listEvs)
            ? fleet.listEvs.map((ev: any) => ({
                _id: ev._id,
                title: `${ev.brand || ''} ${ev.model || ''}`.trim(),
                subtitle: ev.licensePlate || '',
                image: ev.imageContent || '',
            }))
            : [],
    }));

    const externalGroups = [
        ...groupCSUsers.map((group: any) => ({
            _id: group._id,
            name: group.name,
            imageContent: group.imageContent,
            type: 'group',
            details: Array.isArray(group.listOfUsers)
                ? group.listOfUsers.map((user: any) => ({
                    _id: user._id || user.userId,
                    title: user.mobile ? Constants.title.mobile : Constants.title.cardEVIO,
                    subtitle: user.name,
                    image: user.imageContent || '',
                }))
                : [],
        })),
        ...externalFleets.map((fleet: any) => ({
            _id: fleet._id,
            name: fleet.name,
            imageContent: fleet.imageContent,
            type: 'fleet',
            details: Array.isArray(fleet.listEvs)
                ? fleet.listEvs.map((ev: any) => ({
                    _id: ev._id,
                    title: `${ev.brand || ''} ${ev.model || ''}`.trim(),
                    subtitle: ev.licensePlate || '',
                    image: ev.imageContent || '',
                }))
                : [],
        })),
    ];

    return { internalGroups, externalGroups };
};
