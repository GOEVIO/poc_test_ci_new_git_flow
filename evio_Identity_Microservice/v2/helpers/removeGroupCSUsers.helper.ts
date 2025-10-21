import axios from 'axios';
import GroupCSUsersDependencies from '../../models/groupCSUsersDependencies';
import { IGroupCSUserParams } from "../interfaces/groupCSUserParams.interfaces";

export const removeGroupCSUsersDependencies = async ({ _id }: IGroupCSUserParams): Promise<void> => {
    const context = 'Function removeGroupCSUsersDependencies';
    const query = { groupId: _id };

    try {
        const result = await new Promise<boolean>((resolve, reject) => {
            GroupCSUsersDependencies.removeGroupCSUsersDependencies(query, (err: any, res: any) => {
                if (err) return reject(err);
                resolve(Boolean(res));
            });
        });

        const message = result
            ? 'dependencies successfully removed'
            : 'no dependencies to remove';

        console.log(`[${context}] ${message}`);
    } catch (error: any) {
        console.error(`[${context}] Error: ${error.message}`);
    }
};

export const removeGroupCSUsersFromCharger = async ({ _id }: IGroupCSUserParams): Promise<void> => {
    const context = 'Function removeGroupCSUsersFromCharger';
    const data = { groupCSUsers: _id };
    const host = `${process.env.HostCharger}${process.env.PathRemoveGroupCSUsers}`;

    try {
        const { data: responseData } = await axios.patch(host, data);
        const message = responseData
            ? 'removed from chargers'
            : 'not removed from chargers';

        console.log(`[${context}] Group charger station users ${message}`);
    } catch (error: any) {
        console.error(`[${context}][axios.patch] Error: ${error.message}`);
    }
};
