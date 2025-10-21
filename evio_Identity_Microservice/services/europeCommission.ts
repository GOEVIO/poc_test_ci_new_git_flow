import * as soap from 'soap';
import * as Sentry from '@sentry/node';
import { getCode } from 'country-list';

import Constants from '../utils/constants';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NifValidationLogs = require('../models/nifValidationLogs');

export interface IValidTinResponse {
    valid: boolean;
    countryCode: string;
    nif: string;
    errorResponse?: {
        code: string;
        message: string;
    };
}

export const countryCodeIsoToEU = (countryCode: string): string => {
    const context = 'Function countryCodeIsoToEU';
    try {
        switch (countryCode) {
            case 'GR':
                return 'EL';
            default:
                return countryCode;
        }
    } catch (error) {
        Sentry.captureException(error);
        console.error(`[${context}] Error `, error.message);
        return countryCode;
    }
};

export const createNifValidationLog = async (
    result: any,
    valid: boolean,
    countryCode: string,
    tinNumber: string,
    userId: string,
    clientName: string
) => {
    const context = 'Function createNifValidationLog';
    try {
        const found = await NifValidationLogs.findOne({ userId, clientName }).lean();
        if (found) {
            const validationLog = {
                valid,
                countryCode,
                tinNumber,
                result: JSON.parse(JSON.stringify(result)),
                date: new Date().toISOString()
            };

            // eslint-disable-next-line no-underscore-dangle
            await NifValidationLogs.updateOne({ _id: found._id }, { $push: { tries: validationLog } });
        } else {
            const createdLog = new NifValidationLogs({
                userId,
                clientName,
                tries: {
                    valid,
                    countryCode,
                    tinNumber,
                    result: JSON.parse(JSON.stringify(result)),
                    date: new Date().toISOString()
                }
            });
            await createdLog.save();
        }
    } catch (error: any) {
        Sentry.captureException(error);
        console.error(`[${context}] Error `, error.message);
    }
};

export const validTin = async (countryCode: string, tinNumber: string, userId: string, clientName: string): Promise<IValidTinResponse> => {
    const context = 'Function validTin';
    try {
        // FIXME we're skipping spain nif validation because of current business needs, please don't leave like this
        const isSpain = String(countryCode).toUpperCase() === 'ES'
        const itsNonPortugal = countryCode !== getCode('Portugal');
        const defaultTIN = process.env.defaultTIN;

        if (isSpain && tinNumber) {
            return {
                valid: true,
                countryCode,
                nif: tinNumber,
            };
        }

        if (itsNonPortugal && tinNumber === defaultTIN) {
            return {
                valid: true,
                countryCode,
                nif: tinNumber,
            };
        }

        const client = await soap.createClientAsync(Constants.providers.europeCommission.wsdlTin);
        const result = await client.checkTinAsync({
            countryCode: countryCodeIsoToEU(countryCode),
            tinNumber
        });
        const valid = result[0]?.validStructure && result[0]?.validSyntax;
        await createNifValidationLog(result, valid, countryCode, tinNumber, userId, clientName);

        return {
            valid,
            countryCode,
            nif: tinNumber,
            errorResponse: !valid ? { code: 'billingProfile_nif_invalid', message: 'Invalid Tax Number' } : undefined
        };
    } catch (error: any) {
        console.error(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        await createNifValidationLog(
            error.message,
            false,
            countryCode,
            tinNumber,
            userId,
            clientName
        );
        return {
            valid: false,
            countryCode,
            nif: tinNumber,
            errorResponse: { code: 'billingProfile_nif_api_error', message: 'We are sorry but it is not possible to fulfill your request at this time. Please try again later' }
        };
    }
};

export const getViesVat = async (countryCode: string, vatNumber: string): Promise<any> => {
    const client = await soap.createClientAsync(Constants.providers.europeCommission.wsdl);
    const result = await client.checkVatAsync({
        countryCode,
        vatNumber,
    });

    return result[0].valid;
};
