export interface IGroupCSUserUser {
    _id?: string;
    userId: string;
    name?: string;
    mobile?: string;
    internationalPrefix?: string;
    imageContent?: string;
    admin?: boolean;
    active?: boolean;
}

export interface IGroupCSUser {
    _id: string;
    name: string;
    createUser: string;
    imageContent?: string;
    clientName?: string;
    listOfUsers: IGroupCSUserUser[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IBasicUserInfo {
    _id: string;
    name: string;
    mobile: string;
    internationalPrefix: string;
}
