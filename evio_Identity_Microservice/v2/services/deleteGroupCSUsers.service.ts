import GroupCSUsersModel from '../../models/groupCSUsers';
import { removeImageContent } from '../helpers/imageHandler.helper';
import {
    removeGroupCSUsersFromCharger,
    removeGroupCSUsersDependencies
} from '../helpers/removeGroupCSUsers.helper';
import { IServiceResponse } from "../interfaces/serviceResponse.interfaces";
import {
    BadRequest,
    NotFound,
    ServerError
} from '../../utils';

export const deleteGroupCSUsersService = async (
    query: any,
    userId: string
): Promise<IServiceResponse> => {
    const context = 'DELETE /api/private/groupCSUsers';

    try {
        const groupCSUsersFound = await GroupCSUsersModel.findOne(query).exec();

        if (!groupCSUsersFound) {
            throw NotFound('The specified group of charger station users was not found.', context);
        }

        if (groupCSUsersFound.imageContent) {
            await removeImageContent(groupCSUsersFound);
        }

        const result = await new Promise<boolean>((resolve, reject) => {
            GroupCSUsersModel.removeGroupCSUsers(query, (err: any, res: any) => {
                if (err) return reject(err);
                resolve(Boolean(res));
            });
        });

        if (!result) {
            throw BadRequest('Failed to delete the group of charger station users.', context);
        }

        removeGroupCSUsersFromCharger(query);
        removeGroupCSUsersDependencies(query);

        return {
            status: 200,
            data: {
                auth: true,
                code: 'server_groupCSUsers_successfully_removed',
                message: 'Group of charger station users successfully removed'
            }
        };
    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw ServerError(error.message || 'Unexpected error during group deletion.', context);
    }
};
