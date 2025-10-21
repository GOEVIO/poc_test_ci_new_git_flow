import GroupCSUsers from '../../models/groupCSUsers';
import User from '../../models/user';
import {IGroupCSUser, IGroupCSUserUser} from '../interfaces/groupCSUsers.interface';

export const groupCSUsersFind = (userId: string): Promise<IGroupCSUser[]> => {
    return GroupCSUsers.find({ createUser: userId }).lean();
};

export const getGroupCSUsers = async (groupCSUsers: IGroupCSUser): Promise<IGroupCSUser> => {
    const context = 'Function getGroupCSUsers';

    try {
        const baseList = Array.isArray(groupCSUsers.listOfUsers) ? groupCSUsers.listOfUsers : [];

        const users: IGroupCSUserUser[] = await Promise.all(
            baseList.map(async (user): Promise<IGroupCSUserUser> => {
                if (!user.userId || user.userId === '') {
                    return user;
                }

                try {
                    const foundUser = await User.findOne(
                        { _id: user.userId },
                        {
                            _id: 1,
                            name: 1,
                            mobile: 1,
                            internationalPrefix: 1,
                            imageContent: 1,
                        }
                    ).lean();

                    if (foundUser) {
                        return {
                            _id: user._id,
                            userId: foundUser._id.toString(),
                            name: foundUser.name,
                            mobile: foundUser.mobile,
                            internationalPrefix: foundUser.internationalPrefix,
                            imageContent: foundUser.imageContent,
                            admin: user.admin,
                        };
                    }

                    return user;
                } catch (err: any) {
                    console.error(`[${context}] User.findOne Error: ${err.message}`);
                    return user;
                }
            })
        );

        return {
            ...groupCSUsers,
            listOfUsers: users,
        };
    } catch (error: any) {
        console.error(`[${context}] Error: ${error.message}`);
        throw error;
    }
};


export async function groupCSUsersFindOne(query: Record<string, any>): Promise<IGroupCSUser | null> {
    const context = 'Function groupCSUsersFindOne';

    try {
        const result = await GroupCSUsers.findOne(query).exec();
        return result;
    } catch (err: any) {
        console.error(`[${context}][findOne] Error:`, err.message);
        throw err;
    }
}

export async function groupCSUsersUpdate(
    query: Record<string, any>,
    newValues: Record<string, any>
): Promise<boolean> {
    const context = 'Function groupCSUsersUpdate';

    try {
        const result = await GroupCSUsers.updateOne(query, newValues).exec();
        return result.modifiedCount > 0;
    } catch (error: any) {
        console.error(`[${context}] Error:`, error.message);
        throw error;
    }
}

export async function groupCSUsersCreate(group: IGroupCSUser): Promise<any> {
    try {
        const result = await GroupCSUsers.createGroupCSUsers(new GroupCSUsers(group));
        return result;
    } catch (err) {
        throw err;
    }
}

