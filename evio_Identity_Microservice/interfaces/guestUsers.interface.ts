import {
    ObjectId,
    Document,
    Model,
    FilterQuery,
    QueryOptions,
    UpdateQuery,
    Types
} from 'mongoose';

export interface IAccessPlatformList {
    api: boolean,
    webclient: boolean,
    mobile: boolean,
}

export interface IGuestUserUser {
    userId: Types.ObjectId,
    rulesIds?: Array<string | Types.ObjectId>,
}
export interface IGuestUserUserDocument extends IGuestUserUser, Document {}

export interface IGuestUser {
    name: string,
    email: string,
    ownerId?: string | ObjectId, // TODO: Deprecate ownerId
    clientName: string,
    accessPlatform: IAccessPlatformList,
    active?: boolean,
    users: Array<IGuestUserUserDocument | IGuestUserUser | never>
}

export interface IGuestUserDocument extends IGuestUser, Document {}

export interface IGuestUserModel extends Model<IGuestUserDocument> {
    aggregateRules: (
        match: FilterQuery<IGuestUserDocument>,
        project?: object | null,
        findOne?: boolean,
        getNestedRulesRecursively?: boolean
    ) => Array<object>;
    createGuestUsers: (newGuestUsers: IGuestUser)=> IGuestUserDocument;
    updateGuestUsers: (
        query: FilterQuery<IGuestUserDocument>,
        values: UpdateQuery<IGuestUserDocument>,
        options: QueryOptions) => IGuestUserDocument;
    removeGuestUser: (_id: string | Types.ObjectId)=> void;
}
