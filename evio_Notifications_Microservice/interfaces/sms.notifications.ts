export interface IUser {
    internationalPrefix: string;
    mobile: string;
}

export interface IEnvironmentVariables {
    AndroidAppLink?: string;
    iOSAPPLink?: string;
    [key: string]: string | undefined;
}