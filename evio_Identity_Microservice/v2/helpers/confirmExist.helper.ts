import { findOneUser } from './findOneUser.helper';
import { addGroupCSUsersDependencies } from './addGroupCSUsersDependencies.helper';
import { IBasicUserInfo } from '../interfaces/groupCSUsers.interface';

export async function confirmExist(groupCSUsersFound: any, received: any): Promise<any> {
    const context = 'Function confirmExist';
    const groupCSUsersDependencies: any[] = [];

    const getUser = async (user: any): Promise<void> => {
        const existing = groupCSUsersFound.listOfUsers.find((element: any) =>
            element.mobile === user.mobile &&
            element.internationalPrefix === user.internationalPrefix
        );

        if (existing && existing.userId === user.userId) return;

        let userFound = null;
        if (user.userId) {
            userFound = await findOneUser({ _id: user.userId });
        } else if (user.mobile && user.internationalPrefix) {
            userFound = await findOneUser({
                $and: [{ mobile: user.mobile }, { internationalPrefix: user.internationalPrefix }],
            });
        }

        if (userFound) {
            const u = userFound as IBasicUserInfo;

            user.userId = u._id;
            user.name = u.name;
            user.internationalPrefix = u.internationalPrefix;
            user.mobile = u.mobile;
            user.active = true;
        } else {
            user.userId = '';
            user.active = false;
            groupCSUsersDependencies.push(user);
        }

        groupCSUsersFound.listOfUsers.push(user);
    };

    try {
        await Promise.all(received.listOfUsers.map(getUser));

        if (groupCSUsersDependencies.length > 0) {
            await addGroupCSUsersDependencies(groupCSUsersFound, {
                users: groupCSUsersDependencies,
                groupId: groupCSUsersFound._id,
            });
        }

        return groupCSUsersFound;
    } catch (error: any) {
        console.log(`[${context}] Error`, error.message);
        throw error;
    }
}
