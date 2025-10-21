import { Injectable } from '@nestjs/common'
import { LogsService } from '@/logs/logs.service'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { SubscriptionService } from '@/modules/subscription/subscription.service'
import { TariffsRepository, TariffsService } from 'evio-library-ocpi'
import {
  IPricingProductData,
  IPricingProductDataResponse,
  ITariff,
  ITariffElement,
  ITariffRestrictions,
  IAvailability,
  IPricingProductDataRecord,
  IPriceComponent,
  IAdditionalReference,
  IPrice,
  IUpdateOneOperation,
} from '@/modules/tariff/interfaces/pricing-product.interface'
import {
  ChargerNetworks,
  OicpPricingModel,
  dinCountryMapper,
  OcpiTariffType,
  OicpReferenceUnit,
  OcpiTariffDimenstionType,
  OicpReferenceType,
  DaysOfWeek,
} from 'evio-library-commons'

@Injectable()
export class PricingProductService {
  constructor(
    private readonly logger: LogsService,
    private readonly httpService: HttpService,
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(PricingProductService.name)
  }

  public async pullFullPricingProductData(): Promise<{
    url: string
    body: any
    pricingProductData: IPricingProductData[]
  }> {
    // Build input process to fetch full pricing data
    const { url, body, operatorIds } = await this.prepareFullPricingProductDataInput()

    const pricingProductData = await this.requestPricingProductData(url, body)

    this.savePricingProductData(pricingProductData, operatorIds)

    return { url, body, pricingProductData }
  }

  public async pullDeltaPricingProductData(): Promise<{
    url: string
    body: any
    pricingProductData: IPricingProductData[]
  }> {
    // Build input process to fetch delta pricing data
    const { url, body, operatorIds } = await this.prepareDeltaPricingProductDataInput()

    const pricingProductData = await this.requestPricingProductData(url, body)

    this.savePricingProductData(pricingProductData, operatorIds)

    return { url, body, pricingProductData }
  }

  private async prepareFullPricingProductDataInput(): Promise<{
    url: string
    body: any,
    operatorIds: string[]
  }> {
    const url = this.configService.get<string>(
      'oicp.endpoints.tariff.pricingProductData',
    ) as string

    const operatorIds =
      await this.subscriptionService.getOperatorIdsByPricingModel(
        OicpPricingModel.dynamic,
      )
    const body = {
      OperatorIDs: operatorIds,
    }

    return { url, body, operatorIds }
  }

  private async prepareDeltaPricingProductDataInput(): Promise<{
    url: string
    body: any
    operatorIds: string[]
  }> {
    const url = this.configService.get<string>(
      'oicp.endpoints.tariff.pricingProductData',
    ) as string

    const source = ChargerNetworks.Hubject
    const [operatorIds, lastCall] = await Promise.all([
      this.subscriptionService.getOperatorIdsByPricingModel(
        OicpPricingModel.dynamic,
      ),
      this.getLastCallDate(source),
    ])
    const body = {
      LastCall: lastCall,
      OperatorIDs: operatorIds,
    }

    return { url, body, operatorIds }
  }

  private async getLastCallDate(source: string): Promise<string | undefined> {
    const lastCall = await TariffsRepository.getTariffsLastUpdatedDate(source)
    if (!lastCall) return
    // Subtract 30 minutes to compensate for latency in tariffs update
    lastCall.updatedAt.setMinutes(lastCall.updatedAt.getMinutes() - 30)
    return lastCall?.updatedAt?.toISOString()
  }

  private async requestPricingProductData(
    url: string,
    body: any,
  ): Promise<IPricingProductData[]> {
    try {
      // Request
      const response = await firstValueFrom(this.httpService.post(url, body))

      const { PricingProductData, StatusCode } =
        response.data as IPricingProductDataResponse

      if (StatusCode.Code !== '000') {
        this.logger.error(StatusCode)
        return []
      }

      return PricingProductData
    } catch (error: any) {
      console.log(error)
      this.logger.error(error?.response?.data)
      return []
    }
  }

  private async savePricingProductData(
    pricingProductData: IPricingProductData[],
    operatorIds: string[],
  ): Promise<any> {
    const bulkOperations = this.buildAllBulkOperations(pricingProductData)
    bulkOperations.length && TariffsRepository.bulkWriteTariffs(bulkOperations)
    TariffsService.deleteOldDefaultDynamicTariffs(operatorIds)
  }

  private extractCountryCodeFromOperatorId(operatorId: string): string {
    // operatorID is in DIN
    if (operatorId.charAt(0) == '+') {
      const [telecommunicationNumber] = operatorId.split('*')
      // this is not exactly a perfect mapping since some countries share the same number
      return dinCountryMapper[telecommunicationNumber]?.countryCode
    } else {
      // operatorID is in ISO
      return operatorId.substring(0, 2)
    }
  }

  private mapReferenceUnitToComponentType(
    pricingReferenceUnit: string,
  ): string {
    switch (pricingReferenceUnit) {
      case OicpReferenceUnit.hour:
      case OicpReferenceUnit.minute:
        return OcpiTariffDimenstionType.Time

      case OicpReferenceUnit.kWh:
        return OcpiTariffDimenstionType.Energy

      default:
        return OcpiTariffDimenstionType.Energy
    }
  }

  private mapAdditionalReferenceTypeToComponentType(
    additionalReferenceType: string,
    pricingReferenceUnit: string,
  ): string {
    if (
      additionalReferenceType === OicpReferenceType.StartFee ||
      additionalReferenceType === OicpReferenceType.FixedFee
    ) {
      return OcpiTariffDimenstionType.Flat
    } else if (
      additionalReferenceType === OicpReferenceType.ParkingFee &&
      pricingReferenceUnit !== OicpReferenceUnit.kWh
    ) {
      return OcpiTariffDimenstionType.Time
    } else if (
      additionalReferenceType === OicpReferenceType.ParkingFee &&
      pricingReferenceUnit === OicpReferenceUnit.kWh
    ) {
      return OcpiTariffDimenstionType.Energy
    }

    return OcpiTariffDimenstionType.Energy
  }

  private buildDefaultOperatorTariff(
    operator: IPricingProductData,
    source: string,
  ): ITariff {
    const {
      OperatorID,
      PricingDefaultPrice,
      PricingDefaultPriceCurrency,
      PricingDefaultReferenceUnit,
    } = operator

    const countryCode = this.extractCountryCodeFromOperatorId(OperatorID)
    return {
      country_code: countryCode,
      source,
      currency: PricingDefaultPriceCurrency,
      id: `default_dynamic_${OperatorID}`,
      type: OcpiTariffType.Regular,
      party_id: OperatorID,
      elements: [
        this.buildElement(
          {},
          PricingDefaultReferenceUnit,
          PricingDefaultPrice,
          [],
        ),
      ],
    }
  }

  private buildElement(
    restrictions: ITariffRestrictions,
    referenceUnit: string,
    referencePrice: number,
    additionalReferences: IAdditionalReference[] = [],
    step_size: number = 1,
  ): ITariffElement {
    const additionalReferencesComponents =
      this.buildAdditionalReferenceComponents(additionalReferences)
    const component = this.buildPriceComponent(
      referenceUnit,
      referencePrice,
      step_size,
    )
    const mergedComponents = this.mergeComponentsByType([
      component,
      ...additionalReferencesComponents,
    ])
    return {
      restrictions,
      price_components: mergedComponents,
    }
  }

  private buildPriceComponent(
    referenceUnit: string,
    referencePrice: number,
    step_size: number,
    additionalReferenceType: string = '',
  ): IPriceComponent {
    /**
     * Hubject support said that the parking fee is charged by the minute,
     * even though their documentation doesn't explicitly say it.
     *
     *
     * Documentation from Hubject regarding PARKING FEE:
     * Can be used in case sessions are to be charged for both parking and charging.
     * When used, it needs to be specified in the corresponding service offer on the HBS Portal when parking applies
     * (e.g. from session start to charging start and charging end to session end or for the entire session duration,
     *  or x-minutes after charging end, etc)
     *
     *
     * We should read each offer to know how to apply it properly for each operator.
     * It's not very practical.
     */
    const type = additionalReferenceType
      ? this.mapAdditionalReferenceTypeToComponentType(
          additionalReferenceType,
          referenceUnit,
        )
      : this.mapReferenceUnitToComponentType(referenceUnit)

    const isPerMinute = referenceUnit === OicpReferenceUnit.minute;
    const isValidReferencePerTime =
      !additionalReferenceType ||
      OicpReferenceType.ParkingFee === additionalReferenceType;
    
    // We transform into hours since the OCPI tariffs calculations are done in hours on Gireve and Hubject
    const price = isPerMinute && isValidReferencePerTime             
        ? referencePrice * 60
        : referencePrice

    return {
      type,
      price,
      step_size,
    }
  }

  private buildElementsByResctriction(
    availabilityTimes: IAvailability[],
    unit: string,
    price: number,
    additionalReferences: IAdditionalReference[],
  ): ITariffElement[] {
    return availabilityTimes.flatMap((availabilityTimes) => {
      return availabilityTimes.Periods.map((period) => {
        const restrictions = {
          start_time: period.begin,
          end_time: period.end,
          day_of_week: this.getDaysOffTheWeek(availabilityTimes.on),
        }
        return this.buildElement(
          restrictions,
          unit,
          price,
          additionalReferences,
        )
      })
    })
  }

  private getDaysOffTheWeek(days: string): string[] {
    const { Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday } =
      DaysOfWeek

    const dayMappings: Record<string, string[]> = {
      Everyday: [
        Monday,
        Tuesday,
        Wednesday,
        Thursday,
        Friday,
        Saturday,
        Sunday,
      ],
      Workdays: [Monday, Tuesday, Wednesday, Thursday, Friday],
      Weekend: [Saturday, Sunday],
      Monday: [Monday],
      Tuesday: [Tuesday],
      Wednesday: [Wednesday],
      Thursday: [Thursday],
      Friday: [Friday],
      Saturday: [Saturday],
      Sunday: [Sunday],
    }
    return dayMappings[days]
  }

  private buildTariff(
    operator: IPricingProductData,
    record: IPricingProductDataRecord,
    source: string,
  ): ITariff {
    const mainElement = this.buildElement(
      {},
      record.ReferenceUnit,
      record.PricePerReferenceUnit,
      record.AdditionalReferences,
    )

    const restrictionElements = this.buildElementsByResctriction(
      record.ProductAvailabilityTimes,
      record.ReferenceUnit,
      record.PricePerReferenceUnit,
      record.AdditionalReferences,
    )

    const flatElement = this.buildFlatElement(record.AdditionalReferences)

    /**
     * Hubject always applies the same tariff throughout the session.
     * We needed to addapt its structure to be compliant with OCPI, but they clash when it comes to the restrictions calculations.
     * So, we have to add the fallback element so the tariff remains always the same, even if it's outside
     * the restrictions period. Besides that, we must create the flat element isolated so it is not charged multiple times
     */

    const elements = record.IsValid24hours
      ? [mainElement]
      : [...restrictionElements, mainElement]
    
    flatElement && elements.unshift(flatElement)

    const { min_price, max_price } = this.getMinimumAndMaximumPrice(
      record.AdditionalReferences,
    )
    const tariff = {
      country_code: this.extractCountryCodeFromOperatorId(operator.OperatorID),
      source: source,
      currency: record.ProductPriceCurrency,
      // Since the ProductID is not unique, we need to add the OperatorID
      id: `${record.ProductID}_${operator.OperatorID}`,
      type: OcpiTariffType.Regular,
      party_id: operator.OperatorID,
      elements,
      min_price,
      max_price,
    }
    return tariff
  }

  private getMinimumAndMaximumPrice(
    additionalReferences: IAdditionalReference[],
  ): {
    min_price: IPrice | undefined
    max_price: IPrice | undefined
  } {
    const min_price = this.buildAdditionalReferencePrice(
      additionalReferences,
      OicpReferenceType.MinimumFee,
    )
    const max_price = this.buildAdditionalReferencePrice(
      additionalReferences,
      OicpReferenceType.MaximumFee,
    )
    return {
      min_price,
      max_price,
    }
  }

  private buildAdditionalReferencePrice(
    additionalReferences: IAdditionalReference[],
    referenceType: OicpReferenceType,
  ): IPrice | undefined {
    const reference = additionalReferences.find(
      (reference) => reference.AdditionalReference === referenceType,
    )
    return reference
      ? { excl_vat: reference.PricePerAdditionalReferenceUnit } as IPrice
      : undefined
  }

  private buildAdditionalReferenceComponents(
    additionalReferences: IAdditionalReference[],
  ): IPriceComponent[] {
    return additionalReferences
      .filter(this.parkingAdditionalReference())
      .map((reference) => {
        return this.buildPriceComponent(
          reference.AdditionalReferenceUnit,
          reference.PricePerAdditionalReferenceUnit,
          1,
          reference.AdditionalReference,
        )
      })
  }

  private parkingAdditionalReference() : (reference: IAdditionalReference) => boolean {
    return (reference) => {
      return reference.AdditionalReference === OicpReferenceType.ParkingFee
    }
  }

  private flatAdditionalReference() : (reference: IAdditionalReference) => boolean {
    return (reference) => {
      return (
        reference.AdditionalReference === OicpReferenceType.StartFee ||
        reference.AdditionalReference === OicpReferenceType.FixedFee
      )
    }
  }

  private buildOperatorBulkOperations(
    operator: IPricingProductData,
  ): IUpdateOneOperation[] {
    return operator.PricingProductDataRecords.map((record) => {
      const tariff = this.buildTariff(operator, record, ChargerNetworks.Hubject)
      return this.buildBulkWriteBody(tariff)
    })
  }

  private buildBulkWriteBody(tariff: ITariff): IUpdateOneOperation {
    return {
      updateOne: {
        filter: { id: tariff.id },
        update: {
          $set: tariff,
          $setOnInsert: { createdAt: new Date() },
          $currentDate: { updatedAt: true },
        },
        upsert: true,
      },
    }
  }

  private buildAllBulkOperations(
    pricingProductData: IPricingProductData[],
  ): IUpdateOneOperation[] {
    return pricingProductData.flatMap((operator) => {
      const defaultOperatorTariff = this.buildDefaultOperatorTariff(
        operator,
        ChargerNetworks.Hubject,
      )
      const operatorBulkOperations = this.buildOperatorBulkOperations(operator)

      return [
        this.buildBulkWriteBody(defaultOperatorTariff),
        ...operatorBulkOperations,
      ]
    })
  }

  private mergeComponentsByType(
    components: IPriceComponent[],
  ): IPriceComponent[] {
    const mergedMap: Record<string, IPriceComponent> = components.reduce(
      (acc, component) => {
        if (!acc[component.type]) {
          acc[component.type] = { ...component }
        } else {
          // step_size remains the same
          acc[component.type].price += component.price
        }
        return acc
      },
      {} as Record<string, IPriceComponent>,
    )

    return Object.values(mergedMap)
  }

  private buildFlatElement(
    additionalReferences: IAdditionalReference[],
  ): ITariffElement | null {
    const flatComponents = additionalReferences
      .filter(this.flatAdditionalReference())
      .map((reference) => {
        return this.buildPriceComponent(
          reference.AdditionalReferenceUnit,
          reference.PricePerAdditionalReferenceUnit,
          1,
          reference.AdditionalReference,
        )
      })

    return flatComponents.length > 0
      ? {
          restrictions: {},
          price_components: flatComponents,
        }
      : null
  }
}
