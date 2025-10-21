import { IGroupCSUser } from '../interfaces/groupCSUsers.interface';

export async function validateFields(group: IGroupCSUser): Promise<void> {
    if (!group.name) throw { auth: false, code: 'server_error_group_name_req', message: "Group name is required" };
    if (!group.createUser) throw { auth: false, code: 'server_error_group_id_req', message: "Group Id is required" };
}
