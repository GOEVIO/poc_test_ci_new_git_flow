import * as Sentry from '@sentry/node';
import axios from 'axios';
import Constants, { logger } from '../utils/constants';
import { parseAddressStreetToString } from './address';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('../models/user');

export interface IValidTinResponse {
    valid: boolean;
    countryCode: string;
    nif: string;
    errorResponse?: {
        code: string;
        message: string;
    };
}

export const getAddressCaetanoGo = async (userId: string) => {
    const context = 'Function getAddressCaetanoGo';
    const fallback = [];
    try {
        const userFound = await User.findOne({ _id: userId }, { _id: 1, idGoData: 1 });

        if (!userFound?.idGoData?.access_token) {
            return fallback;
        }

        const hostAddresses = `${Constants.providers.goCharge.host}/user/${userFound.idGoData.access_token}/addresses/`;
        const resultAdrress = await axios.get(
            hostAddresses,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            { auth: Constants.providers.goCharge.auth }
        );
        // eslint-disable-next-line no-underscore-dangle
        if (resultAdrress.data?._status === 'success') {
            return resultAdrress.data.data;
        }

        return fallback;
    } catch (error: any) {
        console.log(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return [];
    }
};

export const addAddressCaetanoGo = async (billingProfile: any, userId: string) => {
    const context = 'Function addAddress';
    try {
        const userFound = await User.findOne({ _id: userId }, { _id: 1, idGoData: 1, name: 1 });
        const hostAddresses = `${Constants.providers.goCharge.host}/user/${userFound.idGoData.access_token}/addresses/`;
        const address: string = parseAddressStreetToString(billingProfile.billingAddress);
        const dataToSend = {
            custom_name: 'Home',
            name: userFound.name,
            vat: billingProfile.nif,
            address,
            postal_code: billingProfile.billingAddress.postCode
                ? billingProfile.billingAddress.postCode : billingProfile.billingAddress.zipCode,
            locality: billingProfile.billingAddress.city,
            district: billingProfile.billingAddress.state
                ? billingProfile.billingAddress.state : billingProfile.billingAddress.city,
            country: billingProfile.billingAddress.countryCode,
            favourite: '1'
        };

        const resultAddress = await axios.put(
            hostAddresses,
            dataToSend,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            { auth: Constants.providers.goCharge.auth }
        );
        // eslint-disable-next-line no-underscore-dangle
        return resultAddress.data?._status === 'success';
    } catch (error: any) {
        console.log(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return false;
    }
};

export const updateAddressCaetanoGo = async (billingProfile: any, previousAddress: any, userId: string) => {
    const context = 'Function updateAddress';
    try {
        const userFound = await User.findOne({ _id: userId }, { _id: 1, idGoData: 1, name: 1 });
        const hostAddresses = `${Constants.providers.goCharge.host}/user/${userFound.idGoData.access_token}/addresses/${previousAddress.id}/`;
        const address = parseAddressStreetToString(billingProfile.billingAddress);
        const dataToSend = {
            custom_name: 'Home',
            name: userFound.name,
            vat: billingProfile.nif,
            address,
            postal_code: billingProfile.billingAddress.postCode
                ? billingProfile.billingAddress.postCode : billingProfile.billingAddress.zipCode,
            locality: billingProfile.billingAddress.city,
            district: billingProfile.billingAddress.state
                ? billingProfile.billingAddress.state : billingProfile.billingAddress.city,
            country: billingProfile.billingAddress.countryCode
        };

        const resultAddress = await axios.patch(
            hostAddresses,
            dataToSend,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            { auth: Constants.providers.goCharge.auth }
        );
        // eslint-disable-next-line no-underscore-dangle
        return resultAddress.data?._status === 'success';
    } catch (error: any) {
        console.log(`[${context}] Error `, error.message);
        Sentry.captureException(error);
        return false;
    }
};
