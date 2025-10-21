import GroupCSUsers from '../../models/groupCSUsers';
import User from '../../models/user';
import { sendSMSNotification } from './sendSMSNotification.helper';
import {
    IGroupCSUsersDependenciesFound,
    IGroupCSUsersDependencies, IUserDependency
} from "../interfaces/groupCSUsersDependencies.interface";

export const verifyExist = async (
    groupCSUsersDependenciesFound: IGroupCSUsersDependenciesFound,
    groupCSUsersDependencies: IGroupCSUsersDependencies,
    groupName: string
): Promise<IGroupCSUsersDependenciesFound> => {
    const context = 'Function verifyExist';

    try {
        const toSendSMSNotification: IUserDependency[] = [];

        for (const user of groupCSUsersDependencies.users) {
            const alreadyExists = groupCSUsersDependenciesFound.users.some(
                (existing) => existing.mobile === user.mobile
            );

            if (!alreadyExists) {
                groupCSUsersDependenciesFound.users.push({
                    mobile: user.mobile,
                    internationalPrefix: user.internationalPrefix,
                    registered: false
                });

                toSendSMSNotification.push(user);
            }
        }

        const group = await GroupCSUsers.findOne(
            { _id: groupCSUsersDependencies.groupId },
            { _id: 1, createUser: 1 }
        ).exec();

        let clientName = groupCSUsersDependenciesFound.clientName || null;

        if (group) {
            const user = await User.findOne(
                { _id: group.createUser },
                { _id: 1, clientName: 1 }
            ).exec();

            clientName = user?.clientName || clientName;

            if (clientName === process.env.clientNameEVIO) {
                sendSMSNotification(toSendSMSNotification, groupName, clientName);
            }
        } else {
            sendSMSNotification(toSendSMSNotification, groupName, clientName);
        }

        return groupCSUsersDependenciesFound;
    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    }
};
