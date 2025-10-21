import { findOneUser } from './findOneUser.helper';
import { IGroupCSUser, IGroupCSUserUser } from '../interfaces/groupCSUsers.interface';
import { IGroupCSUsersDependencies } from '../interfaces/groupCSUsersDependencies.interface';

export async function verifyUsers(
    group: IGroupCSUser,
    clientName: string
): Promise<{
    updatedGroup: IGroupCSUser;
    dependencies: IGroupCSUsersDependencies;
}> {
    const unmatchedUsers: IGroupCSUserUser[] = [];

    for (const user of group.listOfUsers) {
        if (!user.userId) {
            try {
                const query = {
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix,
                    clientName
                };

                const userFound = await findOneUser(query);

                if (userFound) {
                    user.active = true;
                    user.userId = userFound._id;
                } else {
                    user.active = false;
                    user.userId = '';
                    unmatchedUsers.push(user);
                }
            } catch (error) {
                throw new Error(`Error to verify user ${user.mobile}: ${(error as Error).message}`);
            }
        } else {
            user.active = true;
        }
    }

    const dependencies: IGroupCSUsersDependencies = {
        groupId: group._id,
        clientName,
        users: unmatchedUsers.map(user => ({
            mobile: user.mobile || '',
            internationalPrefix: user.internationalPrefix || '',
            registered: false
        }))
    };

    return {
        updatedGroup: group,
        dependencies
    };
}
