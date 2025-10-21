import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { IToken, ITokenDocument } from '../interfaces/tokens.interface';
import {
    IAuthentication,
    IAuthenticationMessage,
    ICheckAuthentication,
    IDynamicRules,
} from '../interfaces/authentication.interface';
import Token from '../models/tokens';
import ValidToken from '../models/validTokens';
import { token as tokenConfig } from '../configuration';
import { BadRequest, NotFound, Unauthorized } from '../utils/errorHandling';

async function saveNewToken(
    req: Request,
    token: string,
    refreshToken: string
): Promise<ITokenDocument> {
    const isMobile = !!req.headers.evioappversion;
    const {
        _id: userId,
        requestUserId: guestUserId,
        rules,
        clientName,
    } = req.body;

    if (!token) throw BadRequest('Missing: token');
    if (!refreshToken) throw BadRequest('Missing: refreshToken');

    const currentTime = new Date().getTime();
    const expireTime = currentTime + tokenConfig.refreshTokenLife;

    const tokenData: IToken = {
        userId,
        token,
        refreshToken,
        rules,
        clientName,
        isMobile,
        expiresAt: new Date(expireTime),
    };

    if (guestUserId !== userId) tokenData.guestUserId = guestUserId;

    const newToken = new Token(tokenData);

    return newToken.save();
}

async function authenticate(req: Request): Promise<IAuthentication> {
    let token = '';
    let refreshToken = '';
    const isExternalApi = req.url.includes('evioapi');
    const {
        tokenLife,
        tokenSecret,
        refreshTokenLife,
        refreshTokenSecret,
        apiTokenLife,
        apiRefreshTokenLife,
    } = tokenConfig;

    const {
        _id,
        username,
        language,
        clientType,
        requestUserId,
        accountType,
        users,
        imageContent,
        active,
        mobile,
        internationalPrefix,
        guestUser,
        rules,
        accessType,
        accounts,
        token: existingToken,
        refreshToken: existingRefreshToken,
    } = req.body;


    if (_id && username) {
        const tokenData = {
            _id,
            username,
            language,
            clientType,
            requestUserId,
            accountType,
            accessType,
        };

        token = jwt.sign(tokenData, tokenSecret, {
            expiresIn: isExternalApi ? tokenLife : apiTokenLife,
        });
        refreshToken = jwt.sign({ userId: requestUserId }, refreshTokenSecret, {
            expiresIn: isExternalApi ? refreshTokenLife : apiRefreshTokenLife,
        });

        await saveNewToken(req, token, refreshToken);
    }

    const authentication: IAuthentication = {
        id: _id,
        token: token === '' ? existingToken : token,
        refreshtoken: refreshToken === '' ? existingRefreshToken : refreshToken,
        name: username,
        imageContent,
        mobile,
        internationalPrefix,
        auth: true,
        active,
        guestUser,
        language,
        accessType,
        accounts,
    };

    return { ...authentication, users, rules };
}

async function authenticateWithEmail(req: Request): Promise<IAuthentication> {
    const { email } = req.body;
    const commomAuthentication = await authenticate(req);

    return { ...commomAuthentication, email };
}

async function getDatabaseTokenData(
    token: string,
    fields?: object
): Promise<Partial<ITokenDocument> | null> {
    let tokenData = await Token.findOne({ token }, fields);

    // TODO: remove when this ValidTokens table no longer has active tokens
    if (!tokenData) {
        const validTokenQuery = {
            listOfTokens: {
                $elemMatch: {
                    token,
                    active: true,
                },
            },
            active: true,
        };
        tokenData = await ValidToken.findOne(validTokenQuery, fields);
    }

    return tokenData;
}

async function checkAuthentication(
    token: string
): Promise<ICheckAuthentication> {
    const context = 'Function checkAuthentication';
    const unauthorizedResponse: IAuthenticationMessage = {
        auth: false,
        code: 'server_user_not_valid',
        message: 'User is not valid',
    };

    const tokenData = await getDatabaseTokenData(token, { _id: 1 });

    if (!tokenData) throw Unauthorized(unauthorizedResponse, context);

    const jwtTokenData = jwt.verify(String(token), tokenConfig.tokenSecret);

    if (!jwtTokenData || typeof jwtTokenData === 'string')
        throw Unauthorized(unauthorizedResponse, context);

    const {
        _id: id,
        language,
        username,
        clientType: userType,
        requestUserId,
        accountType,
    } = jwtTokenData;

    return {
        auth: true,
        message: 'Authorized',
        id,
        language,
        username,
        userType,
        requestUserId,
        accountType,
    };
}

async function getUserIdByToken(
    token: string
): Promise<Partial<ITokenDocument>> {
    const context = 'Function getUserIdByToken';

    const tokenData = await getDatabaseTokenData(token, {
        userId: 1,
        guestUserId: 1,
        clientName: 1,
    });

    if (!tokenData) throw NotFound('User not found', context);

    return tokenData;
}

async function getCachedRules(
    token: string,
    userId: string,
    guestUserId?: string
): Promise<ITokenDocument> {
    const context = 'Function getCachedRules';
    const query = guestUserId
        ? { token, userId, guestUserId }
        : { token, userId, guestUserId: { $exists: false } };

    const tokenData = await Token.findOne(query, { rules: 1 });

    if (!tokenData) throw NotFound('Token Rules Not Found', context);

    return tokenData;
}

async function logout(token: string): Promise<Partial<IAuthenticationMessage>> {
    if (!token) throw BadRequest('Missing: token');

    // TODO: remove updateValidTokens when ValidTokens table no longer has active tokens
    const query = {
        'listOfTokens.token': token,
    };

    const newValues = {
        $set: {
            'listOfTokens.$.active': false,
        },
    };

    await ValidToken.updateValidTokens(query, newValues);

    await Token.removeToken({ token });

    return {
        auth: true,
        code: 'server_successful_logout',
        message: 'Successful logout',
    };
}

async function finishAllSessions(
    userId: string,
    guestUserId?: string
): Promise<void> {
    if (!userId) throw BadRequest('Missing: userId');

    const query = guestUserId
        ? { userId, guestUserId }
        : { userId, guestUserId: { $exists: false } };

    // TODO: remove ValidToken.deleteMany when this table no longer has active tokens
    await ValidToken.deleteMany(query);
    await Token.removeTokens(query);
}

async function setCachedRules(
    userId: string,
    rules: Array<IDynamicRules>,
    guestUserId?: string
): Promise<boolean> {
    const query = guestUserId
        ? { userId, guestUserId }
        : { userId, guestUserId: { $exists: false } };

    await Token.updateMany(query, { $set: { rules } });
    return true;
}

async function revokeCachedRules(): Promise<boolean> {
    await Token.removeRules({});
    return true;
}

export default {
    authenticate,
    authenticateWithEmail,
    checkAuthentication,
    finishAllSessions,
    getCachedRules,
    getUserIdByToken,
    logout,
    revokeCachedRules,
    saveNewToken,
    setCachedRules,
};
