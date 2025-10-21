import { IUserMinimal } from './users.interface';

export interface IDynamicRules {
    [key: string]: object[];
}

export interface IAdminAccounts {
    _id: string;
    name: string;
    email: string;
    language: string;
    imageContent?: string;
}

export interface IAuthentication {
    id: string;
    token: string;
    refreshtoken: string;
    name: string;
    imageContent?: string;
    message?: string;
    mobile?: string;
    internationalPrefix?: string;
    auth: boolean;
    active?: boolean;
    guestUser?: boolean;
    email?: string;
    users?: Array<IUserMinimal>;
    rules?: Array<IDynamicRules>;
    language: string;
    accessType?: string;
    accounts?: Array<IAdminAccounts>;
}

export interface ICheckAuthentication {
    auth: boolean;
    message: string;
    id: string;
    language: string;
    username: string;
    userType: string;
    requestUserId: string;
    accountType: string;
}

export interface IAuthenticationMessage {
    auth: boolean;
    code: string;
    message: string;
}
