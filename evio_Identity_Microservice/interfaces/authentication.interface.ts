import { ObjectId } from 'mongoose';
import { IUserMinimal } from './users.interface';

export interface IDynamicRules {
    [key: string]: object[];
}

export interface IAdminAccounts {
    _id: string,
    name: string,
    email: string,
    language: string,
    imageContent?: string,
}

export interface IAuthenticate {
    _id: string | ObjectId;
    language: string;
    name: string;
    imageContent: string;
    active: boolean;
    mobile: string;
    internationalPrefix: string;
    clientType: string;
    requestUserId: string | ObjectId;
    accountType: string | undefined;
    guestUser: boolean;
    users: Array<IUserMinimal>;
    rules: IDynamicRules;
    accessType?: string;
    accounts?: Array<IAdminAccounts>
}
