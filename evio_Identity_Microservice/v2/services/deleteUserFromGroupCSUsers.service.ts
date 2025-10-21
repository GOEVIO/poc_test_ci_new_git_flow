import { IGroupCSUser } from '../interfaces/groupCSUsers.interface';
import {
    getGroupCSUsers,
    groupCSUsersFindOne,
    groupCSUsersUpdate
} from '../helpers/groupCSUsers.helper';
import {
    BadRequest,
    NotFound,
    ServerError
} from '../../utils';

export const deleteUserFromGroupCSUsersService = async (
    received: IGroupCSUser,
    userId: string
): Promise<any> => {
    const context = 'PATCH /api/private/groupCSUsers';

    try {
        const query = { _id: received._id };
        const groupCSUsersFound = await groupCSUsersFindOne(query);

        if (!groupCSUsersFound) {
            throw NotFound('Group charger station users not found for given parameters', context);
        }

        if (groupCSUsersFound.listOfUsers.length === 0) {
            throw BadRequest('No Users to remove', context);
        }

        const updatedList = groupCSUsersFound.listOfUsers.filter(existingUser => {
            return !received.listOfUsers.some(remUser =>
                existingUser.mobile === remUser.mobile &&
                existingUser.internationalPrefix === remUser.internationalPrefix &&
                existingUser.userId === remUser.userId
            );
        });

        groupCSUsersFound.listOfUsers = updatedList;
        const newValues = { $set: { listOfUsers: updatedList } };
        const updated = await groupCSUsersUpdate(query, newValues);

        if (!updated) {
            throw BadRequest('Users unsuccessfully removed', context);
        }

        return await getGroupCSUsers(groupCSUsersFound);

    } catch (error: any) {
        if (error.statusCode) {
            throw error;
        }
        throw ServerError(error.message || 'Internal server error', context);
    }
};
