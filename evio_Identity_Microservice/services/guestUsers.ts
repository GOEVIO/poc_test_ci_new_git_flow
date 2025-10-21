import { Types } from 'mongoose';
import dotenv from 'dotenv-safe';

import axios from 'axios';
import { BadRequest, NotFound, ServerError } from '../utils';

import GuestUser from '../models/guestUsers';
import UserPasswords from '../models/userPasswords';
import {
    IGuestUserDocument,
    IGuestUserUser,
} from '../interfaces/guestUsers.interface';
import Rule from '../models/rules';
import { IDynamicRules } from '../interfaces/authentication.interface';

dotenv.load();

function validateFieldsCreate(guestUser, password) {
    return new Promise((resolve, reject) => {
        const regexPasswordValidation =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@_$!%*?&])[A-Za-z\d@_$!%*?&]{8,}$/;
        if (!guestUser.email)
            reject({
                auth: false,
                code: 'server_email_required',
                message: 'Email is required',
            });

        if (!guestUser.accessPlatform)
            reject({
                auth: false,
                code: 'server_accessPlatform_required',
                message: 'Access Platform data is required',
            });

        if (!password)
            reject({
                auth: false,
                code: 'server_password_req',
                message: 'Password is required',
            });

        if (!regexPasswordValidation.test(password))
            reject({
                auth: false,
                code: 'server_invalid_password',
                message: 'Password is invalid',
            });
        else resolve(true);
    });
}

const addGuestUser = async (
    newGuestUser,
    password,
    isEVIO: boolean = false
) => {
    const context = 'Function addGuestUser';

    const guestUser = await GuestUser.createGuestUsers(newGuestUser);

    console.log(
        `[${context}] Adding password for GuestUser ${guestUser?.email} (${guestUser?.clientName})`
    );
    await UserPasswords.addPassword(guestUser._id, password);

    return guestUser;
};

async function updateGuestUsersPassword(
    guestUserId: string,
    received,
    isEVIO: boolean = false
) {
    const context = 'Function updateGuestUsersPassword';

    const query = { _id: Types.ObjectId(guestUserId) };
    const guestUserFound = await GuestUser.findOne(query);

    if (!guestUserFound) throw NotFound('Guest User not found', context);

    const guestUser = { ...received };

    console.log(
        `[${context}] Updating password for GuestUser ${guestUserFound.email} (${guestUserFound.clientName})`
    );
    await UserPasswords.updatePassword(guestUserFound._id, received.password);

    return await GuestUser.findOneAndUpdate(
        query,
        { $set: guestUser },
        { new: true }
    );
}

async function updateGuestUsersRules(
    guestUserId: string,
    userId: string,
    rulesIds: Array<string>
) {
    const context = 'Function updateGuestUsersRules';

    const userIdObject = Types.ObjectId(userId);
    const rulesIdsObject = rulesIds.map((rule) => Types.ObjectId(rule));
    const guestUser = await GuestUser.findById(guestUserId);
    if (!guestUser) throw NotFound('Guest User not found', context);
    const guestUserUsersBackup = [...guestUser.users];

    const guestUserUsers = guestUser.users.filter(
        (user) => user.userId !== userIdObject
    );
    guestUser.users = guestUserUsers;
    guestUser.users.push({ userId: userIdObject, rulesIds: rulesIdsObject });

    await guestUser.save();

    const rules = await Rule.calculateRules({ _id: { $in: rulesIdsObject } });

    const host = `${process.env.HostAuthorization}/api/validTokens/rules`;
    const params = { userId, guestUserId, rules };
    await axios.patch(host, { ...params }).catch((error) => {
        guestUser.users = guestUserUsersBackup;
        guestUser.save();
        throw ServerError(error, context);
    });

    return guestUser;
}

async function updateGuestUsersEmailName(
    guestUserId: string,
    received,
    isEVIO: boolean = false
) {
    const context = 'Function updateGuestUsersEmailName';

    const query = { _id: Types.ObjectId(guestUserId) };

    const guestUser = await GuestUser.findOne(query);

    console.log(
        `[${context}] Updating data for GuestUser ${guestUser?.email} (${guestUser?.clientName})`
    );
    console.log(`[${context}] Received: ${JSON.stringify(received)}`);

    if (!guestUser) throw NotFound('Guest User not found', context);

    return await GuestUser.findOneAndUpdate(
        query,
        { $set: received },
        { new: true }
    );
}

async function getGuestUsers(
    query,
    findFirst: boolean = true
): Promise<Array<IGuestUserDocument> | IGuestUserDocument | null> {
    return (await findFirst) ? GuestUser.findOne(query) : GuestUser.find(query);
}

function getGuestUserByID(guestUserId) {
    const context = '[Function] getGuestUserByID';
    const guestUser = getGuestUsers({ _id: Types.ObjectId(guestUserId) });

    if (!guestUser) throw NotFound('Guest User not found', context);

    return guestUser;
}

async function getGuestUsersByUser(userId) {
    const context = '[Function] getGuestUsersByOwner';
    const getGuestUserQuery = { 'users.userId': Types.ObjectId(userId) };
    const guestUsers = <Array<IGuestUserDocument>>(
        await getGuestUsers(getGuestUserQuery, false)
    );

    if (!guestUsers) throw NotFound('Guest User not found', context);

    const withUserRules = guestUsers.map((guestUser) => {
        const currentUser =
            guestUser.users?.find((user) => user.userId === userId) ?? false;
        guestUser.users = currentUser ? [currentUser] : [];
        return guestUser;
    });

    return withUserRules;
}

async function attachUser(userId: string, guestUserId: string) {
    const context = '[Function] addUser';
    const userIdObject = Types.ObjectId(userId);

    const guestUser = await GuestUser.findById(guestUserId);
    if (!guestUser) throw NotFound('Guest User not found', context);

    if (guestUser.users.find((user) => user.userId === userIdObject)) {
        throw BadRequest(
            {
                auth: false,
                code: 'server_email_use_guesUsers',
                message: 'Email is already registered as an guest user',
            },
            context
        );
    }

    const newGuestUserUser: IGuestUserUser = {
        userId: userIdObject,
        rulesIds: [Types.ObjectId(process.env.DEFAULT_GUESTUSER_ROLE)],
    };

    guestUser.users.push(newGuestUserUser);
    return guestUser.save();
}

async function detachUser(userId: string, guestUserId: string) {
    const context = '[Function] addUser';
    const userIdObject = Types.ObjectId(userId);

    const guestUser = await GuestUser.findById(guestUserId);
    if (!guestUser) throw NotFound('Guest User not found', context);

    const guestUserUsers = guestUser.users.filter(
        (user) => user.userId !== userIdObject
    );

    guestUser.users = guestUserUsers;
    return guestUser.save();
}

async function loadCachedRules(
    token: string,
    userId: string,
    guestUserFound: IGuestUserDocument
): Promise<IDynamicRules> {
    const { _id: guestUserId } = guestUserFound;
    const getCachedRulesHost = `${process.env.HostAuthorization}/api/private/getCachedRules`;
    const getCachedRulesParams = { token, userId, guestUserId };
    const cachedRulesResponse = await axios
        .get(getCachedRulesHost, { params: getCachedRulesParams })
        .catch((error) =>
            console.log(
                `GuestUser[${guestUserId}|${userId}] Problems fetching cached rules: ${error}`
            )
        );
    let rules: IDynamicRules = cachedRulesResponse?.data?.rules;

    if (!rules) {
        const rulesIds = guestUserFound.users.find(
            (user) => user.userId
        )?.rulesIds;
        rules = await Rule.calculateRules({ _id: { $in: rulesIds } });

        const updateCachedRulesHost = `${process.env.HostAuthorization}/api/validTokens/rules`;
        const updateCachedRulesParams = { rules, userId, guestUserId };
        axios
            .patch(updateCachedRulesHost, updateCachedRulesParams)
            .catch((error) =>
                console.log(
                    `GuestUser[${guestUserId}|${userId}] Problems saving cached rules. ${error}`
                )
            );
    }

    return rules;
}

async function isGuestUser(
    userId: string,
    guestUserId: string
): Promise<boolean> {
    const context = '[Function] isGuestUser';
    try {
        const query = {
            _id: Types.ObjectId(guestUserId),
            'users.userId': userId,
        };
        return (await GuestUser.findOne(query)) ? true : false;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export default {
    addGuestUser,
    attachUser,
    detachUser,
    getGuestUserByID,
    getGuestUsersByUser,
    loadCachedRules,
    updateGuestUsersEmailName,
    updateGuestUsersRules,
    updateGuestUsersPassword,
    validateFieldsCreate,
    isGuestUser,
};
