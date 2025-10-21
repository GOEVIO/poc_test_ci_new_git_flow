import { Request, Response } from 'express';
import { validate as validateEmail } from 'email-validator';
import dotenv from 'dotenv-safe';

import { BadRequest, ServerError, Unauthorized, errorResponse } from '../utils';

import User from '../models/user';
import GuestUser from '../models/guestUsers';
import UserPasswords from '../models/userPasswords';
import { IAuthenticate } from '../interfaces/authentication.interface';
import { IGuestUserDocument } from '../interfaces/guestUsers.interface';
import { IRuleDocument, IRuleDocumentWithRules } from '../interfaces/rules.interface';
import Rule from '../models/rules';
import { Types } from 'mongoose';
import { ClientType } from '../interfaces/users.interface';

dotenv.load();

async function authenticateUser(
    username: string,
    clientName: string,
    isMobile?: boolean
): Promise<IAuthenticate | boolean> {
    const userQuery = {
        $or: [{
            username: new RegExp(username, 'i'),
            $expr: { $eq: [{ $strLenCP: '$username' }, username.length] }
        }, {
            email: username
        }],
        clientName,
        status: process.env.USERRREGISTERED,
    };

    const queryWithUsers = User.aggregateNestedUsers(userQuery, null, true);
    const [user] = await User.aggregate(queryWithUsers);

    if (user) {
        const {
            clientType, active, _id, language, name, imageContent,
            mobile, internationalPrefix, users: subUsers, accessType
        } = user;

        if (isMobile && clientType === process.env.ClientTypeB2B) {
            throw Unauthorized({
                auth: false,
                code: 'server_user_b2b_unauthorized',
                message: `B2B users are not allowed to access the mobile app: ${username}`,
                type: 'dialog',
            });
        }

        if (active) {
            let accounts;
            const minimalSubusers = subUsers?.map(
                ({ _id, name, imageContent }) => ({ _id, name, imageContent })
            ) ?? [];

            const rules = await Rule.calculateRules(
                { _id: Types.ObjectId(process.env.DEFAULT_USER_ROLE) }
            );

            if (accessType === 'admin') {
                const query = {
                    active: true,
                    clientName,
                    clientType: (process.env.ClientTypeB2B || 'b2b') as ClientType,
                };

                const fields = {
                    _id: 1,
                    name: 1,
                    email: 1,
                    imageContent: 1,
                    language: 1,
                };

                accounts = await User.find(query, fields);
            }

            const authenticationData: IAuthenticate = {
                _id,
                language,
                name,
                imageContent,
                active,
                mobile,
                internationalPrefix,
                clientType,
                accessType,
                requestUserId: _id,
                accountType: process.env.AccountTypeMaster,
                guestUser: false,
                users: minimalSubusers,
                rules,
                accounts
            };

            return authenticationData;
        }

        throw BadRequest({
            auth: false,
            code: 'server_user_not_active',
            message: 'Activate your account using the activation code.',
            _id,
            active: false
        });
    }

    return false;
}

async function authenticateGuestUser(username: string, clientName: string): Promise<IAuthenticate> {
    const guestUserQuery = {
        email: username,
        active: true,
        'accessPlatform.webclient': true,
        clientName
    };
    const guestUser = await GuestUser.findOne(guestUserQuery);

    if (!guestUser) throw BadRequest({ auth: false, code: 'server_user_not_found', message: `Guest User not found: ${username}` });

    // TODO - Allow selection of users if guest user have more than one
    const [{ userId, rulesIds }] = guestUser.users;

    const {
        ownerId,
        _id: guestUserId
    } = <IGuestUserDocument & { rules:Array<IRuleDocument> }>guestUser;

    const queryWithUsers = User.aggregateNestedUsers({
        _id: userId ?? ownerId
    }, null, true);
    const [ownerUser] = await User.aggregate(queryWithUsers);

    if (!ownerUser) throw BadRequest({ auth: false, code: 'server_user_not_found', message: `User not found for this guest user: ${username}` });

    const {
        _id, language, name, imageContent, active, mobile, internationalPrefix,
        clientType, users: subUsers, changedEmail
    } = ownerUser;

    const notActiveErrorResponse = {
        auth: false, code: 'server_user_not_active', message: 'Activate your account using the activation code.', _id
    };

    if (!active && changedEmail) {
        throw BadRequest({ ...notActiveErrorResponse, changedEmail: true });
    }

    if (!active) throw BadRequest({ ...notActiveErrorResponse, active: false });

    const minimalSubusers = subUsers?.map(
        ({ _id, name, imageContent }) => ({ _id, name, imageContent })
    ) ?? [];

    const rules = await Rule.calculateRules({ _id: { $in: rulesIds } });

    const authenticationData: IAuthenticate = {
        _id,
        language,
        name,
        imageContent,
        active,
        mobile,
        internationalPrefix,
        clientType,
        requestUserId: guestUserId,
        accountType: process.env.AccountTypeGuest,
        guestUser: true,
        users: minimalSubusers,
        rules
    };

    return authenticationData;
}

async function authenticate(username: string, clientName: string, isMobile?: boolean) {
    const authenticationUserData = await authenticateUser(username, clientName, isMobile);

    if (authenticationUserData) return authenticationUserData;

    if (isMobile) throw BadRequest({ auth: false, code: 'server_user_not_found', message: `User not found: ${username}` });

    const authenticationGuestUserData = await authenticateGuestUser(username, clientName);

    return authenticationGuestUserData;
}

async function verifyCredentials(req: Request, res: Response, next) {
    const context = `[${req.baseUrl}] verifyCredentials()`;
    try {
        const {
            client,
            clientname: clientName
        } = <{ client: string, clientname: string }>req.headers;

        const {
            internationalPrefix,
            username,
            password
        } = <{ internationalPrefix: string, username: string, password: string }>req.body;

        const isBackOffice = client?.includes('BackOffice');
        const isExternalAPI = client?.includes('EXTERNAL_API');
        const clientIsEVIO = clientName === process.env.clientNameEVIO;
        let userIdToAuthenticate: string = '';

        // use email during login if is webclient or client is not EVIO
        const usesEmail = isBackOffice || !clientIsEVIO;

        let userQuery: any = {};
        const baseUserQuery = {
            clientName,
            status: process.env.USERRREGISTERED
        };

        // use Email and client is EVIO = uses email field
        if (usesEmail && clientIsEVIO) {
            userQuery = { email: username, ...baseUserQuery };
        // use Email but client is not EVIO = uses email in username field
        } else if (usesEmail) {
            userQuery = { username, ...baseUserQuery };
        // don't use Email = uses mobile phone number in username field and international prefix
        } else {
            userQuery = { username, internationalPrefix, ...baseUserQuery };
        }

        console.log(`[${context}] Trying to fetch user with query: ${JSON.stringify(userQuery)}`);

        const userFound = await User.findOne(userQuery);

        if (userFound?.active === false && !isBackOffice && !isExternalAPI) {
            throw BadRequest({ auth: false, code: 'server_user_not_active', message: 'User is not active' });
        }

        if (userFound) {
            console.log(`[${context}] User found _id=${JSON.stringify(userFound?._id)} status=${JSON.stringify(userFound?.status)}`);
            userIdToAuthenticate = userFound?._id;
        }

        if (!clientName) {
            throw BadRequest({ auth: false, code: 'server_missing_header', message: 'Missing clientName' });
        }

        if (usesEmail) {
            if (!validateEmail(username)) {
                throw BadRequest({ auth: false, code: 'server_email_not_valid', message: 'Email not valid' });
            }
        } else {
            if (!internationalPrefix) {
                throw BadRequest({ auth: false, code: 'server_internationalPrefix_required', message: 'Internationl prefix is required' });
            }
        }

        if (userFound?.active && isBackOffice && userFound.clientType !== process.env.ClientTypeB2B) {
            throw BadRequest({ auth: false, code: 'server_user_not_company', message: 'User is not a company' });
        }


        userIdToAuthenticate = userFound?.active ? userFound?._id ?? '' : '';

        console.log(`[${context}] Handling other checks userIdToAuthenticate: ${userIdToAuthenticate}`);

        if ((isBackOffice || isExternalAPI) && usesEmail && (!userFound || userFound?.active === false)) {
            const guestUserQuery = {
                email: username,
                active: true,
                clientName
            };

            console.log(`[${context}] Trying to fetch guest user with query: ${JSON.stringify(guestUserQuery)}`);

            const guestUserFound = await GuestUser.findOne(guestUserQuery);

            if (guestUserFound) {
                if (isExternalAPI && guestUserFound && !guestUserFound.accessPlatform.api) {
                    throw BadRequest({ auth: false, code: 'server_not_authorized_access_externalAPI', message: 'Not authorized to access' });
                }

                userIdToAuthenticate = guestUserFound?._id;
                console.log(`[${context}] Guest user found. userIdToAuthenticate: ${userIdToAuthenticate}`);
            }
        }

        try {
            console.log(`[${context}] Authenticating userId=${userIdToAuthenticate} ...`);
            await UserPasswords.authenticate(userIdToAuthenticate, password);
            delete req.body.password;

            next();
        } catch (error) {
            throw BadRequest({ auth: false, code: 'server_invalid_credentials', message: error.message });
        }

    } catch (error) {
        return errorResponse(res, error, context);
    }
}

export default {
    authenticate,
    verifyCredentials,
};
