import * as Sentry from '@sentry/node';
import Constants, { logger } from '../utils/constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axiosS = require('./axios');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('../models/user');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BillingProfile = require('../models/billingProfile');

export const getHyundaiToken = async () => {
    const context = 'Function hyundaiGetToken';
    try {
        const host = Constants.providers.hyundai.hostGetToken;
        const keys = ['client_id', 'scope', 'client_secret', 'grant_type'];
        const values = [Constants.providers.hyundai.clientId, Constants.providers.hyundai.scope,
            Constants.providers.hyundai.clientSecret, Constants.providers.hyundai.grantType];

        const body = axiosS.getFromDataFormat(keys, values);
        return axiosS.axiosPostBody(host, body);
    } catch (error) {
        console.log(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return null;
    }
};

export const updateUserHyundai = async (userId: string) => {
    const context = 'Function hyundaiPutData';
    try {
        const tokenInfo = await getHyundaiToken();
        const {
            _id, idHyundaiCode, internationalPrefix, mobile, name
        } = await User.findOne(
            { _id: userId },
            {
                _id: 1, idHyundaiCode: 1, internationalPrefix: 1, mobile: 1, name: 1
            }
        );
        if (!_id) {
            console.log(`[${context}]`, 'User not found!');
            return;
        }

        const { nif, billingAddress } = await BillingProfile.findOne(
            { userId },
            { userId: 1, nif: 1, billingAddress: 1 }
        );

        if (!nif) {
            console.log(`[${context}]`, 'Billing profile not found!');
            return;
        }

        const {
            street = '',
            number = '',
            zipCode = '',
            city = '',
        } = billingAddress;
        const address = `${street}, ${number}, ${zipCode}, ${city}`;

        const names = name.split(' ');
        const data = {
            telephone: `${internationalPrefix}${mobile}`,
            nif,
            address,
            ...(names.length >= 2
                ? { firstName: names[0], lastName: names[names.length - 1] }
                : { firstName: name }
            )
        };

        const headers = {
            Authorization: `Bearer ${tokenInfo.access_token}`,
            idClientCRM: idHyundaiCode,
            brand: Constants.providers.hyundai.brand,
        };
        const host = `${process.env.hyundaiPutData}${idHyundaiCode}`;

        const response = await axiosS.axiosPutBodyAndHeader(host, data, headers);
        return response;
    } catch (error: any) {
        console.error(
            `[${context}] Error: ${error?.message ?? 'Unknown error occurred'}`
        );
        return null;
    }
};
