import { Types } from 'mongoose';
import fs from 'fs';
import axios from 'axios';
import * as Sentry from '@sentry/node';
import { StatusCodes } from 'http-status-codes';

const AxiosHandler = require('../services/axios');
import Constants from '../utils/constants';
import { sendNotificationEmail } from '../utils/notificationEmail';
import BillingProfile from '../models/billingProfile';
import Activation from "../models/activation";
import GuestUser from '../models/guestUsers';
import User from '../models/user';
import guestUserService from '../services/guestUsers';
import TemporaryEmailDomain from '../models/temporaryEmailDomain';
import { BadRequest, NotFound, ServerError, Forbidden } from '../utils';
import {
    IDeletionClearance,
    IPhoneNumber,
    IUser,
    IUserDocumentAggregated,
    IUserModel
} from '../interfaces/users.interface';
import { IUserDocument } from '../interfaces/users.interface';
import { IDynamicRules } from '../interfaces/authentication.interface';
import Rule from '../models/rules';
import { KnownDomains } from '../utils/enums/temporaryEmails';
import { IUserEmailAccept } from '../interfaces/userEmailAccept.interface';
import nodemailerS from '../services/nodemailerService';
import contractsServices from '../services/contracts';
import driversServices from '../services/drivers';
import { ISendMailOptions } from '../interfaces/utils/sendEmailOptions.interface';
import { MessageParamsEmail } from '../interfaces/utils/messageParamsEmail.interface';
import { DeletionReason } from '../enums/deletionReason';
import moment from 'moment';
import Contract from '../models/contracts';
import paymentLibrary from "evio-library-payments";
import UserPasswords from "../models/userPasswords";
import { getRandomInt } from "../utils/randomNum";

import { AppConfigurationReadRepository } from "evio-library-configs"; 

async function loadCachedRules(
    token: string,
    userId: string
): Promise<IDynamicRules> {
    const getCachedRulesHost = `${process.env.HostAuthorization}/api/private/getCachedRules`;
    const getCachedRulesParams = { token, userId };
    const cachedRulesResponse = await axios
        .get(getCachedRulesHost, { params: getCachedRulesParams })
        .catch((error) =>
            console.log(
                `User[${userId}] Problems fetching cached rules: ${error}`
            )
        );
    let rules: IDynamicRules = cachedRulesResponse?.data?.rules;

    if (!rules) {
        rules = await Rule.calculateRules({
            _id: Types.ObjectId(process.env.DEFAULT_USER_ROLE),
        });

        const updateCachedRulesHost = `${process.env.HostAuthorization}/api/validTokens/rules`;
        const updateCachedRulesParams = { rules, userId };
        axios
            .patch(updateCachedRulesHost, updateCachedRulesParams)
            .catch((error) =>
                console.log(
                    `User[${userId}] Problems saving cached rules. ${error}`
                )
            );
    }

    console.log('Calculated Rules', rules, !rules);

    return rules;
}

async function getCurrentUserData(
    token: string,
    userId: string,
    requestUserId?: string,
    accountType?: string
): Promise<IUserDocumentAggregated> {
    const context = '[function] getCurrentUserData';
    const isGuestUser = accountType === process.env.AccountTypeGuest;

    const match = { _id: Types.ObjectId(userId), active: true };
    const userQuery = User.aggregateNestedUsers(match, null, true);

    const [userFound] = <Array<IUserDocumentAggregated>>(
        await User.aggregate(userQuery)
    );

    if (!userFound)
        throw BadRequest(
            {
                auth: false,
                code: 'server_users_not_found',
                message: 'User not found',
            },
            context
        );

    userFound.billingProfile = await BillingProfile.findOne({ userId }).lean();
    userFound.users =
        userFound.users?.map(({ _id, name, imageContent }) => ({
            _id,
            name,
            imageContent,
        })) ?? [];

    if (isGuestUser && requestUserId !== userId) {
        const guestUserQuery = { _id: requestUserId, active: true };
        const guestUserFound = await GuestUser.findOne(guestUserQuery);

        if (!guestUserFound) {
            throw NotFound(
                {
                    auth: false,
                    code: 'server_users_not_found',
                    message: 'Guest User not found',
                },
                context
            );
        }

        userFound.rules = await guestUserService.loadCachedRules(
            token,
            userId,
            guestUserFound
        );
        userFound.name = guestUserFound.name;
        userFound.email = guestUserFound.email;
        userFound.mobile = '-';
        userFound.internationalPrefix = '-';
        return userFound;
    }

    userFound.rules = await loadCachedRules(token, userId);
    return userFound;
}

async function saveUserImage(userId: Types.ObjectId, imageContent: string) {
    const context = '[function] saveUserImage';
    try {
        const date = Date.now();
        const path = `/usr/src/app/img/users/${userId}_${date}.jpg`;
        const base64Image = <string>imageContent.split(';base64,').pop();
        let imageHost = process.env.HostQA;

        if (Constants.environment === 'production')
            imageHost = process.env.HostProd;
        if (Constants.environment === 'pre-production')
            imageHost = process.env.HostPreProd;

        const pathImage = `${imageHost}${userId}_${imageContent}.jpg`;

        const saveFilePromise: string = await new Promise((resolve, reject) => {
            fs.writeFile(path, base64Image, { encoding: 'base64' }, (err) => {
                if (err) reject(err);
                resolve(pathImage);
            });
        });

        return saveFilePromise;
    } catch (error) {
        throw ServerError(error, context);
    }
}

async function cancelFirebaseTokens(
    userId: string,
    isWhitelabel: boolean = false
) {
    const context = '[function] cancelFirebaseTokens';
    try {
        const host = isWhitelabel
            ? process.env.NotificationsFirebaseWLHost
            : process.env.NotificationsHost;
        await axios.patch(`${host}/api/private/firebase/firebaseUserTokens`, {
            userId,
        });
    } catch (error) {
        console.log(`${context} ${userId}`, error.message);
    }
}

async function cancelAllTokens(userId) {
    const context = '[function] cancelAllTokens';
    try {
        const host = process.env.HostAuthorization;
        await axios.patch(`${host}/api/validTokens`, { userId });
    } catch (error) {
        console.log(`${context} ${userId}`, error.message);
    }
}

async function sendEmail(
    email: string,
    password: string,
    username: string,
    clientName: string,
    emailType: 'resetPassword' | 'createUser',
    platform?: string
) {
    const context = `[function] sendEmail`;
    try {
        const url = `${Constants.services.notifications}/api/private/sendEmail`;
        const message =
            emailType === 'resetPassword'
                ? { username, tempPassword: password }
                : { username, password, CLIENTNAME: clientName, PLATFORM: platform };
        const mailOptions = { to: email, message, type: emailType };
        const headers = { clientname: clientName };
        await axios.post(url, { mailOptions }, { headers });
    } catch (error) {
        console.log(`${context} ${email}`, error.message);
    }
}

async function sendResetPasswordEmail(
    email: string,
    password: string,
    username: string,
    clientName: string
) {
    const context = '[function] sendResetPasswordEmail';
    try {
        await sendEmail(email, password, username, clientName, 'resetPassword');
    } catch (error) {
        console.log(`${context} ${email}`, error.message);
    }
}

async function sendCreateUserEmail(
    email: string,
    password: string,
    username: string,
    clientName: string,
    platform: string
) {
    const context = '[function] sendCreateUserEmail';
    try {
        await sendEmail(email, password, username, clientName, 'createUser', platform);
    } catch (error) {
        console.log(`${context} ${email}`, error.message);
    }
}

async function isTemporaryDomain(domain: string): Promise<boolean> {
    const domainExists = await TemporaryEmailDomain.findOne({ domain });

    return !!domainExists;
}

async function isTemporaryEmail(domain: string): Promise<boolean> {
    try {
        const email = `t@${domain}`;

        // Check if the domain is in the list of known domains.
        if (Object.values(KnownDomains).includes(domain.toLowerCase() as KnownDomains)) {
            return false;
        }

        // First verification with mailcheck.ai
        const mailcheckResponse = await axios.get(`https://api.mailcheck.ai/email/${email}`);
        const isDisposableMailcheck = mailcheckResponse.data.disposable;

        if (isDisposableMailcheck) {
            return true;
        }

        // Second verification with verifyemail.io
        const verifyEmailResponse = await axios.get(`https://verifyemail.io/api/email?domain=${domain}&apikey=0454ffdc-4368-11ef-a812-0e41040f2227`);
        const domainVerdict = verifyEmailResponse.data.DOMAIN_VERDICT;
        if (domainVerdict === 'Invalid') {
            return true;
        }

        return false;

    } catch (error) {
        console.error('Error temporary email validation:', error);
        return false;
    }
}

async function createTemporaryEmailDomain(domain: string): Promise<void> {
    try {
        await TemporaryEmailDomain.create({ domain });
        console.log(`Domain ${domain} added to TemporaryEmailDomain collection.`);
    } catch (error) {
        console.error('Error creating temporary email domain:', error);
    }
}

async function handleRevertAccountDeletionRequested(user: IUserDocument) {
    const context = "Function handleRevertAccountDeletionRequested";
    try {
        user.accountDeletionRequested = false;
        if (user.deletionClearance && user.deletionClearance.length > 0) user.deletionClearance.pop()

        await user.save();
        console.info(`[${context}] - Flags accountDeletionRequested and deletionClearance have been removed`);
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    }
}

async function handleAccountDeletionRequested(user: IUserDocument, deletionClearance: IDeletionClearance, deletionRequested: boolean) {
    const context = "Function handleAccountDeletionRequested";
    try {
        user.accountDeletionRequested = deletionRequested;
        user.deletionClearance?.push(deletionClearance);

        await user.save();
        console.info(`[${context}] - Flags accountDeletionRequested and deletionClearance modified`);
    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    }
}

async function sendEmailDeleteAccount(
    type: string,
    messageParams: MessageParamsEmail = {},
    cc?: string,
    clientName: string = 'EVIO'
) {
    try {
        const mailOptions: ISendMailOptions = {
            to: messageParams.destinationEmail || messageParams.userEmail,
            cc,
            message: {
                ...messageParams
            },
            type
        };

        await sendNotificationEmail(mailOptions, clientName);
        console.info(`Email sent to: ${mailOptions.to}`);
    } catch (error) {
        console.error(`Error sending email of type ${type}`, error.message);
        throw error;
    }
}

async function removeTokensByUser(
    userId: string
): Promise<void> {
    const context = 'function removeTokensByUser';
    try {
        const host = `${Constants.services.authorization.host}${Constants.services.authorization.validTokens}`;
        let body = {
            userId: userId.toString()
        };
        return await AxiosHandler.axiosPatchBody(host, body);
    } catch (error) {
        throw error;
        console.error(`${context} ${userId}`, error.message);
    }
}

async function getListPaymentMethods(userId: string) {
    const context = 'function getListPaymentMethods';
    try {
        const host = `${Constants.services.payments.host}${Constants.services.payments.PathPaymentMethods}`;
        let headers = {
            userid: userId
        };
        return await AxiosHandler.axiosGetHeaders(host, headers);
    } catch (error) {
        console.error(`${context} ${userId}`, error.message);
    }
}

/**
 * Fetches sessions from the public network based on the given transactionId.
 * It queries the OCPI microservice to retrieve all related sessions for the specified transaction | OcpiDB.
 *
 * @param {string} transactionId - The ID of the transaction for which sessions are being retrieved.
 */
async function getSessionsPublicNetwork(transactionId: string) {
    const context = 'function getSessionsPublicNetwork';
    try {
        const host = `${Constants.services.ocpi22.host}${Constants.services.ocpi22.getSessionByTransactionId}`;
        let query = {
            transactionId: transactionId
        };
        return await AxiosHandler.axiosGet(host, query);
    } catch (error) {
        console.error(`${context} ${transactionId}`, error.message);
        return [];
    }
}

/**
 * Fetches sessions from the private network based on the given sessionId.
 * It queries the Chargers microservice to retrieve the session details for the specified session | ChargersDB.
 *
 * @param {string} sessionId - The ID of the session for which details are being retrieved.
 */
async function getSessionsPrivateNetwork(sessionId: string) {
    const context = 'function getSessionsPrivateNetwork';
    try {
        const host = `${Constants.services.chargers.host}${Constants.services.chargers.getSessionById}`;
        let query = {
            _id: sessionId
        };
        return await AxiosHandler.axiosGet(host, query);
    } catch (error) {
        console.error(`${context} ${sessionId}`, error.message);
        return [];
    }
}

async function handleTransactionSuspendAccount(userId: string) {
    const context = 'function handleTransactionSuspendAccount';
    try {
        // Checks for pending transactions
        const transactions = await getTransactionsByUserId(userId)
        const transactionsNotPaid = transactions.filter(transaction => transaction.status !== "40") || null;
        return transactionsNotPaid;
    } catch (error) {
        console.error(`${context} | ${userId}`, error.message);
    }
}

async function getTransactionsByUserId(userId: string) {
    const context = 'function getListPaymentMethods';
    try {
        const host = `${Constants.services.payments.host}${Constants.services.payments.getTransactionByUserId}`;
        let headers = {
            userid: userId
        };
        return await AxiosHandler.axiosGetHeaders(host, headers);
    } catch (error) {
        console.error(`${context} | ${userId}`, error.message);
    }
}

const processAccountDeletion = async (user: IUserDocument): Promise<void> => {
    const context = "Function processAccountDeletion";
    try {
        console.info(`[${context}] - Initiating process for user: ${user._id.toString()}`);
        const actionDate = new Date();
        const deletionRequested = true;

        const deletionClearance: IDeletionClearance = {
            actionDate: actionDate,
            isCleared: false,
            reason: DeletionReason.USER_BLOCKED_DEBT,
        };

        const [_, transactions] = await Promise.all([
            handleAccountDeletionRequested(user, deletionClearance, deletionRequested),
            handleTransactionSuspendAccount(user._id)
        ]);

        console.info(`[${context}] - Transactions found: ${transactions.length}`);
        if (!transactions || transactions.length === 0) {
            return;
        }

        const sessionDetailsList: string[] = [];
        let amountOwed;
        for (const transaction of transactions) {
            amountOwed = `${transaction.amount.value} ${transaction.amount.currency}`;
            const createdAt = moment(transaction.createdAt).format('DD/MM/YYYY HH:mm');

            console.info(`[${context}] - Get sessions`);
            const sessionsPublicNetwork = await getSessionsPublicNetwork(transaction._id);
            const sessionsPrivateNetwork = await getSessionsPrivateNetwork(transaction.sessionId);
            const allSessions = [...sessionsPublicNetwork, ...sessionsPrivateNetwork];
            console.info(`[${context}] - Sessions obtained: ${allSessions.length}`);

            for (const session of allSessions) {
                const city = session?.address?.city || '';
                const street = session?.address?.street || '';
                const zipCode = session?.address?.zipCode || '';
                const sessionDetails = `Local: ${street}, ${city} - ${zipCode}`;

                let message = '';
                if (user.language === 'en') {
                    message = `Amount owed: ${amountOwed}, Session: ${createdAt}, ${sessionDetails}<br>`;
                } else {
                    message = `Montante devido: ${amountOwed}, Sessão: ${createdAt}, ${sessionDetails}<br>`;
                }

                sessionDetailsList.push(message);
            }
        }

        const combinedSessionDetails = sessionDetailsList.join("<br><br>");
        // Prepare email for the user
        const messageUserEmail: MessageParamsEmail = {
            username: user.name,
            userEmail: user.email,
            cdrLocationCity: combinedSessionDetails
        };

        // Prepare email for the EVIO
        const supportEmail = getSupportEmail(user.clientName);
        const messageSupportEmail: MessageParamsEmail = {
            destinationEmail: supportEmail,
            userId: user._id.toString(),
            username: user.name,
            userEmail: user.email,
            amountOwed: amountOwed
        };

        const emailPromises = [
            sendEmailDeleteAccount('account_deletion_suspension', messageUserEmail, undefined, user.clientName)
        ];

        if (user.userType === process.env.UserTypeFinalCostumer) {
            // Send email from personal account
            emailPromises.push(
                sendEmailDeleteAccount('account_deletion_suspension_support', messageSupportEmail, undefined, user.clientName)
            );
        } else {
            // Send email from business account
            emailPromises.push(
                sendEmailDeleteAccount('account_deletion_suspension_support', messageSupportEmail, Constants.emails.Sales, user.clientName)
            );
        }

        const fleetOwnerEmails = await getFleetOwnerEmail(user);
        if (fleetOwnerEmails && fleetOwnerEmails.length > 0 && user.clientName === 'EVIO') {
            fleetOwnerEmails.forEach((fleetOwnerEmail) => {
                const messageFleetOwnerEmail: MessageParamsEmail = {
                    destinationEmail: fleetOwnerEmail,
                    userEmail: user.email,
                    username: user.name,
                };
        
                emailPromises.push(
                    sendEmailDeleteAccount('account_deletion_suspension_fleet_owner', messageFleetOwnerEmail, undefined, user.clientName)
                );
            });
        }

        await Promise.all(emailPromises);
    } catch (error: any) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    }
};

async function handleIsDisposableEmail(email: string): Promise<IUserEmailAccept> {
    const context = `Function handleIsDisposableEmail`;
    try {
        const domain = email.split('@')[1];

        const defaultResponse = {
            auth: false,
            code: 'identity_email_not_valid',
            message: 'Email is not valid.',
            status: StatusCodes.BAD_REQUEST
        }

        const isTempDomain = await isTemporaryDomain(domain);
        if (isTempDomain) {
            console.warn(`[${context}] - Temporary domain found: ${domain} for email: ${email}`);
            return defaultResponse;
        }

        const isTempEmail = await isTemporaryEmail(domain);
        if (isTempEmail) {
            console.warn(`[${context}] - Temporary email found: ${email}`);
            return defaultResponse;
        }

        return { ...defaultResponse, auth: true }
    } catch (error) {
        console.log(`[${context}] Error`, error.message);
        Sentry.captureException(error)
        throw error;
    }
}

/**
 * Anonymizes user data, including billing profile and contracts, and removes the user from LDAP.
 * @param {Object} user - The user object (IUserDocument).
 * @param {number | null} amount - The amount to check before anonymizing user data. Should be 0 or null to proceed with anonymization.
 * @returns {Promise<void>} - Resolves when the user data and related information are successfully deleted, nothing is returned.
 */
const deleteUserAndRelatedData = async (user: IUserDocument, amount: number | null): Promise<void> => {
    const context = `Function deleteUserAndRelatedData`;
    try {

        if (amount === 0 || amount === null) {
            await anonymizeUserData(user);
        }

        await setRemovedUserStatus(user);

        console.log(`[${context}] - Removing password for userId ${user._id}`);
        await UserPasswords.removePasswordByUserId(user._id);


        if (user.userType === process.env.UserTypeFinalCostumer && (amount === 0 || amount === null)) {
            await anonymizeUserData(user);
        }

        await setRemovedUserStatus(user);

    } catch (error) {
        console.error(`[${context}] Error`, error.message);
        throw error;
    }
};

const setRemovedUserStatus = async (user: IUserDocument): Promise<void> => {
    await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    status: 'REMOVED',
                    removeDate: new Date(),
                    active: false
                },
            },
        );
};

const anonymizeUserData = async (user: IUserDocument): Promise<void> => {
    const randomize = () => Math.random().toString(36).substring(2, 10); 

    await Promise.all([
        User.updateOne(
            { _id: user._id },
            {
                $set: {
                    name: `anon-${randomize()}`,
                    email: `anon_${randomize()}`,
                    mobile: `anon_${randomize()}`, 
                    username: `anon_${randomize()}`, 
                    anonymizationDate: new Date()
                },
            },
        ),
        BillingProfile.updateOne(
            { userId: user._id },
            {
                $set: {
                    name: `anon_${randomize()}`,
                    billingName: `anon_${randomize()}`,
                    email: `anon_${randomize()}`
                },
            }
        ),
        Contract.updateMany(
            { userId: user._id },
            {
                $set: {
                    name: `anon_${randomize()}`,
                    email: `anon_${randomize()}`,
                    mobile: `anon_${randomize()}`,
                    cardName: `anon_${randomize()}`,
                    address: {
                        street: `anon_${randomize()}`,
                        zipCode: `anon_${randomize()}`,
                        country: `anon_${randomize()}`,
                        countryCode: `anon_${randomize()}`
                    }
                },
            }
        ),
        anonymizeUserDataHistory(user._id.toString())
    ]);
};

/**
 * Retrieve balance wallet from user, should always return wallet amount  structure, of occurs an error, should throw it.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<{ value: number; currency: string }>} - Wallet balance information.
 */
const getWalletBalance = async (userId: string): Promise<{ value: number; currency: string }> => {
    const context = `Function getWalletBalance`;
    try {
        const walletResponse = await paymentLibrary.retrieveWalletByUserId(userId);

        if (!walletResponse) {
            console.warn(`[${context}] - Wallet not found for user ID: ${userId}`);
            return { value: 0, currency: 'EUR' };
        }

        const amountWallet = walletResponse.amount;
        return amountWallet;
    } catch (error) {
        console.error(
            `[${context}] - Error fetching wallet data:`,
            error.message
        );
        throw error;
    }
}

/**
 * Get the email of the corresponding support team.
 * @param {string} clientName - The client Name of the user ( ex: EVIO, ACP, Kinto).
 * @returns {string} - Return the email of the support team corresponding to this client.
 */
const getSupportEmail = (clientName: string = ''): string => {
    let supportEmail: string;
    if (['development', 'pre-production'].includes(Constants.environment)) supportEmail = Constants.emails.QaTest;
    else {
        switch (clientName) {
            case Constants.clientNames.acp:
                supportEmail = Constants.emails.SupportACP;
                break;
            case Constants.clientNames.salvadorCaetano:
                supportEmail = Constants.emails.SupportGoCharge;
                break;
            case Constants.clientNames.hyundai:
                supportEmail = Constants.emails.SupportHyundai;
                break;
            case Constants.clientNames.klc:
                supportEmail = Constants.emails.SupportKLC;
                break;
            default:
                supportEmail = Constants.emails.SupportEvio;
        }
    }
    return supportEmail;
};

/**
 * Sends a reminder email to the user about their account deletion request.
 * @param {Object} user - The user object containing user details.
 * @param {string} user.name - The name of the user.
 * @param {string} user.email - The email address of the user.
 * @param {string} user.clientName - The client name of the user (ex: EVIO, ACP, Hyundai).
 * @param {number} daysRemaining - The number of days remaining until the account deletion.
 * @returns {Promise<void>} - Returns a promise that resolves when the email is sent.
 */
const sendAccountDeletionReminder = async (user, daysRemaining: number): Promise<void> => {
    const context = "sendAccountDeletionReminder";
    try {
        const reminderEmailParams: MessageParamsEmail = {
            username: user.name,
            userEmail: user.email,
            reminderDays: daysRemaining,
        };

        await sendEmailDeleteAccount(
            'account_deletion_reminder',
            reminderEmailParams,
            undefined,
            user.clientName
        );

        console.info(`[${context}] - Reminder email sent to user with id ${user._id.toString()} for account deletion.`);
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

/**
 * Sends a request to the support service to initiate account deletion.
 * 
 * @param user - The user object containing details for the deletion request | Users from IdentityDB.
 * @returns A promise that resolves when the request is successfully sent.
 * @throws An error if the request fails.
 */
export const sendAccountDeletionRequestSupport = async (user: IUserDocument): Promise<void> => {
    const context = "sendAccountDeletionRequestSupport";
    console.info(`[${context}] - Initiating request for user: ${user}`);

    const url = `${Constants.services.notifications}/api/private/support`;
    const data = {
        mobile: user.mobile,
        message: "I want to delete my account.",
        email: user.email,
        name: user.name,
        internationalPrefix: user.internationalPrefix,
    };

    try {
        const response = await axios.post(url, data);
        console.info(`[${context}] - Request to support sent successfully: ${response.data}`);
    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
};

/**
 * Retrieves fleet owner details based on the user's active fleet contract.
 * @param userId - The user's ID.
 * @returns {Promise<IUserDocument[] | null>} List of fleet owners.
 */
const getActiveFleetOwner = async (userId: string): Promise<IUserDocument[] | null> => {
    const context = 'getFleetOwner';
    try {
        const drivers = await driversServices.getEvsByUserId(userId);

        if (!drivers || drivers.length === 0) {
            console.info(`[${context}] No drivers found for user ID: ${userId}`);
            return null;
        }

        const fleetOwnersPromises = drivers.map(driver => User.findById(driver.userId));
        const fleetOwners = await Promise.all(fleetOwnersPromises);

        const validFleetOwners = fleetOwners.filter(fleetOwner => fleetOwner !== null);

        if (validFleetOwners.length === 0) {
            console.info(`[${context}] No valid fleet owners found for the provided userId`);
            return null;
        }

        return validFleetOwners;
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return null;
    }
};

const getFleetOwnerEmail = async (user: IUserDocument): Promise<string[] | null> => {
    const context = 'getFleetOwnerEmail';
    try {
        const fleetOwners = await getActiveFleetOwner(user._id.toString());

        if (!fleetOwners || fleetOwners.length === 0) {
            console.info(`[${context}] No fleet owners found for user ${user._id}`);
            return null;
        }

        const validEmails = Array.from(
            new Set(
                fleetOwners
                    .map((fleetOwner) => fleetOwner?.email)
                    .filter((email): email is string => email !== undefined)
            )
        );

        if (validEmails.length === 0) {
            console.info(`[${context}] No valid email found for fleet owners of user ${user._id}`);
            return null;
        }

        console.info(`[${context}] Fleet owner emails found for user ${user._id}: ${validEmails.join(', ')}`);
        return validEmails;
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return null;
    }
};

const adjustDeletionCountdownAfterDebtClearance = async (user: IUserDocument, debtBlockedDate: Date, requestedDate: Date): Promise<void> => {
    const context = `Function adjustDeletionCountdownAfterDebtClearance`;
    try {
        if (!user || !user.deletionClearance) return;
        
        const debtPaymentDate = new Date();

        const newClearanceEntry: IDeletionClearance = {
            isCleared: true,
            actionDate: debtPaymentDate,
            reason: DeletionReason.USER_DEBT_CLEARED
        };
        user.deletionClearance.push(newClearanceEntry);
        await user.save();
        
        console.info(`Added new clearance entry for user with id ${user._id.toString()}, isCleared set to true.`);

        // Calculates the final day of account deletion 
        const daysInDebt = moment(debtPaymentDate).diff(moment(debtBlockedDate), 'days');
        const totalDeletionDays = 31 + daysInDebt;
        const deletionDate = moment(requestedDate).add(totalDeletionDays, 'days').format('DD-MM-YYYY');

        // Prepare email for the user
        const messageUserEmail: MessageParamsEmail = {
            username: user.name,
            userEmail: user.email,
            deletionDate: deletionDate
        };

        // Prepare email for the EVIO
        const supportEmail = getSupportEmail(user.clientName);
        const messageSupportEmail: MessageParamsEmail = {
            destinationEmail: supportEmail,
            username: user.name,
            userEmail: user.email,
            userId: user._id.toString(),
            deletionDate: deletionDate
        };

        const emailPromises = [
            sendEmailDeleteAccount('account_deletion_restarted_user', messageUserEmail, undefined, user.clientName)
        ];

        if (user.userType === process.env.UserTypeFinalCostumer) {
            // Send email from personal account
            emailPromises.push(
                sendEmailDeleteAccount('account_deletion_restarted_support', messageSupportEmail, undefined, user.clientName)
            );
        } else {
            // Send email from business account
            emailPromises.push(
                sendEmailDeleteAccount('account_deletion_restarted_support', messageSupportEmail, Constants.emails.Sales, user.clientName)
            );
        }

        const fleetOwnerEmails = await getFleetOwnerEmail(user);
        if (fleetOwnerEmails && fleetOwnerEmails.length > 0 && user.clientName === 'EVIO') {
            fleetOwnerEmails.forEach((fleetOwnerEmail) => {
                const messageFleetOwnerEmail: MessageParamsEmail = {
                    destinationEmail: fleetOwnerEmail,
                    userEmail: user.email,
                    deletionDate: deletionDate,
                    username: user.name,
                    userId: user._id.toString(),
                };
        
                emailPromises.push(
                    sendEmailDeleteAccount('account_deletion_restarted_fleet_owner', messageFleetOwnerEmail, undefined, user.clientName)
                );
            });
        }

        await Promise.all(emailPromises);

    } catch (error) {
        console.error(`[${context}] Error`, error);
        Sentry.captureException(error)
    }
};

const handleStatusRfidCard = async (user: IUserDocument, status: 'active' | 'inactive') => {
    const context = 'handleStatusRfidCard';
    try {
        console.info(`[${context}] | Starting process`);

        const evs = await driversServices.getEvsByUserId(user._id.toString());

        if (!evs || evs.length === 0) {
            console.info(`[${context}] No evs found for user ID: ${user._id.toString()}`);
            return null;
        }

        for (const ev of evs) {
            const { listOfDrivers } = ev;

            if (!listOfDrivers || listOfDrivers.length === 0) {
                console.info(`[${context}] No drivers found in listOfDrivers for vehicle ID: ${ev._id}`);
                continue;
            }

            for (const driverInfo of listOfDrivers) {
                if (user._id.toString() === driverInfo.userId && driverInfo.paymenteBy === "driver") {
                    console.info(`[${context}] Updating token status for userId: ${driverInfo.userId}`);
                    await updateTokenStatusByEvId(ev._id.toString(), status);
                }
            }
        }
    } catch (error) {
        console.error(`[${context}] Error`, error);
        return null;
    }
};

async function updateTokenStatusByEvId(evId: string, status: 'active' | 'inactive'): Promise<void> {
    const context = "updateTokenStatusByEvId";
    try {
        console.info(`[${context}] | Starting process`);

        const contract = await Contract.findOne({ evId });

        if (!contract) {
            console.warn(`[${context}] No contract found for evId: ${evId}`);
            return;
        }

        contract.networks.forEach(network => {
            network.tokens.forEach(token => {
              if (token.tokenType === 'RFID') { 
                token.status = status; 
              }
            });
          });
          
          await contract.save();

    } catch (error) {
        console.error(`[${context}] Error`, error);
        throw error;
    }
}

/**
 * Generates a random code for the user and sends an SMS with the code for activation purposes.
 * @param userId
 * @returns { Promise<number> } - The activation code generated for the user.
 */
async function getActivationCodeToUserForValidateChangeMobile(userId: string): Promise<number> {
    const context = "Function userCodeChangeMobile";

    try {
        console.log(`[${context}] - Creating activation code for user ${userId}`);

        const code = getRandomInt(10000, 100000).toString();
        const activation = new Activation({
            code,
            userId: userId,
        })

        await activation.save();

        return activation.code;
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error when creating code for user ${userId}`, error);
        throw error;
    }

}

/**
 * Sets the activation code as used for the user.
 * @param userId
 * @param code
 */
const setCodeUsedForActivation = async(userId: string, code: string): Promise<void> => {
    const context = "Function setCodeUsedForActivation";

    console.log(`[${context}] - Setting code ${code} as used for user ${userId}`);

    await Activation.findOneAndUpdate(
        { userId, code, used: false },
        { $set: { used: true } }
    );
}


/**
 * Sets the pending mobile number for the user.
 * @param userId
 * @param pendingMobile
 */
const setPendingMobile = async (userId: string, pendingMobile: IPhoneNumber): Promise<IUserDocument | null> => {
    const context = "Function setPendingMobile";

    console.log(`[${context}] Setting pending mobile for user ${userId}`);

    return User.findOneAndUpdate(
        { _id: Types.ObjectId(userId) },
        {
            $set: {
                pendingMobile: {
                    mobile: pendingMobile.mobile,
                    internationalPrefix: pendingMobile.internationalPrefix
                }
            },
        }, { new: true }
    );
};

const setUserAsActiveAndRemovePendingMobile = async (
    userId: string,
    mobile: string,
    internationalPrefix: string,
    clientName: string
): Promise<IUserDocument | null> => {
    const context = "Function setUserAsActiveAndRemovePendingMobile";

    console.log(`[${context}] Setting user as active and removing pending mobile for user ${userId}`);

    const updateFields: any = {
        $set: {
            active: true,
            mobile,
            internationalPrefix,
        },
        $unset: { pendingMobile: 1 }
    };

    if (clientName === Constants.clientNames.evio) {
        updateFields.$set.username = mobile;
    }

    return User.findOneAndUpdate(
        { _id: Types.ObjectId(userId) },
        updateFields,
        { new: true },
    );
}

const setUserAsActive = async (
    userId: string,
): Promise<IUserDocument | null> => {
    const context = "Function setUserAsActiveAndRemovePendingMobile";

    console.log(`[${context}] Setting user as active and removing pending mobile for user ${userId}`);

    const updateFields: any = {
        $set: {
            active: true,
        },
    };

    return User.findOneAndUpdate(
        { _id: Types.ObjectId(userId) },
        updateFields,
        { new: true },
    );
}

async function anonymizeUserDataHistory(userId: string) {
    const context = "Function anonymizeUserDataHistory";
    try {
        const host = `${Constants.services.statitics.host}${Constants.services.statitics.PathAnonymizeUserDataHistory}`;
        await AxiosHandler.axiosPatchBody(host, { userId: userId });
    } catch (error) {
        console.log(`[${context}] Error `, error);
    }
}

const updateLanguagePreference = async (userId: string, clientName: string, language: string) =>{
    const context = 'Service - updateLanguagePreference'
    // The endpoint validates that the provided language exists within configsBD.appConfigurations.languagesAllowed for the given client.
    const appConfig = await AppConfigurationReadRepository.getAppConfigurationsByClient(clientName);

    if (!appConfig?.languagesAllowed?.languages) {
        throw NotFound({ auth: false, code: 'server_not_found', message: 'languagesAllowed not found' }, context); 
    }

    if(!appConfig?.languagesAllowed?.languages.includes(language)){
        throw Forbidden({ auth: false, code: 'server_forbidden', message: 'Language not allowed. Languages that are allowed are: ' + appConfig?.languagesAllowed?.languages }, context); 
    }
    // On a valid request, identityDB.users.language is updated to reflect the new language preference. 
    const  result = await User.updateOne({_id: userId}, {$set: { language : language, updatedAt: new Date().toISOString()}} )
    if(result.nModified === 0){
        throw BadRequest({ auth: false, code: 'server_bad_request', message: 'Not possible update language' }, context); 
    }
    return true;
}

export default {
    getCurrentUserData,
    loadCachedRules,
    saveUserImage,
    cancelFirebaseTokens,
    cancelAllTokens,
    sendResetPasswordEmail,
    sendCreateUserEmail,
    isTemporaryDomain,
    isTemporaryEmail,
    createTemporaryEmailDomain,
    handleAccountDeletionRequested,
    getListPaymentMethods,
    sendEmailDeleteAccount,
    handleTransactionSuspendAccount,
    processAccountDeletion,
    handleRevertAccountDeletionRequested,
    handleIsDisposableEmail,
    removeTokensByUser,
    getTransactionsByUserId,
    deleteUserAndRelatedData,
    getSupportEmail,
    getWalletBalance,
    sendAccountDeletionReminder,
    sendAccountDeletionRequestSupport,
    getFleetOwnerEmail,
    anonymizeUserData,
    adjustDeletionCountdownAfterDebtClearance,
    handleStatusRfidCard,
    getActivationCodeToUserForValidateChangeMobile,
    setPendingMobile,
    setCodeUsedForActivation,
    setUserAsActiveAndRemovePendingMobile,
    setUserAsActive,
    updateLanguagePreference
};
