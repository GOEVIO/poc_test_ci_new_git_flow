const axios = require('axios');
const Sentry = require("@sentry/node");

const { PaymentsV2ServiceHost } = require('../configs/constants');

class PaymentV2ServiceClient {
    constructor(strategy) {
        this.strategy = strategy.toLocaleLowerCase();
        this.client = axios.create({
            baseURL: PaymentsV2ServiceHost,
            headers: {
                'Content-Type': 'application/json',
                strategy: this.strategy
            }
        });

    }

    async updatePreAuthorization(body) {
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

    async cancelPreAuthorization(body) {
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

    async capturePreAuthorization(body) {
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

module.exports = { PaymentV2ServiceClient };