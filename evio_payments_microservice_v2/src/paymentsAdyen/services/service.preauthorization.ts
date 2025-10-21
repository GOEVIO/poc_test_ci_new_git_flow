import { Injectable } from "@nestjs/common";
import {generate} from 'short-uuid';
import adyenLibrary from "evio-library-adyen";
import paymentLibrary from "evio-library-payments";
import { ErrorHandlerCommon } from "../../common/error.handler.common";
import { PreAuthorizationRepository } from "../repositories/preauthorization.repository";
import { IPreAuthorizationResponse, PreAuthorizationResponse, statusPreAuthorization } from '../dto/preauthorization.dto';
import { PreAuthorizationSchemaArray } from "../schemas/preauthorization.schema";


@Injectable()
export class PreAuthorizationService {
        
    constructor(private readonly PreAuthorizationRepository: PreAuthorizationRepository) {}
    
/**********************************************************************************************************************************
 * *********************** RETRIEVE RESERVATION  ********************************************************************************* *
 ***********************************************************************************************************************************/

    /**
     * Retrieves all pre-authorizations from the database.
     * 
     * @returns The array of pre-authorizations found. If no pre-authorizations are found, an error is thrown.
     * @throws {Error} If no pre-authorizations are found in the database.
     */
    async retrieveAllPreAuthorization(): Promise<IPreAuthorizationResponse[]> {    
        const context = '[retrieveAllPreAuthorization]'    
        const result = await paymentLibrary.retrieveAllPreAuthorization();
        console.log(`${context}, result of retrive all reservation: ${result}`)
        if(!result) throw ErrorHandlerCommon.notfound('server_preauthorization_required', 'No preauthorization found', 'Not found');

        PreAuthorizationSchemaArray.safeParse(result);
        return result as IPreAuthorizationResponse[]
    }

    /**
     * Retrieves the current pre-authorization for a user by their user ID.
     *
     * @param {string} userid - The user ID for whom the pre-authorization is to be retrieved.
     * @param {boolean} [internal=false] - A flag indicating if the call is internal. Defaults to false.
     * @returns {Promise<IPreAuthorizationResponse>} A promise that resolves to the pre-authorization response if found.
     * @throws {Error} If no pre-authorization is found for the given user ID.
     *
     * @remarks
     * - The function attempts to retrieve the current active pre-authorization for the specified user.
     * - If a pre-authorization is not found, an error is thrown indicating no pre-authorization was found.
     * - The result is validated against the `PreAuthorizationSchema` to ensure it matches the expected structure.
     */
    async retrievePreAuthorizationByUser(userid: string, internal: boolean = false): Promise<IPreAuthorizationResponse> {
        const context = '[retrievePreAuthorizationByUser]' 
        const result = await paymentLibrary.retrieveCurrentPreAuthorizationByUser(userid);
        console.log(`${context}, result of retrive all reservation: ${JSON.stringify(result)}`)
        if(!result) throw ErrorHandlerCommon.notfound('server_preauthorization_required', 'No preauthorization found', 'Not found');
        return result;        
    }

    /**
     * Retrieves the current pre-authorization for a session by its session ID.
     *
     * @param {string} sessionId - The session ID for which the pre-authorization is to be retrieved.
     * @param {boolean} [internal=false] - A flag indicating if the call is internal. Defaults to false.
     * @returns {Promise<IPreAuthorizationResponse>} A promise that resolves to the pre-authorization response if found.
     * @throws {Error} If no pre-authorization is found for the given session ID.
     *
     * @remarks
     * - The function attempts to retrieve the current active pre-authorization for the specified session.
     * - If a pre-authorization is not found, an error is thrown indicating no pre-authorization was found.
     * - The result is validated against the `PreAuthorizationSchema` to ensure it matches the expected structure.
     */
    async retrieveReservationBySessionId(sessionId: string): Promise<IPreAuthorizationResponse> {
        return await paymentLibrary.retrieveCurrentReservationAmountBySessionId(sessionId);        
    }

    async retrieveAllReservationBySessionId(sessionId: string): Promise<IPreAuthorizationResponse> {
        return await paymentLibrary.retrieveAllReservationAmountBySessionId(sessionId);        
    }

/**********************************************************************************************************************************
 * *********************** CREATE / UPDATE / PAY RESERVATION  ******************************************************************** *
 ***********************************************************************************************************************************/

    /**
     * Creates a pre authorization using the Adyen API.
     * 
     * This function creates a pre authorization and returns the pre authorization id, the transaction id and the amount reserved.
     * 
     * @param body The body of the pre authorization request.
     * @param reservedAmount The amount to be reserved.
     * @param owner The owner of the pre authorization.
     * @returns A promise that resolves to an object containing the pre authorization id, the transaction id and the amount reserved.
     * @throws {ErrorHandlerCommon} If the pre authorization fails.
     */
    async createPreAuthorization(body: any, reservedAmount: number, owner?: string ): Promise<object> {
        const constext = '[createPreAuthorization]';
        // create a transaction id that will be used to identify the transaction
        const transactionId = generate().substring(0, 16);
        let data = {
            ...body,
            transactionId: transactionId,
            reservedAmount: reservedAmount,
            initialAmount: body.reservedAmount,
            success: true,
            active: true,
            error: {
                refusalReason: null,
                refusalReasonCode:null,
                refusalReasonRaw: null,
                adyenReference: null,
                originError: null
            },
            status: statusPreAuthorization.CREATED,
            owner: owner
        };

        try {
            // retrieve the payment method config for a determined user
            const paymentMethodConfig =  await paymentLibrary.retrievePaymentMethodByUserIdwithConfigs(body.userId);
            if(!paymentMethodConfig || paymentMethodConfig.paymentMethods == null || paymentMethodConfig.paymentMethods.length == 0) {
                throw ErrorHandlerCommon.notfound('server_paymentMethod_required', 'No payment method found', 'Not found');
            }
            const { paymentMethods } = paymentMethodConfig;
            
            // retrive payment method that are approved
            const dafaultPaymentMethod = paymentMethods.find((paymentMethod: any) => paymentMethod.status == 'APPROVED' && paymentMethod.defaultPaymentMethod);
            const currentPaymentMethod = dafaultPaymentMethod ?? paymentMethods.find((paymentMethod: any) => paymentMethod.status == 'APPROVED');
            data.paymentMethodId = currentPaymentMethod.paymentMethodId;

            // compose request object that will be sent to adyen
            const requestPreAuthorization = {
                userId: body.userId,
                currency: body.currency,
                amount: reservedAmount,
                allow3DS2: currentPaymentMethod.needsThreeDSAuthentication,
                paymentMethodId: currentPaymentMethod.paymentMethodId,
                shopperReference: body.userId,
                recurringProcessingModel: paymentMethodConfig.recurringProcessingModel ?? 'UnscheduledCardOnFile',
                reference: transactionId
            }

            console.log(`${constext} requestPreAuthorization: ${JSON.stringify(requestPreAuthorization)}`);
            // send request to adyen
            const preAuthorizationResponse = await adyenLibrary.preAuthorization(requestPreAuthorization);

            console.log(`${constext} preAuthorizationResponse: ${JSON.stringify(preAuthorizationResponse)}`);
            if(preAuthorizationResponse.refusalReason != undefined || preAuthorizationResponse.refusalReasonCode != undefined) {
                console.log(`${constext} preAuthorizationResponse.refusalReason: ${preAuthorizationResponse.refusalReason}, preAuthorizationResponse.refusalReasonCode: ${preAuthorizationResponse.refusalReasonCode}`);
                throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', preAuthorizationResponse.refusalReason, 'Payment refused', preAuthorizationResponse);
            }

            //console.log('updatePreAuthorization updateOnAdyen.response', preAuthorizationResponse?.response);
            if(preAuthorizationResponse.response && preAuthorizationResponse.response === 'Refused') {
                console.log(`${constext} preAuthorizationResponse.response: ${preAuthorizationResponse.response}`);
                throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', preAuthorizationResponse.additionalData.refusalReasonRaw, 'Payment refused', preAuthorizationResponse);
            }

            data = {
                ...data,
                ...preAuthorizationResponse,
                ...currentPaymentMethod
            }

            // added to preauthorization document all the data returned by adyen
            const requestPreAuthorizationDocument = this.composePreAuthorization(data); 
            // insert into database all the pre authorization information
            const inserted = await this.preAuthorizationCreateDocumentDB(requestPreAuthorizationDocument);

            return {
                amount: reservedAmount,
                pspReference: preAuthorizationResponse.pspReference,
                preAuthorizationsId: inserted.insertedId,
                transactionId: transactionId
            }; 
        } catch (error) {
            data.error = error?.origin ?? error;
            data.success = false;
            data.active = false;
            data.status = statusPreAuthorization.CREATEDFAILD;
            data.refusalReason = error?.message ?? error?.origin?.message;
            data.refusalReasonCode = error?.code ?? error?.origin?.statusCode;
            data.refusalStatusCode = error?.errorCode ?? error?.origin?.errorCode;

            const requestPreAuthorizationDocument = this.composePreAuthorization(data);    
            await this.preAuthorizationCreateDocumentDB(requestPreAuthorizationDocument);

            console.log(`${constext} error: ${JSON.stringify(error)}`);
            if(error.errorCode === (typeof error.errorCode === 'string' ? '800' : 800))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused'); 
            if(error.errorCode === (typeof error.errorCode === 'string' ? '801' : 801))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused'); 
            if(error.errorCode === (typeof error.errorCode === 'string' ? '802' : 802))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused');  
            if(error.errorCode === (typeof error.errorCode === 'string' ? '167' : 167))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused');              
            throw error;                  
        }
    }

    /**
     * Update a pre-authorization using the Adyen API.
     *
     * @param preauthorizationData - The pre-authorization information that will be updated.
     * @param body - The data request object containing the user ID, currency, amount, stored payment method ID, and Adyen reference.
     * @param reservedAmount - The amount to be pre-authorized.
     * @param owner - The owner of the pre-authorization.
     * @return {Promise<IPreAuthorizationResponse>} A promise that resolves to the updated pre-authorization response or an error if the update fails.
     */
    async updatePreAuthorization(preauthorizationData: any, body: any, reservedAmount: number, owner?: string): Promise<IPreAuthorizationResponse>{
        const constext = '[updatePreAuthorization]';
        let dataObject: any;
        try {
            // object that will be used to update the document
            dataObject = {
                userId: body.userId,
                sessionIdInternal: preauthorizationData.sessionIdInternal,
                data: {
                    updatedAt: new Date(),
                    active: preauthorizationData.active,
                    adyenReference: preauthorizationData.adyenReference,
                    success: preauthorizationData.success,
                    amount:{
                        currency: preauthorizationData.amount.currency,
                        value: reservedAmount
                    },
                    adyenPspReferenceUpdated: preauthorizationData.adyenPspReferenceUpdated,
                    status:statusPreAuthorization.UPDATED,
                    owner: owner
                }
            }

            const updateOnAdyen = await adyenLibrary.updatePreAuthorization({
                userId: preauthorizationData.userId,
                pspReference: preauthorizationData.adyenReference,
                amount: reservedAmount,
                currency: preauthorizationData.amount.currency,
                blobPreAuthorization: preauthorizationData.blobPreAuthorization,
                transactionId: preauthorizationData.transactionId
             });

            console.log(`${constext} updateOnAdyen: ${JSON.stringify(updateOnAdyen)}`);

            if(updateOnAdyen.refusalReason != undefined || updateOnAdyen.refusalReasonCode != undefined) {
                console.error(`${constext} preAuthorizationResponse.refusalReason: ${updateOnAdyen.refusalReason}, preAuthorizationResponse.refusalReasonCode: ${updateOnAdyen.refusalReasonCode}`);
                throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', updateOnAdyen.data.refusalReason, 'Payment refused');
            }

            console.log(`${constext} updateOnAdyen.response: ${updateOnAdyen.response}`);
            if(updateOnAdyen.response && updateOnAdyen.response === 'Refused') {
                console.error(`${constext} preAuthorizationResponse.response: ${updateOnAdyen.response}`);
                throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', updateOnAdyen.additionalData.refusalReasonRaw, 'Payment refused');
            }

            preauthorizationData.adyenPspReferenceUpdated != null ? preauthorizationData.adyenPspReferenceUpdated.push(updateOnAdyen.pspReference)  // if a pre authorization does have the field adyenPspReferenceUpdated we will push a new information to this field 
            :  updateOnAdyen.pspReference ? preauthorizationData.adyenPspReferenceUpdated = [updateOnAdyen.pspReference] // if adyen does have the field pspReference we will create a new field with this information
            : preauthorizationData.adyenPspReferenceUpdated = null; // if not we will set the field to null

            // update document
            const updated = await this.PreAuthorizationRepository.update(dataObject, null, preauthorizationData.sessionIdInternal);
            if (!updated) {
                throw ErrorHandlerCommon.internalservererror('not-updated', 'Not was possible to update preauthorization', 'not-updated');
            }

            // compose response
            let composeInfo = {
                ...preauthorizationData
            }
            composeInfo.updatedAt = dataObject.data.updatedAt;
            composeInfo.active = dataObject.data.active;
            composeInfo.adyenReference = dataObject.data.adyenReference;
            composeInfo.success = dataObject.data.success;
            composeInfo.amount.value = dataObject.data.amount.value;
            
            return composeInfo;
        } catch (error) {
            dataObject.data.refusalReason = error?.message ?? error?.origin?.message;
            dataObject.data.refusalReasonCode = error?.code ?? error?.origin?.statusCode;
            dataObject.data.refusalStatusCode = error?.errorCode ?? error?.origin?.errorCode;

            await this.PreAuthorizationRepository.update(dataObject, null, dataObject.sessionIdInternal);

            console.log(`${constext} error: ${JSON.stringify(error)}`);
            if(error.errorCode === (typeof error.errorCode === 'string' ? '800' : 800))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused'); 
            if(error.errorCode === (typeof error.errorCode === 'string' ? '801' : 801))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused'); 
            if(error.errorCode === (typeof error.errorCode === 'string' ? '802' : 802))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused');  
            if(error.errorCode === (typeof error.errorCode === 'string' ? '167' : 167))  throw ErrorHandlerCommon.invalid('server_paymentMethod_refused', error?.message, 'Payment refused');              
            throw error; 
        }
    }


    /**
     * Update a pre-authorization using the Adyen API.
     *
     * @param preauthorizationData - The pre-authorization information that will be updated.
     * @param body - The data request object containing the user ID, currency, amount, stored payment method ID, and Adyen reference.
     * @param reservedAmount - The amount to be pre-authorized.
     * @param owner - The owner of the pre-authorization.
     * @return {Promise<IPreAuthorizationResponse>} A promise that resolves to the updated pre-authorization response or an error if the update fails.
     */
    async updateInternalPreAuthorizationToCompleted(sessionId: string, body: any): Promise<boolean>{
        const constext = '[updateInternalPreAuthorization]';
        let dataObject: any;
        try {
            // object that will be used to update the document
            dataObject = {
                sessionIdInternal: sessionId,
                data: {
                    updatedAt: new Date(),
                    active: false,
                    status: body.status === 'completedFaild' ? statusPreAuthorization.COMPLETEDFAIL : null
                }
            }

            console.log(dataObject)
            // update document
            const updated = await this.PreAuthorizationRepository.update(dataObject, null , dataObject.sessionIdInternal);
            if (!updated) {
                throw ErrorHandlerCommon.internalservererror('not-updated', 'Not was possible to update preauthorization', 'not-updated');
            }

            // compose response
            return true;
        } catch (error) {
            dataObject.data.refusalReason = error?.message ?? error?.origin?.message;
            dataObject.data.refusalReasonCode = error?.code ?? error?.origin?.statusCode;
            dataObject.data.refusalStatusCode = error?.errorCode ?? error?.origin?.errorCode;
            console.log(`${constext} error: ${JSON.stringify(dataObject)}`);
            await this.PreAuthorizationRepository.update(dataObject, null, dataObject.sessionIdInternal);
             
            throw error; 
        }
    }

   


/**********************************************************************************************************************************
 * *********************** RELEASE RESERVATION *********************************************************************************** *
 ***********************************************************************************************************************************/

    /**
     * Cancels a list of pre-authorizations by sending cancellation requests to the Adyen API.
     *
     * @param {any} body - The request body containing a JSON string of pre-authorization data.
     *                     Each entry should include `pspReference`, `userId`, `blobPreAuthorization`, and `transactionId`.
     * @returns {Promise<void>} - A promise that resolves when all cancellations have been processed.
     *
     * @remarks
     * - Logs the cancellation response from Adyen for each pre-authorization.
     * - If a cancellation is unsuccessful, the associated pre-authorization is updated to inactive.
     * - Updates the status to 'cancelled' and logs the refusal reason if the pre-authorization release occurs
     *   due to exceeding a 24-hour duration.
     */
    async cancelListReservationPaymentAdyen(body: any): Promise<void> {
        const context = '[cancelReservationPaymentAdyen]';
        console.log(`${context}, body: ${body} typo_ ${typeof body}`);
        const dataList = JSON.parse(typeof body === 'string' ? body : JSON.stringify(body));
        console.log(`${context}, dataList: ${dataList}`);
        if(dataList.length === 0) return;
        
        for(let preAuthorization of dataList){
            const adyenCanceled = await adyenLibrary.cancelPreAuthorization({
                pspReference: preAuthorization.pspReference, 
                userId: preAuthorization.userId,
                blobPreAuthorization: preAuthorization.blobPreAuthorization,
                transactionId: preAuthorization.transactionId
            });
            console.log(`${context}, adyenCanceledResponse: ${adyenCanceled}`);
            if(adyenCanceled.statusCode && adyenCanceled.errorCode) continue;

            const dataObject = {
                data: {
                    active: false,
                    status:{
                        value: 'cancelled',
                        code: 'unpaid'
                    },
                    updatedAt: new Date(),
                    refusalReason: 'Pre Authorization released because have more than 24 hours.',
                    metadata: adyenCanceled
                }
            };
    
            await this.PreAuthorizationRepository.update(dataObject, null, body.sessionIdInternal);
        }
    }

    /**
     * Cancels a preauthorization for a user by their user ID.
     *
     * @param {string} userid - The user ID for whom the preauthorization is to be cancelled.
     * @return {Promise<any>} A promise that resolves to the result of the cancellation update.
     * @throws {Error} If no preauthorization is found or if the cancellation fails.
     *
     * @remarks
     * - The function retrieves the current preauthorization for the specified user.
     * - If found, it sends a cancellation request to the Adyen API.
     * - Updates the preauthorization status to 'CANCELLED' if successful.
     * - Logs the preauthorization and cancellation response for debugging purposes.
     */
    async cancelPreAuthorizationByUserID(userid: string): Promise<void> {
        const constext = '[cancelPreAuthorizationByUserID]';

        const preAuthorization = await paymentLibrary.retrieveCurrentPreAuthorizationByUser(userid);
        console.log(`${constext}, preAuthorization: ${preAuthorization}`);
        if(!preAuthorization) throw ErrorHandlerCommon.notfound('not-cancelled', 'Not found', 'Not found');

        const adyenCanceled = await adyenLibrary.cancelPreAuthorization({
            pspReference: preAuthorization.adyenReference, 
            userId: preAuthorization.userId,
            blobPreAuthorization: preAuthorization.blobPreAuthorization,
            transactionId: preAuthorization.transactionId
        });
        console.log(`${constext}, adyenCanceledResponse: ${adyenCanceled}`);
        if(!adyenCanceled) throw ErrorHandlerCommon.internalservererror('not-cancelled', 'Not was possible to cancel preauthorization', 'not-cancelled');

        await this.PreAuthorizationRepository.update({
            userId: preAuthorization.userId,
            data: {
                active: false,
                status: statusPreAuthorization.CANCELLED,
                updatedAt: new Date(),
                metadata: adyenCanceled
            }
        }, userid, null);
    }

    /**
     * Cancels a preauthorization for a user by their session ID.
     *
     * @param {string} sessionId - The session ID for whom the preauthorization is to be cancelled.
     * @return {Promise<void>} A promise that resolves to the result of the cancellation update.
     * @throws {Error} If no preauthorization is found or if the cancellation fails.
     *
     * @remarks
     * - The function retrieves the current preauthorization for the specified user.
     * - If found, it sends a cancellation request to the Adyen API.
     * - Updates the preauthorization status to 'CANCELLED' if successful.
     * - Logs the preauthorization and cancellation response for debugging purposes.
     */
    async cancelPreAuthorizationBySession(sessionId: string): Promise<void> {
        const constext = '[cancelPreAuthorizationBySession]';

        const preAuthorization = await paymentLibrary.retrieveCurrentReservationAmountBySessionId(sessionId);
        console.log(`${constext}, preAuthorization: ${preAuthorization}`);
        if(!preAuthorization) throw ErrorHandlerCommon.notfound('not-cancelled', 'Not found', 'Not found');

        const adyenCanceled = await adyenLibrary.cancelPreAuthorization({
            pspReference: preAuthorization.adyenReference, 
            userId: preAuthorization.userId,
            blobPreAuthorization: preAuthorization.blobPreAuthorization,
            transactionId: preAuthorization.transactionId
        });
        console.log(`${constext}, adyenCanceledResponse: ${adyenCanceled}`);
        if(!adyenCanceled) throw ErrorHandlerCommon.internalservererror('not-cancelled', 'Not was possible to cancel preauthorization', 'not-cancelled');

        await this.PreAuthorizationRepository.update({
            userId: preAuthorization.userId,
            data: {
                active: false,
                status: statusPreAuthorization.CANCELLED,
                updatedAt: new Date(),
                metadata: adyenCanceled
            }
        }, null, sessionId);
    }

/**********************************************************************************************************************************
 * *********************** PAY RESERVATION *********************************************************************************** *
 ***********************************************************************************************************************************/

    /**
     * Makes a payment preauthorization.
     *
     * @param userid - The user id of the user who is making the payment.
     * @param body - The data request object containing the user ID, currency, amount, stored payment method ID, and Adyen reference.
     * @return {Promise<any>} A promise that resolves to the response or an error if the update fails.
     */
    async makePaymentPreAuthorization(sessionId: string, body: any): Promise<any> {
        const context = 'makePaymentPreAuthorization';
        const adyenCaptureRequest = {
            pspReference: body.pspReference, 
            userId: body.userId, 
            amount: body.amount, 
            currency: body.currency, 
            blobPreAuthorization: body.blobPreAuthorization,
            transactionId: body.transactionId,
            merchantAccount: body.merchantAccount
        }

        const updateInfoData = {
            userId: adyenCaptureRequest.userId,
            sessionIdInternal: sessionId,
            data: {
                active : false,
                success: true,
                amount: {
                    currency: body.currency,
                    value: body.amount
                },
                status:{
                    value: 'completed',
                    code: null
                },
                updatedAt: new Date(),
                paymentInfo: {
                    paymentId: body.paymentId,
                    amountThatWasPaid: body.amount,
                    paidAt: new Date()
                },
                metadata: null
            }
        }

        // send request to Adyen
        const result = await adyenLibrary.capture(adyenCaptureRequest);
        updateInfoData.data.metadata = result;
        console.log(`${context}, result of payment response: ${JSON.stringify(updateInfoData)}`);
        if(!result) {
            updateInfoData.data.status.code = 'unpaid';
            await this.PreAuthorizationRepository.update(updateInfoData, null, updateInfoData.sessionIdInternal);
            throw ErrorHandlerCommon.invalid('not-cancelled', 'Not was possible to pay preauthorization', 'not-cancelled');
        }

        if(!result.response) {
            updateInfoData.data.status.code = 'unpaid';
            await this.PreAuthorizationRepository.update(updateInfoData, null, updateInfoData.sessionIdInternal);
            throw ErrorHandlerCommon.invalid('not-cancelled', 'Not was possible to pay preauthorization', 'not-cancelled');
        }
    
        // update preauthorization
        updateInfoData.data.status.code = 'paid';
        await this.PreAuthorizationRepository.update(updateInfoData, null, updateInfoData.sessionIdInternal);


        return adyenCaptureRequest;
    }


/**********************************************************************************************************************************
 * *********************** PRIVATE METHODS  *********************************************************************************** *
 ***********************************************************************************************************************************/


    /**
     * Composes a pre-authorization response object from the given data.
     * 
     * The given data should contain the following properties:
     * - transactionId: The transaction id of the pre-authorization.
     * - initialAmount: The initial amount of the pre-authorization.
     * - currency: The currency of the pre-authorization.
     * - reservedAmount: The reserved amount of the pre-authorization.
     * - paymentMethodId: The id of the payment method used for the pre-authorization.
     * - adyenReference: The Adyen reference of the pre-authorization.
     * - userId: The user id associated with the pre-authorization.
     * - success: A boolean indicating if the pre-authorization was successful.
     * - active: A boolean indicating if the pre-authorization is active.
     * - adyenPspReferenceUpdated: An array of psp references that were updated.
     * - blobPreAuthorization: The blob data of the pre-authorization.
     * - status: The status of the pre-authorization.
     * - sessionId: The session id associated with the pre-authorization.
     * - refusalReason: The refusal reason of the pre-authorization.
     * - refusalReasonCode: The refusal reason code of the pre-authorization.
     * - refusalStatusCode: The refusal status code of the pre-authorization.
     * - originError: The error that originated the pre-authorization.
     * - createdAt: The timestamp when the pre-authorization was created.
     * - owner: The owner of the pre-authorization.
     * 
     * The returned object is of type PreAuthorizationResponse.
     * 
     * @param data The data to compose the pre-authorization response from.
     * @returns The composed pre-authorization response object.
     */
    private composePreAuthorization(data: any): PreAuthorizationResponse {
        return ( {
            transactionId: data?.transactionId ?? null,
            initialAmount: data?.initialAmount,
            amount: {
                currency: data.currency,
                value: data.reservedAmount
            },
            paymentMethodId: data?.paymentMethodId ?? null,
            adyenReference: data?.pspReference ?? null,
            userId: data.userId,
            success: data.success,
            active: data.active,
            adyenPspReferenceUpdated: [],
            blobPreAuthorization: data?.additionalData?.adjustAuthorisationData ?? data?.additionalData?.blobPreAuthorization ?? null,
            status: data?.status ?? data?.error?.statusCode ?? null,
            sessionId: data?.sessionId ?? null,
            sessionIdInternal: data?.sessionIdInternal ?? null,
            hwId: data?.hwId ?? null,
            error: {
                refusalReason: data?.refusalReason ?? null,
                refusalReasonCode: data?.refusalReasonCode ?? null,
                refusalStatusCode: data?.refusalStatusCode ?? null,
                originError: data.error ?? null,            
                adyenReference: data.error?.pspReference ?? null,
                errorAt: new Date()
            },            
            createdAt: new Date(),
            owner: data.owner
        } as any);
    }

    /**
     * Inserts a pre-authorization document in the database.
     *
     * @param {any} data - The data to be inserted in the database.
     * @return {Promise<{ success: boolean; errorType?: string; insertedId?: string; }>} - A promise that resolves to an object with the following properties:
     * - success: a boolean indicating if the insertion was successful.
     * - errorType: a string indicating the error type if the insertion failed.
     * - insertedId: a string indicating the id of the inserted document if the insertion was successful.
     */
    private async preAuthorizationCreateDocumentDB(data: any): Promise<{ success: boolean; errorType?: string; insertedId?: string; }>{
        const created = await this.PreAuthorizationRepository.insert(data)
        if (!created) {
            return { success: false, errorType: 'not-created' }
        }
    
        return {success:true, insertedId: created}

    }

    /**
     * Calculates the amount to pre-authorize based on various parameters.
     *
     * @param totalCostInclVat - The total cost including VAT.
     * @param simulationAmount - The additional simulation amount to consider.
     * @param currentPreAuthorization - The current amount that has been pre-authorized.
     * @param elapsed - The elapsed time or interval to round to.
     * @param maxAmountPreAuthorization - The maximum allowable amount for pre-authorization.
     * @returns The calculated amount to pre-authorize, ensuring it does not exceed the maximum allowed.
     */
    formulaToCalculateAmountToPreAuth(totalCostInclVat: number, simulationAmount: number, currentPreAuthorization: number, elapsed: number, maxAmountPreAuthorization: number) {
        console.log(`[Function] FormulaToCalculateAmountToPreAuth, totalCostInclVat: ${totalCostInclVat}, simulationAmount: ${simulationAmount}, currentPreAuthorization: ${currentPreAuthorization}, elapsed: ${elapsed}, maxAmountPreAuthorization: ${maxAmountPreAuthorization}`);
          // Step 1: Calculate simulation time
        const simulationTime = totalCostInclVat + simulationAmount;
        
        // Step 2: Find maximum between current captivation and simulation time
        const maxValue = Math.max(simulationTime, currentPreAuthorization);
        
        // Step 3: Round to nearest elapsed
        const roundedValue = Math.ceil(maxValue / elapsed) * elapsed;
        
        // Step 4: Ensure result doesn't exceed maxAmountPreAuthorization
        const value =  Math.min(maxAmountPreAuthorization, roundedValue);
        console.log(`[Function] FormulaToCalculateAmountToPreAuth, value: ${value}`);
        return value;
    }

}