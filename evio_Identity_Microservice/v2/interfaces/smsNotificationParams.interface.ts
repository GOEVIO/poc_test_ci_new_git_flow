import {IGroupCSUserUser} from "./groupCSUsers.interface";

export interface ISMSNotificationParams {
    value: Partial<IGroupCSUserUser>[];
    groupName: string;
    clientName: string | null;
}
