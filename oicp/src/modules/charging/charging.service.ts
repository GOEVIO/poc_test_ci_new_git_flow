import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigType } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { HttpConstants } from '@/constants'
import {
  ChargerNetworks,
  EVSEStatuses,
  OcpiSessionStatus,
  OicpAuthorizationStatusType,
  TokenTypes,
  TokenStatus,
  alpha2CountryMapper,
} from 'evio-library-commons'
import CommonsLibrary from 'evio-library-commons'
import libraryIdentity from 'evio-library-identity'
import { ChargingSessionReadRepository as ChargingSessionRepository } from 'evio-library-ocpi'
import {
  findPublicChargerByEvseId,
  getChargerToValidatePayments,
} from 'evio-library-chargers'
import libraryTariffs from 'evio-library-tariffs'
import ConfigsLibrary from 'evio-library-configs'
import { findEvAndFleetById } from 'evio-library-evs'
import { LogsService } from '../../logs/logs.service'
import { EvseService } from '../evse/evse.service'
import { SubscriptionService } from '../subscription/subscription.service'
import {
  RemoteResponseDto,
  RemoteResultDto,
  RemoteStartDto,
  RemoteStopDto,
} from './dto/charging.dto'
import {
  oicp as oicpConfiguration,
  serviceUrl as serviceUrlConfiguration,
} from '../../config/'
import { AxiosResponse } from 'axios'
import pauseInSeconds from '@/helpers/pause'
import { isEmptyObject } from '@/helpers/object'
import {
  IdentificationDto,
  PhysicalStartDto,
  PhysicalStartResponseDto,
  PhysicalStopDto,
} from './dto/physical-charging.dto'
import { parseChargingSession } from '@/helpers/parseChargingSession'
import { instanceToPlain, plainToInstance } from 'class-transformer'
import { ReceiveCdrService } from '../cdr/services/receive-cdr.service'
import { ICharger } from '../evse/evse.interface'
import {
  IContractNetwork,
  IEV,
  IListOfGroupDrivers,
  IEvInfo,
  IFees,
  IFee,
  IUserInfo,
  IAllUserInfo,
} from '../charging/interfaces/charging.interface'
import { ChargingNotificationService } from './notification.service'
import toggle from 'evio-toggle'
import axios from 'axios'

@Injectable()
export class ChargingService {
  constructor(
    private readonly logger: LogsService,
    private readonly evseService: EvseService,
    private readonly subscriptionService: SubscriptionService,
    private readonly receiveCdrService: ReceiveCdrService,
    private readonly httpService: HttpService,
    private readonly chargingNotificationService: ChargingNotificationService,
    @Inject(oicpConfiguration.KEY)
    private oicpConfig: ConfigType<typeof oicpConfiguration>,
    @Inject(serviceUrlConfiguration.KEY)
    private serviceUrlConfig: ConfigType<typeof serviceUrlConfiguration>,
    @Inject(HttpConstants.PLAIN_HTTP) private readonly plainHttp: HttpService,
  ) {
    this.logger.setContext(ChargingService.name)
  }

  async remoteStartSession({
    sessionId,
    evseId,
    contractId,
  }: RemoteStartDto): Promise<RemoteResponseDto> {
    try {
      this.logger.log('remoteStartSession', sessionId, evseId, contractId)

      const identification: any = {
        RemoteIdentification: {
          EvcoID: contractId,
        },
      }

      const contract = await libraryIdentity.findContract(
        {
          'contractIdInternationalNetwork.tokens.contract_id': contractId,
          active: true,
        },
        { networks: 1 },
      )

      if (!contract) {
        this.logger.log(`Contract ${contractId} not found`)
        return {
          success: false,
          data: { code: '210', description: 'Contract not found' },
        }
      }

      if (contract.networks[2]?.tokens[1]?.active) {
        identification.RfidMifareFamilyIdentification = {
          Uid: contract.networks[2].tokens[1]?.idTagHexa,
        }
      }

      void this.checkChargingSession(evseId, sessionId, EVSEStatuses.Charging)

      const hubjectResponse: AxiosResponse<RemoteResultDto> =
        await firstValueFrom(
          this.httpService.post(
            this.oicpConfig.endpoints.charging.remoteStart,
            {
              ProviderID: this.oicpConfig.providerId,
              EvseID: evseId,
              Identification: identification,
            },
          ),
        )

      const response = plainToInstance(RemoteResultDto, hubjectResponse.data)

      const success = !!(
        response.sessionId && response.statusCode.code === '000'
      )
      const data = response.statusCode
      const externalSessionId = response.sessionId

      if (success) {
        void this.checkChargingSession(
          evseId,
          externalSessionId as string,
          EVSEStatuses.Charging,
        )
      }

      this.logger.log({ externalSessionId, success, data })
      return {
        success,
        data,
        sessionId: externalSessionId,
      }
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  async startSession({
    evseId,
    identification,
    operatorId,
    sessionId,
    partnerProductId,
  }: PhysicalStartDto): Promise<PhysicalStartResponseDto> {
    const context = '[Start Session]'

    try {
      const rfidToken =
        identification?.rfidIdentification?.uid ??
        identification?.rfidMifareFamilyIdentification?.uid

      if (!operatorId || !rfidToken) {
        this.logger.log(`${context} - Missing Mandatory fields`)
        return this.authorizationResponse(false, '022')
      }

      if (sessionId) {
      // Check if session is already completed and return success without change anything
        const completed = await this.chargingNotificationService.sessionIsCompleted(sessionId);
        if (completed) return this.authorizationResponse(true, '000');
      }
      const subscription = await this.subscriptionService.findByOperatorId(
        operatorId,
        true,
      )
      if (!subscription?.active) {
        return this.authorizationResponse(false, '210')
      }

      const charger: ICharger =
        (evseId &&
        (await findPublicChargerByEvseId(evseId, ChargerNetworks.Hubject, {
          hwId: 1,
          chargerType: 1,
          countryCode: 1,
          address: 1,
          operator: 1,
          'plugs.plugId': 1,
          'plugs.evse_id': 1,
          'plugs.power': 1,
          'plugs.voltage': 1,
        }))) || undefined

      if (
        charger &&
        !this.evseService.isValidCountry(
          alpha2CountryMapper[charger.countryCode]?.countryCode,
        )
      ) {
        return this.authorizationResponse(false, '210')
      }

      /**
       * Currently the payments validations depends on the existence of a charger, but it doesn't matter which one.
       * If there's no evseId we can simple send a random charger from Hubject.
       * This is not elegant. It is what it is. :)
       */
      const defaultCharger = !charger
        ? await getChargerToValidatePayments(ChargerNetworks.Hubject)
        : charger


      const { hwId, plugId, chargerType, countryCode, zipCode, plugPower } = this.extractChargerData(charger, defaultCharger, evseId)

      const contract = await libraryIdentity.findContractByIdTag(rfidToken)
      
      // The contract network of Hubject is actually the same as Gireve, so we use the Gireve network
      if (
        !contract ||
        !this.isNetworkActive(
          contract.networks,
          ChargerNetworks.Gireve,
          TokenTypes.RFID,
        )
      ) {
        this.logger.log(`${context} -  ${rfidToken} - Contract not found`)
        return this.authorizationResponse(false, '210')
      }

      const evInfo = await this.getEvInfo(contract.evId, contract.userId)

      const user = await libraryIdentity.findUserById(contract.userId as string)

      if (!user.active || user.blocked) {
        this.logger.log(`${context} - Inactive user ${contract.userId} `)
        return this.authorizationResponse(false, '210')
      }

      const fee = (await ConfigsLibrary.getFees(countryCode, zipCode)) as IFee

      const paymentConditions = await this.validatePaymentConditions(
        evInfo.userId,
        contract.evId,
        hwId,
        plugId,
        chargerType,
        fee.fees,
        rfidToken,
      )

      if (!paymentConditions.valid) {
        this.logger.log(
          `${context} - Invalid payment conditions for user ${evInfo.userId}`,
        )
        return this.authorizationResponse(false, '210')
      }

      const opcTariff = await this.receiveCdrService.getTariff(
        partnerProductId,
        operatorId,
        evInfo.evOwner !== "-1" ? evInfo.evOwner : evInfo.userId,
        countryCode,
        plugPower
      )

      const chargingSessionData = parseChargingSession(
        evseId ?? '',
        sessionId ?? '',
        rfidToken,
        user,
        contract,
        charger,
        TokenTypes.RFID,
        opcTariff,
        charger && fee.fees,
        operatorId,
        evInfo,
      )

      await this.extractPaymentConditionsData(
        chargingSessionData,
        paymentConditions.data,
      )

      const success =
        await ChargingSessionRepository.insertSession(chargingSessionData)

      if (success) {
        const identifications = this.parseContractTags(contract)
        if (evseId) {
          void this.checkChargingSession(
            evseId,
            sessionId as string,
            EVSEStatuses.Charging,
          )
        }
        const response = this.authorizationResponse(true, '000', '', [
          identifications,
        ])
        response.sessionId = sessionId
        this.logger.log(`Physical Session ${sessionId}:`, response)
        return response
      }

      return this.authorizationResponse(false, '021')
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  async remoteStopSession({
    sessionId,
    evseId,
  }: RemoteStopDto): Promise<RemoteResponseDto> {
    try {
      const hubjectResponse: AxiosResponse<RemoteResultDto> =
        await firstValueFrom(
          this.httpService.post(this.oicpConfig.endpoints.charging.remoteStop, {
            ProviderID: this.oicpConfig.providerId,
            SessionID: sessionId,
            EvseID: evseId,
          }),
        )
      const response = plainToInstance(RemoteResultDto, hubjectResponse.data)
      const data = response.statusCode
      const success = !!(response.sessionId && data.code === '000')

      if (success) {
        this.logger.log('Successfully stopped session', sessionId, evseId)
        void this.checkChargingSession(
          evseId,
          sessionId,
          EVSEStatuses.Available,
        )
      }

      this.logger.log({ sessionId, success, data })
      return { success, data }
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  async stopSession({
    evseId,
    sessionId,
  }: PhysicalStopDto): Promise<PhysicalStartResponseDto> {
    const context = '[Start Session]'
    try {
      if (!evseId || !sessionId) {
        this.logger.log(`${context} - Missing Mandatory fields`)
        return this.authorizationResponse(false, '022')
      }

      const success = await ChargingSessionRepository.updateSessionByExternalId(
        sessionId,
        {
          status: OcpiSessionStatus.SessionStatusStopped,
        },
      )

      if (success) {
        void this.checkChargingSession(
          evseId,
          sessionId,
          EVSEStatuses.Available,
        )
        return this.authorizationResponse(true, '000')
      }

      return this.authorizationResponse(false, '021')
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  async checkChargingSession(
    evseId: string,
    sessionId: string,
    expectedStatus: EVSEStatuses,
    retriesLeft: number = 30,
  ): Promise<void> {


    // Check if session is already completed and skip any further action
    const completed = await this.chargingNotificationService.sessionIsCompleted(sessionId);
    if (completed) return;

    const evseStatus = (await this.evseService.getEvseStatusById(
      evseId,
    )) as EVSEStatuses

    if (evseStatus === expectedStatus) {
      const status =
        expectedStatus === EVSEStatuses.Available
          ? OcpiSessionStatus.SessionStatusStopped
          : OcpiSessionStatus.SessionStatusRunning
      await ChargingSessionRepository.updateSessionByExternalId(sessionId, {
        status,
      })

      if (status === OcpiSessionStatus.SessionStatusRunning) {
        const [isPreAuthorizationEnable, chargingSession] = await Promise.all([
          toggle.isEnable('bp-401-hubject-preathorization'),
          ChargingSessionRepository.findSessionByExternalId(sessionId) as any,
        ]);
        if (
          isPreAuthorizationEnable &&
          chargingSession &&
          chargingSession?.paymentMethod === 'Card' &&
          !chargingSession?.reservationPay
        ) {
          await this.doPreAuthorization(chargingSession, evseId);
        }
      }
      this.logger.log(
        `Session ${sessionId}: ${evseId} status changed ${status}`,
      )
    } else if (retriesLeft > 0) {
      this.logger.log(
        `checkCharger: ${evseId} status: ${evseStatus}/${expectedStatus}`,
      )
      await pauseInSeconds(4)
      await this.checkChargingSession(
        evseId,
        sessionId,
        expectedStatus,
        retriesLeft - 1,
      )
    } else if (evseStatus === EVSEStatuses.Available) {
      await ChargingSessionRepository.updateSessionByExternalId(sessionId, {
        status: OcpiSessionStatus.SessionStatusFailed,
        displayText: { language: 'EN', text: 'TIMEOUT' },
      })
      this.logger.error(`Charging session ${sessionId} not started correctly.`)
    }
  }

  async doPreAuthorization(
    chargingSession: any,
    evseId: string,
  ): Promise<void> {
    console.log(
      `Starting Pre-Authorization process for session id: ${chargingSession.id}`,
    )
    const info = {
      userId: chargingSession.userIdWillPay ?? chargingSession.userId,
      totalCostInclVat: 30, // this is irrelevant for the pre-authorization
      reservedAmount: chargingSession.reservedAmount ?? 30,
      currency: chargingSession.currency ?? 'EUR',
      sessionId: chargingSession.id,
      hwId: chargingSession.location_id,
      sessionIdInternal: chargingSession._id,
      capture: true,
      clientName: chargingSession.clientName,
      chargerType: chargingSession.chargerType,
    }
    const host = `${this.serviceUrlConfig.paymentsV2}/api/private/payments/v2/user/${chargingSession.userId}/reservation`
    await axios.post(host, info).catch(async (error) => {
      this.logger.error(
        `Pre-Authorization failed for session ${chargingSession.id}: ${error.message}`,
      )
      ChargingSessionRepository.updateSessionByExternalId(chargingSession.id, {
        reason: 'SESSION STOP - MISSING PAYMENTS',
        reservationPay: true,
      })
      console.error(
        `Pre-Authorization failed, sending stop to session ${chargingSession.id}: ${error.message ?? error}`,
      )
      await this.remoteStopSession({ sessionId: chargingSession.id, evseId })
    })
  }

  authorizationResponse(
    status: boolean,
    code: string,
    description?: string,
    identifications?: Array<IdentificationDto>,
  ): PhysicalStartResponseDto {
    const response = new PhysicalStartResponseDto()
    response.authorizationStatus =
      OicpAuthorizationStatusType[status ? 'Authorized' : 'NotAuthorized']
    response.statusCode = { code, description }
    if (identifications) {
      response.authorizationStopIdentifications = identifications
    }
    response.providerId = this.oicpConfig.providerId

    return instanceToPlain(response) as PhysicalStartResponseDto
  }

  parseContractTags(contract: any): IdentificationDto {
    const rfidTag = contract.networks[2].tokens[1]?.idTagHexa
    const contractId =
      contract.contractIdInternationalNetwork[0]?.tokens[0]?.contract_id ||
      contract.contract_id

    return {
      remoteIdentification: { evcoId: contractId },
      rfidMifareFamilyIdentification: { uid: rfidTag },
    }
  }

  private isNetworkActive(
    networks: IContractNetwork[],
    targetNetwork: string,
    targetTokenType: string,
  ): boolean {
    return !!networks
      .find((network) => network.network === targetNetwork)
      ?.tokens.find(
        (token) =>
          token.tokenType === targetTokenType &&
          token.status === TokenStatus.Active,
      )
  }

  private getEvDriver(ev: IEV, contractUserId: string) {
    if (!ev) return contractUserId

    const { listOfGroupDrivers = [], listOfDrivers = [], userId } = ev

    if (
      listOfGroupDrivers.length > 0 ||
      listOfDrivers.length > 1 ||
      (listOfGroupDrivers.length === 0 && listOfDrivers.length === 0)
    ) {
      return userId
    }

    return listOfDrivers[0]?.userId || userId || contractUserId
  }

  private async getEvInfo(
    evId: string,
    contractUserId: string,
  ): Promise<IEvInfo> {
    if (!evId || evId === '-1') {
      return this.buildAnonymousEvInfo(contractUserId)
    }

    const { ev, fleet } = await findEvAndFleetById(evId)
    ev && (ev.listOfGroupDrivers = await this.getListOfGroupDrivers(ev))

    return {
      evOwner: ev?.userId ?? '-1',
      invoiceType: ev?.invoiceType ?? '-1',
      invoiceCommunication: ev?.invoiceCommunication ?? '-1',
      evDetails: ev,
      fleetDetails: fleet,
      userId: this.getEvDriver(ev, contractUserId),
    }
  }

  private async getListOfGroupDrivers(ev: IEV) {
    const groupIds = this.extractGroupIds(ev?.listOfGroupDrivers)
    const groupDrivers = await libraryIdentity.findGroupDrivers(groupIds)
    return ev?.listOfGroupDrivers.map(this.findGroupDriverInfo(groupDrivers))
  }

  private extractGroupIds(listOfGroupDrivers: IListOfGroupDrivers[]): string[] {
    return listOfGroupDrivers?.map((groupDriver) => groupDriver.groupId) ?? []
  }

  private findGroupDriverInfo(groupDrivers: IListOfGroupDrivers[]) {
    return (groupDriver: IListOfGroupDrivers) => {
      const { listOfDrivers = [], name = '' } =
        groupDrivers.find((group) => group._id === groupDriver.groupId) ?? {}
      return { ...groupDriver, listOfDrivers, name }
    }
  }

  private buildAnonymousEvInfo(userId: string): IEvInfo {
    return {
      evOwner: '-1',
      invoiceType: '-1',
      invoiceCommunication: '-1',
      evDetails: undefined,
      fleetDetails: undefined,
      userId,
    }
  }

  private async validatePaymentConditions(
    userId: string,
    evId: string = '-1',
    hwId: string,
    plugId: string,
    chargerType: string,
    fees: IFees | undefined,
    idTag: string,
  ): Promise<any> {
    try {
      const data = {
        userId,
        data: {
          hwId,
          plugId,
          evId,
          tariffId: '-1',
          chargerType,
          fees,
          idTag,
        },
      }

      const url = this.serviceUrlConfig.payments
      const response = await firstValueFrom(
        this.plainHttp.request({
          method: 'GET',
          url: `${url}/api/private/payments/validatePaymentConditions`,
          data,
        }),
      )

      return { valid: !!response.data, data: response.data }
    } catch (error: any) {
      this.logger.error(JSON.stringify(error?.response?.data || error?.message))
      return {
        valid: false,
      }
    }
  }

  private async extractPaymentConditionsData(session: any, paymentData: any) {
    const { userIdInfo, userIdWillPayInfo, userIdToBillingInfo } =
      await this.getAllUserInfo(
        session.userId,
        paymentData.userIdWillPay,
        paymentData.userIdToBilling,
      )

    session.clientName = paymentData.clientName || userIdWillPayInfo?.clientName
    paymentData.cardNumber && (session.cardNumber = paymentData.cardNumber)

    const tariffCEME =
      paymentData?.ceme?.plan && !isEmptyObject(paymentData?.ceme?.plan)
        ? paymentData?.ceme?.plan
        : await libraryTariffs.getCemeTariffPlan(ChargerNetworks.Hubject)
    tariffCEME.tariff = this.getTariffCemeByDate(
      tariffCEME,
      new Date().toISOString(),
    )

    session.tariffCEME = tariffCEME
    session.userIdInfo = userIdInfo
    session.userIdWillPayInfo = userIdWillPayInfo
    session.userIdToBillingInfo = userIdToBillingInfo
    session.paymentType =
      paymentData.paymentType || userIdWillPayInfo?.paymentPeriod
    session.clientType = paymentData.clientType || userIdWillPayInfo?.clientType
    session.billingPeriod = paymentData.billingPeriod
    session.paymentMethod = paymentData.paymentMethod || 'Unknown'
    session.paymentMethodId = paymentData.paymentMethodId || '-1'
    session.walletAmount = paymentData.walletAmount ?? -1
    session.reservedAmount = paymentData.reservedAmount ?? -1
    session.confirmationAmount = paymentData.confirmationAmount ?? -1
    paymentData.plafondId && (session.plafondId = paymentData.plafondId)
    session.viesVAT = paymentData.viesVAT
    session.userIdWillPay = paymentData.userIdWillPay
    session.userIdToBilling = paymentData.userIdToBilling
    session.adyenReference = paymentData.adyenReference || '-1'
    session.transactionId = paymentData.transactionId || '-1'

    if (session.location_id) {
      const billingProfile =
        (await libraryIdentity.findBillingProfileByUserId(
          paymentData.userIdToBilling,
        )) || {}
      const { billingAddress } = billingProfile
      const userToBillingFees = (await ConfigsLibrary.getFees(
        billingAddress?.countryCode,
        billingAddress?.zipCode,
      )) as IFee
      const { VAT, countryCode } = CommonsLibrary.getVATandContryCode(
        billingProfile,
        session.country_code,
        session.fees.IVA,
        userToBillingFees.fees.IVA,
      )
      session.fees.IVA = VAT
      session.fees.countryCode = countryCode
    }
  }

  private async getAllUserInfo(
    userId: string,
    userIdWillPay: string,
    userIdToBilling: string,
  ): Promise<IAllUserInfo> {
    const query = {
      _id: { $in: [userId, userIdWillPay, userIdToBilling] },
    }
    const fields = {
      mobile: 1,
      internationalPrefix: 1,
      imageContent: 1,
      name: 1,
      language: 1,
      country: 1,
      clientType: 1,
      clientName: 1,
      operatorId: 1,
      paymentPeriod: 1,
    }
    const result = (await libraryIdentity.findUsers(
      query,
      fields,
    )) as IUserInfo[]

    return {
      userIdInfo: this.findUserInArray(result, userId),
      userIdWillPayInfo: this.findUserInArray(result, userIdWillPay),
      userIdToBillingInfo: this.findUserInArray(result, userIdToBilling),
    }
  }

  private findUserInArray(
    users: IUserInfo[],
    userId: string,
  ): IUserInfo | undefined {
    return users.find((elem) => elem._id === userId)
  }
  private getTariffCemeByDate(cemeTariff: any, startDate: string) {
    return (
      cemeTariff?.tariffsHistory?.find(
        (obj) => startDate >= obj.startDate && startDate <= obj.stopDate,
      )?.tariff ?? cemeTariff.tariff
    )
  }

  private extractChargerData(
    charger: ICharger,
    defaultCharger: ICharger,
    evseId: string | undefined,
  ): {
    hwId: string
    plugId: string
    chargerType: string
    countryCode: string
    zipCode: string,
    plugPower: number
  } {
    const hwId = charger?.hwId || defaultCharger.hwId
    const plugId =
      charger?.plugs?.find((plug) => plug.evse_id === evseId)?.plugId ??
      defaultCharger?.plugs[0]?.plugId
    const chargerType = charger?.chargerType || defaultCharger?.chargerType
    const countryCode = charger?.countryCode || defaultCharger?.countryCode
    const zipCode =
      charger?.address?.zipCode || defaultCharger?.address?.zipCode
    const plugPower =
      charger?.plugs?.find((plug) => plug.evse_id === evseId)?.power ??
      defaultCharger?.plugs[0]?.power
    return {
      hwId,
      plugId,
      chargerType,
      countryCode,
      zipCode,
      plugPower,
    }
  }
}
