import Payments from 'evio-library-payments'
import { DeviceTypes, isEmptyObject } from 'evio-library-commons'
import { PaymentV2ServiceClient } from '../clients/payments-v2.client'
import { aptPreAuthorizationConstants } from '../constants/apt-pre-authorization-constants'

export class DevicesPreAuthorizationService {
    paymentClient;
    constructor(device: DeviceTypes) {
        this.paymentClient = new PaymentV2ServiceClient(device);
    }

    async updatePreAuthorization(session, totalCostInclVat, fromCapture = false) {
        const preAuthorization = await this.getPreAuthorization(session, {
            "amount": 1,
            transactionId: 1,
            blobPreAuthorization: 1,
            active: 1
        });

        console.log('[updatePreAuthorization] Info - Pre-authorization found', preAuthorization);

        if(!preAuthorization.active) {
            console.log('[updatePreAuthorization] Error - Pre-authorization is not active');
            throw new Error('Pre-authorization is not active');
        }

        if(!this.checkUpdatePreAuthIsNecessary(preAuthorization.amount.value,  totalCostInclVat)) {
            return true;
        }

        const updateObject = {
            amount: fromCapture ? 
                totalCostInclVat +  Number(aptPreAuthorizationConstants.PreAuthorizationMinDiffToNecessaryUpdate) : 
                preAuthorization.amount.value + Number(aptPreAuthorizationConstants.PreAuthorizationValueAddToUpdate),
            currency: preAuthorization.amount.currency,
            originalReference: session.adyenReference,
            merchantReference: preAuthorization.transactionId,
            adjustAuthorisationData: preAuthorization.blobPreAuthorization
        }

        const result = await this.paymentClient.updatePreAuthorization(updateObject);
        console.log('[updatePreAuthorization] Info - Pre-authorization updated', result);
        return result?.response === 'Authorised';
    }

    async cancelPreAuthorization(session) {
        const preAuthorization = await this.getPreAuthorization(session, {
            transactionId: 1,
            active: 1
        });

        if(!preAuthorization.active) {
            return true
        }

        const result = await this.paymentClient.cancelPreAuthorization({
            merchantReference: preAuthorization.transactionId,
            originalReference: session.adyenReference,
        });
        return result?.response === '[cancel-received]';
    }

    async capturePreAuthorization(session, totalCostInclVat) {
        await this.updatePreAuthorization(session, totalCostInclVat, true);
        const preAuthorization = await this.getPreAuthorization(session, {
            "amount": 1,
            transactionId: 1,
            blobPreAuthorization: 1
        });

        const captureObject = {
            amount: totalCostInclVat,
            currency: preAuthorization.amount.currency,
            originalReference: session.adyenReference,
            merchantReference: preAuthorization.transactionId,
        }

        const result = await this.paymentClient.capturePreAuthorization(captureObject);
        return result?.response === '[capture-received]';
    }

    async getPreAuthorization(session, projection = {}) {
        const preAuthorization = await Payments.retrievePreAuthorizationByPSPReference(session?.adyenReference, projection);
        if(!preAuthorization || isEmptyObject(preAuthorization)){
            throw new Error('Not found pre-authorization');
        }
        return preAuthorization;
    }

    checkUpdatePreAuthIsNecessary(preAuthorizationAmount, sessionTotalCostInclVat) {
        if (preAuthorizationAmount - Number(aptPreAuthorizationConstants.PreAuthorizationMinDiffToNecessaryUpdate) < sessionTotalCostInclVat) {
            console.log('[checkUpdatePreAuthIsNecessary] Info - Update necessary');
            return true;
        }
        return false;
    }

}