import IdentityLib from 'evio-library-identity';
import { get } from 'evio-library-commons/dist/src/util/function/objects';

export type ProjectedClientType = {
    clientList: [
        {
            userId: string;
        }
    ];
};

const projection = {
    clientList: {
        userId: 1,
    },
};

/**
 * Finds the users that have any userId as client
 */
export async function getClients(userIds: string[]): Promise<Array<string>> {
    if (!userIds.length) {
        return [];
    }

    const query = {
        'clientList.userId': { $in: userIds },
    };
    const clients: Array<ProjectedClientType> = (await IdentityLib.findUsers(query, projection)) as any;
    return clients.flatMap(get('clientList')).map(get('userId'));
}
