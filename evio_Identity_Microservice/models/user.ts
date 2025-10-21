import { FilterQuery, Schema, Types, model, UpdateQuery, CallbackError, QueryOptions } from 'mongoose';
import dotenv from 'dotenv-safe';
import crypto from 'crypto';
import Constants from '../utils/constants';
import {
    IAddressModel,
    IClientList,
    IEvioCommissionModel,
    IEvioCommissionsModel,
    IFavorites,
    IGetPaginationTotals,
    IReferencePlacesModel,
    IUserDocument,
    IUserModel,
    IUserPackageModel,
    IUnsubscribedLink,
    IPhoneNumber,
    IUserEnabledNetworks,
    IUserVisibleNetworks,
} from '../interfaces/users.interface';
import { statusEnum } from '../utils/enums/users';
import { ReasonForBlockUser } from '../utils/enums/ReasonForBlockUser';
import { ReasonForUnblockUser } from '../utils/enums/ReasonForUnblockUser';

dotenv.load();

const pendingMobileModel = new Schema<IPhoneNumber>({
    mobile: String,
    internationalPrefix: String,
});

const addressModel = new Schema<IAddressModel>({
    street: String,
    number: String,
    floor: String,
    zipCode: String,
    city: String,
    state: String,
    country: String,
    countryCode: String,
});

const favoritesModel = new Schema<IFavorites>({
    baseId: String,
    hwId: String,
    chargerType: String,
});

const clientListModel = new Schema<IClientList>({
    userId: String,
    clientType: String, // fleet, infrastructure, both
});

const referencePlacesModel = new Schema<IReferencePlacesModel>({
    name: String,
    type: String, // WORK, HOME, OTHER
    address: { type: addressModel },
    geometry: {
        type: { type: String, default: 'Point' },
        coordinates: { type: [Number], index: '2dsphere' },
    },
    addressIdCaetanoGo: String,
});

const evioCommissionModel = new Schema<IEvioCommissionModel>({
    minAmount: {
        uom: String, // Unit of measurement
        value: { type: Number }, // Value
    },
    transaction: {
        uom: String, // Unit of measurement
        value: { type: Number }, // Value
    },
});

const evioCommissionsModel = new Schema<IEvioCommissionsModel>({
    minAmount: {
        uom: String, // Unit of measurement
        value: { type: Number }, // Value
    },
    percentage: {
        value: { type: Number }, // Value
    },
    specialClients: [
        {
            userId: String, // User that is special
            minAmount: { type: Number },
            percentage: { type: Number },
        },
    ],
});

const userPackageModel = new Schema<IUserPackageModel>({
    packageId: {
        type: String,
    },
    packageName: {
        type: String,
        default: process.env.PackageNameFree,
    },
    packageType: {
        type: String,
        default: process.env.PackageTypeFree,
    },
    rfidCardsLimit: {
        type: Number,
        default: 1,
    },
    fleetsLimit: {
        type: Number,
        default: 1,
    },
    evsLimit: {
        type: Number,
        default: 5,
    },
    driversLimit: {
        type: Number,
        default: 1,
    },
    groupOfDriversLimit: {
        type: Number,
        default: 1,
    },
    driversInGroupDriversLimit: {
        type: Number,
        default: 1,
    },
    chargingAreasLimit: {
        type: Number,
        default: 1,
    },
    evioBoxLimit: {
        type: Number,
        default: 1,
    },
    chargersLimit: {
        type: Number,
        default: 1,
    },
    tariffsLimit: {
        type: Number,
        default: 1,
    },
    chargersGroupsLimit: {
        type: Number,
        default: 1,
    },
    userInChargerGroupsLimit: {
        type: Number,
        default: 1,
    },
    searchLocationsLimit: {
        type: String,
        default: 'UNLIMITED',
    },
    searchChargersLimit: {
        type: String,
        default: 'UNLIMITED',
    },
    comparatorLimit: {
        type: String,
        default: 'UNLIMITED',
    },
    routerLimit: {
        type: String,
        default: 'UNLIMITED',
    },
    cardAssociationEnabled: {
        type: Boolean,
        default: false,
    },
    billingTariffEnabled: {
        type: Boolean,
        default: false,
    },
    mileageEntryEnabled: {
        type: Boolean,
        default: false,
    },
    energyManagementEnabled: {
        type: Boolean,
        default: false,
    },
    createB2BUsers: {
        type: Boolean,
        default: false,
    },
    createB2CUsers: {
        type: Boolean,
        default: false,
    },
});

const deletionClearanceSchema = new Schema({
    actionDate: {
        type: Date,
        required: true,
    },
    isCleared: {
        type: Boolean,
        required: true,
    },
    reason: {
        type: String,
        required: false,
    }
});

const unsubscribedLink = new Schema<IUnsubscribedLink>({
    hash: String,
    link: String,
});

const blockHistorySchema = new Schema({
    actionDate: {
        type: Date,
        required: true,
    },
    blocked: {
        type: Boolean,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    }
});

const visibleNetworksModel = new Schema<IUserVisibleNetworks>({
    resource : {
        type: String,
    },
    networks : {
        type: Array,
    }
});

const enabledNetworksModel = new Schema<IUserEnabledNetworks>({
    EVIO : {
        type: Boolean,
        default: true,
    },
    MOBIE : {
        type: Boolean,
        default: true,
    },
    GIREVE : {
        type: Boolean,
        default: true,
    },
    HUBJECT : {
        type: Boolean,
        default: true,
    },
});

const userSchema = new Schema<IUserDocument>(
    {
        username: {
            type: String,
            index: true,
            require: true,
        },
        password: {
            type: String,
            require: true,
        },
        email: {
            type: String,
            require: true,
            index: true,
        },
        name: {
            type: String,
            require: true,
            index: true,
        },
        mobile: {
            type: String,
            require: true,
            index: true,
        },
        active: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: statusEnum,
            default: statusEnum.registered,
        },
        validated: {
            type: Boolean,
            default: false,
        },
        // Flag indicating that the user has requested account deletion
        accountDeletionRequested: {
            type: Boolean,
            default: false,
        },
        // Array of objects indicating deletion clearance records
        deletionClearance: {
            type: [deletionClearanceSchema],
            default: [],
        },
        licenseAgreement: {
            type: Boolean,
            default: false,
        },
        licenseMarketing: {
            type: Boolean,
            default: false,
        },
        licenseServices: {
            type: Boolean,
            default: false,
        },
        licenseProducts: {
            type: Boolean,
            default: false,
        },
        unsubscribedLink: unsubscribedLink,
        country: {
            type: String,
            default: 'PT',
        },
        language: {
            type: String,
            default: 'pt',
        },
        internationalPrefix: {
            type: String,
            default: '+351',
        },
        createDate: {
            type: Date,
            default: Date.now,
        },
        imageContent: {
            type: String,
            default: '',
        },
        favorites: [favoritesModel],
        referencePlaces: [referencePlacesModel],
        accessType: {
            type: String,
            default: process.env.AccessTypeLinited,
        }, // Can be "limited", "all"
        userPackage: userPackageModel,
        clientType: {
            type: String,
            default: process.env.ClientTypeb2c,
            index: true,
        }, // Can be "b2c", "b2b"
        devUser: { type: Boolean, default: false },
        blocked: { type: Boolean, default: false },
        paymentPeriod: {
            type: String,
            default: process.env.PaymentPeriodAD_HOC,
        }, // AD_HOC / MONTHLY
        clientList: [clientListModel],
        paymentMethodB2B: String,
        needChangePassword: { type: Boolean, default: false },
        isBankTransferEnabled: { type: Boolean, default: false },
        isMBRefEnabled: { type: Boolean, default: false },
        partyId: String,
        operatorId: String,
        operator: String,
        operatorContact: String,
        operatorEmail: String,
        evioCommission: evioCommissionModel,
        changedEmail: { type: Boolean, default: false },
        clientName: {
            type: String,
            default: process.env.clientNameEVIO,
            index: true,
        },
        userType: { type: String, default: process.env.UserTypeFinalCostumer },
        idGoData: Object,
        idCaetanoGo: String,
        idHyundai: String,
        idHyundaiCode: String,
        billingProfile: Object,
        evioCommissions: evioCommissionsModel,
        cardNumber: String,
        memberNumber: String,
        activePartner: { type: Boolean, default: false },
        cardAndMemberNotValid: { type: Boolean, default: false },
        faildConnectionACP: { type: Boolean, default: false },
        emailToChange: String,
        userIds: [Types.ObjectId],
        anonymizationDate: {
            type: Date,
            default: null,
        },
        blockHistory: {
            type: [blockHistorySchema],
            default: [],
        },
        pendingMobile: {
            type: pendingMobileModel,
            require: false,
        },
        isEmailVerified: { 
            type: Boolean, 
            default: false 
        },
        visibleNetworks: {
            type: [visibleNetworksModel],
            default: () => ([
                {
                    resource: "locations",
                    networks: ["MOBIE","GIREVE","HUBJECT"],
                }
            ]),
        },
        enabledNetworks: {
            type: enabledNetworksModel,
            default: () => ({
                EVIO: true,
                MOBIE: true,
                GIREVE: true,
                HUBJECT: true,
            }),
        },
        defaultNetworks: {
            type: enabledNetworksModel,
            default: () => ({
                EVIO: true,
                MOBIE: true,
                GIREVE: true,
                HUBJECT: true,
            }),
        },
    },
    {
        timestamps: true,
    }
);

userSchema.statics.getEncriptedPassword = (
    userPassword: string,
    callback?: { (_: null, password: string): void }
): string => {
    const cryptoAlgorithm = process.env.CRYPTO_ALGORITHM as string;
    const cryptoPassword = process.env.CRYPTO_PASSWORD as string;

    const cipher = crypto.createCipher(cryptoAlgorithm, cryptoPassword);
    let encriptedPassword = cipher.update(userPassword, 'utf8', 'hex');
    encriptedPassword += cipher.final('hex');

    if (callback) callback(null, encriptedPassword);
    return encriptedPassword;
};

userSchema.statics.updateUserFilter = function (
    query,
    values,
    filter,
    callback
) {
    this.findOneAndUpdate(query, values, filter, callback);
};

userSchema.statics.createUser = function (newUser, callback) {
    newUser.save(callback);
};

userSchema.statics.deleteUserByUsername = function (
    username,
    clientName,
    callback
) {
    this.findOneAndUpdate(
        {
            username,
            clientName,
            status: process.env.USERRREGISTERED,
        },
        {
            $set: {
                active: false,
                status: process.env.USERREMOVED,
            },
        },
        callback
    );
};

userSchema.statics.getUserByUsername = function (username, callback) {
    const query = { username, status: process.env.USERRREGISTERED };
    this.findOne(query, callback);
};

userSchema.statics.getUserByEmail = function (email, callback) {
    const query = { email };
    this.findOne(query, callback);
};

userSchema.statics.getUserByMobile = function (
    mobile,
    internationalPrefix,
    callback
) {
    const query = {
        mobile,
        internationalPrefix,
    };
    this.findOne(query, callback);
};

userSchema.statics.getUserById = function (id, callback) {
    this.findById(id, callback);
};
userSchema.statics.getUsersByClientName = function (
    clientName: string,
    additionalFilters?: FilterQuery<IUserDocument>,
    currentPage: string | number = 1,
    limit: string | number = Constants.pagination.defaultLimit,
    project: object = {
        _id: 1,
        name: 1,
        email: 1,
        internationalPrefix: 1,
        mobile: 1,
        username: 1,
        clientType: 1,
        blocked: 1,
    }
): Promise<Array<Partial<IUserDocument>>> {
    const accountDeletionFilter = { accountDeletionRequested: { $ne: true } };
    const query: FilterQuery<IUserDocument> = additionalFilters
        ? { ...additionalFilters, clientName, ...accountDeletionFilter }
        : { clientName, ...accountDeletionFilter };
    const options: QueryOptions = {
        skip: (Number(currentPage) - 1) * Number(limit),
        limit: Number(limit),
        collation: { locale: 'en' },
        sort: { name: 1 }
    };
    return this.find(query, project, options).lean();
};

userSchema.statics.getUsersCountByClientName = async function (
    clientName: string,
    additionalFilters?: FilterQuery<IUserDocument>,
    limit: string | number = Constants.pagination.defaultLimit
): Promise<IGetPaginationTotals> {
    const query: FilterQuery<IUserDocument> = additionalFilters
        ? { ...additionalFilters, clientName }
        : { clientName };

    const total = await this.find(query).count();
    const pages = Math.ceil(total / Number(limit));

    return { total, pages };
};

userSchema.statics.blockUser = function (
    userId: string, 
    reason: ReasonForBlockUser, 
    callback?: { (err: CallbackError, result: IUserDocument | null): void }): Promise<IUserDocument> {
    const query = { _id: userId };

    const newValues = {
        $set: { blocked: true },
        $push: {
            blockHistory: {
                actionDate: Date.now(),
                blocked: true,
                reason: reason
            }
        }
    };

    return this.findOneAndUpdate(query, newValues, { new: true }, callback);
};

userSchema.statics.unlockUser = function (
    userId: string, 
    reason: ReasonForUnblockUser, 
    callback?: { (err: CallbackError, result: IUserDocument | null): void }):Promise<IUserDocument> {
    const query = { _id: userId };

    const newValues = {
        $set: { blocked: false },
        $push: {
            blockHistory: {
                actionDate: Date.now(),
                blocked: false,
                reason: reason
            }
        }
    };

    return this.findOneAndUpdate(query, newValues, { new: true }, callback);
};

userSchema.statics.aggregateNestedUsers = function (
    match: FilterQuery<IUserDocument>,
    project?: object | null,
    findOne?: boolean
): Array<object> {
    const matchQuery = { $match: match };
    const graphLookupQuery = {
        $graphLookup: {
            from: this.collection.name,
            startWith: '$userIds',
            connectFromField: 'userIds',
            connectToField: '_id',
            as: 'users',
            maxDepth: 2,
        },
    };
    // const matchActiveNestedUsersQuery = { $match: { 'users.active': true } };

    const unsetQuery = { $unset: ['userIds', 'users.userIds'] };

    const query: Array<object> = [{ ...matchQuery }];

    if (findOne) query.push({ $limit: 1 });

    query.push(
        { ...graphLookupQuery },
        /* { ...matchActiveNestedUsersQuery }, */ { ...unsetQuery }
    );

    if (project) query.push({ $project: project });

    return query;
};

userSchema.statics.isUsedEmail = async function (
    email: string,
    userId: string,
    clientName: string
): Promise<boolean> {
    const query = {
        email,
        _id: { $ne: userId },
        $or: [{ active: true }, { status: process.env.USERRREGISTERED }],
        clientName,
    };
    const user = await this.findOne(query, { _id: 1 });
    return !!user;
};

userSchema.statics.isUsedMobile = async function (
    mobile: string,
    userId: string,
    clientName: string,
    internationalPrefix: string = "+351"
): Promise<boolean> {
    const query = {
        mobile,
        internationalPrefix,
        _id: { $ne: userId },
        $or: [{ active: true }, { status: process.env.USERRREGISTERED }],
        clientName,
    };
    const user = await this.findOne(query, { _id: 1 });
    return !!user;
};

userSchema.statics.updateUser = async function (
    query: FilterQuery<IUserDocument>,
    values: UpdateQuery<IUserDocument>,
    callback?: { (err: CallbackError, result: IUserDocument | null): void }
): Promise<IUserDocument> {
    return this.findOneAndUpdate(query, values, { new: true }, callback);
};

userSchema.statics.getUnsubscribedLink = function (id: string, clientName: string, formLink: string): IUnsubscribedLink {
    const hash = crypto.createHash('SHA256')
        .update(clientName + id)
        .digest('hex')
        .substring(0, 40)
        .toUpperCase();

    return {
        hash,
        link: formLink + hash,
    };
};
  
const User = model<IUserDocument, IUserModel>('User', userSchema);

User.createIndexes(
    {
        name: 1,
        mobile: 1,
        email: 1,
        _id: 1,
    },
    (err) => {
        if (err) console.error(err);
    }
);

export default module.exports = User;
