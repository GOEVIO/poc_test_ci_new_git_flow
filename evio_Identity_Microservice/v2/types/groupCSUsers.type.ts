export type GroupCSUserUser = {
    _id?: string;
    userId: string;
    name?: string;
    mobile?: string;
    internationalPrefix?: string;
    imageContent?: string;
    admin?: boolean;
    active?: boolean;
};

export type GroupCSUserType = {
    _id: string;
    name: string;
    createUser: string;
    imageContent?: string;
    clientName?: string;
    listOfUsers: GroupCSUserUser[];
    createdAt?: Date;
    updatedAt?: Date;
};
