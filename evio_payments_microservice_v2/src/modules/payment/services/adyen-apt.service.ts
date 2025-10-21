import { Injectable, Logger } from '@nestjs/common'
import { AdyenAdapter } from '../adapters/adyen.adapter'
import { AdjustPreAuthorisationDto } from '../dto/ajust-pre-authorisation.dto'
import { AptPreAuthorisationDto } from '../dto/apt-pre-authorisation.dto'
import { IAptPreAuthoriseResponse, IPaymentInstrumentData } from '../interfaces/apt-pre-authorise-response.interface'
import { parse } from 'querystring'
import { PreAuthorizationRepository } from 'src/paymentsAdyen/repositories/preauthorization.repository'
import { IAdjustPreAuthoriseResponse } from '../interfaces/adjust-pre-authorise-response.interface'
import { CaptureDto } from '../dto/capture.dto'
import { ICaptureResponse } from '../interfaces/capture-response.interface'
import { PaymentsRepository } from 'src/paymentsAdyen/repositories/payment.repository'
import { TransactionsRepository } from 'src/paymentsAdyen/repositories/transations.repository '
import { PaymentStatusEnum } from '../enums/payment-status.enum'
import { TransactionStatusEnum } from '../enums/transaction-status.enum'
import { AptIdentifyUserDto } from '../dto/apt-identify-user.dto'
import { CancelPreAuthorisationDto } from '../dto/cancel-pre-authorisation.dto'
import { ICancelAuthoriseResponse } from '../interfaces/cancel-authorise-response'
import { AdyenResponse } from '../enums/adyen-responses.enum'
import { ConfigService } from '@nestjs/config'
import { createHash } from 'crypto'
import { mapExpireDays } from '../helpers/preauthorisation.helper'

@Injectable()
export default class AdyenAptService {
  private readonly logger = new Logger(AdyenAptService.name)
  private readonly preAuthExpiration

  constructor(
    private readonly adyenAdapter: AdyenAdapter,
    private readonly preAuthorizationRepository: PreAuthorizationRepository,
    private readonly paymentRepository: PaymentsRepository,
    private readonly transactionRepository: TransactionsRepository,
    private readonly configService: ConfigService
  ) {
    this.preAuthExpiration = this.configService.get('payment.apt.preAuthExpiration')
  }

  async preAuthoriseApt(body: AptPreAuthorisationDto): Promise<any> {
    try {
      const response: IAptPreAuthoriseResponse = await this.adyenAdapter.preAuthoriseApt(body)

      const additionalDataEncoded = response?.SaleToPOIResponse?.PaymentResponse?.Response?.AdditionalResponse
      const additionalData = additionalDataEncoded ? parse(additionalDataEncoded) : undefined

      if (response?.SaleToPOIResponse?.PaymentResponse?.Response?.Result !== 'Success') {
        this.logger.error('Pre-authorization failed', response)
        throw new Error(additionalData?.acquirerResponseCode?.toString() ?? 'Pre-authorization failed')
      }

      const preAuth = await this.createPreAuthorization(body.merchantReference, response)

      return { ...response, ...preAuth }
    } catch (error) {
      this.logger.error('Error in preAuthoriseApt:', error)
      throw error
    }
  }

  async updatePreAuthorisationApt(body: AdjustPreAuthorisationDto): Promise<any> {
    try {
      const preAuthorisation = await this.findActivePreAuthorisation(body.originalReference, body.merchantReference)

      if (!preAuthorisation) {
        this.logger.error('Pre-authorization not found or inactive', {
          originalReference: body.originalReference,
          merchantReference: body.merchantReference,
        })
        throw new Error('Pre-authorization not found or inactive')
      }

      const response: IAdjustPreAuthoriseResponse = await this.adyenAdapter.updatePreAuthorisationApt(body)

      if (response?.response !== 'Authorised') {
        this.logger.error('Update pre-authorization failed', response)
        throw new Error('Update pre-authorization failed')
      }

      const preAuthExpireDate = new Date()
      preAuthExpireDate.setDate(preAuthExpireDate.getDate() + mapExpireDays(this.preAuthExpiration, preAuthorisation.paymentMethodVariant))

      const query = {
        adyenReference: body.originalReference,
        transactionId: body.merchantReference,
      }

      const updateFields = {
        amount: { value: body.amount, currency: body.currency },
        blobPreAuthorization: response?.additionalData?.adjustAuthorisationData,
        expireDate: preAuthExpireDate,
      }

      await this.preAuthorizationRepository.updateByReferenceId(query, updateFields)

      return response
    } catch (error) {
      this.logger.error('Error in updatePreAuthorisationApt:', error)
      throw error
    }
  }

  async cancelPreAuthorisationApt(body: CancelPreAuthorisationDto): Promise<any> {
    try {
      const preAuthorisation = await this.findActivePreAuthorisation(body.originalReference, body.merchantReference)

      if (!preAuthorisation) {
        this.logger.error('Pre-authorization not found or inactive', {
          originalReference: body.originalReference,
          merchantReference: body.merchantReference,
        })
        throw new Error('Pre-authorization not found or inactive')
      }

      const response: ICancelAuthoriseResponse = await this.adyenAdapter.cancelPreAuthorisation(body)

      if (response?.response !== AdyenResponse.CANCEL_RECEIVED) {
        this.logger.error('Cancel pre-authorization failed', response)
        throw new Error('Cancel pre-authorization failed')
      }

      await this.preAuthorizationRepository.updateByReferenceId(
        { adyenReference: body.originalReference, transactionId: body.merchantReference },
        { active: false, status_reason: body.statusReason }
      )

      return response
    } catch (error) {
      this.logger.error('Error in cancelPreAuthorisationApt:', error)
      throw error
    }
  }

  async capture(body: CaptureDto): Promise<any> {
    try {
      const preAuthorisation = await this.findActivePreAuthorisation(body.originalReference, body.merchantReference)

      if (!preAuthorisation) {
        this.logger.error('Pre-authorization not found or inactive', {
          originalReference: body.originalReference,
          merchantReference: body.merchantReference,
        })
        throw new Error('Pre-authorization not found or inactive')
      }

      const response: ICaptureResponse = await this.adyenAdapter.capture(body)

      if (response?.response !== AdyenResponse.CAPTURE_RECEIVED) {
        this.logger.error('Capture failed', response)
        throw new Error('Capture failed')
      }

      const amount = {
        value: body.amount,
        currency: body.currency,
      }

      const payment = await this.createPayment(preAuthorisation, amount, response)
      const transaction = await this.createTransaction(preAuthorisation, amount, response, payment)
      await this.updatePreAuthorizationStatus(body.originalReference, body.merchantReference, response?.pspReference, payment.data, transaction.data)

      return response
    } catch (error) {
      this.logger.error('Error in capture:', error)
      throw error
    }
  }

  async identify(body: AptIdentifyUserDto): Promise<any> {
    const response = await this.adyenAdapter.identifyUserApt(body)
    return { userCardHash: this.createCardUserHash(response?.SaleToPOIResponse?.CardAcquisitionResponse?.PaymentInstrumentData) }
  }

  private updatePreAuthorizationStatus(
    adyenReference: string,
    transactionId: string,
    pspReference: string,
    paymentData: any,
    transactionData: any
  ): Promise<boolean> {
    return this.preAuthorizationRepository.updateByReferenceId(
      { adyenReference, transactionId },
      { active: false, adyenPspReferenceUpdated: pspReference, paymentData, transactionData }
    )
  }

  private async createPreAuthorization(transactionId, response): Promise<any> {
    const additionalDataEncoded = response?.SaleToPOIResponse?.PaymentResponse?.Response?.AdditionalResponse
    const additionalData = additionalDataEncoded ? parse(additionalDataEncoded) : undefined

    const preAuthExpireDate = new Date()
    preAuthExpireDate.setDate(preAuthExpireDate.getDate() + mapExpireDays(this.preAuthExpiration, additionalData.paymentMethod))

    const userCardHash = this.createCardUserHash(response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.PaymentInstrumentData)

    const preAuthObject = {
      transactionId: transactionId,
      initialAmount: response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.AmountsResp?.AuthorizedAmount,
      amount: {
        currency: response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.AmountsResp?.Currency,
        value: response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.AmountsResp?.AuthorizedAmount,
      },
      paymentMethodId: null,
      adyenReference: response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.PaymentAcquirerData?.AcquirerTransactionID?.TransactionID,
      userId: null,
      userCardHash,
      success: true,
      active: true,
      adyenPspReferenceUpdated:
        response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.PaymentAcquirerData?.AcquirerTransactionID?.TransactionID,
      blobPreAuthorization: additionalData?.adjustAuthorisationData,
      sessionId: null,
      createdAt: response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.PaymentAcquirerData?.AcquirerTransactionID?.TimeStamp,
      paymentInstrumentData: response?.SaleToPOIResponse?.PaymentResponse?.PaymentResult?.PaymentInstrumentData, //newField for APT to identify adhoc user
      paymentMethodVariant: additionalData.paymentMethod,
      expireDate: preAuthExpireDate,
    }

    const preAuthorisationId = await this.preAuthorizationRepository.insert(preAuthObject)

    return Promise.resolve({ preAuthorisationId, userCardHash })
  }

  private async createPayment(preAuthorisation, amount, adyenResponse): Promise<any> {
    const paymentObject = {
      amount: amount,
      listOfSessions: [],
      paymentType: 'AD_HOC',
      syncToHistory: false,
      userId: preAuthorisation.userId,
      sessionId: preAuthorisation.sessionIdInternal,
      hwId: preAuthorisation.hwId,
      chargerType: preAuthorisation.chargerType,
      paymentMethod: 'Card',
      paymentMethodId: preAuthorisation.paymentMethodId,
      adyenReference: preAuthorisation.adyenReference,
      reservedAmount: amount.value,
      clientName: 'EVIO',
      listOfSessionsMonthly: [],
      listOfHwIdPeriodic: [],
      status: PaymentStatusEnum.InPayment,
      createdAt: new Date(),
      updatedAt: new Date(),
      paymentAdyenId: adyenResponse.pspReference,
      dataReceived: adyenResponse,
      reason: 'Payment captured on session stop',
    }

    const paymentId = await this.paymentRepository.insert(paymentObject)

    const paymentData = {
      success: true,
      id: paymentId,
      amount: amount.value,
      createdAt: new Date(),
    }

    return Promise.resolve({ paymentId, data: paymentData })
  }

  private async createTransaction(preAuthorization, amount, adyenResponse, paymentId): Promise<any> {
    const transactionObject = {
      userId: preAuthorization.userId,
      transactionType: 'debit',
      status: TransactionStatusEnum.InPayment,
      provider: 'Card',
      amount: amount,
      sessionId: preAuthorization.sessionId,
      paymentId: paymentId.paymentId,
      addBalanceToWallet: false,
      clientName: 'EVIO',
      createdAt: new Date(),
      updatedAt: new Date(),
      dataReceived: adyenResponse,
    }

    const transactionId = await this.transactionRepository.insert(transactionObject)

    let transactionData = {
      success: true,
      id: transactionId,
      amount: amount.value,
      createdAt: new Date(),
    }

    return Promise.resolve({ transactionId, data: transactionData })
  }

  private findActivePreAuthorisation(adyenReference: string, transactionId: string): Promise<any> {
    return this.preAuthorizationRepository.findOne({ adyenReference, transactionId, active: true })
  }

  private createCardUserHash(paymentInstrumentData: IPaymentInstrumentData): string {
    this.logger.debug(`Creating card user hash for payment instrument data: ${JSON.stringify(paymentInstrumentData)}`)
    const cardData = paymentInstrumentData?.CardData
    const CardCountryCode = cardData?.CardCountryCode?.trim().toUpperCase() ?? ''
    const MaskedPan = cardData?.MaskedPan?.replace(/\D/g, '') ?? ''
    const PaymentBrand = cardData?.PaymentBrand?.trim().toUpperCase() ?? ''
    const ExpiryDate = cardData?.SensitiveCardData?.ExpiryDate?.trim() ?? ''

    const ref = `${CardCountryCode}|${MaskedPan}|${PaymentBrand}|${ExpiryDate}`
    return createHash('sha1').update(ref).digest('hex')
  }
}
