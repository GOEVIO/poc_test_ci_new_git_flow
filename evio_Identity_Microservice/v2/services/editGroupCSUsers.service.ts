import { IGroupCSUser } from '../interfaces/groupCSUsers.interface';
import { removeImageContent, saveImageContent } from '../helpers/imageHandler.helper';
import { getGroupCSUsers, groupCSUsersFindOne, groupCSUsersUpdate } from '../helpers/groupCSUsers.helper';
import {
    BadRequest,
    ServerError
} from '../../utils';

export const editGroupCSUsersService = async (
    received: IGroupCSUser,
    userId: string
): Promise<any> => {
    const context = 'PATCH /api/private/groupCSUsers/update';

    try {
        const query = { _id: received._id };
        const groupCSUsersFound = await groupCSUsersFindOne(query);

        if (!groupCSUsersFound) {
            throw BadRequest('Group charger station users not found for given parameters.', context);
        }

        groupCSUsersFound.name = received.name;

        if (received.imageContent === '' && groupCSUsersFound.imageContent !== '') {
            await removeImageContent(groupCSUsersFound);
            groupCSUsersFound.imageContent = '';
        }

        if (received.imageContent?.includes('base64')) {
            await removeImageContent(groupCSUsersFound);
            const saved = await saveImageContent(received);
            groupCSUsersFound.imageContent = saved.imageContent;
        }

        const newValues = { $set: groupCSUsersFound };
        const updated = await groupCSUsersUpdate(query, newValues);

        if (!updated) {
            throw BadRequest('Add unsuccessful.', context);
        }

        return await getGroupCSUsers(groupCSUsersFound);
    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw ServerError('Unexpected error during group deletion.', context);
    }
};
