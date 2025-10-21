import { groupCSUsersFindOne, groupCSUsersUpdate, getGroupCSUsers } from '../helpers/groupCSUsers.helper';
import { confirmExist } from '../helpers/confirmExist.helper';
import {
    BadRequest,
    NotFound,
    ServerError
} from '../../utils';
import { IGroupCSUser } from '../interfaces/groupCSUsers.interface';

export const addUserFromGroupCSUsersService = async (
    received: any,
    userId: string
): Promise<any> => {
    const context = 'PUT /api/private/groupCSUsers';

    try {
        const query = { _id: received._id };

        const groupCSUsersFound = await groupCSUsersFindOne(query);
        if (!groupCSUsersFound) {
            throw NotFound('Group charger station users not found for given parameters.', context);
        }

        const updatedGroup: IGroupCSUser = await confirmExist(groupCSUsersFound, received);
        const updateResult = await groupCSUsersUpdate(query, { $set: updatedGroup });

        if (!updateResult) {
            throw BadRequest('Add unsuccessful.', context);
        }

        return await getGroupCSUsers(updatedGroup);

    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw ServerError(error.message || 'Unexpected error during group update.', context);
    }
};
