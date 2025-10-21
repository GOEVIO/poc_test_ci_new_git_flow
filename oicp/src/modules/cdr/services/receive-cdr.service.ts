import { Injectable, Inject } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { HttpConstants } from '@/constants'
import * as timeZoneMoment from 'moment-timezone'
import { LogsService } from '@/logs/logs.service'
import { ReceiveCdrDto, IdentificationDto } from '../dto/receive-cdr.dto'
import { eRoamingAcknowledgementDto } from '@/shared/dto/acknowledgement.dto'
import {
  OicpStatusCodes,
  ChargerNetworks,
  EmspTariffTypes,
  TaxExemptionCode,
  InvoiceLineCode,
  HubjectCommission,
  PaymentStatusSessions,
  MinimumEnergyToBilling,
  PaymentType,
  PaymentsMethods,
  PaymentStatus,
  PaymentSubStatus,
  BillingPeriods,
  ClientNames,
} from 'evio-library-commons'
import CommonsLibrary from 'evio-library-commons'
import libraryIdentity from 'evio-library-identity'
import ConfigsLibrary from 'evio-library-configs'
import {
  IChargingSession,
  ICdr,
  ICdrLocation,
  ICdrToken,
  ITariff,
  IExtractedEmspUnitPrices,
  IEmspTariff,
  IExtractedEmspPrices,
  IInvoiceLine,
  ICpoFinalPrices,
  IEmspFinalPrices,
  IOtherPrice,
  ITotalPriceDetail,
  IFinalPrices,
  IUpdateSessionValues,
  IPaymentData,
  IPaymentsResponse,
  IDimensionsPriceDetail,
  IFleetDetails,
  IEvDetails,
  IUserInfo,
  IAddress,
  IContextData,
  IInvoiceData,
  IFee,
  IFees,
} from '../interfaces/receive-cdr.interface'
import { ICharger, IPlug, IPrice } from '../../evse/evse.interface'
import {
  CdrReadRepository as CdrRepository,
  ChargingSessionReadRepository as ChargingSessionRepository,
  TariffsRepository,
  TariffsService,
  CdrsService,
  SessionsRepository,
} from 'evio-library-ocpi'
import { findPublicChargerByEvseId } from 'evio-library-chargers'
import { acknowledgement } from '@/helpers/acknowledgement'
import {
  durationInMiliseconds,
  milisecondsToHours,
  milisecondsToMinutes,
  milisecondsToSeconds,
} from '@/helpers/timeConversion'
import { round } from '@/helpers/number'
import { sumObjectValues } from '@/helpers/object'
import { getTimezone } from '@/helpers/timezone'
import { sendSessionToHistoryQueue } from '@/helpers/history'
import toggle from 'evio-toggle';
import { sendMessage } from 'evio-event-producer';

@Injectable()
export class ReceiveCdrService {
  constructor(
    private readonly logger: LogsService,
    @Inject(HttpConstants.PLAIN_HTTP) private readonly plainHttp: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(ReceiveCdrService.name)
  }

  public async receiveCdr(
    cdr: ReceiveCdrDto,
    operatorId: string,
  ): Promise<eRoamingAcknowledgementDto> {
    // Check if CDR already exists
    const cdrExists = await this.cdrExists(cdr)
    if (cdrExists) return cdrExists

    // Check if session exists
    const { session, sessionDoesNotExist } = await this.sessionExists(cdr)
    if (sessionDoesNotExist) return sessionDoesNotExist

    // Create CDR
    const { parsedCdr, charger, failedCdrCreation } = await this.createCdr(
      cdr,
      session,
      operatorId || session.party_id,
    )
    if (failedCdrCreation) return failedCdrCreation

    this.payAndInvoice(cdr.evseId, parsedCdr, session, charger)

    return acknowledgement(
      true,
      OicpStatusCodes.Success,
      'CDR created with sucess',
      'CDR received',
      cdr.sessionId,
      cdr.empPartnerSessionId,
      cdr.cpoPartnerSessionId,
    )
  }

  private async cdrExists(
    cdr: ReceiveCdrDto,
  ): Promise<eRoamingAcknowledgementDto | null> {
    const cdrExists = await CdrRepository.findOneBySessionId(cdr.sessionId)
    if (cdrExists) {
      return acknowledgement(
        false,
        OicpStatusCodes.DataError,
        'A CDR already exists with the same SessionID',
        'CDR already exists',
        cdr.sessionId,
        cdr.empPartnerSessionId,
        cdr.cpoPartnerSessionId,
      )
    }
    return null
  }

  private async sessionExists(cdr: ReceiveCdrDto): Promise<{
    session: IChargingSession
    sessionDoesNotExist?: eRoamingAcknowledgementDto
  }> {
    const session = (await ChargingSessionRepository.findSessionByExternalId(
      cdr.sessionId,
    )) as IChargingSession
    if (!session) {
      return {
        sessionDoesNotExist: acknowledgement(
          false,
          OicpStatusCodes.DataError,
          'No session found for given SessionID',
          'Session not found',
          cdr.sessionId,
          cdr.empPartnerSessionId,
          cdr.cpoPartnerSessionId,
        ),
        session,
      }
    }
    return { session }
  }

  private async createCdr(
    cdr: ReceiveCdrDto,
    session: IChargingSession,
    operatorId: string,
  ): Promise<{
    parsedCdr: ICdr
    charger: ICharger
    failedCdrCreation?: eRoamingAcknowledgementDto
  }> {
    const charger = await findPublicChargerByEvseId(cdr.evseId, ChargerNetworks.Hubject)
    const parsedCdr = await this.parseCdr(cdr, session, charger, operatorId)
    const createdCdr = await CdrRepository.insertCdr(parsedCdr)
    if (!createdCdr) {
      return {
        failedCdrCreation: acknowledgement(
          false,
          OicpStatusCodes.SystemError,
          'Error creating CDR',
          'Error creating CDR',
          cdr.sessionId,
          cdr.empPartnerSessionId,
          cdr.cpoPartnerSessionId,
        ),
        parsedCdr,
        charger,
      }
    }
    return { parsedCdr, charger }
  }

  private buildCdrLocation(
    charger: ICharger,
    evseId: string,
  ): ICdrLocation {
    const plug = charger.plugs.find(
      (plug) => plug.evse_id == evseId,
    ) as IPlug
    return {
      id: charger.hwId,
      address: charger.address.street,
      city: charger.address.city,
      country: charger.address.country,
      postal_code: charger.address.zipCode,
      evse_uid: plug.uid,
      evse_id: plug.evse_id,
      connector_id: plug.plugId,
      connector_standard: plug.connectorType,
      connector_format: plug.connectorFormat,
      connector_power_type: plug.connectorPowerType,
      connnector_power: plug.power,
      connector_voltage: plug.voltage,
      connector_amperage: plug.amperage,
      coordinates: {
        latitude: String(charger.geometry.coordinates[1]),
        longitude: String(charger.geometry.coordinates[0]),
      },
    }
  }

  private buildCdrToken(
    session: IChargingSession,
    identification: IdentificationDto,
  ): ICdrToken {
    return {
      uid:
        identification.rfidMifareFamilyIdentification?.uid ??
        identification.rfidIdentification?.uid ??
        session.cdr_token?.uid ??
        session.token_uid,
      type: session.cdr_token?.type ?? session.token_type,
      contract_id:
        identification.remoteIdentification?.evcoId ??
        session.cdr_token?.contract_id,
    }
  }

  private async parseCdr(
    cdr: ReceiveCdrDto,
    session: IChargingSession,
    charger: ICharger,
    operatorId: string,
  ): Promise<ICdr> {
    const {
      sessionStart,
      sessionEnd,
      chargingEnd,
      partnerProductId,
      sessionId,
      consumedEnergy,
      identification,
    } = cdr
    const { country_code, party_id, auth_method, evOwner, userId } = session

    const { totalTime, parkingTime } = this.getCdrDurations(
      sessionStart,
      sessionEnd,
      chargingEnd,
    )
    const cdr_token = this.buildCdrToken(session, identification)
    const cdr_location = this.buildCdrLocation(charger, cdr.evseId)

    const tariff = await this.getTariff(partnerProductId, operatorId, evOwner !== "-1" ? evOwner : userId, country_code, cdr_location.connnector_power)

    return {
      country_code,
      party_id,
      id: sessionId,
      start_date_time: sessionStart,
      end_date_time: sessionEnd,
      session_id: sessionId,
      cdr_token,
      auth_method,
      cdr_location,
      currency: tariff.currency,
      source: ChargerNetworks.Hubject,
      total_energy: consumedEnergy,
      total_time: Number(totalTime),
      total_parking_time: Number(parkingTime),
      last_updated: new Date().toISOString(),
      charging_periods: [],
      tariffs: [tariff],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  public async getTariff(
    partnerProductId: string | undefined,
    operatorId: string,
    userId: string,
    countryCode: string,
    power: number
  ): Promise<ITariff> {
    const tariffId = `${partnerProductId}_${operatorId}`
    const defaultDynamicId = `default_dynamic_${operatorId}`
    return await TariffsService.getCpoTariff(
      tariffId,
      defaultDynamicId,
      userId,
      operatorId,
      countryCode,
      power
    ) as ITariff
  }

  private getCdrDurations(
    sessionStart: string,
    sessionEnd: string,
    chargingEnd: string | null | undefined,
  ): { totalTime: number; parkingTime: number } {
    const totalTimeMs = durationInMiliseconds(sessionStart, sessionEnd)
    const parkingTimeMs = chargingEnd ? durationInMiliseconds(chargingEnd, sessionEnd) : 0

    // Cdr takes durations in hours
    return {
      totalTime: milisecondsToHours(totalTimeMs),
      parkingTime: milisecondsToHours(parkingTimeMs),
    }
  }
  private calculateCpoPrices(
    cdr: ICdr,
    session: IChargingSession,
    charger: ICharger,
  ): Record<string, number> {
    const {
      tariffs,
      start_date_time,
      end_date_time,
      total_energy,
      total_time,
      total_parking_time,
      source,
      country_code,
    } = cdr

    const { timeZone, plugPower, plugVoltage } = session
    const [longitude, latitude] = charger.geometry.coordinates

    const [flat, energy, time, parking] = TariffsService.calculateCpoPrices(
      tariffs[0].elements,
      start_date_time,
      end_date_time,
      timeZone,
      country_code,
      plugPower,
      plugVoltage,
      total_energy,
      total_time,
      total_parking_time,
      source,
      latitude,
      longitude,
    )

    return {
      flat: flat.price,
      energy: energy.price,
      time: time.price,
      parking: parking.price,
    }
  }

  private calculateEmspPrices(
    cdr: ICdr,
    session: IChargingSession,
    cpoPrice: number,
  ): IExtractedEmspPrices {
    const {
      flatUnitPrice,
      energyUnitPrice,
      timeUnitPrice,
      percentageUnitPrice,
    } = this.extractEmspUnitPrices(session.tariffCEME)

    const totalTimeMs = durationInMiliseconds(
      cdr.start_date_time,
      cdr.end_date_time,
    )
    const totalTimeMinutes = milisecondsToMinutes(totalTimeMs)

    const flatEmspPrice = flatUnitPrice * 1
    const energyEmspPrice = energyUnitPrice * cdr.total_energy
    const timeEmspPrice = timeUnitPrice * totalTimeMinutes
    const percentageEmspPrice = percentageUnitPrice * cpoPrice

    return {
      flat: flatEmspPrice,
      energy: energyEmspPrice,
      time: timeEmspPrice,
      emspPercentage: percentageEmspPrice,
      percentageUnitPrice,
    }
  }

  private extractEmspUnitPrices(
    emspTariff: IEmspTariff,
  ): IExtractedEmspUnitPrices {
    const tariffElement = this.findEmspTariffElement(emspTariff)

    const [flat, energy, time, percentage] =
      Object.values(EmspTariffTypes).map(tariffElement)

    return {
      flatUnitPrice: flat?.price ?? 0,
      energyUnitPrice: energy?.price ?? 0,
      timeUnitPrice: time?.price ?? 0,
      percentageUnitPrice: percentage?.price ?? 0,
    }
  }

  private findEmspTariffElement(emspTariff: IEmspTariff) {
    return (type: string) => {
      return emspTariff.tariff.find((element) => element.type === type)
    }
  }
  private buildInvoiceLines(totalCost: number, vat: number): IInvoiceLine[] {
    const invoiceLine = {
      code: InvoiceLineCode.OtherNetworks,
      description: 'Serviços em outras redes',
      unitPrice: totalCost,
      uom: 'UN',
      quantity: 1,
      vat: vat,
      discount: 0,
      total: 0,
    } as IInvoiceLine

    if (vat == 0) {
      invoiceLine.taxExemptionReasonCode = TaxExemptionCode.M40
    }

    return [invoiceLine]
  }

  private buildFinalPrices(
    cpoPrices: Record<string, number>,
    emspPrices: IExtractedEmspPrices,
    vat: number,
  ): IFinalPrices {
    const cpoPricesExclVat = this.getExclVatPrices(cpoPrices)
    const cpoPricesInclVat = this.getInclVatPrices(cpoPrices, vat)

    const emspPricesExclVat = this.getExclVatPrices(emspPrices)
    const emspPricesInclVat = this.getInclVatPrices(emspPrices, vat)

    const { opcPrice, opcPriceDetail } = this.buildCpoDetail(
      cpoPricesExclVat,
      cpoPricesInclVat,
      vat,
    )

    const { cemePrice, cemePriceDetail } = this.buildEmspDetail(
      emspPricesExclVat,
      emspPricesInclVat,
      vat,
    )

    const othersPrice = this.buildOtherPrices(
      HubjectCommission,
      emspPricesExclVat.emspPercentage,
      emspPricesInclVat.emspPercentage,
      vat,
    )

    const { vatPrice, totalPrice } = this.buildTotalPriceDetail(
      opcPrice,
      cemePrice,
      HubjectCommission,
      emspPricesExclVat.emspPercentage,
      vat,
    )

    const dimensionsPriceDetail = this.buildDimensionsPriceDetail(
      opcPriceDetail,
      cemePriceDetail,
      emspPricesExclVat.percentageUnitPrice,
      HubjectCommission,
      vat,
    )

    return {
      opcPrice,
      opcPriceDetail,
      cemePrice,
      cemePriceDetail,
      vatPrice,
      othersPrice,
      dimensionsPriceDetail,
      totalPrice,
    }
  }

  private buildCpoDetail(
    cpoPricesExclVat: Record<string, number>,
    cpoPricesInclVat: Record<string, number>,
    vat: number,
  ): ICpoFinalPrices {
    const {
      flat: flatExclVat,
      energy: energyExclVat,
      time: timeExclVat,
      parking: parkingExclVat,
    } = cpoPricesExclVat

    const {
      flat: flatInclVat,
      energy: energyInclVat,
      time: timeInclVat,
      parking: parkingInclVat,
    } = cpoPricesInclVat

    const cpoPriceExclVat = sumObjectValues(cpoPricesExclVat)
    const opcPrice = {
      excl_vat: round(cpoPriceExclVat),
      incl_vat: this.addVat(cpoPriceExclVat, vat),
    }
    const opcPriceDetail = {
      flatPrice: { excl_vat: flatExclVat, incl_vat: flatInclVat },
      timePrice: { excl_vat: timeExclVat, incl_vat: timeInclVat },
      powerPrice: { excl_vat: energyExclVat, incl_vat: energyInclVat },
      parkingTimePrice: { excl_vat: parkingExclVat, incl_vat: parkingInclVat },
    }

    return {
      opcPrice,
      opcPriceDetail,
    }
  }

  private buildEmspDetail(
    emspPricesExclVat: Record<string, number>,
    emspPricesInclVat: Record<string, number>,
    vat: number,
  ): IEmspFinalPrices {
    const {
      flat: flatExclVat,
      energy: energyExclVat,
      time: timeExclVat,
    } = emspPricesExclVat

    const {
      flat: flatInclVat,
      energy: energyInclVat,
      time: timeInclVat,
    } = emspPricesInclVat

    const cemePriceExclVat = flatExclVat + energyExclVat + timeExclVat
    const cemePrice = {
      excl_vat: round(cemePriceExclVat),
      incl_vat: this.addVat(cemePriceExclVat, vat),
    }

    const cemePriceDetail = {
      flatPrice: { excl_vat: flatExclVat, incl_vat: flatInclVat },
      timePrice: { excl_vat: timeExclVat, incl_vat: timeInclVat },
      powerPrice: { excl_vat: energyExclVat, incl_vat: energyInclVat },
    }

    return {
      cemePrice,
      cemePriceDetail,
    }
  }

  private buildOtherPrices(
    activationFee: number,
    percentagePriceExclVat: number,
    percentagePriceInclVat: number,
    vat: number,
  ): IOtherPrice[] {
    const activationFeePrice = {
      excl_vat: round(activationFee),
      incl_vat: this.addVat(activationFee, vat),
    }

    const evioPercentagePrice = {
      excl_vat: percentagePriceExclVat,
      incl_vat: percentagePriceInclVat,
    }

    const otherPrices = [
      {
        description: `${ChargerNetworks.Hubject} Activation Fee ${HubjectCommission}`,
        price: activationFeePrice,
      },
      { description: `EVIO Percentage`, price: evioPercentagePrice },
    ]

    return otherPrices
  }

  private buildTotalPriceDetail(
    opcPrice: IPrice,
    cemePrice: IPrice,
    activationFee: number,
    percentageEmspPriceExclVat: number,
    vat: number,
  ): ITotalPriceDetail {
    const totalExclVat = round(
      opcPrice.excl_vat +
      cemePrice.excl_vat +
      round(activationFee) +
      percentageEmspPriceExclVat
    )

    const totalIncVat = this.addVat(totalExclVat, vat)
    const vatPrice = { vat: vat, value: round(totalIncVat - totalExclVat) }

    const totalPrice = {
      excl_vat: round(totalExclVat),
      incl_vat: round(totalIncVat),
    }

    return {
      totalPrice,
      vatPrice,
    }
  }

  private buildDimensionsPriceDetail(
    opcPriceDetail: Record<string, any>,
    cemePriceDetail: Record<string, any>,
    percentageUnitPrice: number,
    activationFee: number,
    vat: number,
  ): IDimensionsPriceDetail {
    const {
      flatPrice: cpoFlatPrice,
      timePrice: cpoTimePrice,
      powerPrice: cpoPowerPrice,
      parkingTimePrice: cpoParkingTimePrice,
    } = opcPriceDetail

    const {
      flatPrice: cemeFlatPrice,
      timePrice: cemeTimePrice,
      powerPrice: cemePowerPrice,
    } = cemePriceDetail

    const flatPrice =
      this.calculateDimensionPrice(
        cpoFlatPrice.excl_vat,
        cemeFlatPrice.excl_vat,
        percentageUnitPrice,
      ) + activationFee

    const timePrice = this.calculateDimensionPrice(
      cpoTimePrice.excl_vat,
      cemeTimePrice.excl_vat,
      percentageUnitPrice,
    )
    const powerPrice = this.calculateDimensionPrice(
      cpoPowerPrice.excl_vat,
      cemePowerPrice.excl_vat,
      percentageUnitPrice,
    )
    const parkingTimePrice = this.calculateDimensionPrice(
      cpoParkingTimePrice.excl_vat,
      0,
      percentageUnitPrice,
    )

    return {
      flatPrice: {
        excl_vat: flatPrice,
        incl_vat: this.addVat(flatPrice, vat),
      },
      timePrice: {
        excl_vat: timePrice,
        incl_vat: this.addVat(timePrice, vat),
      },
      powerPrice: {
        excl_vat: powerPrice,
        incl_vat: this.addVat(powerPrice, vat),
      },
      parkingTimePrice: {
        excl_vat: parkingTimePrice,
        incl_vat: this.addVat(parkingTimePrice, vat),
      },
    }
  }

  private calculateDimensionPrice(
    opcValue: number,
    cemeValue: number,
    percentageUnitPrice: number,
  ) {
    return opcValue + cemeValue + round(opcValue * percentageUnitPrice)
  }

  private addVat(price: number, vat: number) {
    return round(price * (1 + vat))
  }

  private getExclVatPrices(object: any) {
    return Object.fromEntries(
      Object.entries(object).map(([key, price]: any) => [
        `${key}`,
        round(price),
      ]),
    )
  }

  private getInclVatPrices(object: any, vat: number) {
    return Object.fromEntries(
      Object.entries(object).map(([key, price]: any) => [
        `${key}`,
        this.addVat(price, vat),
      ]),
    )
  }

  private async calculateSessionFinalValues(data: IContextData): Promise<void> {
    const { cdr, session, charger } = data
    const { start_date_time, end_date_time, total_energy: kwh, id: cdrId } = cdr

    const cpoPrices = this.calculateCpoPrices(cdr, session, charger)
    const emspPrices = this.calculateEmspPrices(
      cdr,
      session,
      sumObjectValues(cpoPrices),
    )

    const finalPrices = this.buildFinalPrices(
      cpoPrices,
      emspPrices,
      session.fees.IVA,
    )

    const invoiceLines = this.buildInvoiceLines(
      finalPrices.totalPrice.excl_vat,
      session.fees.IVA,
    )

    const totalTimeMs = durationInMiliseconds(start_date_time, end_date_time)
    const timeCharged = milisecondsToSeconds(totalTimeMs)
    const totalPower = kwh * 1000
    const { local_start_date_time, local_end_date_time } = this.getLocalDates(
      start_date_time,
      end_date_time,
      charger,
    )

    const bodySession = {
      timeCharged,
      totalPower,
      kwh,
      CO2Saved: 0,
      cdrId,
      start_date_time,
      end_date_time,
      total_energy: kwh,
      total_cost: finalPrices.totalPrice,
      finalPrices: finalPrices,
      invoiceLines: invoiceLines,
      charging_periods: [],
      paymentStatus: PaymentStatusSessions.Unpaid,
      local_start_date_time,
      local_end_date_time,
      tariffOPC: cdr.tariffs[0]
    } as IUpdateSessionValues

    const { status, reason, valid } =
      await CdrsService.checkToApplyValidationCDR(cdr, bodySession, false)

    bodySession.status = status
    bodySession.suspensionReason = reason

    const minimumBillingConditions =
      this.hasMinimumBillingConditions(totalPower)

    this.setMinimumBillingConditionValues(minimumBillingConditions, bodySession)

    Object.assign(data.session, bodySession)
    Object.assign(data.updatedSession, bodySession)
    data.valid = valid
  }

  private hasMinimumBillingConditions(energy: number) {
    return energy > MinimumEnergyToBilling
  }

  private getLocalDates(
    start_date_time: string,
    end_date_time: string,
    charger: ICharger,
  ) {
    const timeZone = getTimezone(
      charger.geometry.coordinates[1],
      charger.geometry.coordinates[0],
    )
    const local_start_date_time = this.formatToLocalDateTime(
      start_date_time,
      timeZone,
    )
    const local_end_date_time = this.formatToLocalDateTime(
      end_date_time,
      timeZone,
    )

    return {
      local_start_date_time,
      local_end_date_time,
    }
  }

  private formatToLocalDateTime(dateTime: string, timeZone: string) {
    return timeZoneMoment(dateTime).tz(timeZone).format('YYYY-MM-DDTHH:mm:ss')
  }

  private buildZeroCostPrices(): IFinalPrices {
    const priceZero = {
      excl_vat: 0,
      incl_vat: 0,
    }

    const finalPrices = {
      opcPrice: priceZero,
      opcPriceDetail: {
        flatPrice: priceZero,
        timePrice: priceZero,
        powerPrice: priceZero,
        parkingTimePrice: priceZero,
      },
      cemePrice: priceZero,
      cemePriceDetail: {
        flatPrice: priceZero,
        timePrice: priceZero,
        powerPrice: priceZero,
      },
      vatPrice: {
        vat: 0,
        value: 0,
      },
      othersPrice: [
        {
          description: `${ChargerNetworks.Hubject} Activation Fee ${0}`,
          price: priceZero,
        },
        { description: `EVIO Percentage`, price: priceZero },
      ],
      dimensionsPriceDetail: {
        flatPrice: priceZero,
        timePrice: priceZero,
        powerPrice: priceZero,
        parkingTimePrice: priceZero,
      },
      totalPrice: priceZero,
    }

    return finalPrices
  }

  private setMinimumBillingConditionValues(
    minimumBillingConditions: boolean,
    bodySession: IUpdateSessionValues,
  ) {
    bodySession.minimumBillingConditions = minimumBillingConditions
    if (!minimumBillingConditions) {
      const finalPrices = this.buildZeroCostPrices()
      bodySession.finalPrices = finalPrices
      bodySession.total_cost = finalPrices.totalPrice
    }
    bodySession.total_cost.incl_vat < 0 &&
      (bodySession.minimumBillingConditions = false)
  }

  private async pay(data: IContextData): Promise<void> {
    const { session, cdr, valid } = data
    const { paymentType, paymentMethod } = session
    this.logger.log(`valid: ${valid}, paymentType: ${paymentType}, paymentMethod: ${paymentMethod}`)
    if (
      valid &&
      paymentType === PaymentType.AdHoc &&
      paymentMethod !== PaymentsMethods.transfer
    ) {
      const paymentData = this.buildPaymentData(session, cdr.currency)
      this.logger.log(`Calling payments service: ${JSON.stringify(paymentData)}`)
      const {
        status,
        transactionId,
        _id: paymentId,
      } = await this.callPaymentsService(paymentData)

      const bodySession = {
        transactionId,
        paymentId,
        ...this.getPaymentSessionStatus(status),
      } as IUpdateSessionValues

      Object.assign(data.session, bodySession)
      Object.assign(data.updatedSession, bodySession)

      data.paid = status === PaymentStatus.PaidOut
      this.logger.log(`payment result data: ${JSON.stringify(data)}`)
    }
  }

  private buildPaymentData(
    session: IChargingSession,
    currency: string,
  ): IPaymentData {
    return {
      amount: { currency: currency, value: session.total_cost.incl_vat },
      userId: session.userIdWillPay,
      sessionId: session._id,
      listOfSessions: [],
      hwId: session.location_id,
      chargerType: session.chargerType,
      paymentMethod: session.paymentMethod,
      paymentMethodId: session.paymentMethodId,
      transactionId: session.transactionId,
      adyenReference: session.adyenReference,
      reservedAmount: session.reservedAmount,
      clientName: session.clientName,
    }
  }

  private async callPaymentsService(
    paymentData: IPaymentData,
  ): Promise<IPaymentsResponse> {
    try {
      const url = this.configService.get<string>(
        'serviceUrl.payments',
      ) as string
      const headers = { userid: paymentData.userId }
      const response = await firstValueFrom(
        this.plainHttp.post(`${url}/api/private/payments`, paymentData, {
          headers,
        }),
      )

      return response.data as IPaymentsResponse
    } catch (error: any) {
      this.logger.error(error?.response?.data || error?.message)
      return {
        status: null,
        transactionId: paymentData.transactionId,
      }
    }
  }

  private getPaymentSessionStatus(
    status: string | null,
  ): Partial<IUpdateSessionValues> {
    switch (status) {
      case PaymentStatus.PaidOut:
        return {
          paymentStatus: PaymentStatusSessions.Paid,
          paymentSubStatus: PaymentSubStatus.PaidAndClosed,
        }
      case PaymentStatus.StartPayment:
      case PaymentStatus.InPayment:
        return {
          paymentSubStatus: PaymentSubStatus.PaidAndWaitingForAdyenNotification,
        }
      default:
        return {
          paymentSubStatus: PaymentSubStatus.PaymentFailedForAnyReason,
        }
    }
  }

  private async payAndInvoice(
    evseId: string,
    parsedCdr: ICdr,
    session: IChargingSession,
    charger: ICharger,
  ) {
    try {
      const data = {
        evseId,
        cdr: parsedCdr,
        session,
        charger,
        updatedSession: {},
        paid: false,
        invoiced: false,
      } as IContextData

      await this.addChargerInfoToSession(data)

      await this.calculateSessionFinalValues(data)

      await this.pay(data)

      const disabledBillingV2InvoiceOcpi = await toggle.isEnable('billing-v2-invoice-magnifinance-disable');
      if (!disabledBillingV2InvoiceOcpi) {
        this.logger.log("BillingV2 - feature billing-v2-invoice-magnifinance-disable is disabled, old billing will be used");
        await this.invoice(data)
      }

      await this.updateSession(data)

      const enableBillingV2AdHoc = await toggle.isEnable('billing-v2-session_adhoc');
      if (enableBillingV2AdHoc) {
        this.logger.log(`BillingV2 - Preparing message to send | sessionId: ${session._id.toString()}`);
        const payload = { sessionId: session._id.toString(), cdrId: data.cdr.id };
        sendMessage({ method: 'invoiceAdHoc', payload }, 'billing_v2_key');
      }
    } catch (error: any) {
      this.logger.error(error?.response?.data || error?.message)
    }
  }

  private async invoice(data: IContextData): Promise<void> {
    const { session, paid } = data
    const { minimumBillingConditions, billingPeriod } = session
    this.logger.log(`minimumBillingConditions: ${minimumBillingConditions} - billingPeriod: ${billingPeriod} - paid: ${paid}`) 
    if (
      paid &&
      minimumBillingConditions &&
      billingPeriod === BillingPeriods.Adhoc
    ) {
      const invoice = CdrsService.buildInvoice(session)
      this.logger.log(`Calling invoice service for session ${session._id} - ${JSON.stringify(invoice)}`)
      const response = await this.callInvoiceService(session, invoice)

      Object.assign(data.session, response)
      Object.assign(data.updatedSession, response)
    }
  }

  private async updateSession(data: IContextData) {
    this.logger.log("Updating session")
    const { id, _id } = data.session
    const { updatedSession } = data
    this.logger.log(`Updating session ${_id} - ${JSON.stringify(updatedSession)}`)
    await SessionsRepository.updateSessionWithOptions({ id }, updatedSession)
    sendSessionToHistoryQueue(_id, 'receive-cdr')
  }

  private async callInvoiceService(
    session: IChargingSession,
    invoiceData: IInvoiceData,
  ): Promise<{ invoiceId?: string, invoiceStatus: boolean }> {
    try {
      const { userIdToBilling, clientName } = session

      const url = this.configService.get<string>('serviceUrl.billing') as string

      const headers = {
        userid: userIdToBilling,
        clientname: clientName,
        source: ChargerNetworks.International.toLowerCase(),
        ceme: ClientNames.EVIO,
      }
      const path = this.getBillingPath(url, clientName)
      const response = await firstValueFrom(
        this.plainHttp.post(path, invoiceData, {
          headers,
        }),
      )

      const invoiceId = response.data.invoiceId
      const invoiceStatus = true
      return { invoiceId, invoiceStatus }
    } catch (error: any) {
      this.logger.error(error?.response?.data || error?.message)
      return { invoiceStatus: false }
    }
  }

  private getBillingPath(url: string, clientName: string) {
    const evioPath = `${url}/api/private/createGireveBillingDocument`
    const wlPath = `${url}/api/private/billing/createBillingDocumentWL`
    return clientName === ClientNames.EVIO ? evioPath : wlPath
  }

  private async getFees(chargerCountryCode: string, address: IAddress, userIdToBilling: string): Promise<Partial<IFees>> {

    // Get billing profile to get VIES
    const billingProfile = (await libraryIdentity.findBillingProfileByUserId(userIdToBilling)) || {}
    const { billingAddress } = billingProfile

    // Get charger and user to billing fees
    const chargerFee = await ConfigsLibrary.getFees(chargerCountryCode, address?.zipCode) as IFee
    const userToBillingFees = await ConfigsLibrary.getFees(billingAddress?.countryCode, billingAddress?.zipCode) as IFee

    // Check if vies will be applied
    const { VAT, countryCode } = CommonsLibrary.getVATandContryCode(billingProfile, chargerCountryCode, chargerFee.fees.IVA, userToBillingFees.fees.IVA);

    return {
      ...chargerFee.fees,
      IVA: VAT,
      countryCode
    }
  }

  private async addChargerInfoToSession(data: IContextData): Promise<void> {
    const { session, charger, evseId } = data

    if (!session.location_id) {

      const { hwId: location_id, address, countryCode: country_code, operator } = charger
      const plug = charger?.plugs?.find((plug) => plug.evse_id === evseId)
      const { plugId: connector_id, power: plugPower, voltage: plugVoltage } = plug as IPlug
      const timeZone = getTimezone(charger.geometry.coordinates[1], charger.geometry.coordinates[0])

      const fees = await this.getFees(country_code, address, session.userIdToBilling)

      const chargerData = {
        location_id,
        address,
        country_code,
        operator,
        connector_id,
        plugPower,
        plugVoltage,
        evse_uid: evseId,
        fees,
        timeZone
      }

      Object.assign(data.session, chargerData)
      Object.assign(data.updatedSession, chargerData)
    }
  }
}
