import axios, {AxiosInstance} from 'axios'
import * as Sentry from '@sentry/node'
import {aptPreAuthorizationConstants } from '../constants/apt-pre-authorization-constants'

export class PaymentV2ServiceClient {
    strategy: string;
    client: AxiosInstance;
    constructor(strategy: string) {
        this.strategy = strategy;
        this.client = axios.create({
            baseURL: aptPreAuthorizationConstants.PaymentsV2ServiceHost,
            headers: {
                'Content-Type': 'application/json',
                strategy: this.strategy
            }
        });

    }

    async updatePreAuthorization(body: any) {
        const context = `[updatePreAuthorization] strategy=${this.strategy}`;
        console.log(`${context} Info - Sending updatePreAuthorization request`, body);
        try {
            const response = await this.client.patch(`/api/private/payments/v2/preauthorisation`, body);
            if (!response?.data) {
                console.log(`${context} Error - No data received from updatePreAuthorization`);
                throw new Error('No data received from updatePreAuthorization');
            }
            return response.data;
        } catch (e) {
            const error = e?.response?.data || e;
            console.error(`Error ${context}:`, error.message);
            Sentry.captureException(error);
            throw error;
        }
    }

    async cancelPreAuthorization(body: any) {
        const context = `[cancelPreAuthorization] strategy=${this.strategy}`;
        try {
            const response = await this.client.delete(`/api/private/payments/v2/preauthorisation`, {
                data: body,
            });
            if (!response?.data) {
                throw new Error('No data received from deletePreAuthorization');
            }
            return response.data;
        } catch (e) {
            const error = e?.response?.data || e;
            console.error(`Error ${context}:`, error.message);
            Sentry.captureException(error);
            throw error;
        }
    }

    async capturePreAuthorization(body: any) {
        const context = `[capturePreAuthorization] strategy=${this.strategy}`;
        try {
            const response = await this.client.post(`/api/private/payments/v2/capture`, body);
            if (!response?.data) {
                throw new Error('No data received from capturePreAuthorization');
            }
            return response.data;
        } catch (e) {
            const error = e?.response?.data || e;
            console.error(`Error ${context}:`, error.message);
            Sentry.captureException(error);
            throw error;
        }
    }
}