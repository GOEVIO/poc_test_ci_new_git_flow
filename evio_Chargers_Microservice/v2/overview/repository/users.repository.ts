import IdentityLib from 'evio-library-identity';
import { get } from 'evio-library-commons/dist/src/util/function/objects';

export type ProjectedUserType = {
    _id: string;
    name: string;
    email: string;
};

function toEntry(user: ProjectedUserType): [string, ProjectedUserType] {
    return [get('_id', user), user];
}

const projection = {
    _id: 1,
    name: 1,
    email: 1,
};

/**
 * Finds users by userIds and builds a map that matches the id with the user
 */
export async function getUsersMap(userIds: string[]): Promise<Record<string, ProjectedUserType>> {
    if (!userIds.length) {
        return {};
    }
    const users = (await IdentityLib.findUsersByIds(userIds, projection)) as ProjectedUserType[];
    return Object.fromEntries(users.map(toEntry));
}
