import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { getCode } from 'country-list';
import * as Sentry from '@sentry/node';
import axios from 'axios';
import contractServices from '../services/contracts';

import commons from 'evio-library-commons';

import { validateUserPerClientName } from '../auth/auth';
/** TO BE REMOVED AFTER -> bp-287-removing-tin-validation */
import { getViesVat, IValidTinResponse, validTin } from '../services/europeCommission';
import ClientTypeEnum from '../enums/clientType.enum';
import BillingPeriodEnum from '../enums/billingPeriod.enum';
import Constants from '../utils/constants';
import { addAddressCaetanoGo, getAddressCaetanoGo, updateAddressCaetanoGo } from '../services/goCharge';
import UserTypeEnum from '../enums/userType.enum';
import BillingprofilesClientTypeEnum from '../enums/billingprofilesClientType.enum';
import CountryCodeEnum from '../enums/countryCode.enum'
import CemeData from './ceme';
import { ClientWhiteLabelsEnum } from '../enums/clientWhiteLabels.enum';
import { updateUserHyundai } from '../services/hyundai';
import { errorResponse, isValidPortugueseZipCode, normalizeCountryCodeToCountryName } from '../utils';
import { isZipAddressValidToCountry } from '../services/googleMaps';
import { IHeaders } from '../interfaces/headers.interface';
import toggle from 'evio-toggle';
import EmailChangeService from '../services/emailChangeService';
import { IBillingProfile } from '../interfaces/billingProfile.interface'

import ENV from '../constants/env';

const { billingProfileStatus } = ENV;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const countryList = require('country-list');
const BillingProfile = require('../models/billingProfile');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Contract = require('../models/contracts');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('../models/user');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CEMETariff = require('../models/cemeTariff');
// eslint-disable-next-line @typescript-eslint/no-var-requires

export const updateContracts = async (user: any) => {
    const context = 'FUNCTION updatedContracts';

    try {
        if (user) {
            const query = {
                // eslint-disable-next-line no-underscore-dangle
                userId: user._id,
                networks: {
                    $elemMatch: {
                        network: process.env.NetworkMobiE,
                        tokens: {
                            $elemMatch: {
                                tokenType: process.env.TokensTypeApp_User,
                                status: { $ne: process.env.NetworkStatusInactive }
                            }
                        }
                    }
                }
            };

            Contract.find(query, async (err, contractsFound) => {
                if (err) {
                    console.error(`[${context}] Error `, err.message);
                }

                let CEME;

                if (contractsFound.length === 0) {
                    CEME = await CemeData.getCEMEEVIOADHOC(user.clientName);
                } else {
                    CEME = await CemeData.getCEMEEVIONormal(
                        user.clientName,
                        user.userType,
                        user.activePartner
                    );
                }

                const newValues = {
                    tariff: {
                        power: 'all',
                        // eslint-disable-next-line no-underscore-dangle
                        planId: CEME.plan._id
                    }
                };

                // eslint-disable-next-line no-underscore-dangle
                Contract.updateMany({ userId: user._id }, { $set: newValues }, (err, result) => {
                    if (err) {
                        console.error(`[${context}][Contract.updateMany] Error `, err.message);
                    }

                    if (result) {
                        // eslint-disable-next-line no-underscore-dangle
                        CEMETariff.updateMany(
                            // eslint-disable-next-line no-underscore-dangle
                            { userId: user._id },
                            { $set: newValues },
                            (err, result) => {
                                if (err) {
                                    console.error(`[${context}][CEMETariff.updateMany] Error `, err.message);
                                }
                                if (result) {
                                    console.log('Ceme tariff updated');
                                } else console.log('Ceme tariff not updated');
                            }
                        );
                    } else console.log('Contract not updated');
                });
            });
        }
    } catch (error) {
        console.error(`[${context}][] Error `, error.message);
    }
};

export const updateUserType = async (userBilling: any) => {
    const context = 'FUNCTION updateUserType';
    const { userId } = userBilling;
    let userType;

    if(userBilling.clientType === BillingprofilesClientTypeEnum.Business)
        userType = UserTypeEnum.Company;
    else 
        userType = UserTypeEnum.FinalCostumer;

    User.findOneAndUpdate({ _id: userId }, { $set: { userType } }, { new: true }, async(err, userUpdated) => {
        if (err) {
            console.error(`[${context}] Error `, err.message);
        } else {
            const featureFlagEnabled = await toggle.isEnable('prevent_update_contracts_after_update_billing_profile');
            if (featureFlagEnabled) {
                console.log(`[${context}] Feature prevent_update_contracts_after_update_billing_profile is enabled, contracts not updated for userId=${userId}`);
            } else {
                console.log(`[${context}] Feature prevent_update_contracts_after_update_billing_profile is disabled, contracts will be updated for userId=${userId}`);
                await updateContracts(userUpdated);
                console.log('User updated');
            }

        }
    });
};

export const updateFavoriteAddress = async (billingProfile: any, userId: string) => {
    const context = 'Function updateFavoriteAddress';
    try {
        const fetchedAddresses = await getAddressCaetanoGo(userId);

        if (fetchedAddresses.length > 0) {
            const existsFavoriteAddress = fetchedAddresses.find((address: any) => address.favourite === '1');

            if (existsFavoriteAddress) {
                return await updateAddressCaetanoGo(billingProfile, existsFavoriteAddress, userId);
            }

            return await addAddressCaetanoGo(billingProfile, userId);
        }
        return await addAddressCaetanoGo(billingProfile, userId);
    } catch (error) {
        console.error(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return error;
    }
};

export const processBilling = async (userId: string) => {
    const context = 'Function processBilling';
    const host = `${Constants.services.connectionStation}/api/private/connectionstation/job/periodBilling/forceRun`;
    const data = {
        billingPeriods: [
            BillingPeriodEnum.AdHOC
        ],
        userId
    };
    try {
        const response = await axios.post(host, data);
        console.log(`[${context}] response`, response.data);
    } catch (error: any) {
        Sentry.captureException(error);
        console.error(`[${context}][.catch] Error `, error.message);
    }
};

export const addAddressToContracts = async (addressObjectData: any, userId: string) => {
    const context = 'Function addAddressToContracts';

    const query = {
        userId,
        address: undefined
    };

    const newValues = { $set: { address: addressObjectData.billingAddress, nif: addressObjectData.nif } };

    Contract.updateMany(query, newValues, (err, result) => {
        if (err) {
            console.error(`[${context}][updateMany] Error `, err.message);
        } else {
            console.log(`[${context}] Address updated `);
        }
    });
};

/** TO BE REMOVED AFTER -> bp-287-removing-tin-validation */
export const validateViesVAT = async (userData: any) => {
    const context = 'Function validateViesVAT';
    if (userData?.nif !== '') {
        const viesVatResult = await getViesVat(userData.billingAddress.countryCode, userData.nif);
        // eslint-disable-next-line no-underscore-dangle
        BillingProfile.updateBillingProfile({ _id: userData._id }, { $set: { viesVAT: viesVatResult } }, { new: true }, (err, updatedBilling) => {
            if (err) {
                console.error(`[${context}] Error `, err.message);
            } else {
                console.log('Vies VAT updated');
            }
        });
    }
};

export default {
    updateBillingProfile: async (req: Request, res: Response, controlCenter:boolean=false) => { 
        const context = 'PATCH /api/private/billingProfile';
        try {
            const { client , userid: userId, clientname: clientName } = req.headers;
            const isBackoffice = ClientTypeEnum.Backoffice === client;
            const defaultCountryCode: string = getCode('Portugal')!;

            const userValidated: boolean = validateUserPerClientName(req.headers as IHeaders, true);
            if (!userValidated) {
                console.log(`Action not allowed for ${clientName}`);
                return res
                    .status(StatusCodes.BAD_REQUEST)
                    .send({
                        auth: false,
                        code: 'action_not_allowed',
                        message: 'Action not allowed',
                    });
            }

            // eslint-disable-next-line no-underscore-dangle
            if (!req.body._id) {
                return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billing_profile_id_missing', message: 'Billing Profile id missing' });
            }

            if (!req.body.nif) {
                return res.status(StatusCodes.BAD_REQUEST).send({ code: 'nif_missing', message: 'NIF missing' });
            }

            if (!req.body.billingName) {
                return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billingName_missing', message: 'Billing name missing' });
            }

            if(req.body.publicEntity !== undefined && typeof req.body.publicEntity !== 'boolean') {
                return res.status(StatusCodes.BAD_REQUEST).send({ code: 'publicEntity_invalid', message: 'publicEntity is not valid, must be true or false' });                
            }

            if(req.body.companyTaxIdNumber && typeof req.body.companyTaxIdNumber !== 'string') {
                return res.status(StatusCodes.BAD_REQUEST).send({ code: 'companyTaxIdNumber_invalid', message: 'companyTaxIdNumber is not valid, must be a string' });
            }


            // flag to check if TIN validation is enabled
            const featureFlagEnabledTIN = await toggle.isEnable('bp-287-removing-tin-validation');

            // BP-365 - setup clientType
            const clientType = req.body.clientType ?? calculateClientType(req.body.clientType, isBackoffice, req.body.billingAddress.countryCode, req.body.nif);

            
            if (req.body.finalConsumer === false) {
                if (!req.body.billingAddress) {
                    return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billingAddress_missing', message: 'Billing address missing' });
                }
                
                if (req.body.billingAddress.street === undefined || req.body.billingAddress.street === '') {
                    return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billingAddress_missing', message: 'Billing address street missing' });
                }

                if (req.body.billingAddress.city === undefined || req.body.billingAddress.city === '') {
                    return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billingAddress_missing', message: 'Billing address city missing' });
                }

                if (req.body.billingAddress.zipCode === undefined || req.body.billingAddress.zipCode === '') {
                    return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billingAddress_missing', message: 'Billing address zipCode missing' });
                }

                const countryCode = (req.body.billingAddress.countryCode ?? req.body.countryCode) ?? defaultCountryCode;
                // Issue 1444 - Quick fix from validation of NIF, this should be temporary
                if (!countryList.getCodes().includes(countryCode)) {
                    return res.status(StatusCodes.BAD_REQUEST).send({ code: 'invalid_billing_address_country_code', message: 'Invalid Billing address country code' });
                }


                const featureFlagEnabledCountry = await toggle.isEnable('fleet-489-backend-normalize-country-field-from-country-code-in-billing-address');
                if (!featureFlagEnabledCountry) {
                    // Normalize country code to country name
                    req.body.billingAddress.country = normalizeCountryCodeToCountryName(countryCode) || req.body.billingAddress.country;
                }


                const { zipCode } = req.body.billingAddress;
                if (countryCode === defaultCountryCode) {
                    const sanitizedZipCode = zipCode?.trim() ?? '';
                    if (!isValidPortugueseZipCode(sanitizedZipCode)) {
                        return res.status(StatusCodes.BAD_REQUEST).send({ code: 'zipCode_invalid', message: 'zipCode is not valid' });
                    }
                    req.body.billingAddress.zipCode = sanitizedZipCode;
                } else if (zipCode) {
                    const isValidZipCodeToCountry = await isZipAddressValidToCountry(zipCode.trim(), countryCode);
                    if (!isValidZipCodeToCountry) {
                        return res.status(StatusCodes.BAD_REQUEST).send({ code: 'zipCode_invalid', message: 'zipCode is not valid' });
                    }
                }

                
                if(!featureFlagEnabledTIN) {
                    const tinValidationResult : IValidTinResponse = await validTin(
                        countryCode,
                        req.body.nif,
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-expect-error
                        userId,
                        clientName
                    );
                    if (!tinValidationResult.valid) {
                        return res.status(StatusCodes.BAD_REQUEST).send(tinValidationResult.errorResponse);
                    }
                }
            }
            else {
                req.body.viesVAT = false;
            }
            let billingPurchaseOrder;
            billingPurchaseOrder = req.body.purchaseOrder ?? '';


            let billingProfile : IBillingProfile = {
                nif: req.body.nif,
                billingName: req.body.billingName,
                billingAddress: req.body.billingAddress,
                email: req.body.email,
                billingPeriod: req.body.billingPeriod,
                purchaseOrder: billingPurchaseOrder,
                clientType: clientType,
                publicEntity: req.body?.publicEntity ?? false,
                companyTaxIdNumber: req.body?.companyTaxIdNumber ?? req.body?.nif ?? null,
                viesVAT: req.body?.viesVAT ?? false,
                name: req.body.name ?? req.body.billingName,
            };
            if (await toggle.isEnable('evio-5764-update-change-email')) {
                /**
                 * req.body.oldEmail is current email
                 * req.body.email is new email if changed
                 */
                billingProfile.email = req.body.oldEmail ?? req.body.email;
            }


            /**
             * req.body.oldEmail is current email
             * req.body.email is new email if changed
             */
            if (EmailChangeService.isBillingProfileEmailChangeEnabled({ clientName, isBackoffice})) {
                billingProfile.email = req.body.oldEmail ?? req.body.email;
            }
            
            if (controlCenter && req.body.invoiceWithoutPayment) {
                billingProfile.invoiceWithoutPayment = req.body.invoiceWithoutPayment;
            }

            if (!billingProfile.billingPeriod && isBackoffice) {
                billingProfile.billingPeriod = BillingPeriodEnum.Monthly;
            }

            // eslint-disable-next-line no-underscore-dangle
            const query = { _id: req.body._id };
            let response = true;
            let goChargeNeedsUpdate = Constants.customers.caetanoGOList.includes(<string>clientName) && !isBackoffice

            if(await toggle.isEnable('bp-464-update-billing-profile-gocharge')) {
                goChargeNeedsUpdate = goChargeNeedsUpdate && req.body.finalConsumer === false
            }

            if (goChargeNeedsUpdate) {
                response = await updateFavoriteAddress(billingProfile, <string>userId);
            }

            if (response) {
                BillingProfile.updateBillingProfile(query, { $set: billingProfile }, { new: true }, (err, updatedBilling) => {
                    if (err) {
                        console.error(`[${context}][.then][findOne] Error`, err.message);
                        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(err.message);
                    }

                    if (updatedBilling != null) {
                        if (billingProfile.billingPeriod === BillingPeriodEnum.AdHOC) {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-expect-error
                            processBilling(userId);
                        }

                        addAddressToContracts(req.body, updatedBilling.userId);

                        if(!featureFlagEnabledTIN) {
                            validateViesVAT(updatedBilling);
                        }
                        updateUserType(updatedBilling);

                        User.findOne({ _id: updatedBilling.userId }, async(error, userFound) => {
                            if (error) {
                                console.error(`[${context}][.then][findOne] Error `, error.message);
                                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error.message);
                            }

                            let pendingConfirmation = false;
                            // Send email with a confirmation code when clientType is B2C and clientName is one of the companies in the lista and billing profile is not active or email has changed
                            if (
                                EmailChangeService.isBillingProfileEmailChangeEnabled({ clientName, isBackoffice }) && 
                                (updatedBilling.status !== billingProfileStatus.ACTIVE || req.body.oldEmail !== req.body.email)
                            ) {
                                console.log(`featureFlagEnabledChangeEmail - updatedBilling.status is ${updatedBilling.status} - req.body.oldEmail is ${req.body.oldEmail} - req.body.email is ${req.body.email}`);
                                const emailChangeResponse = await EmailChangeService.requestBillingProfileEmailChange({ userId: updatedBilling.userId, email: req.body.email, clientName });

                                /**
                                 * 202 code means email change was sent
                                 * 200 code means email change was not sent but it's confirmed
                                 * All other codes means error
                                */
                                if (emailChangeResponse?.statusCode === StatusCodes.ACCEPTED) {
                                    pendingConfirmation = true;
                                }
                                else if (emailChangeResponse?.statusCode  === StatusCodes.OK) {
                                    updatedBilling.status = billingProfileStatus.ACTIVE;
                                }
                                else {
                                    console.error(`[${context}][requestBillingProfileEmailChange][Error] ${JSON.stringify(emailChangeResponse)}`);
                                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(emailChangeResponse);
                                }

                                console.log(`[${context}][requestBillingProfileEmailChange][response] emailChangeResponse: ${JSON.stringify(emailChangeResponse)}`);
                                console.log(`[${context}][updatedBilling][updatedBilling] updatedBilling.status: ${updatedBilling.status}`);
                            }

                            // need to update nif in contracts
                            const query = {
                                userId: updatedBilling.userId
                            };
                            Contract.updateMany(query, { $set: { nif: updatedBilling.nif } }, async (err, result) => {
                                if (err) {
                                    console.error(`[${context}] `, err.message);
                                    return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billing_profile_fetch_failed', message: 'Fail to Update Contracts' });
                                }

                                if (userFound) {
                                    let billingEmail;
                                    if (updatedBilling.email == undefined) {
                                        billingEmail = userFound.email;
                                    } else {
                                        // If there's no pending email change confirmation, update to the new email; otherwise, retain the existing one
                                        billingEmail = !pendingConfirmation ? req.body.email : updatedBilling.email;
                                        console.log(`featureFlagEnabledChangeEmail is enable. billingEmail is ${billingEmail}`);
                                    }

                                    let billingName;
                                    if (updatedBilling.billingName == undefined) {
                                        billingName = userFound.name;
                                    } else {
                                        billingName = updatedBilling.billingName;
                                    }

                                    let billingProfile = {
                                        // eslint-disable-next-line no-underscore-dangle
                                        _id: updatedBilling._id,
                                        billingName,
                                        email: billingEmail,
                                        billingAddress: updatedBilling.billingAddress,
                                        nif: updatedBilling.nif,
                                        imageContent: userFound.imageContent,
                                        mobile: userFound.mobile,
                                        internationalPrefix: userFound.internationalPrefix,
                                        userUpdatedAt: userFound.updatedAt,
                                        billingPeriod: updatedBilling.billingPeriod,
                                        // finalConsumer: updatedBilling.finalConsumer
                                        purchaseOrder: updatedBilling.purchaseOrder,
                                        clientName: updatedBilling.clientName,
                                        clientType: updatedBilling.clientType,
                                        companyTaxIdNumber: updatedBilling.companyTaxIdNumber ?? updatedBilling.nif ?? null,
                                        publicEntity: updatedBilling.publicEntity,
                                        status: updatedBilling.status,
                                        viesVAT: updatedBilling.viesVAT,
                                        name: billingName ?? userFound.name,
                                    };

                                    if (clientName === ClientWhiteLabelsEnum.Hyundai) {
                                        updateUserHyundai(updatedBilling.userId);
                                    }
                                    await contractServices.deleteCachedContractsByUser(updatedBilling.userId);
                                    // if email change was sent, pendingConfirmation is true, then return 202
                                    const statusCode = pendingConfirmation ? StatusCodes.ACCEPTED : StatusCodes.OK;
                                    console.log(`featureFlagEnabledChangeEmail is enable. statusCode = ${statusCode} `);
                                    return res.status(statusCode).send(billingProfile);
                                }

                                return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billing_profile_fetch_failed', message: 'Billing Profile fetch failed' });
                            });
                        });
                    } else {
                        return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billing_profile_update_failed', message: 'Billing Profile update failed' });
                    }
                });
            }
            else {
                return res.status(StatusCodes.BAD_REQUEST).send({ code: 'billing_profile_update_failed', message: 'Billing Profile update failed' });
            }
        } catch (error: any) {
            console.error(`[${context}] Error: `, error);
            return errorResponse(res, error, context);
        }
    },
    /**
  * Updates billing profiles with incorrect `billingName` and `name` set to "Home".
  * 
  * This endpoint updates the `billingName` and `name` fields in the `BillingProfile` collection 
  * to match the `name` field from the corresponding user in the `Users` collection, based on `userId`.
  * 
  * @param req - HTTP request object (supports an optional `limit` for batch size in the body).
  * @param res - HTTP response object.
  * @returns A JSON response with the number of updated profiles and their IDs, or a message if no updates were made.
  */
    async updateBillingProfileName(req: Request, res: Response): Promise<Response> {
        try {
            const featureFlagEnabled = await toggle.isEnable('identity_fix_billing_profile_name');
            if (!featureFlagEnabled) {
                return res.status(StatusCodes.FORBIDDEN).json({
                    success: false,
                    message: 'Feature not enabled.',
                });
            }

            const batchSize = req.body.limit || 50;
            const billingProfiles = await BillingProfile.find({ billingName: "Home", name: "Home" });
    
            if (billingProfiles.length === 0) {
                return res.status(StatusCodes.OK).json({
                    success: true,
                    message: 'No profiles with the name "Home" were found.',
                    updatedIds: [],
                });
            }
    
            const totalBatches = Math.ceil(billingProfiles.length / batchSize);
            const updatedIds: string[] = [];
    
            for (let i = 0; i < totalBatches; i++) {
                const batchStart = i * batchSize;
                const batchEnd = batchStart + batchSize;
                const batch = billingProfiles.slice(batchStart, batchEnd);
    
                const updatePromises = batch.map(async (profile) => {
                    const user = await User.findById(profile.userId);
    
                    if (user && user.name) {
                        profile.billingName = user.name;
                        profile.name = user.name;
                        await profile.save();
                        updatedIds.push(profile._id.toString()); 
                    }
                });
    
                await Promise.all(updatePromises); 
            }
    
            return res.status(StatusCodes.OK).json({
                success: true,
                message: "Profiles updated successfully",
                updatedIds,
            });
        } catch (error) {
            console.error('Error updating billing profiles:', error);
            Sentry.captureException(error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Error updating billing profiles.',
                updatedIds: [],
            });
        }
    },
    /** Requests a change in the email of a billing profile */
    async requestChangeEmail (req: Request, res: Response) {
        const { userid: userId, clientname: clientName } = req.headers;
        const { email } = req.body;
        
        const { statusCode, ...response } = await EmailChangeService.requestBillingProfileEmailChange({ userId, email, clientName });
    
        return res.status(statusCode).send(response);
    },
    /** Confirms a change in the email of a billing profile */
    async confirmChangeEmail(req: Request, res: Response) {
        const { email, verificationCode } = req.body;
        
        const { statusCode, ...response } = await EmailChangeService.confirmEmailChange({ email, verificationCode });
    
        return res.status(statusCode).send(response);
    },
    /** Validates a TIN number and returns its classification */
    async getTinClassification(req: Request, res: Response) {
        const { countryCode, tin } = req.query as { countryCode: string, tin: string };
        const result = await commons.Services.TINValidator.getClassification(countryCode, tin);
    
        if ('error' in result) {
            return res.status(result.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR).send(result.error);
        }
    
        return res.status(StatusCodes.OK).send(result);
    }
};

function calculateClientType (bodyClientType, isBackoffice, countryCode, bodyNif) {

    if (!bodyClientType && isBackoffice) {
        return BillingprofilesClientTypeEnum.Business;
    }

    if (countryCode === CountryCodeEnum.Portugal && bodyNif && bodyNif !== process.env.defaultTIN) {
        const nif = bodyNif.trim();
        let firstNumber;

        if (nif[0] === '-') {
            firstNumber = nif[1];
        } else {
            firstNumber = nif[0];
        }

        const businessInit = ['5', '6', '9']
        if(businessInit.indexOf(firstNumber) !== -1){
            return BillingprofilesClientTypeEnum.Business;
        }
    } 

    return BillingprofilesClientTypeEnum.Private;
}