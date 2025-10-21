export interface IEmailChangeRequest {
    userId: string;
    type: string;
    clientName: string;
    oldEmail: string;
    newEmail: string;
    verificationCode: string;
    expiresAt: Date | null;
    clientType: string;
}

export interface IRequestEmailChangeWithTokenParams {
    type: string;
    userId: string;
    clientName: string;
    name: string;
    userEmail: string;
    oldEmail: string;
    newEmail: string;
    emailTemplate: string;
    clientType: string;
    expiresAt: Date | null;
}

export interface IRequestEmailChangeWithHashLinkParams {
    type: string;
    userId: string;
    clientName: string;
    name: string;
    oldEmail: string;
    newEmail: string;
    emailTemplate: string;
    clientType: string;
    expiresAt: Date | null;
    language: string;
}

export interface IResponseEmailChange {
    statusCode: number;
    code: string;
    message: string;
}

export interface IHashLinkData {
    verificationCode: string; 
    email: string;
}