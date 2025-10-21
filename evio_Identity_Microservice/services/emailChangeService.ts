// External Imports: Libraries and packages from node_modules
import axios from "axios";
import { captureException } from "@sentry/node";
import { StatusCodes } from "http-status-codes";
import { cryptoHelper } from "evio-library-commons";
import redisConnection from "evio-redis-connection/dist";

// Internal Imports – Constants and Utility Functions
import ENV from "../constants/env";
import Constants from "../utils/constants";
import { requestEmailChange } from "../utils/enums/requestEmailChange";
import { ServerError, sendEmail } from "../utils";

// Internal Imports – Models
import BillingProfile from "../models/billingProfile";
import Contract from "../models/contracts";
import EmailChangeRequest from "../models/emailChangeRequest";
import User from "../models/user";

// Internal Imports – Interfaces
import { IEmailChangeRequest, IResponseEmailChange, IRequestEmailChangeWithTokenParams, IRequestEmailChangeWithHashLinkParams, IHashLinkData } from "../interfaces/emailChange.interface";
import { IUserDocument } from "../interfaces/users.interface";

const { billingProfileStatus, configService } = ENV;

export default class EmailChangeService {
    static secret = cryptoHelper.scryptSync(process.env.CHANGE_EMAIL_SECRET_TOKEN ?? '', process.env.CHANGE_EMAIL_SALT ?? '', 32);

    static storeRequestEmailChange = async (data: IEmailChangeRequest): Promise<boolean> => {
        try {
            // save to db
            const emailChangeRequest = new EmailChangeRequest(data);
            await emailChangeRequest.save();

            // save to redis
            const cacheKey = `${requestEmailChange.redisKey}:${data.newEmail}:${data.verificationCode}`;

            console.log(`[storeRequestEmailChange] cacheKey: ${cacheKey}`);
            console.log(`[storeRequestEmailChange] data: ${JSON.stringify(data)}`);

            await redisConnection.set(cacheKey, JSON.stringify(data));

            return true;
        } catch (error) {
            console.error(`[storeRequestEmailChange][Error]`, error.message);
            captureException(error);
            return false;
        }
    }

    static getRequestEmailChange = async ({ email, verificationCode }): Promise<IEmailChangeRequest | null> => {
        try {
            const cacheKey = `${requestEmailChange.redisKey}:${email}:${verificationCode}`;

            console.log(`[getRequestEmailChange] cacheKey: ${cacheKey}`);

            const emailChange = await redisConnection.get(cacheKey);

            console.log(`[getRequestEmailChange] emailChange: ${emailChange}`);

            return emailChange ? JSON.parse(emailChange) : null;
        } catch (error) {
            captureException(error);
            return null;
        }
    }

    static deleteRequestEmailChange = async ({ email, verificationCode }) => {
        try {
            await redisConnection.delete(`${requestEmailChange.redisKey}:${email}:${verificationCode}`);
        } catch (error) {
            console.error(`[deleteRequestEmailChange][Error] ${JSON.stringify(error)}`);
            captureException(error);
        }
    }

    static createRandomCode = (min: number, max: number): string => Math.floor(Math.random() * (max - min) + min).toString();

    static requestEmailChangeWithToken = async ({
        userId,
        type,
        clientName,
        name,
        userEmail,
        oldEmail,
        newEmail,
        emailTemplate,
        clientType,
        expiresAt
    }: IRequestEmailChangeWithTokenParams): Promise<boolean> => {

        const verificationCode = this.createRandomCode(10000, 100000);

        const emailChangeRequest: IEmailChangeRequest = {
            userId,
            type,
            clientName,
            oldEmail,
            newEmail,
            verificationCode,
            expiresAt,
            clientType
        };

        // Store token in Redis and DB
        const saved = await this.storeRequestEmailChange(emailChangeRequest);
        if (!saved) return false;

        const mailOptions = {
            message: {
                username: name,
                "{code}": verificationCode
            },
            type: emailTemplate,
            to: newEmail,
            userEmail
        };

        return sendEmail({ mailOptions, clientName });
    }

    static getConfirmChangeEmailLink = async ({ hash, clientName, language }): Promise<string> => {
        try {
            const host = configService.host + configService.PathGetConfigs;
            const { data } = await axios.get(host, { headers: { clientName } });

            return data?.baseURL ? `${data?.baseURL}/${language}/confirmEmail/${hash}` : '';
        } catch (error) {
            console.log(`[getConfirmChangeEmailLink][Error] ${JSON.stringify(error)}`);
            captureException(error);
            return '';
        }
    }

    static requestEmailChangeWithHashLink = async ({
        userId,
        type,
        clientName,
        name,
        oldEmail,
        newEmail,
        emailTemplate,
        clientType,
        expiresAt,
        language
    }: IRequestEmailChangeWithHashLinkParams): Promise<boolean> => {
        try {
            console.log(`[requestEmailChangeWithHashLink][Start] userId: ${userId} newEmail: ${newEmail}`);
            const verificationCode = cryptoHelper.createHash(userId + newEmail);

            // Create a hash
            const hashData = { verificationCode, email: newEmail } as IHashLinkData;
            console.log(`[requestEmailChangeWithHashLink] hashData: ${JSON.stringify(hashData)}`);
            const hash = cryptoHelper.encrypt(hashData, this.secret) as string;

            const link = await this.getConfirmChangeEmailLink({ hash, clientName, language });

            if (!link) return false;

            // Store token in redis and db
            const stored = await this.storeRequestEmailChange({
                userId,
                type,
                clientName,
                oldEmail,
                newEmail,
                verificationCode,
                expiresAt,
                clientType
            });

            if (!stored) return false;

            // Send email
            const mailOptions = {
                message: {
                    username: name,
                    linkUrl: link,
                    newEmail
                },
                type: emailTemplate,
                to: newEmail,
                userEmail: oldEmail,
            }

            return sendEmail({ mailOptions, clientName });
        }
        catch (error) {
            console.error(`[requestEmailChangeWithHashLink][Error] ${error.message}`);
            captureException(error);
            return false;
        }
    }

    static isUserEmailAvailable = async ({ email, clientName, userId }): Promise<boolean> => {
        const userFound = await User.findOne({ email, clientName, status: process.env.USERRREGISTERED, _id: { $ne: userId } });
        console.log(`[isUserEmailAvailable] User found: ${userFound ? userFound._id : null}`);
        return !userFound;
    }

    static isLinkExpired = (expiresAt: Date): boolean => Date.now() > expiresAt.getTime();

    static decodeHash = (hash: string): IHashLinkData | null => {
        try {
            return cryptoHelper.decrypt(hash, this.secret);
        } catch (error) {
            console.error(`[decodeHash][Error] ${JSON.stringify(error)}`);
            captureException(error);
            return null;
        }
    }

    static confirmEmailChange = async ({ email, verificationCode }): Promise<IResponseEmailChange> => {
        try {
            console.log(`[confirmEmailChange][Start] email: ${email} - verificationCode: ${verificationCode}`);

            if (!email || !verificationCode) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'email_or_verification_code_not_found',
                message: 'Email or verification code not found'
            };

            // Get request from redis by key
            const emailChangeRequest = await this.getRequestEmailChange({ email, verificationCode });

            // Check if request exists
            if (!emailChangeRequest) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'server_email_change_request_not_found',
                message: 'Email change request not found'
            };

            console.log(`[confirmEmailChange] emailChangeRequest: ${JSON.stringify(emailChangeRequest)}`);
            const { type, userId, newEmail, clientName, clientType, expiresAt, oldEmail } = emailChangeRequest;

            // Check if link is expired
            if (expiresAt && this.isLinkExpired(new Date(expiresAt))) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'server_code_dont_belongs_email',
                message: 'Email change link expired'
            }

            let response: IResponseEmailChange;

            switch (type) {
                case requestEmailChange.userChangeEmail:
                    response = await this.confirmUserEmailChange({ userId, email: newEmail, clientName, clientType, oldEmail });
                    break;
                case requestEmailChange.billingChangeEmail:
                    response = await this.confirmBillingProfileEmailChange({ userId, email: newEmail, oldEmail });
                    break;
                default:
                    console.error(`[confirmEmailChange][Error] Type not found (${type})`);
                    throw ServerError({ code: 'server_email_change_type_not_found', message: 'Email change type not found' });
            }

            console.log(`[confirmEmailChange][Response] ${JSON.stringify(response)}`);

            if (response.statusCode !== StatusCodes.OK) return response;

            // Delete request from redis
            await this.deleteRequestEmailChange({ email, verificationCode });

            return {
                statusCode: StatusCodes.OK,
                code: 'email_change_confirmed',
                message: 'Email change confirmed'
            };
        }
        catch (error) {
            console.error(`[confirmEmailChange][Error] ${JSON.stringify(error)}`);
            // Register error in sentry
            captureException(error);

            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                code: 'server_email_change_confirmation_failed',
                message: 'Email change confirmation failed'
            };
        }
    }

    static confirmUserEmailChange = async ({ userId, email, clientName, clientType, oldEmail }): Promise<IResponseEmailChange> => {
        // if client type is b2c and client name is not evio
        const isWlUser = clientType === Constants.clientTypes.ClientB2C && clientName !== Constants.clientNames.evio;

        try {
            console.log(`[confirmUserEmailChange][Start] userId: ${userId} - email: ${email} - clientName: ${clientName} - clientType: ${clientType} - isWlUser: ${isWlUser}`);
            // Validate email usage
            const isEmailAvailable = await this.isUserEmailAvailable({ email, clientName, userId });
            if (!isEmailAvailable) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'server_email_taken',
                message: 'The email is already in use'
            }

            // if wl user, cancel all tokens
            if (isWlUser && (!await this.cancelAllTokens(userId) || !await this.cancelFirebaseWLTokens(userId))) {
                return {
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    code: 'server_email_change_confirmation_failed',
                    message: 'Email change confirmation failed'
                };
            }

            const userData = isWlUser ? {
                email,
                username: email,
                isEmailVerified: true
            } : {
                email,
                isEmailVerified: true
            }

            await User.updateOne({ _id: userId }, userData);
            await Contract.updateOne({ _id: userId }, { email });

            return {
                statusCode: StatusCodes.OK,
                code: 'email_change_confirmed',
                message: 'Email change confirmed'
            };
        }
        catch (error) {
            console.error(`[confirmUserEmailChange][Error] ${JSON.stringify(error)}`);
            // Register error in sentry
            captureException(error);
            // Rollback
            const userData = isWlUser ? {
                email: oldEmail,
                username: oldEmail,
                isEmailVerified: false
            } : {
                email: oldEmail,
                isEmailVerified: false
            }

            await User.updateOne({ _id: userId }, userData);
            await Contract.updateOne({ _id: userId }, { email });

            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                code: 'server_email_change_confirmation_failed',
                message: 'Email change confirmation failed'
            };
        }
    }

    static confirmBillingProfileEmailChange = async ({ userId, email, oldEmail }): Promise<IResponseEmailChange> => {
        try {
            console.log(`[confirmBillingProfileEmailChange][Start] userId: ${userId} - email: ${email} - oldEmail: ${oldEmail}`);
            // Update billing profile
            await BillingProfile.updateOne({ userId }, { email, status: billingProfileStatus.ACTIVE });
            // Update user If user is using the same email and is not verified
            await User.updateOne({ _id: userId, email }, { isEmailVerified: true });

            return {
                statusCode: StatusCodes.OK,
                code: 'email_change_confirmed',
                message: 'Email change confirmed'
            }
        }
        catch (error) {
            console.error(`[confirmBillingProfileEmailChange][Error] ${JSON.stringify(error)}`);
            // Register error in sentry
            captureException(error);
            // Rollback
            await BillingProfile.updateOne({ userId }, { email: oldEmail, status: billingProfileStatus.INACTIVE });
            await User.updateOne({ _id: userId, email: oldEmail }, { isEmailVerified: false });

            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                code: 'server_email_change_confirmation_failed',
                message: 'Email change confirmation failed'
            }
        }
    }

    static cancelAllTokens = async (userId: string): Promise<boolean> => {
        try {
            console.log(`[cancelAllTokens][Start] userId: ${userId}`);

            const host = Constants.services.authorization.host + Constants.services.authorization.validTokens;

            await axios.patch(host, { userId: userId });
            return true;
        }
        catch (error) {
            console.error(`[cancelAllTokens][Error] ${JSON.stringify(error)}`);
            // Register error in sentry
            captureException(error);
            return false;
        }
    }

    static cancelFirebaseWLTokens = async (userId: string): Promise<boolean> => {

        const host = Constants.services.notification.host + Constants.services.notification.pathNotificationsFirebaseUserTokens;

        try {
            console.log(`[cancelFirebaseWLTokens][Start] userId: ${userId}`);

            await axios.patch(host, { userId: userId });
            return true;
        }
        catch (error) {
            console.error(`[cancelFirebaseWLTokens][Error] ${JSON.stringify(error)}`);
            captureException(error);
            return false;
        }

    }

    static sendWelcomeEmail = async (user: IUserDocument): Promise<boolean> => this.requestEmailChangeWithHashLink({
        type: requestEmailChange.userChangeEmail,
        userId: user._id,
        clientName: user.clientName ?? '',
        name: user.name,
        oldEmail: user.email,
        newEmail: user.email,
        emailTemplate: requestEmailChange.welcomeEmailTemplate,
        language: user.language ?? "en",
        clientType: user.clientType,
        expiresAt: null
    })

    static isBillingProfileEmailChangeEnabled = ({ isBackoffice, clientName }) => {

        const companiesEnabled = [
            Constants.clientNames.evio,
            Constants.clientNames.salvadorCaetano,
            Constants.clientNames.acp,
            Constants.clientNames.hyundai
        ];

        return companiesEnabled.includes(clientName) && !isBackoffice;
    }

    static requestBillingProfileEmailChange = async ({ userId, email, clientName }): Promise<IResponseEmailChange> => {
        try {

            console.log(`[requestBillingProfileEmailChange][Start] userId: ${userId} - email: ${email} - clientName: ${clientName}`);

            if (!email) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'email_not_found',
                message: 'Email not found'
            };

            // Get billing profile
            const billingProfile = await BillingProfile.findOne({ userId });

            // Check if email is already verified by user, if so update billing profile
            const userFound = await User.findOne({ _id: userId, email });

            // validate is email verified or if username is the same (WL user)
            if (userFound && (userFound.isEmailVerified || userFound.username === email)) {
                billingProfile.email = email;
                billingProfile.status = billingProfileStatus.ACTIVE;
                await billingProfile.save();
                return {
                    statusCode: StatusCodes.OK,
                    code: 'email_change_confirmed',
                    message: 'Email change confirmed'
                };
            }

            const user = await User.findOne({ _id: userId });

            // Expires in 10 minutes
            const minutes = 10;
            const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

            // If billing profile is inactive, it's a new billing profile
            const emailTemplate = billingProfile.status === billingProfileStatus.INACTIVE ? requestEmailChange.billingCreateEmailTemplate : requestEmailChange.billingChangeEmail;

            // Send email
            const saved = await this.requestEmailChangeWithToken({
                type: requestEmailChange.billingChangeEmail,
                userId,
                clientName,
                name: user?.name ?? '',
                userEmail: user?.email ?? '',
                oldEmail: billingProfile.email,
                newEmail: email,
                emailTemplate,
                clientType: user?.clientType ?? '',
                expiresAt
            });

            if (!saved) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'server_email_change_failed',
                message: 'Email change failed'
            };

            return {
                statusCode: StatusCodes.ACCEPTED,
                code: 'email_change_sent',
                message: 'Email change sent'
            };
        } catch (error) {
            // Register error in sentry
            console.error(`[requestBillingProfileEmailChange][Error] ${JSON.stringify(error)}`);
            captureException(error);
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                code: 'server_email_change_failed',
                message: 'Email change failed'
            };
        }
    }

    static requestUserEmailChange = async ({ userId, email, clientName }): Promise<IResponseEmailChange> => {
        try {

            console.log(`[requestUserEmailChange][Start] userId: ${userId} - email: ${email} - clientName: ${clientName}`);

            if (!email) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'email_not_found',
                message: 'Email not found'
            };

            // Validate email usage
            const isEmailAvailable = await this.isUserEmailAvailable({ email, clientName, userId });

            if (!isEmailAvailable) return {
                statusCode: StatusCodes.BAD_REQUEST,
                code: 'server_email_taken',
                message: 'The email is already in use'
            };

            const user = await User.findOne({ _id: userId });

            // Expires in 10 minutes
            const minutes = 10;
            const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

            // Send email with token
            const saved = await this.requestEmailChangeWithToken({
                type: requestEmailChange.userChangeEmail,
                userId,
                clientName,
                name: user?.name ?? '',
                userEmail: user?.email ?? '',
                oldEmail: user?.email ?? '',
                newEmail: email,
                emailTemplate: requestEmailChange.userChangeEmail,
                clientType: user?.clientType ?? '',
                expiresAt
            });

            // Something went wrong but the exception was caught
            if (!saved) return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                code: 'server_email_change_request_failed',
                message: 'Email change request failed'
            };

            return {
                statusCode: StatusCodes.ACCEPTED,
                code: 'email_change_request_sent',
                message: 'Email change request sent'
            };

        } catch (error) {
            console.error(`[requestUserEmailChange][Error] ${JSON.stringify(error)}`);
            captureException(error);
            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                code: 'server_email_change_request_failed',
                message: 'Email change request failed'
            };
        }
    }

    static confirmEmailChangeWithHash = async (hash: string): Promise<IResponseEmailChange> => {

        console.log(`[confirmEmailChangeWithHash][Start] Hash: ${hash}`);

        if (!hash) return {
            statusCode: StatusCodes.BAD_REQUEST,
            code: 'hash_not_found',
            message: 'Hash not found'
        };

        const data = await this.decodeHash(hash);

        if (!data) return {
            statusCode: StatusCodes.BAD_REQUEST,
            code: 'token_not_valid_or_expired',
            message: 'Token not valid or expired'
        }

        const { email, verificationCode } = data;
        console.log(`[confirmEmailChangeWithHash][Data] ${JSON.stringify(data)}`);

        // Get data from redis before delete it
        const emailChangeRequest = await this.getRequestEmailChange({ email, verificationCode });

        if (!emailChangeRequest) return {
            statusCode: StatusCodes.BAD_REQUEST,
            code: 'token_not_valid_or_expired',
            message: 'Token not valid or expired',
        };

        const response = await this.confirmEmailChange({ email, verificationCode });

        console.log(`[confirmEmailChangeWithHash][Response] ${JSON.stringify(response)}`);

        return response;
    }
}