export interface IGroupCSUsersDependencies {
    users: {
        mobile: string;
        internationalPrefix: string;
        registered: boolean;
    }[];
    clientName?: string;
    groupId: string;
}

export interface IUserDependency {
    mobile: string;
    internationalPrefix: string;
    registered: boolean;
}

export interface IGroupCSUsersDependenciesFound {
    users: IUserDependency[];
    clientName?: string;
}
