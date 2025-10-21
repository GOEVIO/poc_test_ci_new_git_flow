import { Injectable } from '@nestjs/common'
import { LogsService } from '@/logs/logs.service'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { SubscriptionService } from '@/modules/subscription/subscription.service'
import {
  IEvsePricing,
  IEvsePricingResponse,
  ITariffIdUpdateOperation,
} from '@/modules/tariff/interfaces/evse-pricing.interface'
import { ITariff } from '@/modules/tariff/interfaces/pricing-product.interface'
import ChargersLibrary from 'evio-library-chargers'
import { ChargerNetworks, OicpPricingModel, ChargerOperationStatuses } from 'evio-library-commons'
import { TariffsRepository } from 'evio-library-ocpi'
@Injectable()
export class EvsePricingService {
  constructor(
    private readonly logger: LogsService,
    private readonly httpService: HttpService,
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(EvsePricingService.name)
  }

  public async pullFullEvsePricing(): Promise<{
    url: string
    body: any
    evsePricing: IEvsePricing[]
  }> {
    const { url, body } = await this.prepareFullEvsePricingInput()
    const evsePricing = await this.requestEvsePricing(url, body)
    const tariffMap = await this.getBulkTariffsToMap(evsePricing)
    this.saveEvsePricing(evsePricing, tariffMap)
    return { url, body, evsePricing }
  }

  public async pullDeltaEvsePricing(): Promise<{
    url: string
    body: any
    evsePricing: IEvsePricing[]
  }> {
    const { url, body } = await this.prepareDeltaEvsePricingInput()
    const evsePricing = await this.requestEvsePricing(url, body)
    const tariffMap = await this.getBulkTariffsToMap(evsePricing)
    this.saveEvsePricing(evsePricing, tariffMap)
    return { url, body, evsePricing }
  }

  private async prepareFullEvsePricingInput(): Promise<{
    url: string
    body: any
  }> {
    const url = this.configService.get<string>(
      'oicp.endpoints.tariff.evsePricing',
    ) as string

    const providerId = this.configService.get<string>(
      'oicp.providerId',
    ) as string

    const operatorIds =
      await this.subscriptionService.getOperatorIdsByPricingModel(
        OicpPricingModel.dynamic,
      )
    const body = {
      ProviderID: providerId,
      OperatorIDs: operatorIds,
    }

    return { url, body }
  }

  private async prepareDeltaEvsePricingInput(): Promise<{
    url: string
    body: any
  }> {
    const url = this.configService.get<string>(
      'oicp.endpoints.tariff.evsePricing',
    ) as string

    const providerId = this.configService.get<string>(
      'oicp.providerId',
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
      ProviderID: providerId,
      OperatorIDs: operatorIds,
    }

    return { url, body }
  }

  private async requestEvsePricing(
    url: string,
    body: any,
  ): Promise<IEvsePricing[]> {
    try {
      // Request
      const response = await firstValueFrom(this.httpService.post(url, body))

      const { EVSEPricing, StatusCode } = response.data as IEvsePricingResponse

      if (StatusCode.Code !== '000') {
        this.logger.error(StatusCode)
        return []
      }

      return EVSEPricing
    } catch (error: any) {
      console.log(error)
      this.logger.error(error?.response?.data)
      return []
    }
  }

  private async saveEvsePricing(
    evsePricing: IEvsePricing[],
    tariffMap: Map<string, Partial<ITariff>>,
  ): Promise<void> {
    const tariffIdBulkOperations = this.buildAllBulkTariffIdOperations(
      evsePricing,
      tariffMap,
    )
    tariffIdBulkOperations.length &&
      (await ChargersLibrary.bulkWriteChargers(tariffIdBulkOperations))

    this.updateOperatorsChargersWithDefaultTariff(evsePricing, tariffMap)
  }

  private buildAllBulkTariffIdOperations(
    evsePricing: IEvsePricing[],
    tariffMap: Map<string, Partial<ITariff>>,
  ): ITariffIdUpdateOperation[] {
    return evsePricing.flatMap((operator) => {
      const operatorId = operator.OperatorID
      const defaultTariff = `default_dynamic_${operatorId}`
      return operator.EVSEPricing.map((evse) => {
        const { EvseID, EvseIDProductList } = evse
        const updatedTariffIds = this.addOperatorIdToTariffId(
          EvseIDProductList,
          operatorId,
        )
        const tariffs = updatedTariffIds
          .map((tariffId) => tariffMap.get(tariffId))
          .filter(Boolean) as Partial<ITariff>[]
        
        tariffs.length !== updatedTariffIds.length && (tariffs.push(tariffMap.get(defaultTariff) as Partial<ITariff>))
        return this.buildBulkTariffIdBody(
          EvseID,
          ChargerNetworks.Hubject,
          updatedTariffIds,
          tariffs,
        )
      })
    })
  }

  private buildBulkTariffIdBody(
    evseId: string,
    source: string,
    updatedTariffIds: string[],
    tariffs: Partial<ITariff>[],
  ): ITariffIdUpdateOperation {
    return {
      updateOne: {
        filter: {
          'plugs.evse_id': evseId,
          source,
          operationalStatus: { $ne: ChargerOperationStatuses.Removed }
        },
        update: {
          $set: {
            'plugs.$[plug].tariffId': updatedTariffIds,
            'plugs.$[plug].serviceCost.tariffs': tariffs,
          },
          $currentDate: { updatedAt: true },
        },
        arrayFilters: [
          {
            'plug.evse_id': evseId,
          },
        ],
      },
    }
  }

  private addOperatorIdToTariffId(
    evseIdProductList: string[],
    operatorId: string,
  ): string[] {
    return evseIdProductList.map((product) => `${product}_${operatorId}`)
  }

  private updateOperatorsChargersWithDefaultTariff(
    evsePricing: IEvsePricing[],
    tariffMap: Map<string, Partial<ITariff>>,
  ): void {
    for (const operator of evsePricing) {
      const evseIds = operator.EVSEPricing.map((evse) => evse.EvseID)
      const operatorId = operator.OperatorID
      const defaultTariff = `default_dynamic_${operatorId}`
      const query = {
        partyId: operatorId,
      }
      const tariff = tariffMap.get(defaultTariff)
      const update = {
        'plugs.$[plug].tariffId': [defaultTariff],
        'plugs.$[plug].serviceCost.tariffs' : tariff ? [tariff] : []
      }
      const options = {
        arrayFilters: [
          {
            $or: [
              { 'plug.tariffId': { $exists: false } },
              { 'plug.tariffId': { $size: 0 } },
              { 'plug.evse_id': { $nin: evseIds } },
            ],
          },
        ],
      }
      ChargersLibrary.updatePublicChargerWithOptions(query, update, options)
    }
  }

  private async getLastCallDate(source: string): Promise<string> {
    // For now we're fetching the last 24h
    const now: Date = new Date()
    const yesterday: string = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString()
    return yesterday
  }
  
  private async getBulkTariffsToMap(
    evsePricing: IEvsePricing[],
  ): Promise<Map<string, Partial<ITariff>>> {
    const tariffIds = this.getTariffIdsList(evsePricing)
    const tariffs = await TariffsRepository.getTariffsById(tariffIds)
    const mapTariffById = new Map(
      tariffs.map((tariff) => [tariff.id, tariff]),
    ) as Map<string, Partial<ITariff>>

    return mapTariffById
  }

  private getTariffIdsList(evsePricing: IEvsePricing[]): string[] {
    const allTariffIds = evsePricing.flatMap((operator) => {
      const operatorTariffIds = operator.EVSEPricing.flatMap((evse) =>
        this.addOperatorIdToTariffId(
          evse.EvseIDProductList,
          operator.OperatorID,
        ),
      )
      const defaultOperatorTariffId = `default_dynamic_${operator.OperatorID}`

      return [defaultOperatorTariffId, ...operatorTariffIds]
    })

    return [...new Set(allTariffIds)]
  }
}
