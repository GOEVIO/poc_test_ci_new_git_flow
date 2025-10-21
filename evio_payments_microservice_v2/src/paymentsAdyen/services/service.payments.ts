import { Injectable } from "@nestjs/common";
import adyenLibrary from "evio-library-adyen";
import paymentLibrary from "evio-library-payments";
import { ErrorHandlerCommon } from "src/common/error.handler.common";
import { generate } from "short-uuid";
// ConfigService
import { ConfigService } from '@nestjs/config'

// Services
import { PaymentsMethodService } from './service.payment.method';
import { PreAuthorizationService } from './service.preauthorization';

// Repositories
import { TransactionsRepository } from '../repositories/transations.repository ';
import { PaymentsRepository } from '../repositories/payment.repository';
import { PreAuthorizationRepository } from "../repositories/preauthorization.repository";

@Injectable()
export class PaymentsService {
    
    constructor(
        private readonly PreAuthorizationRepository: PreAuthorizationRepository,
        private readonly PaymentsRepository: PaymentsRepository,
        private readonly TransactionsRepository: TransactionsRepository,
        private readonly PreAuthorizationService: PreAuthorizationService,
        private readonly ConfigService: ConfigService,
    ) {}


    async makePaymentAuthorised(body: any, amount: number, origin: string): Promise<any> {
        const context = 'makePaymentAuthorised';
        let id = null;
        console.log(`[${context}] Starting payment authorization for sessionIdInternal=${body.sessionIdInternal}, userId=${body.userId}`);

        try {
            // create payments
            id = await this.PreAuthorizationRepository.insert({active:true, success:false, sessionIdInternal:body.sessionIdInternal, createdAt: new Date(), userId: body.userId});

            // We make this promise to avoid having to deal with more than one request at a time if we receive them very close together.
            const response =  await new Promise((resolve, reject)=>{
                setTimeout(async () => {
                    try {
                    const reservations = await paymentLibrary.retrieveAllReservationAmountBySessionId(body.sessionIdInternal);

                    if(reservations.length > 1 && reservations[0]._id !== id){
                        await this.PreAuthorizationRepository.delete(id);
                        return resolve(ErrorHandlerCommon.invalid('not-cancelled', 'Duplicated transaction', 'not-cancelled'));
                    }
                    // retrieve the payment method config for a determined user
                    const paymentMethod =  await PaymentsMethodService.retrievePaymentMethodByUserIdwithConfigs(body.userId);
                    if(!paymentMethod) {
                        await this.PreAuthorizationRepository.update({active:false, success:false, reason: 'Payment method not found.'}, null, null, id);
                        return reject(ErrorHandlerCommon.invalid('not-cancelled', 'Not was possible to retrieve payment method', 'not-cancelled'))
                    }

                    const transactionId = generate().substring(0, 24);
    
                    let [reservationRequest, adyenReservationRequest] = await Promise.all([
                        this.composeReservationRequest(body, paymentMethod, amount, origin, transactionId, false),
                        this.composeAdyenReservationRequest(body, paymentMethod, amount, transactionId)
                    ]);
    
                    const adyenResponse = await adyenLibrary.payment(adyenReservationRequest);
    
                    if(!adyenResponse) {
                        return reject(ErrorHandlerCommon.invalid('not-cancelled', 'Not was possible to pay preauthorization', 'not-cancelled'))
                    }
    
                    if(adyenResponse.resultCode.toLowerCase().trim() === 'refused'.toLocaleLowerCase().trim()) {
                        await this.PreAuthorizationRepository.update({active:false, success:false, reason: 'Adyen refused.', dataReceived: adyenResponse}, null, null, id);
                        return reject(ErrorHandlerCommon.invalid('server_paymentRefusal_transactionRefused', adyenResponse.additionalData.merchantAdviceCode ?? adyenResponse.refusalReason, 'Payment refused', {
                            data: adyenResponse,
                            reservation: reservationRequest
                        }))
                    }
    
                    reservationRequest = await this.savePaymentAndTransactionAndReservation(context, amount, reservationRequest, adyenResponse, body, '40', true, id, false);
                    console.log(`[${context}] Payment authorized and saved successfully`);

                    return resolve(reservationRequest);

                }catch (error){
                    console.error(`[${context}] Error: ${error}`);
                    await this.PreAuthorizationRepository.update({active:false, success:false, reason: error.message ?? 'Error on payment'}, null, null, id);
                    return reject(ErrorHandlerCommon.invalid('not-cancelled', 'Not was possible to pay preauthorization', 'not-cancelled'));
                }             
                }, 500);
            });
            return response;
           
        } catch (error) {
            if(error?.origin?.data){
                error.origin.reservation.active = false;
                error.origin.reservation.success = false;
                await this.savePaymentAndTransactionAndReservation(context, amount, error.origin.reservation, error.origin.data, body, '30', false, id, null);
            }
            console.log(`${context}, thow error: ${error}`);
            throw error;
        }
    }

    async topUpPaymentAuthorised(body: any, amount: number, origin: string): Promise<any> {
        const context = 'topUpPaymentAuthorised';
        try {
            // retrieve the payment method config for a determined user
            const paymentMethod =  await PaymentsMethodService.retrievePaymentMethodByUserIdwithConfigs(body.userId);
            if(!paymentMethod) {
                throw ErrorHandlerCommon.invalid('not-cancelled', "Not was possible to retrieve payment method Or user don't have one", 'not-cancelled');
            }
            const transactionId = generate().substring(0, 24);

            let [reservationRequest, adyenReservationRequest] = await Promise.all([
                this.composeReservationRequest(body, paymentMethod, amount, origin, transactionId, true),
                this.composeAdyenReservationRequest(body, paymentMethod, amount, transactionId)
            ]);

            const adyenResponse = await adyenLibrary.payment(adyenReservationRequest);

            if(!adyenResponse) {
                throw ErrorHandlerCommon.invalid('not-cancelled', 'Not was possible to topUpPaymentAuthorised', 'not-cancelled')
            }

            if(adyenResponse.resultCode.toLowerCase().trim() === 'refused'.toLocaleLowerCase().trim()) {
                throw (ErrorHandlerCommon.invalid('server_paymentRefusal_transactionRefused', adyenResponse.additionalData.merchantAdviceCode ?? adyenResponse.refusalReason, 'Payment refused', {
                    data: adyenResponse,
                    reservation: reservationRequest
                }))
            }

            reservationRequest = await this.savePaymentAndTransactionAndReservation(context, amount, reservationRequest, adyenResponse, body, '40', true, null, true);
            return (reservationRequest);
        }catch (error) {
            if(error?.origin?.data){
                error.origin.reservation.active = false;
                error.origin.reservation.success = false;
                await this.savePaymentAndTransactionAndReservation(context, amount, error.origin.reservation, error.origin.data, body, '60', false, null);
            }
            console.log(`${context}, thow error: ${error}`);
            throw error;
        }
    }

    async refundPaymentAuthorized(body: any, amount: number, origin: string, reason?: string): Promise<any> {
        const context = 'refundPaymentAuthorized';
        try {
            const request = {
                userId: body.userId,
                currency: body.reservation.amount.currency,
                amount: amount,
                transactionId: generate().substring(0, 24),
                reason: 'RETURN',
                pspreference: body.reservation.adyenReference
            }
            const response = await adyenLibrary.refund(request);

            body.reservation.active = false;
            body.reservation.dataReceivedRefund = response;
            body.reservation.paymentData.push({
                success: true,
                id: body.paymentId,
                createdAt: new Date(),
                amount: amount
            });
            body.reservation.transationData.push({
                success: true,
                id: body.transactionId,
                createdAt: new Date(),
                amount: amount
            })

            body.reservation.updatedAt = new Date();
            body.amountRefunded = amount;
            if(reason) body.reservation.reasonRefund = reason;

            delete body.reservation._id;
            await this.PreAuthorizationRepository.update({data: body.reservation}, null, body.reservation.sessionIdInternal);
            
            return {
                status: '70',
                amount: amount,
                dataRecieved: response
            }
        } catch (error) {
            throw error;
        }
    }

    private async savePaymentAndTransactionAndReservation(context: string, amount:number, reservationRequest: any, adyenResponse: any, body: any, status:string, statusReservation: boolean, id?:string, finalpayment?:boolean) {
    
        let paymentData = {
            success: true,
            id: body.paymentId,
            amount: amount,
            createdAt: new Date()
        }
        let transationData = {
            success: true,
            id: body.transactionId,
            amount: amount,
            createdAt: new Date()
        }
                      

        reservationRequest.adyenReference = adyenResponse.pspReference;
        reservationRequest.dataReceived = adyenResponse;   
        reservationRequest.success = statusReservation;

        if(body.reservation){

            body.reservation.active = false;
            body.reservation.topUpAmount = amount;
            body.reservation.newReservation = {
                createdAt: new Date(),
                adyenReference: reservationRequest.adyenReference,
                amount: amount,
                currency: reservationRequest.amount.currency,
                dataReceived: reservationRequest.dataReceived
            }
            body.reservation.paymentData.push(paymentData)
            body.reservation.transationData.push(transationData)
            body.reservation.success = statusReservation;
            delete body.reservation._id;
            delete body.reservation.createdAt;
            
            await this.PreAuthorizationRepository.update({data: body.reservation}, null, reservationRequest.sessionIdInternal);
            return body.reservation;

        }else{
            
            const paymentRequest = this.composePaymentRequest(reservationRequest, adyenResponse, status, body);
            const paymentResponse = await this.makePayment(paymentRequest);
            
            const transactionRequest = this.composeTransactionRequest(paymentResponse, reservationRequest, adyenResponse, status, body.clientName);
            const transactionResponse = await this.makeTransaction(transactionRequest); 
            paymentData.id = paymentResponse.id;
            reservationRequest.paymentData = [paymentData];
            transationData.id = transactionResponse.id;
            reservationRequest.transationData = [transationData];
            
            await this.PreAuthorizationRepository.update({data: reservationRequest}, null, null, id);            
            return reservationRequest;
        }

       
    }

    async refund (body: any): Promise<any> {
        const context = 'refund';
        const request = {
            userId: body.userId,
            currency: body.currency,
            amount: body.amount,
            transactionId: generate().substring(0, 24),
            reason: 'RETURN',
            pspreference: body.adyenReference
        }
        const response = await adyenLibrary.refund(request);
        return response;
    }

    private async makePayment(paymentRequest: any) {
        const created = await this.PaymentsRepository.insert(paymentRequest).catch((err) => { throw err; });
        if (!created) {
            return { success: false, errorType: 'not-created' }
        }
    
        return {success:true, id: created, createdAt: new Date(paymentRequest.createdAt)}
    }
    private async makeTransaction(transactionRequest: any) {
        const created = await this.TransactionsRepository.insert(transactionRequest).catch((err) => { throw err; });
        if (!created) {
            return { success: false, errorType: 'not-created' }
        }
    
        return {success:true, id: created, createdAt: new Date(transactionRequest.createdAt)}
    }
    private composeAdyenReservationRequest(body: any, paymentMethod: any, amount: number, transactionId: string): Object {
        return {
            currency: body.currency,
            amount: amount,
            paymentMethodId: paymentMethod.paymentMethodId,
            shopperReference: body.userId,
            recurringProcessingModel: paymentMethod.recurringProcessingModel,
            reference: transactionId,
            capture: body.capture ?? false
        }
    }
    private composeReservationRequest(data: any, paymentMethod: any, amount: number, origin: string, transactionId: string, finalpayment: boolean): any {
        return {
            transactionId: transactionId,
            initialAmount: amount,
            amount: {
                currency: data.currency,
                value: amount
            },
            paymentMethodId: paymentMethod.paymentMethodId,            
            adyenReference: null,
            userId: data.userId,
            success: false,
            active: finalpayment ? false : true,
            sessionId: data?.sessionId ?? null,
            sessionIdInternal: data?.sessionIdInternal ?? null,
            hwId: data?.hwId ?? null,
            dataReceived: null,            
            createdAt: new Date(),
            owner: origin
        }
    }
    private composeTransactionRequest(paymentResponse: any, reservationRequest: any, adyenResponse: any, status: string, clientName: string) {
        return {
            userId: reservationRequest.userId,
            transactionType: 'debit',
            status: status,
            provider: 'Card',
            amount: reservationRequest.amount,
            sessionId: reservationRequest.sessionIdInternal,
            paymentId: paymentResponse.id,
            addBalanceToWallet: false,
            clientName: clientName,
            createdAt: new Date(),
            updatedAt: new Date(),
            dataReceived: adyenResponse
        };
    }
    private composePaymentRequest(reservationRequest: any, adyenResponse: any, status: string, body: any) {
        return {
            amount: reservationRequest.amount,
            listOfSessions: [],
            paymentType: 'AD_HOC',
            syncToHistory: false,
            userId: reservationRequest.userId,
            sessionId: reservationRequest.sessionIdInternal,
            hwId: reservationRequest.hwId,
            chargerType: body.chargerType,
            paymentMethod: 'Card',
            paymentMethodId: reservationRequest.paymentMethodId,
            adyenReference:'-1',
            reservedAmount: body.reservedAmount,
            clientName: body.clientName,
            listOfSessionsMonthly: [],
            listOfHwIdPeriodic: [],
            status: status,
            createdAt: new Date(),
            updatedAt: new Date(),
            paymentAdyenId: adyenResponse.pspReference,
            dataReceived: adyenResponse,
            reason: 'Payment reserved on start session'
        }

    }
    async getPaymentBySessionId(sessionId: string): Promise<any> {
        return paymentLibrary.findPaymentBySessionId(sessionId);
    }
    async releasePreAuthorizationSession(sessionId: string, sessionIdInternal: string, chargerType: string, sessionStatus: string): Promise<boolean> {
        const context = 'releasePreAuthorizationSession'
        try {
          const preAuthorizationRefusalCodes = this.ConfigService.get<any>('PreAuthorizationRefusalCodes')
          const adyenSalvadorCaetano = this.ConfigService.get<any>('AdyenSalvadorCaetano')
          const adyenEVIO = this.ConfigService.get<any>('AdyenEVIO')
          const ChargingSession = this.ConfigService.get<any>('ChargingSession')

          const [preAuthorization, payment] = await Promise.all([
            this.PreAuthorizationService.retrieveReservationBySessionId(sessionId),
            this.getPaymentBySessionId(sessionIdInternal),
          ])
    
          if (!preAuthorization || !preAuthorization.active || payment.transactionType == 'refund') return true
    
          const request = {
            merchantAccount:
              payment.clientName === process.env.clientNameSC || payment.clientName === process.env.clientNameHyundai
                ? adyenSalvadorCaetano.adyenMerchantAccountSC
                : adyenEVIO.AdyenMerchantAccount,
            reservation: preAuthorization,
            userId: preAuthorization.userId,
            amount: preAuthorization.amount.value,
            transactionId: payment.transactionId,
            paymentId: payment._id,
          }
          const refundData = await this.refundPaymentAuthorized(
            request,
            preAuthorization.amount.value,
            null,
            preAuthorizationRefusalCodes.suspendSession
          )
          
          const { _id, ...paymentsWithoutId } = payment
          // creates new payment and transaction
          const newPaymentId = await this.PaymentsRepository.insert({
            ...paymentsWithoutId,
            amount: {
              currency: 'EUR',
              value: preAuthorization.amount.value,
            },
            syncToHistory: false,
            status: '70',
            reason: sessionStatus === ChargingSession?.status?.invalid ? preAuthorizationRefusalCodes.invalid : preAuthorizationRefusalCodes.suspendSession,
            transactionType: 'refund',
            refundData: refundData,
            updatedAt: new Date(),
            createdAt: new Date(),
            amountRefund: preAuthorization.amount.value,
            amountToUp: 0,
          })

          await this.TransactionsRepository.insert({
            amount: {
              currency: 'EUR',
              value: preAuthorization.amount.value,
            },
            listOfSessions: paymentsWithoutId.listOfSessions,
            addBalanceToWallet: false,
            clientName: payment.clientName,
            userId: payment.userId,
            transactionType: 'refund',
            status: '70',
            provider: 'Card',
            sessionId: payment.sessionId,
            paymentId: newPaymentId,
            listOfSessionsMonthly: paymentsWithoutId.listOfSessionsMonthly,
            reasonRefund: preAuthorizationRefusalCodes.suspendSession,
            refundData: refundData,
            createdAt: new Date(),
            updatedAt: new Date(),
            amountRefund: preAuthorization.amount.value,
            amountToUp: 0,
          })

          return  true ;
        } catch (error) {
          console.error(`${context} Error - `, error.message)
          return false
        }
      }
}