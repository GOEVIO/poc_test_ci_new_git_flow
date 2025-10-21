import axios from 'axios';
import * as Sentry from '@sentry/node';
const moment = require('moment');
import dotenv from 'dotenv-safe';
import { StatusCodes } from 'http-status-codes';
import { captureMessage } from '@sentry/node';
import { Request, Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { getCode } from 'country-list';
import axiosS from '../services/axios';
import { clientTypeNameEnum, clientNameEnum, userTypeEnum, platformEnum } from '../utils/enums/users';
import { BadRequest, errorResponse, ServerError, Unauthorized } from '../utils/errorHandling';
import Constants from '../utils/constants';
import { IDeletionClearance, IUserCaetanoGOUpdate, IUserPatchCaetanoGO } from '../interfaces/users.interface';
import {
    ClientType,
    IGetUserByClientName,
    IUserDocument,
} from '../interfaces/users.interface';
import driversService from '../services/drivers';
import UserHandler from './user'; // TODO: all methods in this file must be ported to this file
import toggle from 'evio-toggle'; 
// BD
import BillingProfile from '../models/billingProfile';
import User from '../models/user';
import AppConfigurationService from '../services/configsService';

// Service
import usersService from '../services/users';
import contractsServices from '../services/contracts';
// Utils
import userUtills from '../utils/users';
import { generateRandomPassword, getRegex } from '../utils/transformation';
import { TokenStatusChangeReason } from '../utils/enums/TokenStatusChangeReason';
// Helpers
import { DeletionReason } from '../enums/deletionReason';
import { MessageParamsEmail } from '../interfaces/utils/messageParamsEmail.interface';
import { CLIENTS_ALLOWED_DELETE_ACCOUNT } from '../helpers/deleteAccount/clientNameDeleteAccount';
import { FinanceEmails } from '../helpers/deleteAccount/financeEmails';

import UserPasswords from "../models/userPasswords";
import EmailChangeService from '../services/emailChangeService';
import TokenStatusService from '../services/tokenStatus.service';

dotenv.load();

// TODO: Refactor addUser and addUserWl functions to remove from users.js
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createUserDependencies } = require('../routes/users');

function getGochargeHostAndAuth() {
    let host;
    let auth;
    switch (process.env.NODE_ENV) {
        case 'production':
            auth = {
                username: process.env.UserNameWebserviceGoCharge,
                password: process.env.KeyWebserviceGoCharge
            };
            host = process.env.HostToken;

            break;
        case 'development':
            auth = {
                username: process.env.UserNameWebserviceGoChargePRE,
                password: process.env.KeyWebserviceGoChargePRE
            };
            host = process.env.HostTokenTest;

            break;
        case 'pre-production':
            auth = {
                username: process.env.UserNameWebserviceGoChargePRE,
                password: process.env.KeyWebserviceGoChargePRE
            };
            host = process.env.HostTokenTest;

            break;
        default:
            auth = {
                username: process.env.UserNameWebserviceGoChargePRE,
                password: process.env.KeyWebserviceGoChargePRE
            };
            host = process.env.HostTokenTest;
            break;
    }
    return { host, auth };
}

const getUsersByClientName = async (req: Request, res: Response) => {
    const context = `${req.method} ${req.path}`;
    try {
        const clientName = <string>req.headers.clientname;
        const {
            field, value, pageNumber, limitQuery
        } = <IGetUserByClientName>(
            req.query
        );
        const { userid:userId, requestuserid:requestUserId } = <{ userid:string, requestuserid:string }> req.headers
        let additionalFilters: FilterQuery<IUserDocument> | undefined;
        const isSuperAdmin = Constants.OperationsManagement.OperationsManagementID === requestUserId
        if (field && value) {
            const validFields = ['email', 'name', 'mobile', 'clientType'];

            if (!validFields.includes(field)) {
                throw BadRequest({
                    auth: false,
                    code: 'server_invalid_query',
                    message: `Invalid query parameter field ${field}, possible values: ${validFields.join(',')}`
                });
            }

            const searchValue = field === 'clientType' ? value : { $regex: getRegex(value, true) };
            additionalFilters = { [field]: searchValue };
        }
        if (!clientName) throw BadRequest({ auth: false, code: 'server_missing_header', message: 'Missing clientName' });
        if(!isSuperAdmin){
            const user = await User.findOne({ _id: userId })
            if(!user) throw BadRequest({ auth: false, code: 'server_user_not_found', message: 'User not found' });
            if( !user.userPackage?.createB2CUsers && !user.userPackage?.createB2BUsers) throw Unauthorized({ auth: false, code: 'action_not_allowed', message: 'Action not allowed for this user' });
            if( !user.userPackage?.createB2CUsers && user.userPackage?.createB2BUsers && field === 'clientType' && value !== 'b2b') throw BadRequest({ auth: false, code: 'bad_query_filter', message: 'Invalid query filter for this user' });
            if( user.userPackage?.createB2CUsers && !user.userPackage?.createB2BUsers && field === 'clientType' && value !== 'b2c') throw BadRequest({ auth: false, code: 'bad_query_filter', message: 'Invalid query filter for this user' });
            if(!user.userPackage?.createB2CUsers || !user.userPackage?.createB2BUsers && field !== 'clientType'){
                if(additionalFilters){
                    user.userPackage?.createB2CUsers ? additionalFilters['clientType'] = 'b2c'  : additionalFilters['clientType'] = 'b2b' ;
                } else {
                    user.userPackage?.createB2CUsers ? additionalFilters = { ['clientType']: 'b2c' } : additionalFilters = { ['clientType']: 'b2b' };
                }
            }
        }
        const [users, { total, pages }] = await Promise.all([
            User.getUsersByClientName(clientName, additionalFilters, pageNumber, limitQuery),
            User.getUsersCountByClientName(clientName, additionalFilters, limitQuery)
        ]);

        const paginationHeaders = {
            'Access-Control-Expose-Headers': ['totalOfEntries', 'numberOfPages'],
            totalOfEntries: total,
            numberOfPages: pages > 0 ? pages : 1
        };

        const usersWithClientTypeName = users.map((user) => {
            const clientTypeName = user.clientType ? clientTypeNameEnum[user.clientType] : '';
            return { ...user, clientTypeName };
        });

        return res.status(200).header(paginationHeaders).send(usersWithClientTypeName);
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

const createUser = async (req: Request, res: Response) => {
    const context = `${req.method} ${req.path}`;

    try {
        const { headers } = req;
        const clientType = req.params.clientType as ClientType;
        const {
            clientname: clientName,
            userid: userId,
            language: langHeader
        } = <{clientname: string, userid: string, language: string}>headers;

        const { addDriver, password, country, language: languageBody } = <{addDriver: boolean, password: string, country: string, language:string}>req.body;
        const countryCode = getCode(country);
        delete req.body.password;
        let platform = clientTypeNameEnum[clientType] === clientTypeNameEnum.b2b
            ? platformEnum.webclient
            : platformEnum.app;
        const user = new User(req.body);

        user.userPackage = Constants.users.default.packages[clientType];
        user.userType = userTypeEnum[clientType];
        user.clientType = clientType;
        user.clientName = <string>clientName;
        user.needChangePassword = true;

        if (clientTypeNameEnum[clientType] === clientTypeNameEnum.b2c) {
            user.isEmailVerified = true;
        }

        user.active = true;
        user.validated = true;
        user.country = countryCode; //We store and use countryCodes as countries in our database

        // Get the app config
        const appConfig = await AppConfigurationService.getAppConfiguration(clientName);

        if (!appConfig) {
            throw { auth: false, code: 'app_config_not_found', message: 'AppConfigurations not found' };
        }

        //set language preference
        user.language = userUtills.setLanguageUser(user, appConfig, (langHeader ?? languageBody));

        //@ts-ignore
        const { licenseServiceEnabled, licenseProductEnabled, licenseMarketingEnabled, unsubscribedLink } = appConfig.marketingAndPromotionNotifications;
        
        if (clientTypeNameEnum[clientType] === 'Company') {
            user.licenseAgreement = true;
            user.licenseMarketing = true;
            user.licenseServices = true;
            user.licenseProducts = true;
            user.validated = true;
            user.evioCommission = Constants.users.default.evioCommission;
            if(clientName === clientNameEnum.EVIO) user.username = user.email;
        }

        // if the company license is not enabled, set licenseServices, licenseProducts and licenseMarketing to false
        if (!licenseServiceEnabled) user.licenseServices = false;
        if (!licenseProductEnabled) user.licenseProducts = false;
        if (!licenseMarketingEnabled) user.licenseMarketing = false;
        
        // create unsubscribed link by company license preferences
        if (licenseProductEnabled || licenseServiceEnabled || licenseMarketingEnabled) {
            user.unsubscribedLink = User.getUnsubscribedLink(user._id, clientName, unsubscribedLink);
        }
        
        if (user.imageContent) {
            // eslint-disable-next-line no-underscore-dangle
            user.imageContent = await usersService.saveUserImage(user._id, user.imageContent);
        }

        const savedUser = await user.save();

        try {
            console.log(`[${context}] - Adding password for user ${savedUser?.email} (${clientName})`);
            await UserPasswords.addPassword(user._id, password);

            createUserDependencies(user, headers, true);

            if (clientTypeNameEnum[clientType] === 'Private' && addDriver) {
                const drivers = [
                    {
                        mobile: user.mobile,
                        internationalPrefix: <string>user.internationalPrefix
                    }
                ];

                await driversService.addNewDrivers(drivers, userId, clientName);
            }
            await usersService.sendCreateUserEmail(user.email, password, user.username,  <string>clientName, platform);
            return res.status(201).send(savedUser);
        } catch (error) {
            user.delete();
            throw error;
        }
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

async function updateUserCaetanoGO(user: IUserCaetanoGOUpdate, userFound:IUserDocument) {
    const context = 'Function updateUserCaetanoGO';
    try {
        if ( !user || !((userFound?.idGoData as { access_token?: string })?.access_token) || !((userFound?.idGoData as { sub_marketing?: string })?.sub_marketing)){
            console.error(`[${context}] Error - Missing Input data`, user, userFound);
            captureMessage(`[${context}] Error - Missing Input data `);
            return false;
        }
        const data : IUserPatchCaetanoGO = {
            name: user.name,
            phone_number: user.mobile,
            phone_code: user.internationalPrefix ? user.internationalPrefix.split('+')[1] : undefined,
            sub_marketing: (userFound?.idGoData as { sub_marketing?: string })?.sub_marketing
        };
        const { host, auth } = getGochargeHostAndAuth();
        const hostUser = `${host}${process.env.PathUpdateUserCaetanoGO}${(userFound?.idGoData as { access_token?: string })?.access_token}/`;

        const result = await axios.patch(hostUser, data, { auth });

        if (result?.data?._status !== 'success') {
            console.error(`[${context}] Error from axios `, result.data);
            captureMessage(`[${context}] Error from axios `, result.data);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return false;
    }
}

async function hyundaiGetToken() {
    const context = 'Function hyundaiGetToken';
    try {
        const host = process.env.hyundaiGetToken;
        const keys = ['client_id', 'scope', 'client_secret', 'grant_type'];
        const values = [
            process.env.HYUNDAI_CLIENT_ID,
            process.env.HYUNDAI_CLIENT_SCOPE,
            process.env.HYUNDAI_CLIENT_SECRET,
            process.env.hyundaiGranType
        ];

        const body = axiosS.getFromDataFormat(keys, values);

        return await axiosS.axiosPostBody(host, body);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        return null;
    }
}

async function updateUserHyundai(userId: string) {
    const context = 'Function hyundaiPutData';
    try {
        if(!Types.ObjectId.isValid(userId)){
            console.error(`[${context}] Error - Invalid userId ${userId}`);
            captureMessage(`Invalid userId ${userId}`);
            return null;
        }

        const [tokenInfo , userFound, billingProfileFound] = await Promise.all([
            await hyundaiGetToken(),
            await User.findOne({ _id: userId }, { _id: 1, idHyundaiCode: 1, idHyundai: 1, internationalPrefix: 1, mobile: 1, name: 1, email: 1 }),
            await BillingProfile.findOne({ userId }, { userId: 1, nif: 1, idHyundai: 1, billingAddress: 1 })
        ]);
        if(!tokenInfo) {
            console.error(`[${context}] Error - Fail to get Token Info!`);
            captureMessage(`Fail to get Token Info`);
            return null;
        }
        if (!userFound) {
            console.error(`[${context}] Error - User not found! for user ${userId}` );
            captureMessage(`User not found! for user: ${userId}`);
            return null;
        }
        if (!billingProfileFound) {
            console.error(`[${context}] Error - Billing profile not found! for user: ${userId}`);
            captureMessage(`'Billing profile not found! for user: ${userId}`);
            return null;
        }

        const { street = '', number = '', zipCode = '', city = '' } = billingProfileFound.billingAddress;
        const address = `${street},${number},${zipCode},${city}`;

        const data = {
            telephone: userFound.internationalPrefix + userFound.mobile,
            nif: billingProfileFound.nif,
            address,
            firstName: userFound.name,
            lastName: '',
        };
        const headers = { Authorization: `Bearer ${tokenInfo.access_token}`, idClientCRM: userFound.idHyundaiCode, brand: process.env.hyundaiBrand };

        const host = (process.env.hyundaiPutData ?? 'https://demowsmyhyundai.rigorcg.pt/WsMyHyundai/services/client/') + userFound.idHyundaiCode;
        return await axiosS.axiosPutBodyAndHeader(host, data, headers);
    } catch (error) {
        console.error(`[${context}] Error `, error);
        captureMessage(error.message);
        return null;
    }
}

async function patchUser(req: Request, res: Response) {
    const context = `${req.method} ${req.path}`;
    try {
        const {
            email, internationalPrefix, mobile, username, name
        } = req.body;
        const { userId } = req.params;
        const { userid: userRequestId } = <{userid :string}> req.headers;
        const user = await User.findById(userId);
        if (!user) return errorResponse(res, BadRequest({ auth: false, code: 'server_user_not_found', message: 'User not found' }), context);

        const [isUsedEmail, isUsedPhone] = await Promise.all([
            User.isUsedEmail(email ?? '', userId, user.clientName ?? ''),
            User.isUsedMobile(mobile, userId, user.clientName ?? '')
        ]);
        if (isUsedEmail) return errorResponse(res, BadRequest({ auth: false, code: 'server_email_already_exists', message: 'Email already exists' }), context);
        if (isUsedPhone) return errorResponse(res, BadRequest({ auth: false, code: 'server_phone_already_exists', message: 'Phone already exists' }), context);
        const updatedUser = await User.updateUser({ _id: userId }, {
            email, internationalPrefix, mobile, username, name
        });
        if (!updatedUser) {
            console.error(`${context} Error - Error updating user`);
            return errorResponse(res, ServerError('Fail to update user'), context);
        }

        const query = {
            _id: userId,
            clientName: user.clientName
        };
        const userToUpdate :IUserCaetanoGOUpdate = {
            name: updatedUser.name,
            mobile: updatedUser.mobile,
            internationalPrefix: updatedUser.internationalPrefix,
            imageContent: updatedUser.imageContent
        };

        if (user.clientName !== clientNameEnum.EVIO) {
            if (([process.env.WhiteLabelGoCharge, process.env.WhiteLabelHyundai].includes(updatedUser.clientName)) && (updatedUser.clientType === 'b2b' || updatedUser.clientType === 'b2c')) {
                const result = await updateUserCaetanoGO(userToUpdate, user);
                if (!result) {
                    console.error(`${context} Error - Error updateUserCaetanoGO user `, userId);
                    return errorResponse(res, ServerError('Fail to update user'), context);
                }
            }
            const updateUserWl = await UserHandler.updateUsersWl(query, userToUpdate);
            if (!updateUserWl) {
                console.error(`${context} Error - Error updateUsersWl user `, userId);
                return errorResponse(res, ServerError('Fail to update user'), context);
            }
            if (updatedUser.clientName === clientNameEnum.Hyundai) updateUserHyundai(userId);
        }

        return res.status(200).send(userUtills.removeSensitiveInformation(updatedUser));
    } catch (error) {
        console.error(`${context} Error - `, error.message);
        return errorResponse(res, error, context);
    }
}

const resetUserPassword = async (req: Request, res: Response) => {
    const context = `${req.method} ${req.path}`;

    try {
        const { userId } = req.params;

        const password = generateRandomPassword();

        const user = await User.findById(userId);

        if (!user) throw BadRequest({ auth: false, code: 'server_users_not_found', message: 'Users not found for given parameters' });

        const { username, clientName, email } = user;
        const isEvio = clientName === clientNameEnum.EVIO;

        console.log(`[${context}] - Resetting password for user ${userId} ...`);
        await UserPasswords.updatePassword(user._id, password);

        usersService.cancelFirebaseTokens(userId, !isEvio);
        usersService.cancelAllTokens(userId);

        User.updateUser({ _id: userId }, { $set: { needChangePassword: true } }).catch((error) => {
            console.error(`Unable to set needChangePassword for user ${userId}:`, error);
        });

        await usersService.sendResetPasswordEmail(email, password, username, <string>clientName);

        return res.status(200).send({ auth: true, code: 'server_password_change', message: 'Password successfully changed' });
    } catch (error) {
        return errorResponse(res, error, context);
    }
};

async function reactivateFailDeleteUserRequest(
    user: IUserDocument,
    userId: string
): Promise<void> {
    const context = `Function reactivateFailDeleteUserRequest`;
    try {
        Promise.all([
            usersService.handleRevertAccountDeletionRequested(user),
            contractsServices.handleExternalNetworkContracts(userId, true),
        ]);
    } catch (error) {
        console.error(
            `[${context}] - Error fetching wallet data:`,
            error.message
        );
        Sentry.captureException(error);
    }
}

const deleteUser = async (req: Request, res: Response): Promise<Response> => {
    const context = "Function deleteUser";
    const { userid: userId } = req.headers as { userid: string };
    let user;
    try {
        console.info(`[${context}] - Process started for userId:${userId}`);
        
        user = await User.findById(userId);
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ auth: false, code: 'server_user_not_found', message: 'User not found' });
        }

        // Check if delete account process already requested
        if (user.accountDeletionRequested) {
            return res.status(StatusCodes.CONFLICT).json({
                auth: false,
                code: "account_already_in_deletion_process",
                message: "The account deletion process has already been requested"
            });
        }

        if (!CLIENTS_ALLOWED_DELETE_ACCOUNT.includes(user.clientName)) {
            await usersService.sendAccountDeletionRequestSupport(user);
            return res.status(StatusCodes.OK).json({
                auth: true,
                code: "user_deletion_process_started_successfully",
                message: "User deletion process started successfully"
            });
        }

        const actionDate = new Date();
        const deletionRequested = true;
        const deletionClearance: IDeletionClearance = {
            actionDate,
            isCleared: true,
            reason: DeletionReason.USER_REQUESTED
        };

        try {
            const featureFlagEnabled = await toggle.isEnable('fleet-363-delete-user');

            if (featureFlagEnabled) {
                const tokenStatusService = new TokenStatusService(); 
                const tokensUpdated = await tokenStatusService.switchReasonByUserId({
                    userId, 
                    reason: TokenStatusChangeReason.DeleteAccount,
                    activeBlock: true,
                    requestUserId: userId
                });

                if (!tokensUpdated) {
                    console.error(`[${context}] - Error updating token status for user ${userId}`);
                    return errorResponse(
                        res,
                        BadRequest({
                            auth: false,
                            code: 'server_error',
                            message: 'Tokens not updated',
                        }),
                        context
                    );
                }

                await usersService.handleAccountDeletionRequested(
                    user,
                    deletionClearance,
                    deletionRequested
                );
            }
            else {
                await Promise.all([
                    usersService.handleAccountDeletionRequested(
                        user,
                        deletionClearance,
                        deletionRequested
                    ),
                    contractsServices.handleExternalNetworkContracts(userId, false),
                    contractsServices.updateTokenStatusByUserId(userId, 'inactive', TokenStatusChangeReason.AccountDeletionRequested),
                    usersService.handleStatusRfidCard(user, 'inactive'),
                ]);
            }

            console.info(`[${context}] - handleAccountDeletionRequested and handleExternalNetworkContracts resolved`);
        } catch (error) {
            console.error(
                `[${context}] - Error fetching wallet data:`,
                error.message
            );
            throw error;
        }

        console.info(`[${context}] - Get wallet balance`);
        let amountWallet = await usersService.getWalletBalance(userId);
       
        console.info(`[${context}] - Preparing to send emails`);
        sendDeletionEmails(user, amountWallet, actionDate);

        contractsServices.deleteCachedContractsByUser(userId);

        return res.status(StatusCodes.OK).json({
            auth: true,
            code: "user_deletion_process_started_successfully",
            message: "User deletion process started successfully"
        });

    } catch (error) {
        console.error(`[${context}] Error`, error);
        reactivateFailDeleteUserRequest(user, userId);
        Sentry.captureException(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            auth: false,
            code: 'server_error',
            message: "Internal server error"
        });
    }
};

const sendDeletionEmails = async (user, amountWallet, actionDate) => {
    const context = "Function sendDeletionEmails";
    try {
        console.info(`[${context}] - Starting email sending process for user ${user._id.toString()}`);

        const messageUserEmail: MessageParamsEmail = {
            username: user.name,
            userEmail: user.email
        };

        const supportEmail = usersService.getSupportEmail(user.clientName);
        const messageSupportEmail: MessageParamsEmail = {
            destinationEmail: supportEmail,
            username: user.name,
            userEmail: user.email,
            userId: user._id.toString(),
            deletionRequestDate: moment.utc(actionDate).local().format('DD/MM/YYYY HH:mm'),
            balanceWallet: `${amountWallet.value.toString()} ${amountWallet.currency.toString()}`
        };

        console.info(`[${context}] - Preparing email for user ${user.name} and support at ${supportEmail}`);

        const emailPromises = [
            usersService.sendEmailDeleteAccount('account_deletion_request', messageUserEmail, undefined, user.clientName)
        ];

        if (user.userType === process.env.UserTypeFinalCostumer) {
            console.info(`[${context}] - User type is FinalCustomer, sending email to support.`);
            emailPromises.push(
                usersService.sendEmailDeleteAccount('account_deletion_request_support', messageSupportEmail, undefined, user.clientName)
            );
        } else {
            console.info(`[${context}] - User type is not FinalCustomer, sending email to Sales support.`);
            emailPromises.push(
                usersService.sendEmailDeleteAccount('account_deletion_request_support', messageSupportEmail, Constants.emails.Sales, user.clientName)
            );
        }

        const fleetOwnerEmails = await usersService.getFleetOwnerEmail(user);
        console.info(`[${context}] - Found ${fleetOwnerEmails?.length} fleet owner emails for user ${user.name}`);
        if (fleetOwnerEmails && fleetOwnerEmails.length > 0 && user.clientName === 'EVIO') {
            fleetOwnerEmails.forEach((email) => {
                const fleetOwnerEmailData: MessageParamsEmail = {
                    destinationEmail: email,
                    username: user.name,
                    userEmail: user.email,
                    userId: user._id.toString(),
                    deletionRequestDate: moment.utc(actionDate).local().format('DD/MM/YYYY HH:mm'),
                    balanceWallet: `${amountWallet.value.toString()} ${amountWallet.currency.toString()}`
                };
                emailPromises.push(
                    usersService.sendEmailDeleteAccount('account_deletion_request_support', fleetOwnerEmailData, undefined, user.clientName)
                );
            });
        }

        await Promise.all(emailPromises);
        console.info(`[${context}] - Emails sent successfully for user ${user._id.toString()}`);
    } catch (error) {
        console.error(`[${context}] Error for user ${user._id.toString()}`, error);
        Sentry.captureException(error);
    }
};


const revertRequestDeleteAccount = async (req: Request, res: Response): Promise<Response> => {
    const context = "Function revertRequestDeleteAccount";
    try {
        const { userid: userId } = req.headers as { userid: string };
        const userData = await User.findOne({ _id: userId });

        console.info(`[${context}] - Process started for userId:${userId}`);
        if (!userData) {
            return res.status(StatusCodes.NOT_FOUND).json({ auth: false, code: 'server_user_not_found', message: 'User not found' });
        }

        const deletionRequested = false;
        const deletionClearance: IDeletionClearance = {
            actionDate: new Date(),
            isCleared: false,
            reason: DeletionReason.USER_SUSPEND_DELETION
        };

        try {

            const featureFlagEnabled = await toggle.isEnable('fleet-363-delete-user');

            if (featureFlagEnabled) {
                const tokenStatusService = new TokenStatusService();
                const tokensUpdated = await tokenStatusService.switchReasonByUserId({
                    userId, 
                    reason: TokenStatusChangeReason.DeleteAccount,
                    activeBlock: false,
                    requestUserId: userId
                });

                if (!tokensUpdated) {
                    console.error(`[${context}] - Error updating token status for user ${userId}`);
                    return errorResponse(
                        res,
                        BadRequest({
                            auth: false,
                            code: 'server_error',
                            message: 'Tokens not updated',
                        }),
                        context
                    );
                }

                await usersService.handleAccountDeletionRequested(
                    userData,
                    deletionClearance,
                    deletionRequested
                );
            }
            else {
                await Promise.all([
                    usersService.handleAccountDeletionRequested(
                        userData,
                        deletionClearance,
                        deletionRequested
                    ),
                    contractsServices.handleExternalNetworkContracts(userId, true),
                    contractsServices.updateTokenStatusByUserId(userId, 'active', TokenStatusChangeReason.AccountDeletionCanceled),
                    await usersService.handleStatusRfidCard(userData, 'active')
                ]);
            }
        } catch (error) {
            console.error(`[${context}] Error`, error.message);
            Sentry.captureException(error);
        }

        // Prepare the email data for the user
        const messageUserEmail: MessageParamsEmail = {
            userEmail: userData.email,
            username: userData.name
        };

        const clientName = userData.clientName || '';
        const supportEmail = getSupportEmail(clientName);
        // Prepare the email data for the support team
        const supportEmailData : MessageParamsEmail = {
            destinationEmail: supportEmail,
            username: userData.name,
            userId: userId,
            userEmail: userData.email,
            deletionRequestDate: new Date().toISOString(),
        };


        const emailPromises = [
            usersService.sendEmailDeleteAccount('revert_deletion_account', messageUserEmail, undefined, userData.clientName)
        ];

        if (userData.userType === process.env.UserTypeFinalCostumer) {
            // Send email from personal account
            emailPromises.push(
                usersService.sendEmailDeleteAccount('account_deletion_revert_support', supportEmailData, undefined, userData.clientName)
            );
        } else {
            // Send email from business account
            emailPromises.push(
                usersService.sendEmailDeleteAccount('account_deletion_revert_support', supportEmailData, Constants.emails.Sales, userData.clientName)
            );
        }

        const fleetOwnerEmails = await usersService.getFleetOwnerEmail(userData);
        if (fleetOwnerEmails && fleetOwnerEmails.length > 0 && userData.clientName === 'EVIO') {
            fleetOwnerEmails.forEach((fleetOwnerEmail) => {
                // Prepare the email data for each fleet owner
                const fleetOwnerEmailData: MessageParamsEmail = {
                    destinationEmail: fleetOwnerEmail,
                    username: userData.name,
                    userId: userId,
                    userEmail: userData.email,
                    deletionRequestDate: new Date().toISOString(),
                };

                emailPromises.push(
                    usersService.sendEmailDeleteAccount('account_deletion_revert_support', fleetOwnerEmailData, undefined, userData.clientName)
                );
            });
        }

        await Promise.all(emailPromises);

        console.info(`[${context}] - User deletion process canceled successfully for userId:${userId}`);

        contractsServices.deleteCachedContractsByUser(userId);
        
        return res.status(StatusCodes.OK).json({
            auth: true,
            code: "user_deletion_process_canceled_successfully",
            message: "User deletion process canceled successfully"
        });

    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        Sentry.captureException(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            auth: false,
            code: 'server_error',
            message: "Internal server error"
        });
    }
};

const processAfter30DaysDeleteAccount = async (req, res) => {
    const context = "function processAfter30DaysDeleteAccount";
    console.info(`[${context}] - Initiating deletion process`);
    try {
        await deleteUsersAfter30DaysRequest();
        console.info(`[${context}] - Process completed successfully.`);
        res.status(StatusCodes.OK).send({ message: "Process completed successfully." });
    } catch (error) {
        console.error(`[${context}] - Error occurred during the deletion process:`, error);
        Sentry.captureException(error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            auth: false,
            code: 'server_error',
            message: "Internal server error"
        });
    }
}

const deleteUsersAfter30DaysRequest = async () => {
    const context = "Function deleteUsersAfter30DaysRequest";
    try {
        console.info(`[${context}] - Starting user search for deletion after 30 days.`);
        const dateMore30Days = moment().subtract(30, 'days').toDate();

        const users = await User.find({
            accountDeletionRequested: true
        });
        console.info(`[${context}] - ${users.length} users found with accountDeletionRequested: true.`);

        for (const user of users) {
            const userId = user._id.toString();
            console.info(`[${context}] - Evaluating user ${userId} | status: ${user.status}`);

            // Find the most recent item in the deletionClearance array with isCleared == true
            const recentClearance = user.deletionClearance?.[user.deletionClearance.length - 1];

            // Skip if user is blocked or blocked due to debt
            if (recentClearance?.reason == DeletionReason.USER_BLOCKED || recentClearance?.reason == DeletionReason.USER_BLOCKED_DEBT) {
                console.info(`[${context}] - User ${userId} skipped: blocked or blocked due to debt.`);
                continue;
            }

            // If user is currently blocked, update deletion status
            if (user.blocked) {
                console.info(`[${context}] - User ${userId} is currently blocked. Updating deletion status.`);
                const deletionRequested = true;
                const deletionClearance: IDeletionClearance = {
                    actionDate: new Date(),
                    isCleared: false,
                    reason: DeletionReason.USER_BLOCKED
                };

                await usersService.handleAccountDeletionRequested(user, deletionClearance, deletionRequested);
                continue;
            }

            // Proceed if user has a valid clearance and is not already removed
            if (recentClearance && recentClearance.isCleared && user.status !== "REMOVED") {
                let adjustedDate = recentClearance.actionDate;
                console.info(`[${context}] - User ${userId} has clearance for deletion. Base date: ${adjustedDate}`);

                // Adjust date if the reason is "Debt Cleared"
                if (recentClearance.reason == DeletionReason.USER_DEBT_CLEARED) {
                    const requestedDateUser = user.deletionClearance?.reverse().find(item => item.reason == DeletionReason.USER_REQUESTED);
                    const blockedForDebtClearance = user.deletionClearance?.reverse().find(item => item.reason == DeletionReason.USER_BLOCKED_DEBT);

                    if (blockedForDebtClearance && requestedDateUser) {
                        const debtClearedDate = new Date(recentClearance.actionDate);
                        const debtPaymentDate = new Date(blockedForDebtClearance.actionDate);
                        const daysInDebt = moment(debtClearedDate).diff(moment(debtPaymentDate), 'days');
                        adjustedDate = moment(requestedDateUser.actionDate).add(daysInDebt, 'days').toDate();
                        console.info(`[${context}] - User ${userId} had debt cleared. Adjusted deletion date: ${adjustedDate}`);
                    }
                }

                // If eligible for deletion
                if (adjustedDate <= dateMore30Days) {
                    console.info(`[${context}] - User ${userId} eligible for deletion. Fetching wallet balance.`);
                    const amountWallet = await usersService.getWalletBalance(userId);

                    // Fetch and filter transactions
                    const transactions = await usersService.getTransactionsByUserId(userId);
                    const transactionsPaid = transactions?.filter(
                        t => t?.status === "40" && t?.transactionType === 'credit' && t?.provider !== 'Other'
                    ) || [];

                    console.info(`[${context}] - User ${userId} has ${transactionsPaid.length} paid transactions eligible for refund.`);
                    // Calculate voucher amount to exclude from refund
                    const voucherAmount = transactions?.reduce((acc, t) => (
                        t?.status === "40" && t?.transactionType === 'credit' && t?.provider === 'Other'
                            ? acc + (t.amount?.value || 0)
                            : acc
                    ), 0) || 0;
                    console.info(`[${context}] - User ${userId} has voucher amount: ${voucherAmount}`);

                    const adjustedAmountWallet = (amountWallet && typeof amountWallet.value === 'number')
                        ? { ...amountWallet, value: amountWallet.value - voucherAmount }
                        : amountWallet;

                    console.info(`[${context}] - User ${userId} | Original balance: ${amountWallet?.value} | Vouchers: ${voucherAmount} | Adjusted balance: ${adjustedAmountWallet?.value}`);

                    // Prepare refund details for emails
                    let paymentDetails = '';
                    if (transactionsPaid && transactionsPaid.length > 0) {
                        paymentDetails = transactionsPaid.map(transaction => ({
                            amount: `${transaction.amount.value} ${transaction.amount.currency}`,
                            transactionId: transaction._id,
                            provider: transaction.provider || transaction.dataReceived?.paymentMethod
                        }));
                    }
                    const clientName = user.clientName || '';
                    const supportEmail = getSupportEmail(clientName);

                    // Remove tokens and delete user data
                    await Promise.all([
                        usersService.removeTokensByUser(userId),
                        usersService.deleteUserAndRelatedData(user, adjustedAmountWallet?.value)
                    ]);
                    console.info(`[${context}] - User ${userId} and related data removed.`);

                    // Prepare and send refund emails
                    const messageEmailSupport: MessageParamsEmail = {
                        destinationEmail: supportEmail,
                        username: user.name,
                        userEmail: user.email,
                        paymentMethod: paymentDetails,
                        refundAmount: `${adjustedAmountWallet?.value.toString()} ${adjustedAmountWallet?.currency.toString()}`
                    };
                    const messageEmailUser: MessageParamsEmail = {
                        username: user.name,
                        userEmail: user.email,
                        paymentMethod: paymentDetails,
                        refundAmount: `${adjustedAmountWallet?.value.toString()} ${adjustedAmountWallet?.currency.toString()}`
                    };
                    const financeEmail = getFinanceEmail(clientName);
                    const messageEmailFinance: MessageParamsEmail = {
                        destinationEmail: financeEmail,
                        username: user.name,
                        userEmail: user.email,
                        userId: userId,
                        paymentMethod: paymentDetails,
                        refundAmount: `${adjustedAmountWallet?.value.toString()} ${adjustedAmountWallet?.currency.toString()}`
                    };

                    const emailTypeUser = adjustedAmountWallet?.value > 0
                        ? 'account_deletion_refund_customer'
                        : 'account_deletion_refund_customer_no_balance';

                    const emailPromises: Promise<void>[] = [];

                    if (adjustedAmountWallet?.value > 0) {
                        emailPromises.push(usersService.sendEmailDeleteAccount('account_deletion_refund_finance', messageEmailFinance, supportEmail, clientName));
                    } else {
                        emailPromises.push(usersService.sendEmailDeleteAccount('account_deletion_refund_finance_no_balance', messageEmailSupport, undefined, clientName));
                    }

                    emailPromises.push(usersService.sendEmailDeleteAccount(emailTypeUser, messageEmailUser, undefined, clientName));

                    await Promise.all(emailPromises);
                    console.info(`[${context}] - Refund emails sent for user ${userId}.`);
                } else {
                    // Not yet eligible, calculate days remaining
                    const daysRemaining = moment(recentClearance.actionDate).add(30, 'days').diff(moment(), 'days');
                    if (daysRemaining === 5) {
                        await usersService.sendAccountDeletionReminder(user, daysRemaining);
                        console.info(`[${context}] - Deletion reminder sent to user ${userId} (5 days left).`);
                    } else {
                        console.info(`[${context}] - User ${userId} not yet eligible for deletion. Days remaining: ${daysRemaining}`);
                    }
                }
            } else {
                console.info(`[${context}] - User ${userId} does not have clearance for deletion or is already removed.`);
            }
        }
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        Sentry.captureException(error);
        throw error;
    }
};

const getSupportEmail = (clientName: string) => {
    if (clientName === 'EVIO') {
        return Constants.emails.SupportEvio;
    } else if (clientName === 'ACP') {
        return Constants.emails.SupportACP;
    } else if (clientName === 'Hyundai') {
        return Constants.emails.SupportHyundai;
    } else if (clientName === 'KLC') {
        return Constants.emails.SupportKLC;
    } else if (clientName === 'Salvador Caetano') {
        return Constants.emails.SupportGoCharge;
    }
    return Constants.emails.SupportEvio;
};

const getFinanceEmail = (clientName: string) => {
    return FinanceEmails[clientName] || FinanceEmails.EVIO;
};

const anonymizeUserData = async (req, res) => {
    const context = "function anonymizeUserData";
    const { userid } = req.headers;

    try {
        console.info(`[${context}] - Initiating anonymization process for userId: ${userid}`);
        
        const user = await User.findById(userid);
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ auth: false, code: 'server_user_not_found', message: 'User not found' });
        }

        if (user.userType === process.env.UserTypeFinalCostumer) {
            await usersService.anonymizeUserData(user);
        }

        console.info(`[${context}] - Anonymization completed for userId: ${userid}`);
        
        res.status(StatusCodes.OK).send({ message: 'User anonymized successfully.' });
    } catch (error) {
        console.error(`[${context}] Error`, error);
        Sentry.captureException(error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            auth: false,
            code: 'server_error',
            message: "Internal server error"
        });
    }
};

const requestChangeEmail = async (req, res) => {
    const { userid: userId, clientname: clientName } = req.headers;
    const { email } = req.body;
    
    const { statusCode, ...response } = await EmailChangeService.requestUserEmailChange({ userId, email, clientName });

    return res.status(statusCode).send(response);
}

const confirmChangeEmail = async (req, res) => {
    const { email, verificationCode } = req.body;
    const { statusCode, ...response } = await EmailChangeService.confirmEmailChange({ email, verificationCode });

    return res.status(statusCode).send(response);
}

const confirmChangeEmailWithHash = async (req, res) => {
    const { hash } = req.body;
    const { statusCode, ...response } = await EmailChangeService.confirmEmailChangeWithHash(hash);

    return res.status(statusCode).send(response);
}

const resendWelcomeEmail = async (req, res) => {
    const { userid } = req.headers;
    const user = await User.findOne({ _id: userid });

    const result = user ? await EmailChangeService.sendWelcomeEmail(user) : false;

    if (!result) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ code: 'server_error', message: "Internal server error"});
    }

    return res.status(StatusCodes.OK).send({ code: 'confirmation_email_resent', message: 'Confirmation email resent'});
}

const updateLanguagePreference = async (req: Request, res: Response) => {
    const context = "function updateLanguagePreference";
    const { language } = req.query;
    const { userid, clientname } = req.headers;
    
    try {
        console.log(`${context} language: ${language}, userId: ${userid}, clientName: ${clientname}`);
        if(!language){return res.status(StatusCodes.BAD_REQUEST).json({ auth: false, code: 'server_language_bad_request', message: 'Language needs to be provided' });}
        if(!clientname){return res.status(StatusCodes.BAD_REQUEST).json({ auth: false, code: 'server_clientName_bad_request', message: 'Client name needs to be provided' });}
        if(!userid){return res.status(StatusCodes.BAD_REQUEST).json({ auth: false, code: 'server_userid_bad_request', message: 'User ID needs to be provided' });}
        if(Array.isArray(userid) || Array.isArray(clientname) || Array.isArray(language)){return res.status(StatusCodes.BAD_REQUEST).json({ auth: false, code: 'server_bad_request', message: 'Bad request' });}

        await usersService.updateLanguagePreference(userid as string, clientname as string, language as string);
        
        res.status(StatusCodes.OK).send();
    } catch (error) {
        console.error(`[${context}] Error`, error);
       
        if(error?.statusCode && error?.statusCode !== StatusCodes.INTERNAL_SERVER_ERROR){
            res.status(error.statusCode).json({
                auth: error.error.auth,
                code: error.error.code,
                message: error.error.message
            });
        }

        Sentry.captureException(error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            auth: false,
            code: 'server_error',
            message: "Internal server error"
        });
    }
}

export default {
    createUser,
    getUsersByClientName,
    patchUser,
    hyundaiGetToken,
    updateUserHyundai,
    getGochargeHostAndAuth,
    resetUserPassword,
    deleteUser,
    revertRequestDeleteAccount,
    processAfter30DaysDeleteAccount,
    anonymizeUserData,
    requestChangeEmail,
    confirmChangeEmail,
    confirmChangeEmailWithHash,
    resendWelcomeEmail,
    updateLanguagePreference
};