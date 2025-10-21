import { ObjectId, Document, Model, FilterQuery, CallbackError, UpdateQuery } from 'mongoose';
import { IDynamicRules } from './authentication.interface';
import { ReasonForBlockUser } from '../utils/enums/ReasonForBlockUser';
import { ReasonForUnblockUser } from '../utils/enums/ReasonForUnblockUser';

export type ClientType = 'b2b' | 'b2c';

export interface IPhoneNumber {
    mobile?: string;
    internationalPrefix?: string;
}

export interface IPhoneNumberUpdate extends IPhoneNumber {
    _id: string;
}

export interface IPhoneNumberActivation extends IPhoneNumber {
    _id: string;
    clientName?: string;
}

export interface IUserEmailToSendCode {
    _id: string;
    email: string;
    userName: string;
    clientName: string;
    type: TEmailType;
}

export enum TEmailType {
    resendCode = 'resendCode'
}

export interface IGetUserByClientName {
    field?: 'email' | 'username' | 'mobile' | 'clientType';
    value?: string;
    pageNumber?: number;
    limitQuery?: number;
}

export interface IGetPaginationTotals {
    total: number;
    pages: number;
}

export interface IAddressModel {
    street?: string;
    number?: string;
    floor?: string;
    zipCode?: string;
    city?: string;
    state: string;
    country: string;
    countryCode: string;
}

interface IGeometry {
    type?: string;
    coordinates?: Array<number>;
}

export interface IReferencePlacesModel {
    name: string;
    type: 'WORK' | 'HOME' | 'OTHER';
    address: IAddressModel;
    geometry: IGeometry;
    addressIdCaetanoGo?: string;
}

interface IUnitOfMeasurement {
    uom: string;
    value: number;
}

export interface IEvioCommissionModel {
    minAmount: IUnitOfMeasurement;
    transaction: IUnitOfMeasurement;
}

interface ISpecialClient {
    userId: ObjectId | string;
    minAmount?: number;
    percentage?: number;
}

export interface IEvioCommissionsModel {
    minAmount?: IUnitOfMeasurement;
    percentage?: number;
    specialClients?: Array<ISpecialClient>;
}

export interface IUserPackageModel {
    packageId?: ObjectId | string;
    packageName: string;
    packageType: string;
    rfidCardsLimit?: number;
    fleetsLimit?: number;
    evsLimit?: number;
    driversLimit?: number;
    groupOfDriversLimit?: number;
    driversInGroupDriversLimit?: number;
    chargingAreasLimit?: number;
    evioBoxLimit?: number;
    chargersLimit?: number;
    tariffsLimit?: number;
    chargersGroupsLimit?: number;
    userInChargerGroupsLimit?: number;
    searchLocationsLimit?: string;
    searchChargersLimit?: string;
    comparatorLimit?: string;
    routerLimit?: string;
    cardAssociationEnabled?: boolean;
    billingTariffEnabled?: boolean;
    mileageEntryEnabled?: boolean;
    energyManagementEnabled?: boolean;
    createB2BUsers?: boolean;
    createB2CUsers?: boolean;
}

export interface IFavorites {
    baseId?: ObjectId | string;
    hwId: ObjectId | string;
    chargerType?: string;
}

export interface IClientList {
    userId: ObjectId | string;
    clientType: 'fleet' | 'infrastructure' | 'both';
}

export interface IUserMinimal {
    _id: ObjectId;
    name: string;
    imageContent?: string;
}

export interface IDeletionClearance {
    actionDate: Date;
    isCleared: boolean;
    reason: string;
}
export interface IUnsubscribedLink {
    hash?: string;
    link?: string;
}

export interface IUser {
    username: string;
    password?: string;
    email: string;
    name: string;
    mobile: string;
    active?: boolean;
    status?: string;
    validated?: boolean;
    accountDeletionRequested?: boolean;
    deletionClearance?: IDeletionClearance[];
    licenseAgreement?: boolean;
    licenseMarketing?: boolean;
    licenseServices?: boolean;
    licenseProducts?: boolean;
    unsubscribedLink?: IUnsubscribedLink;
    country?: string;
    language?: string;
    internationalPrefix?: string;
    createDate?: string | Date;
    imageContent?: string;
    favorites?: Array<IFavorites>;
    referencePlaces?: Array<IReferencePlacesModel>;
    accessType?: 'limited' | 'all'; //Can be "limited", "all"
    userPackage?: IUserPackageModel;
    clientType: ClientType;
    devUser?: boolean;
    blocked?: boolean;
    paymentPeriod?: 'AD_HOC' | 'MONTHLY'; //AD_HOC / MONTHLY
    clientList?: Array<IClientList>;
    paymentMethodB2B?: string;
    needChangePassword?: boolean;
    isBankTransferEnabled?: boolean;
    isMBRefEnabled?: boolean;
    partyId?: string;
    operatorId?: ObjectId | string;
    operator?: string;
    operatorContact?: string;
    operatorEmail?: string;
    evioCommission?: IEvioCommissionModel;
    changedEmail?: boolean;
    clientName?: string;
    userType?: string;
    idGoData?: object;
    idCaetanoGo?: string;
    idHyundai?: string;
    idHyundaiCode?: string;
    billingProfile?: object;
    evioCommissions?: IEvioCommissionsModel;
    cardNumber?: string;
    memberNumber?: string;
    activePartner?: boolean;
    cardAndMemberNotValid?: boolean;
    faildConnectionACP?: boolean;
    emailToChange?: string;
    userIds?: Array<ObjectId>;
    users?: Array<IUserMinimal>;
    anonymizationDate?: Date;
    pendingMobile?: IPhoneNumber;
    isEmailVerified?: boolean;
    enabledNetworks?: IUserEnabledNetworks;
    visibleNetworks?: IUserVisibleNetworks;
    defaultNetworks?: IUserEnabledNetworks;
}

export interface IUserDocument extends IUser, Document {}

export interface IUserRestrictedReturn {
    _id: string;
    name: string;
    username: string;
    email: string;
    mobile: string;
    internationalPrefix?: string;
    clientType: string;
    clientName?: string;
    imageContent?: string;
    active?: boolean;
    country?: string;
    language?: string;
}

export interface IUserModel extends Model<IUserDocument> {
    blockUser: (userId: string, reason: ReasonForBlockUser, callback?: { (err: CallbackError, result: IUserDocument | null): void }) => Promise<IUserDocument>;
    unlockUser: (userId: string, reason: ReasonForUnblockUser, callback?: { (err: CallbackError, result: IUserDocument | null): void }) => Promise<IUserDocument>;
    getEncriptedPassword: (
        userPassword: string,
        callback?: { (_: null, password: string): void }
    ) => string;
    getUsersByClientName: (
        clientName: string,
        additionalFilters?: FilterQuery<IUserDocument>,
        currentPage?: string | number,
        limit?: string | number,
        project?: object
    ) => Promise<Array<Partial<IUserDocument>>>;
    getUsersCountByClientName: (
        clientName: string,
        additionalFilters?: FilterQuery<IUserDocument>,
        limit?: string | number
    ) => Promise<IGetPaginationTotals>;
    aggregateNestedUsers: (
        match: FilterQuery<IUserDocument>,
        project?: object | null,
        findOne?: boolean
    ) => Array<object>;
    isUsedEmail: (
        email: string,
        userId: string,
        clientName: string
    ) => Promise<boolean>;
    isUsedMobile: (
        mobile: string,
        userId: string,
        clientName: string,
        internationalPrefix?: string
    ) => Promise<boolean>;
    updateUser: (query: FilterQuery<IUserDocument>,
        values: UpdateQuery<IUserDocument>,
        callback?: { (err: CallbackError, result: IUserDocument | null): void }) => Promise<IUserDocument>;
    getUnsubscribedLink: (userId: string, clientName: string, formLink: string) => IUnsubscribedLink;
}

export interface IUserValidationResponse {
    auth: boolean;
    message: string;
    code: string;
}

export interface IUserDocumentAggregated extends IUserDocument {
    users: Array<IUserMinimal>;
    rules?: IDynamicRules;
}

export interface IUserCaetanoGOUpdate {
    name: string;
    mobile: string;
    internationalPrefix?: string;
    imageContent?: string;
}
export interface IUserPatchCaetanoGO {
    name: string;
    phone_number: string;
    phone_code?: string;
    sub_marketing?: string
}

export interface IUserEnabledNetworks {
    EVIO?: boolean;
    MOBIE?: boolean;
    GIREVE?: boolean;
    HUBJECT?: boolean
}

export interface IUserVisibleNetworks {
    resources: string;
    networks: Array<string>;
}

export type TAccountType = 'MASTER' | 'GUEST';

export interface IUserPassword {
    userId: string;
    password: string;
    failedAttempts?: number;
}
export interface IUnsubscribedLink {
    hash?: string;
    link?: string;
}