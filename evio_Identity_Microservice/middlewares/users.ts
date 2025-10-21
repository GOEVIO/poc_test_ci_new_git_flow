import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { isValidPhoneNumber } from 'libphonenumber-js/mobile';
import { validateUserPerClientName } from '../auth/auth';
// Utils
import { BadRequest, errorResponse, isValidEmail, isValidName, isValidPassword, isValidPortugueseMobilePhone, Unauthorized } from '../utils';
import Constants from '../utils/constants';
// BD Models
import User from '../models/user';
import GuestUser from '../models/guestUsers';
// Interfaces
import { ClientType, TAccountType } from '../interfaces/users.interface';
// Enums
import blockUsersReasonsEnum from '../enums/blockUsersReasons.enum';
import accountTypeEnum from '../enums/accountType.enum';
// Services
import guestUsersService from '../services/guestUsers';
import usersService from '../services/users';

const validatePasswords = (password: string, confPassword: string) => {
    if (!password) throw BadRequest({ auth: false, code: 'server_password_required', message: 'Password is required' });
    if (!confPassword) throw BadRequest({ auth: false, code: 'server_conf_password_req', message: 'Password confirmation is required' });
    if (!isValidPassword(password)) throw BadRequest({ auth: false, code: 'server_invalid_password', message: 'Password is invalid' });
    if (password !== confPassword) {
        throw BadRequest({ auth: false, code: 'server_password_not_match', message: 'New password and confirmation are different' });
    }
    return true;
};

const validateEmail = (email: string) => {
    if (!email) throw BadRequest({ auth: false, code: 'server_email_required', message: 'Email is required' });
    if (!isValidEmail(email)) throw BadRequest({ auth: false, code: 'server_invalid_email', message: 'Email is invalid' });
    return true;
};

const validateMobileWithPrefix = (mobile: string, internationalPrefix: string) => {
    if (!mobile) throw BadRequest({ auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' });
    if (!internationalPrefix) throw BadRequest({ auth: false, code: 'server_international_prefix_required', message: 'International mobile prefix is required' });

    const isValidNumberInternational = isValidPhoneNumber(`${internationalPrefix}${mobile}`);
    if (!isValidNumberInternational) throw BadRequest({ auth: false, code: 'server_mobile_badNumber', message: 'Phone number with incorrect format' });

    return true;
};

const createUserValidation = async (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} createUserValidation`;
    try {
        const { clientType } = <{ clientType: ClientType }>req.params;
        const {
            clientname: clientName,
            client,
            userid: userId,
            requestuserid: requestUserId
        } = <{ clientname: string, client: string, userid: string, requestuserid: string }>req.headers;
        const isSuperAdmin = Constants.OperationsManagement.id === requestUserId;

        const userData = req.body;

        if (!clientType) throw BadRequest({ auth: false, code: 'client_type_null', message: 'Client type null' });

        if (!clientName) throw BadRequest({ auth: false, code: 'clientName_missing', message: 'Client name missing' });

        if (!userData) throw BadRequest({ auth: false, code: 'server_user_required', message: 'User data is required' });
        const {
            name,
            country,
            email,
            internationalPrefix,
            mobile,
            password,
            confPassword,
            username
        } = userData;

        if (!name) throw BadRequest({ auth: false, code: 'server_name_required', message: 'Name is required' });
        if (!isValidName(name)) throw BadRequest({ auth: false, code: 'server_name_invalid', message: 'Invalid name' });

        if (!username) throw BadRequest({ auth: false, code: 'server_username_required', message: 'Username is required' });

        if (![username, mobile].includes(username)) throw BadRequest({ auth: false, code: 'server_username_mismatch', message: 'Username must be the same as email or mobile' });

        validateEmail(email);
        validateMobileWithPrefix(mobile, internationalPrefix);
        validatePasswords(password, confPassword);

        if (!country) throw BadRequest({ auth: false, code: 'server_country_required', message: 'Country is required' });

        if (!validateUserPerClientName({ clientname: clientName, client })) {
            throw BadRequest({
                auth: false,
                code: 'action_not_allowed',
                message: `Action not allowed for ${clientName}`,
            });
        }
        if (!isSuperAdmin) {
            const user = await User.findOne({ _id: userId })
            if (!user) throw BadRequest({ auth: false, code: 'server_user_not_found', message: 'User not found' });
            if (clientType === Constants.clientTypes.ClientB2B && !user.userPackage?.createB2BUsers) throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
            if (clientType === Constants.clientTypes.ClientB2C && !user.userPackage?.createB2CUsers) throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
        }
        const guestUserExistsQuery = {
            email,
            clientName
        };

        const userExistsQuery = {
            $and: [
                { $or: [{ email }, { mobile }] },
                { $or: [{ active: true }, { status: process.env.USERRREGISTERED }] }
            ],
            clientName
        };

        const userExists = await User.findOne(userExistsQuery);
        if (userExists) {
            if (userExists.email === email) throw BadRequest({ auth: false, code: 'server_email_taken', message: `Email ${email} is already registered` });
            throw BadRequest({ auth: false, code: 'server_mobile_taken', message: `Mobile ${mobile} is already taken` });
        }
        const guestUserExists = await GuestUser.findOne(guestUserExistsQuery);
        if (guestUserExists) throw BadRequest({ auth: false, code: 'server_email_taken', message: `Email ${email} is already registered` });
        return next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const patchUserValidation = async (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} patchUserValidation`;
    try {
        if (!req.body || Object.keys(req.body).length < 1) throw BadRequest({ auth: false, code: 'server_user_required', message: 'User data is required' });

        const { email, internationalPrefix, mobile, username, name } = req.body;
        const { clientType: userId } = <{ clientType: string }>req.params;
        const { userid, accounttype: accountType, requestuserid: requestUserId, usertype: userType } = <{ userid: string, accounttype: TAccountType, requestuserid: string, usertype: string }>req.headers;
        const isSuperAdmin = Constants.OperationsManagement.id === requestUserId;
        if (!Types.ObjectId.isValid(userId)) throw Unauthorized({ auth: false, code: 'server_invalid_userId', message: 'Invalid user id' });

        if (!name) throw BadRequest({ auth: false, code: 'server_name_required', message: 'Name is required' });
        if (!isValidName(name)) throw BadRequest({ auth: false, code: 'server_name_invalid', message: 'Invalid name' });

        if (!username) throw BadRequest({ auth: false, code: 'server_username_required', message: 'Username is required' });

        validateEmail(email);
        validateMobileWithPrefix(mobile, internationalPrefix);

        if (!mobile) throw BadRequest({ auth: false, code: 'server_mobile_required', message: 'Mobile phone is required' });
        if (!internationalPrefix) throw BadRequest({ auth: false, code: 'server_international_prefix_required', message: 'International mobile prefix is required' });
        if (internationalPrefix === Constants.portugueseMobilePrefix && !isValidPortugueseMobilePhone(mobile))
            throw BadRequest({ auth: false, code: 'server_mobile_badNumber', message: 'Phone number with incorrect format' });

        if (![username, mobile].includes(username)) throw BadRequest({ auth: false, code: 'server_username_mismatch', message: 'Username must be the same as email or mobile' });
        if (isSuperAdmin || userId === requestUserId || accountType === 'GUEST') return next()

        const [user, requestUser] = await Promise.all([User.findOne({ _id: userId }), User.findOne({ _id: requestUserId })])
        if (!requestUser || !user) return errorResponse(res, BadRequest({ auth: false, code: 'server_user_not_found', message: 'User not found' }), context);
        if ((!requestUser.userPackage?.createB2BUsers && user.clientType === Constants.clientTypes.ClientB2B)
            || (!requestUser.userPackage?.createB2CUsers && user.clientType === Constants.clientTypes.ClientB2C)) {
            throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
        }
        return next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const userValidation = (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} userValidation`;
    try {
        switch (req.method) {
            case 'POST':
                return createUserValidation(req, res, next);

            case 'PATCH':
                return patchUserValidation(req, res, next);

            default:
                throw BadRequest({ auth: false, code: 'server_method_not_allowed', message: 'Method not allowed' });
        }
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const deactivateContractsValidation = async (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} deactivateContractsValidation`;
    try {
        const { reason } = req.body;
        const { userId } = req.params;
        const { requestuserid: requestUserId, accounttype: accountType } = <{ requestuserid: string, accounttype: string }>req.headers;
        const isSuperAdmin = Constants.OperationsManagement.id === requestUserId;

        if (!reason) throw BadRequest({ auth: false, code: 'server_message_required', message: 'Message is required' });
        if (!(reason in blockUsersReasonsEnum)) throw BadRequest({ auth: false, code: 'server_invalid_reason', message: 'Invalid reason' });

        if (!userId) throw BadRequest({ auth: false, code: 'server_user_id_required', message: 'UserID is required' });
        if (!Types.ObjectId.isValid(userId)) throw BadRequest({ auth: false, code: 'server_invalid_userId', message: 'Invalid user id' });

        if (isSuperAdmin || userId === requestUserId || accountType === 'GUEST') return next();

        const [user, requestUser] = await Promise.all([User.findOne({ _id: userId }), User.findOne({ _id: requestUserId })])
        if (!user || !requestUser) throw BadRequest({ auth: false, code: 'server_user_not_found', message: 'User not found' });
        if (user.clientType === Constants.clientTypes.ClientB2B && !requestUser.userPackage?.createB2BUsers) throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
        if (user.clientType === Constants.clientTypes.ClientB2C && !requestUser.userPackage?.createB2CUsers) throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
        return next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const resetUserPasswordValidation = (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} resetUserPasswordValidation`;
    try {
        const { userId } = req.params;
        if (!userId) throw BadRequest({ auth: false, code: 'server_userId_required', message: 'User Id is required' });
        return next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const validateUserRequest = async (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} validateUserResquest`;
    try {
        const {
            userid: userId,
            requestuserid: requestUserId,
            accounttype: accountType
        } = <{ userid: string, requestuserid: string, accounttype: TAccountType }>req.headers;
        const isSuperAdmin = Constants.OperationsManagement.id === requestUserId;

        if (!userId) throw BadRequest({ auth: false, code: 'server_user_id_required', message: 'UserID is required' });
        if (!isSuperAdmin && !Types.ObjectId.isValid(userId)) throw Unauthorized({ auth: false, code: 'server_invalid_userId', message: 'Invalid user id' });
        if (!requestUserId) throw BadRequest({ auth: false, code: 'server_request_user_id_required', message: 'RequestUserID is required' });
        if (!isSuperAdmin && !Types.ObjectId.isValid(requestUserId)) throw Unauthorized({ auth: false, code: 'server_invalid_requestUserId', message: 'Invalid request user Id' });
        if ((userId !== requestUserId && accountType === accountTypeEnum.Master && !isSuperAdmin)
            || (userId === requestUserId && accountType === accountTypeEnum.Guest)
        ) throw Unauthorized({ auth: false, code: 'server_not_authorized', message: 'Not authorized' });
        if (userId !== requestUserId && accountType === accountTypeEnum.Guest) {
            // check if userId is guest client of requestuserid
            if (!(await guestUsersService.isGuestUser(userId, requestUserId))) throw BadRequest({ auth: false, code: 'server_not_authorized', message: 'Not authorized' });
        }
        return next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const activateContractValidation = async (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} activateContractValidation`;
    try {
        const { userId } = req.params;
        const { requestuserid: requestUserId, accounttype: accountType } = <{ requestuserid: string, accounttype: string }>req.headers;
        const isSuperAdmin = Constants.OperationsManagement.id === requestUserId
        if (!userId) throw BadRequest({ auth: false, code: 'server_user_id_required', message: 'UserID is required' });
        if (!Types.ObjectId.isValid(userId)) throw BadRequest({ auth: false, code: 'server_invalid_userId', message: 'Invalid user id' });
        if (isSuperAdmin || userId === requestUserId || accountType === 'GUEST') return next();

        const [user, requestUser] = await Promise.all([User.findOne({ _id: userId }), User.findOne({ _id: requestUserId })])
        if (!user || !requestUser) throw BadRequest({ auth: false, code: 'server_user_not_found', message: 'User not found' });
        if (user.clientType === Constants.clientTypes.ClientB2B && !requestUser.userPackage?.createB2BUsers) throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
        if (user.clientType === Constants.clientTypes.ClientB2C && !requestUser.userPackage?.createB2CUsers) throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
        return next();
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

export const isDisposableEmail = async (req: Request, res: Response, next: NextFunction) => {
    const context = `${req.method} ${req.path} isDisposableEmail`;
    try {
        const email = req.body.email;
        const { auth, code, message, status } = await usersService.handleIsDisposableEmail(email)

        if (auth) return next();

        return res.status(status).send({
            auth,
            code,
            message,
        });

    } catch (error) {
        return errorResponse(res, error, context);
    }

};

export default {
    createUserValidation,
    userValidation,
    deactivateContractsValidation,
    resetUserPasswordValidation,
    validateUserRequest,
    activateContractValidation,
};
