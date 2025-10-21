import { validateFields } from '../helpers/validateFields.helper';
import { findOneUser } from '../helpers/findOneUser.helper';
import { groupCSUsersCreate, getGroupCSUsers } from '../helpers/groupCSUsers.helper';
import { saveImageContent } from '../helpers/imageHandler.helper';
import { verifyUsers } from '../helpers/verifyUsers.helper';
import GroupCSUsersModel from '../../models/groupCSUsers';
import { IGroupCSUser, IGroupCSUserUser } from '../interfaces/groupCSUsers.interface';
import {
    BadRequest,
    ServerError
} from '../../utils';

export const addGroupCSUsersService = async (
    body: Partial<IGroupCSUser>,
    createUser: string,
    clientName: string
): Promise<any> => {
    const context = 'POST /api/private/groupCSUsers';

    try {
        const groupCSUsers = new GroupCSUsersModel(body) as unknown as IGroupCSUser;

        groupCSUsers.imageContent = groupCSUsers.imageContent || '';
        groupCSUsers.createUser = createUser;
        groupCSUsers.clientName = clientName;

        await validateFields(groupCSUsers as IGroupCSUser);

        let userInList = groupCSUsers.listOfUsers.find((user: IGroupCSUserUser) => user.userId === createUser);
        const creatorWasInList = !!userInList;

        if (!userInList) {
            const userFound = await findOneUser({ _id: createUser });
            const newUser: IGroupCSUserUser = {
                userId: userFound._id,
                name: userFound.name,
                mobile: userFound.mobile,
                internationalPrefix: userFound.internationalPrefix,
                active: true,
                admin: true
            };
            groupCSUsers.listOfUsers.push(newUser);
        } else {
            userInList.admin = true;
        }

        if (groupCSUsers.imageContent !== '') {
            if (!groupCSUsers._id) {
                console.warn(`[${context}] Warning: groupCSUsers._id is undefined before saving image`);
            }
            await saveImageContent(groupCSUsers);
        }

        const onlyCreatorInList = groupCSUsers.listOfUsers.length === 1 &&
            groupCSUsers.listOfUsers[0].userId === createUser;

        if (!onlyCreatorInList || creatorWasInList) {
            await verifyUsers(groupCSUsers, clientName);
        }

        const result = await groupCSUsersCreate(groupCSUsers);
        if (!result) {
            throw BadRequest('Group not created', context);
        }

        return await getGroupCSUsers(result);

    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw ServerError(error.message || 'Unexpected error during group deletion.', context);
    }
};
