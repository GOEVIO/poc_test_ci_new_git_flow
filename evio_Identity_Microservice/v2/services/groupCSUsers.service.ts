import { groupCSUsersFind, getGroupCSUsers } from '../helpers/groupCSUsers.helper';

export const getGroupCSUsersService = async (userId: string) => {
    const groups = await groupCSUsersFind(userId);

    const populatedGroups = await Promise.all(groups.map(group => getGroupCSUsers(group)));

    return populatedGroups;
};
