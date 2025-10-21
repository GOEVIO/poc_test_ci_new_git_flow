import {
    Document, Model, FilterQuery
} from 'mongoose';

export interface IToken {
    userId: string,
    guestUserId?: string,
    token: string,
    refreshToken: string,
    rules?: string,
    clientName: string,
    isMobile: boolean,
    expiresAt?: Date
}

export interface ITokenDocument extends IToken, Document {}

export interface ITokenModel extends Model<ITokenDocument> {
    createToken: (token: ITokenDocument) => ITokenDocument
    updateToken: (
        query: FilterQuery<ITokenDocument>,
        values: Partial<ITokenDocument>
    ) => Promise<ITokenDocument>;
    removeToken: (query: FilterQuery<ITokenDocument>) => Promise<ITokenDocument>;
    removeTokens: (query: FilterQuery<ITokenDocument>) => Promise<Array<ITokenDocument>>;
    removeRules: (query: FilterQuery<ITokenDocument>) => Promise<Array<ITokenDocument>>;
}
