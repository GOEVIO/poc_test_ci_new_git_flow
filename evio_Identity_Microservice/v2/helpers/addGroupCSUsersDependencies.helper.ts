import GroupCSUsersDependencies from '../../models/groupCSUsersDependencies';
import { verifyExist } from './verifyExists.helper';
import { IGroupCSUser } from '../interfaces/groupCSUsers.interface';
import { IGroupCSUsersDependencies } from "../interfaces/groupCSUsersDependencies.interface";

export const addGroupCSUsersDependencies = async (
    groupCSUsers: IGroupCSUser,
    groupCSUsersDependencies: IGroupCSUsersDependencies
): Promise<void> => {
    const context = 'Function addGroupCSUsersDependencies';

    try {
        const query = { groupId: groupCSUsers._id };
        const existing = await GroupCSUsersDependencies.findOne(query).exec();

        const baseData = existing
            ? existing
            : new GroupCSUsersDependencies({
                userId: groupCSUsers.createUser,
                groupId: groupCSUsers._id,
                clientName: groupCSUsers.clientName,
            });

        const verified = await verifyExist(baseData, groupCSUsersDependencies, groupCSUsers.name);

        if (existing) {
            await GroupCSUsersDependencies.updateGroupCSUsersDependencies(query, { $set: verified });
        } else {
            await GroupCSUsersDependencies.createGroupCSUsersDependencies(verified);
        }

    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    }
};
