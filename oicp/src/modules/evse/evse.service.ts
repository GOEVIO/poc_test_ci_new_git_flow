import { BadRequestException, Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { firstValueFrom } from 'rxjs'
import * as geoTz from 'geo-tz'
import { LogsService } from '@/logs/logs.service'
import { ConfigService } from '@nestjs/config'
import { PullEvseDataDto, ProcessDataDto } from './evse.dto'
import ChargersLibrary from 'evio-library-chargers'
import NotificationsLibrary from 'evio-library-notifications'
import { EvseConstants } from '@/constants'
import { Types } from 'mongoose';
import {
  ICharger,
  IPlug,
  IPullEvseDataRecordType,
  IUpdateOneOperation,
  IServiceCost,
  IAddress,
  IAddressIso19773,
  IGeometry,
  IChargingFacility,
  IGeoCoordinatesType,
  IEvseStatusJobInput,
  IEvseStatusResponse,
  IEvseStatuses,
  IEvseStatusRecord,
  IEvseStatusByOperatorBody,
  IEvseStatusMap,
  IPlugUpdateOperation,
  INotifyUsersAvailableCharger,
  IEvseStatusByIdBody,
  IEVSEStatusByIdResponse,
} from './evse.interface'
import {
  ITariff,
} from '@/modules/tariff/interfaces/pricing-product.interface'
import {
  AvailabilityType,
  ChargerNetworks,
  ChargerOperationStatuses,
  ChargerStatus,
  ChargerSubStatus,
  ChargerTypes,
  ConnectorFormat,
  ConnectorPowerType,
  ConnectorType,
  EVSEStatuses,
  OcpiEvseCapability,
  OicpConnectorType,
  OicpEvseCapability,
  OicpParkingType,
  OicpEvseStatus,
  PaginationRequestMode,
  ParkingType,
  PlugStatus,
  OicpDeltaType,
  OicpGeoCoordinatesType,
  AllowedCountries3,
  alpha3CountryMapper,
  defaultCpoTariffId,
} from 'evio-library-commons'
import {
  TariffsService,
} from 'evio-library-ocpi'
import { SubscriptionService } from '@/modules/subscription/subscription.service'
@Injectable()
export class EvseService {
  aditionalCountries: string[] = []
  constructor(
    private readonly logger: LogsService,
    private readonly httpService: HttpService,
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {
    this.aditionalCountries =
      this.configService.get<string>('oicp.aditionalCountries')?.split(',') || []
    this.logger.setContext(EvseService.name)
  }

  public async pullEvseData(
    pullEVSEDataMessage: PullEvseDataDto,
  ): Promise<ProcessDataDto> {
    try {
      // Build input process data to use in pagination
      const url = this.configService.get<string>(
        'oicp.endpoints.evse.data',
      ) as string
      const source = ChargerNetworks.Hubject
      const data = this.buildProcessData(
        url,
        pullEVSEDataMessage,
        source,
        pullEVSEDataMessage.OperatorIds,
        pullEVSEDataMessage.dynamicOperatorIds,
      )

      // Fetch evse data based on provided filters
      await this.paginateService(data)

      return data
    } catch (error: any) {
      this.logger.error(error?.response?.data ?? error)
      throw new BadRequestException(error?.response?.data ?? error)
    }
  }

  public async fullEvseDataRequest(): Promise<ProcessDataDto> {
    // Build input process data to use in pagination
    const { url, body, source, operatorIds, dynamicOperatorIds } =
      await this.prepareFullEvseDataInput()
    const data = this.buildProcessData(url, body, source, operatorIds, dynamicOperatorIds)

    // Fetch evse data based on provided filters
    await this.paginateService(data)

    // Remove missing locations
    await this.updateMissingLocationsToRemoved(data)

    return data
  }

  public async deltaEvseDataRequest(): Promise<ProcessDataDto> {
    // Build input process data to use in pagination
    const { url, body, source, operatorIds, dynamicOperatorIds } =
      await this.prepareDeltaEvseDataInput()
    const data = this.buildProcessData(url, body, source, operatorIds, dynamicOperatorIds)

    // Fetch evse data based on provided filters
    await this.paginateService(data)

    return data
  }

  public async pullEvseStatusJobProcess(): Promise<IEvseStatusJobInput> {

    // Build evse status job input data
    const { url, body, operatorIds } =
      await this.prepareEvseStatusJobInput()
    
    // Request all evses status from Hubject 
    const evseStatusesRecords = await this.requestEvseStatus(url, body, operatorIds)

    // Get db chargers by evse id to compare status change and send notification to users
    const evseStatusMap = await this.getEvseIdChargersMap(evseStatusesRecords)

    // Update charger and evses status
    const notifyUsersAvailableCharger = await this.updateEvsesAndChargerStatus(evseStatusMap, evseStatusesRecords)

    // Notify users that plug is available (no need to await)
    notifyUsersAvailableCharger.length && NotificationsLibrary.notifyUsersAboutAvailableCharger(notifyUsersAvailableCharger)

    return { url, body, operatorIds }
  }

  public async getEvseStatusById(evseId: string): Promise<string> {
    const {url, body} = this.prepareEvseStatusByIdInput([evseId])
    const [evseStatusRecord] = await this.requestEvseStatusById(url, body)
    const [ status, subStatus ] = [
      this.oicpEvseStatusToPlugStatus(evseStatusRecord?.EvseStatus),
      this.oicpEvseStatusToPlugSubStatus(evseStatusRecord?.EvseStatus),
    ]
    this.updateEvseAndNotifyUsers(evseId, status, subStatus)
    return subStatus
  }

  private buildProcessData(
    url: string,
    body: PullEvseDataDto,
    source: string,
    operatorIds: string[] | undefined,
    dynamicOperatorIds: string[] | undefined,
  ): ProcessDataDto {
    return {
      start: new Date(),
      isLastPage: false,
      isFirstPage: true,
      page: EvseConstants.paginationRequest.page,
      size: EvseConstants.paginationRequest.size,
      numberOfElements: 0,
      url,
      body,
      source,
      operatorIds,
      dynamicOperatorIds,
      mode: body.LastCall
        ? PaginationRequestMode.delta
        : PaginationRequestMode.full,
    }
  }

  private async paginateService(data: ProcessDataDto): Promise<void> {
    try {
      while (!data.isLastPage || data.isFirstPage) {
        // Request
        const response = await firstValueFrom(
          this.httpService.post(
            `${data.url}?page=${data.page}&size=${data.size}`,
            data.body,
          ),
        )

        const { content, totalPages, last, first, numberOfElements } =
          response.data
        const chargers = await this.getOcpiLocationsFromEvseData(content, data)
        chargers.length &&
          (await ChargersLibrary.bulkWriteChargers(chargers, false))

        // Update values for next iteration
        console.log({
          page: data.page,
          size: data.size,
          host: `${data.url}?page=${data.page}&size=${data.size}`,
          totalPages: totalPages,
        })
        data.page++
        data.isLastPage = last
        data.isFirstPage = first
        data.numberOfElements += numberOfElements
      }
    } catch (error: any) {
      data.page = -1
      this.logger.error(error?.response?.data)
    }
  }

  private async getOcpiLocationsFromEvseData(
    evseList: IPullEvseDataRecordType[],
    data: ProcessDataDto,
  ): Promise<IUpdateOneOperation[]> {
    const source = data.source

    // Map with the operations to the bulk write after each iteration
    const mapBulkOperationByHwId: Map<string, IUpdateOneOperation> = new Map()

    /**
     * Map with the chargers to check in db if the evse already exists
     * or if it can be aggregated to another charger through the hwId
     */
    const mapChargerByHwId = await this.getBulkChargersToMap(evseList, source)

    /**
     * Map with the operator and default tariffs that should be associated to the evse.
     * Later the tariff can be replaced on the evse pricing if the operator is DYNAMIC
     */
    const mapTariffByType = await this.getBulkTariffsToMap(evseList)

    for (const evse of evseList) {
      const hwId = this.generateHwId(evse)

      await this.locationUpdatePipeline(
        evse,
        data,
        mapBulkOperationByHwId,
        mapChargerByHwId,
        mapTariffByType,
        source,
        hwId
      )
    }

    return Array.from(mapBulkOperationByHwId.values())
  }

  private async locationUpdatePipeline(
    evse: IPullEvseDataRecordType,
    data: ProcessDataDto,
    mapBulkOperationByHwId: Map<string, IUpdateOneOperation>,
    mapChargerByHwId: Map<string, ICharger>,
    mapTariffByType: Map<string, ITariff[]>,
    source: string,
    hwId: string
  ) : Promise<void> {
    (
      // Check if the operator is one of the allowed by EVIO
      !this.isValidOperator(evse.OperatorID, data.operatorIds) ||
      // Check if the evse is to be deleted (only in delta mode)
      this.updateEvseToRemoved(evse,hwId,mapChargerByHwId,mapBulkOperationByHwId) ||
      // Check if the evse location has already been created in memory
      this.tryMatchFromMemory(evse, hwId, mapBulkOperationByHwId, mapTariffByType, data.dynamicOperatorIds) ||
      // Check if the evse location has already been created in db
      this.tryMatchByHwId(evse,hwId,mapChargerByHwId,mapBulkOperationByHwId, mapTariffByType, data.dynamicOperatorIds) ||
      // Create the location in the db since no corresponding location was found in previous checks
      await this.createLocation(evse, hwId, source, mapBulkOperationByHwId, mapTariffByType)
    )
  }


  private async buildLocation(
    evse: IPullEvseDataRecordType,
    hwId: string,
    source: string,
    mapTariffByType: Map<string, ITariff[]>,
  ): Promise<ICharger> {
    const {
      OperatorID: partyId,
      OperatorName: operator,
      Address,
      ChargingStationNames,
      AccessibilityLocation,
      GeoCoordinates,
      ChargingStationImage,
      lastUpdate: lastUpdated,
    } = evse

    const { Country: country, TimeZone } = Address

    const { latitude, longitude } = this.extractEvseCoordinates(GeoCoordinates)

    const { countryCode } = alpha3CountryMapper[country]

    let location = {
      hwId,
      chargerType: ChargerTypes.Hubject,
      source,
      network: source,
      status: ChargerStatus.Unavailable,
      subStatus: ChargerSubStatus.Unknown,
      operationalStatus: ChargerOperationStatuses.Approved,
      countryCode,
      partyId,
      operator,
      country,
      name: this.getLocationName(ChargingStationNames),
      address: this.getLocationAddress(Address),
      parkingType: this.getLocationParkingType(AccessibilityLocation),
      geometry: this.getLocationGeometry(latitude, longitude),
      availability: { availabilityType: AvailabilityType.Always },
      imageContent: ChargingStationImage ? [ChargingStationImage] : [],
      rating: 0,
      plugs: this.buildPlugs(evse, mapTariffByType),
      timeZone: TimeZone || this.getLocationTimeZone(latitude, longitude),
      originalCoordinates: this.getLocationGeometry(latitude, longitude),
      lastUpdated: lastUpdated || new Date().toISOString(),
    }

    // location = await ensureCountryCode(location, 'buildLocation')

    return location
  }

  private buildPlugs(
    evse: IPullEvseDataRecordType, 
    mapTariffByType: Map<string, ITariff[]>,
    ): IPlug[] {
    const {
      Plugs: plugs,
      ChargingFacilities: facilities,
      IsHubjectCompatible: hasRemoteCapabilities,
      AuthenticationModes: authenticationModes,
      EvseID: evseId,
      Address: address,
      lastUpdate: lastUpdated,
      OperatorID: partyId,
    } = evse

    return plugs.map((plug, index) => {
      const { format, powerType } = this.getPowerTypeAndFormatForPlug(plug)
      const {
        Voltage: voltage,
        Amperage: amperage,
        Power: power,
      } = this.matchFacilityWithPowerType(powerType, facilities) || {}
      const capabilities = this.mapAuthenticationModesToCapabilities(
        authenticationModes,
        hasRemoteCapabilities,
      )
      const cpoTariff = TariffsService.getOperatorOrDefaultTariffOnMap(
        mapTariffByType,
        partyId,
        alpha3CountryMapper[address?.Country].countryCode,
        power
      ) as ITariff

      return {
        plugId: `${evseId}-${index + 1}`,
        uid: evseId,
        evse_id: evseId,
        connectorFormat: format,
        connectorPowerType: powerType,
        connectorType: this.mapConnectorType(plug),
        voltage,
        amperage,
        power,
        status: PlugStatus.Unavailable,
        subStatus: EVSEStatuses.Unknown,
        /**
         * On an initial state, every charger has a default tariff (type OPERATOR or DEFAULT),
         * then, if the EVSE has a tariff on the EVSE pricing endpoint, it will be updated accordingly.
         */
        tariffId: [cpoTariff?.id ?? defaultCpoTariffId],
        capabilities,
        floorLevel: address?.Floor,
        hasRemoteCapabilities,
        lastUpdated,
        serviceCost: this.getEmptyServiceCost(cpoTariff && [cpoTariff]),
        updatedAt: new Date(),
        statusChangeDate: new Date(),
      }
    })
  }

  private matchFacilityWithPowerType(
    powerType: string,
    facilities: IChargingFacility[],
  ): IChargingFacility {
    const facility = facilities.find(
      (facility) => facility.PowerType === powerType,
    )
    return facility || facilities[0]
  }

  private mapConnectorType(plug: string): string {
    switch (plug.trim()) {
      case OicpConnectorType.CHAdeMO:
        return ConnectorType.CHADEMO

      case OicpConnectorType.CCSCombo2PlugCableAttached:
        return ConnectorType.CCS2

      case OicpConnectorType.CCSCombo1PlugCableAttached:
        return ConnectorType.CCS1

      case OicpConnectorType.Type2ConnectorCableAttached:
      case OicpConnectorType.Type2Outlet:
        return ConnectorType.TYPE2

      case OicpConnectorType.Type1ConnectorCableAttached:
        return ConnectorType.J1772

      case OicpConnectorType.NEMA520:
        return ConnectorType.NEMA_515

      case OicpConnectorType.TypeFSchuko:
        return ConnectorType.SCHUKO_EU

      case OicpConnectorType.Type3Outlet:
        return ConnectorType.TYPE3C

      default:
        return plug
    }
  }

  private generateCoordinateLocationId(
    evse: IPullEvseDataRecordType,
    decimals: number = EvseConstants.coordinatesAggregation.precisionDecimals,
  ): string {
    /**
     *
     * Decimal Places	| Approx. Accuracy	| Grouping Impact
     *
     * 2              |	~1.1 km	          | Way too coarse — entire neighborhoods
     * 3	            | ~110 m	          | Might group stations across the street
     * 4	            | ~11 m	            | same parking lot, but not too wide
     * 5	            | ~1.1 m	          | Very precise — might miss same station w/ minor GPS error
     * 6	            | ~11 cm	          | Overkill, will likely break grouping unless coords are perfect
     *
     */

    const { latitude, longitude } = this.extractEvseCoordinates(
      evse.GeoCoordinates,
    )

    const latNum = parseFloat(latitude)
    const lngNum = parseFloat(longitude)

    const latPrefix = latNum >= 0 ? 'N' : 'S'
    const lngPrefix = lngNum >= 0 ? 'E' : 'W'

    const roundedLat = Math.abs(latNum).toFixed(decimals)
    const roundedLng = Math.abs(lngNum).toFixed(decimals)

    return `LOC_${latPrefix}${roundedLat}_${lngPrefix}${roundedLng}_${evse.OperatorID}`
  }

  private getLocationName(
    names: { lang: string; value: string }[],
    language: string = 'en',
  ): string {
    return (
      names?.find(
        (name) =>
          name?.lang?.toLowerCase() === language ||
          name?.lang?.toLowerCase().includes(language),
      )?.value ||
      names?.[0]?.value ||
      ''
    )
  }

  private getLocationParkingType(
    accessibilityLocation: string | undefined,
  ): string | undefined {
    switch (accessibilityLocation) {
      case OicpParkingType.OnStreet:
        return ParkingType.Street
      case OicpParkingType.ParkingLot:
        return ParkingType.OutdoorParking
      case OicpParkingType.ParkingGarage:
        return ParkingType.CoverParking
      case OicpParkingType.UndergroundParkingGarage:
        return ParkingType.CoverParking
      default:
        return accessibilityLocation || ParkingType.Street
    }
  }

  private getLocationTimeZone(
    latitude: string,
    longitude: string,
  ): string | null {
    try {
      return geoTz.find(parseFloat(latitude), parseFloat(longitude))[0] || null
    } catch (error) {
      return null
    }
  }

  private getLocationGeometry(latitude: string, longitude: string): IGeometry {
    return {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
    }
  }

  private getLocationAddress(address: IAddressIso19773): IAddress {
    const {
      countryCode,
      countryName: country,
    } = alpha3CountryMapper[address.Country]
    return {
      street: address.Street,
      zipCode: address.PostalCode,
      city: address.City,
      country,
      countryCode,
    }
  }

  private getPowerTypeAndFormatForPlug(plug: string): {
    powerType:
      | ConnectorPowerType.AC1
      | ConnectorPowerType.AC3
      | ConnectorPowerType.DC
    format: ConnectorFormat.Socket | ConnectorFormat.Cable
  } {
    switch (plug) {
      case OicpConnectorType.SmallPaddleInductive:
      case OicpConnectorType.LargePaddleInductive:
      case OicpConnectorType.AVCONConnector:
      case OicpConnectorType.TeslaConnector:
      case OicpConnectorType.Type1ConnectorCableAttached:
        return {
          powerType: ConnectorPowerType.AC1,
          format: ConnectorFormat.Cable,
        }

      case OicpConnectorType.NEMA520:
      case OicpConnectorType.TypeEFrenchStandard:
      case OicpConnectorType.TypeFSchuko:
      case OicpConnectorType.TypeGBritishStandard:
      case OicpConnectorType.TypeJSwissStandard:
      case OicpConnectorType.IEC60309SinglePhase:
        return {
          powerType: ConnectorPowerType.AC1,
          format: ConnectorFormat.Socket,
        }

      case OicpConnectorType.Type2Outlet:
      case OicpConnectorType.Type3Outlet:
        return {
          powerType: ConnectorPowerType.AC3,
          format: ConnectorFormat.Socket,
        }

      case OicpConnectorType.Type2ConnectorCableAttached:
      case OicpConnectorType.IEC60309ThreePhase:
        return {
          powerType: ConnectorPowerType.AC3,
          format: ConnectorFormat.Cable,
        }

      case OicpConnectorType.CCSCombo1PlugCableAttached:
      case OicpConnectorType.CCSCombo2PlugCableAttached:
      case OicpConnectorType.CHAdeMO:
        return {
          powerType: ConnectorPowerType.DC,
          format: ConnectorFormat.Cable,
        }

      default:
        return {
          powerType: ConnectorPowerType.AC1,
          format: ConnectorFormat.Cable,
        }
    }
  }

  private mapAuthenticationModesToCapabilities(
    modes: string[],
    hasRemoteCapabilities: boolean,
  ): string[] {
    if (!modes || modes.length === 0) return []

    const capabilities = new Set<string>()

    for (const mode of modes) {
      switch (mode) {
        case OicpEvseCapability.NfcRfidClassic:
        case OicpEvseCapability.NfcRfidDesfire:
          capabilities.add(OcpiEvseCapability.RfidReader)
          break

        case OicpEvseCapability.Remote:
          capabilities.add(OcpiEvseCapability.RemoteStartStopCapable)
          break

        case OicpEvseCapability.DirectPayment:
          capabilities.add(OcpiEvseCapability.CreditCardPayable)
          break

        default:
          capabilities.add(mode)
          break
      }
    }

    if (!hasRemoteCapabilities) {
      capabilities.delete(OcpiEvseCapability.RemoteStartStopCapable)
    }

    return Array.from(capabilities)
  }

  private getEmptyServiceCost(tariffs: ITariff[] = []): IServiceCost {
    return {
      initialCost: 0,
      costByTime: [
        {
          uom: 'min',
          cost: 0,
        },
      ],
      costByPower: {
        uom: 'kWh',
        cost: 0,
      },
      elements: [],
      tariffs,
      currency: 'EUR',
    }
  }

  private updateEvseOnCharger(
    charger: ICharger,
    evse: IPullEvseDataRecordType,
    mapTariffByType: Map<string, ITariff[]>,
    dynamicOperatorIds: string[] | undefined,
  ): void {
    const plugToUpdate = charger.plugs.find(
      (plug) => plug.evse_id === evse.EvseID,
    )
    const otherPlugs = charger.plugs.filter(
      (plug) => plug.evse_id !== evse.EvseID,
    )

    // Get dynamic info before adding new updated plugs
    const plug = plugToUpdate as IPlug;
    const isDynamicOperator = dynamicOperatorIds?.includes(evse.OperatorID);
    const dynamicInfo = {
      status: plug.status,
      subStatus: plug.subStatus,
      statusChangeDate: plug.statusChangeDate,
      ...(isDynamicOperator && {
        tariffId: plug.tariffId,
        serviceCost: plug.serviceCost,
      }),
    };

    const newPlugs = this.buildPlugs(evse, mapTariffByType).map(
      this.keepDynamicInfoInPlug(dynamicInfo),
    );

    charger.plugs = [...otherPlugs, ...newPlugs]
    charger.operationalStatus = ChargerOperationStatuses.Approved
    charger.lastUpdated = this.compareLastUpdatedDates(
      charger.lastUpdated,
      evse.lastUpdate,
    )
  }

  private keepDynamicInfoInPlug(dynamicInfo: {
    status: string
    subStatus: string
    tariffId?: string[]
    serviceCost?: IServiceCost,
  }): (plug: IPlug) => IPlug {
    return (plug) => {
      return {
        ...plug,
        ...dynamicInfo,
      }
    }
  }

  private pushEvseToCharger(
    charger: ICharger,
    evse: IPullEvseDataRecordType,
    mapTariffByType: Map<string, ITariff[]>,
  ): void {
    charger.plugs = [...charger.plugs, ...this.buildPlugs(evse, mapTariffByType)]
    charger.operationalStatus = ChargerOperationStatuses.Approved
    charger.lastUpdated = this.compareLastUpdatedDates(
      charger.lastUpdated,
      evse.lastUpdate,
    )
  }

  private setChargersOnMappers(
    mapBulkOperationByHwId: Map<string, IUpdateOneOperation>,
    charger: ICharger,
  ): void {
    mapBulkOperationByHwId.set(charger.hwId, this.buildBulkWriteBody(charger))
  }

  private tryMatchByHwId(
    evse: IPullEvseDataRecordType,
    hwId: string,
    mapChargerByHwId: Map<string, ICharger>,
    mapBulkOperationByHwId: Map<string, IUpdateOneOperation>,
    mapTariffByType: Map<string, ITariff[]>,
    dynamicOperatorIds: string[] | undefined
  ): boolean {
    const foundCharger = mapChargerByHwId.get(hwId)
    if (!foundCharger) return false

    this.addEvseToCharger(foundCharger, evse, mapTariffByType, dynamicOperatorIds)
    this.setChargersOnMappers(mapBulkOperationByHwId, foundCharger)
    return true
  }

  private tryMatchFromMemory(
    evse: IPullEvseDataRecordType,
    hwId: string,
    mapBulkOperationByHwId: Map<string, IUpdateOneOperation>,
    mapTariffByType: Map<string, ITariff[]>,
    dynamicOperatorIds: string[] | undefined
  ): boolean {
    const foundBulkWriteCharger = mapBulkOperationByHwId.get(hwId)
    if (!foundBulkWriteCharger) return false

    const charger = foundBulkWriteCharger['updateOne']['update']['$set']
    this.addEvseToCharger(charger, evse, mapTariffByType, dynamicOperatorIds)
    this.setChargersOnMappers(mapBulkOperationByHwId, charger)
    return true
  }

  private buildBulkWriteBody(charger: ICharger): IUpdateOneOperation {
    return {
      updateOne: {
        filter: { hwId: charger.hwId, source: charger.source },
        update: {
          $set: charger,
          $setOnInsert: { createdAt: new Date() },
          $currentDate: { updatedAt: true },
        },
        upsert: true,
      },
    }
  }

  private generateHwId(evse: IPullEvseDataRecordType): string {
    if (
      !this.isValidDecimalCoordinates(
        evse.GeoCoordinates?.DecimalDegree?.Latitude,
        evse.GeoCoordinates?.DecimalDegree?.Longitude,
      )
    ) {
      return evse.EvseID
    }
    return (
      (evse.ChargingStationID &&
        `${evse.ChargingStationID}_${evse.OperatorID}`) ||
      this.generateCoordinateLocationId(evse)
    )
  }

  private addEvseToCharger(
    charger: ICharger,
    evse: IPullEvseDataRecordType,
    mapTariffByType: Map<string, ITariff[]>,
    dynamicOperatorIds: string[] | undefined,
  ): void {
    const isToUpdate = charger.plugs.some(
      (plug) => plug.evse_id === evse.EvseID,
    )
    if (isToUpdate) {
      this.updateEvseOnCharger(charger, evse, mapTariffByType, dynamicOperatorIds)
    } else {
      this.pushEvseToCharger(charger, evse, mapTariffByType)
    }
  }

  private isValidDecimalCoordinates(lat: string, lng: string): boolean {
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)
    return (
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180 &&
      !(latitude === 0 && longitude === 0)
    )
  }

  private async updateMissingLocationsToRemoved({
    start,
    page,
    mode,
    source,
  }: {
    start: Date
    page: number
    mode: string
    source: string
  }): Promise<void> {
    if (mode === PaginationRequestMode.full && page >= 0) {
      try {
        // Update chargers accordingly
        await this.updateLocationsToRemoved(start, source)
        await this.updateEvsesToRemoved(start, source)
      } catch (error) {
        console.log('Error while updating chargers to REMOVED')
      }
    }
  }

  private async updateLocationsToRemoved(
    start: Date,
    source: string,
  ): Promise<void> {
    const locationsQuery = {
      source,
      updatedAt: { $lt: start },
    }

    const locationsData = {
      status: ChargerStatus.Unavailable,
      subStatus: ChargerSubStatus.Unknown,
      operationalStatus: ChargerOperationStatuses.Removed,
    }

    await ChargersLibrary.updatePublicChargers(locationsQuery, locationsData)
  }

  private async updateEvsesToRemoved(
    start: Date,
    source: string,
  ): Promise<void> {
    const evsesQuery = {
      source,
      'plugs.updatedAt': { $lt: start },
    }

    const evsesData = {
      'plugs.$[plug].status': PlugStatus.Unavailable,
      'plugs.$[plug].subStatus': EVSEStatuses.Removed
    }

    const evsesOptions = {
      arrayFilters: [{ 'plug.updatedAt': { $lt: start } }],
    }
    await ChargersLibrary.updatePublicChargerWithOptions(
      evsesQuery,
      evsesData,
      evsesOptions,
    )
  }

  private async bulkLoadChargersByHwId(
    hwIds: string[],
    source: string,
  ): Promise<Map<string, ICharger>> {
    const projection = {
      _id: 0,
      lastUpdated: 1,
      hwId: 1,
      source: 1,
      plugs: 1,
      geometry: 1,
    }
    const existingByHwId = await ChargersLibrary.findManyPublicChargersByHwId(
      hwIds,
      source,
      projection,
    )

    const mapChargerByHwId: Map<string, ICharger> = new Map(
      existingByHwId.map((station) => [station.hwId, station]),
    )

    return mapChargerByHwId
  }

  private getHwIdsList(evses: IPullEvseDataRecordType[]): string[] {
    return evses
      .map((evse) => this.generateHwId(evse))
  }

  private async createLocation(
    evse: IPullEvseDataRecordType,
    hwId: string,
    source: string,
    mapBulkOperationByHwId: Map<string, any>,
    mapTariffByType: Map<string, ITariff[]>,
  ): Promise<void> {
    const newLocation = await this.buildLocation(evse, hwId, source, mapTariffByType)
    this.setChargersOnMappers(mapBulkOperationByHwId, newLocation)
  }

  private extractEvseCoordinates(geoCoordinates: IGeoCoordinatesType): {
    latitude: string
    longitude: string
  } {
    const { Latitude: latitude, Longitude: longitude } =
      geoCoordinates?.DecimalDegree

    if (!this.isValidDecimalCoordinates(latitude, longitude)) {
      return {
        latitude: '0',
        longitude: '0',
      }
    }
    return { latitude, longitude }
  }

  private async getBulkChargersToMap(
    evses: IPullEvseDataRecordType[],
    source: string,
  ): Promise<Map<string, ICharger>> {
    const hwIds = this.getHwIdsList(evses)

    // Bulk load existing chargers by hwId into a Map
    const mapChargerByHwId = await this.bulkLoadChargersByHwId(hwIds, source)

    return mapChargerByHwId
  }

  private updateEvseToRemoved(
    evse: IPullEvseDataRecordType,
    hwId: string,
    mapChargerByHwId: Map<string, ICharger>,
    mapBulkOperationByHwId: Map<string, IUpdateOneOperation>,
  ): boolean {
    if (evse.deltaType === OicpDeltaType.Delete) {
      let charger = mapChargerByHwId.get(hwId)
      if (charger) {
        const foundChargerInMemory = mapBulkOperationByHwId.get(charger.hwId)
        if (foundChargerInMemory) {
          charger = foundChargerInMemory['updateOne']['update']['$set']
        }
        this.updateEvseStatusToRemoved(charger, evse.EvseID)
        this.setChargersOnMappers(mapBulkOperationByHwId, charger)
      }
      return true
    }
    return false
  }

  private updateEvseStatusToRemoved(charger: ICharger, evseId: string): void {
    charger.plugs = charger.plugs.map((plug) => {
      if (plug.evse_id === evseId) {
        plug.status = PlugStatus.Unavailable
        plug.subStatus = EVSEStatuses.Removed
      }
      return plug
    })
  }

  public isValidCountry(country: string): boolean {
    const countryList = [...this.aditionalCountries, ...AllowedCountries3]
    return countryList.includes(country)
  }

  private compareLastUpdatedDates(
    chargerDate: string | undefined,
    evseDate: string | undefined,
  ): string | undefined {
    if (!chargerDate || !evseDate) return chargerDate
    const chargerDateObj = new Date(chargerDate)
    const evseDateObj = new Date(evseDate)
    return evseDateObj > chargerDateObj ? evseDate : chargerDate
  }

  private async prepareFullEvseDataInput(): Promise<{
    url: string
    body: any
    source: string
    operatorIds: string[]
    dynamicOperatorIds: string[]
  }> {
    const url = this.configService.get<string>(
      'oicp.endpoints.evse.data',
    ) as string
    const providerId = this.configService.get<string>(
      'oicp.providerId',
    ) as string
    const activeSubscriptions = await this.subscriptionService.getActiveSubscriptions()
    const operatorIds = this.subscriptionService.extractOperatorIds(activeSubscriptions)
    const dynamicOperatorIds = this.subscriptionService.extractDynamicOperatorIds(activeSubscriptions)
    const source = ChargerNetworks.Hubject
    const body = {
      ProviderID: providerId,
      GeoCoordinatesResponseFormat: OicpGeoCoordinatesType.DecimalDegree,
      OperatorIds: operatorIds,
    }

    return { url, body, source, operatorIds, dynamicOperatorIds }
  }

  private async prepareDeltaEvseDataInput(): Promise<{
    url: string
    body: any
    source: string
    operatorIds: string[],
    dynamicOperatorIds: string[]
  }> {
    const url = this.configService.get<string>(
      'oicp.endpoints.evse.data',
    ) as string
    const providerId = this.configService.get<string>(
      'oicp.providerId',
    ) as string
    const activeSubscriptions = await this.subscriptionService.getActiveSubscriptions()
    const operatorIds = this.subscriptionService.extractOperatorIds(activeSubscriptions)
    const dynamicOperatorIds = this.subscriptionService.extractDynamicOperatorIds(activeSubscriptions)
    const source = ChargerNetworks.Hubject
    const lastCall = await this.getLastCallDate(source)
    const body = {
      ProviderID: providerId,
      GeoCoordinatesResponseFormat: OicpGeoCoordinatesType.DecimalDegree,
      LastCall: lastCall,
    }

    return { url, body, source, operatorIds, dynamicOperatorIds }
  }

  private async getLastCallDate(source: string): Promise<string> {
    const lastCall = await ChargersLibrary.getMostRecentLastUpdatedDate(source)
    const now: Date = new Date()
    const yesterday: string = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString()
    return lastCall ? lastCall.lastUpdated : yesterday
  }

  private isValidOperator(
    operatorId: string,
    operatorIds: string[] | undefined,
  ): boolean {
    return operatorIds ? operatorIds.includes(operatorId) : false
  }

  private async prepareEvseStatusJobInput(
  ): Promise<IEvseStatusJobInput> {
    const url = this.configService.get<string>(
      'oicp.endpoints.evse.statusByOperatorId',
    ) as string
    const providerId = this.configService.get<string>(
      'oicp.providerId',
    ) as string
    const operatorIds = await this.subscriptionService.getOperatorIds()
    const body = {
      ProviderID: providerId,
      OperatorID: operatorIds,
    }

    return { url, body, operatorIds }
  }

  private async requestEvseStatus(
    url: string,
    body: IEvseStatusByOperatorBody,
    operatorIds: string[],
  ): Promise<IEvseStatusRecord[]> {
    try {

      // Request
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          body,
        ),
      )

      const { EvseStatuses, StatusCode } = response.data as IEvseStatusResponse

      if (StatusCode.Code !== '000') {
        this.logger.error(StatusCode)
        return []
      }

      return this.extractEvseStatus(EvseStatuses , operatorIds)
    } catch (error: any) {
      console.log(error)
      this.logger.error(error?.response?.data)
      return []
    }
  }

  private async requestEvseStatusById(
    url: string,
    body: IEvseStatusByOperatorBody,
  ): Promise<IEvseStatusRecord[]> {
    try {

      // Request
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          body,
        ),
      )

      const { EVSEStatusRecords, StatusCode } = response.data as IEVSEStatusByIdResponse

      if (StatusCode.Code !== '000') {
        this.logger.error(StatusCode)
        return []
      }

      return EVSEStatusRecords.EvseStatusRecord
    } catch (error: any) {
      console.log(error)
      this.logger.error(error?.response?.data)
      return []
    }
  }

  private extractEvseStatus(
    statuses: IEvseStatuses,
    operatorIds: string[] | undefined,
  ): IEvseStatusRecord[] {
    return statuses.OperatorEvseStatus
    .filter(operatorEvseStatus => this.isValidOperator(operatorEvseStatus.OperatorID, operatorIds))
    .flatMap(operator => operator.EvseStatusRecord);
  }


  private async getEvseIdChargersMap(
    evseStatusesRecords: IEvseStatusRecord[],
  ): Promise<Map<string, IEvseStatusMap>> {
    
    const evseIds = this.extractEvseIds(evseStatusesRecords);
    const chargers = await ChargersLibrary.findManyPublicChargersByEvseId(
      evseIds,
      ChargerNetworks.Hubject,
      {
        _id: 1,
        hwId: 1,
        "plugs.evse_id": 1,
        "plugs.status": 1,
        "plugs.plugId": 1,
      }
    );
  
    const entries = this.mapChargersToEvseEntries(chargers);
    return new Map<string, IEvseStatusMap>(entries);
  }

  private extractEvseIds(records: IEvseStatusRecord[]): string[] {
    return records.map(record => record.EvseID);
  }
  
  private mapChargersToEvseEntries(
    chargers: ICharger[]
  ): [string, IEvseStatusMap][] {
    return chargers.flatMap((charger: ICharger) =>
      charger.plugs.map((plug: IPlug): [string, IEvseStatusMap] => [
        plug.evse_id,
        this.buildEvseStatusMapEntry(charger, plug)
      ])
    );
  }
  
  private buildEvseStatusMapEntry(
    charger: ICharger, 
    plug: IPlug
  ): IEvseStatusMap {
    return {
      hwId: charger.hwId,
      status: plug.status,
      plugId: plug.plugId,
      _id: charger._id,
    };
  }
  

  private oicpEvseStatusToPlugStatus(
    evseStatus: string
  ): string {
    switch (evseStatus) {
      case OicpEvseStatus.Available:
        return PlugStatus.Available
      case OicpEvseStatus.Reserved:
        return PlugStatus.Booked
      case OicpEvseStatus.Occupied:
        return PlugStatus.InUse
      case OicpEvseStatus.OutOfService:
        return PlugStatus.Unavailable
      case OicpEvseStatus.EvseNotFound:
        return PlugStatus.Unavailable
      case OicpEvseStatus.Unknown:
        return PlugStatus.Unavailable
      default:
        return PlugStatus.Unavailable
    }
  }

  private oicpEvseStatusToPlugSubStatus(
    evseStatus: string
  ): string {
    switch (evseStatus) {
      case OicpEvseStatus.Available:
        return EVSEStatuses.Available
      case OicpEvseStatus.Reserved:
        return EVSEStatuses.Reserved
      case OicpEvseStatus.Occupied:
        return EVSEStatuses.Charging
      case OicpEvseStatus.OutOfService:
        return EVSEStatuses.OutOfOrder
      case OicpEvseStatus.EvseNotFound:
        return EVSEStatuses.Removed
      case OicpEvseStatus.Unknown:
        return EVSEStatuses.Unknown
      default:
        return EVSEStatuses.Unknown
    }
  }

  private async updateChargersStatus(
    operations: IPlugUpdateOperation[],
  ): Promise<void> {
    const ids = operations.map((operation) => operation.updateOne.filter._id)
    await Promise.all([
      this.setChagersToUnavailable(ids),
      this.setChagersToAvailable(ids)
    ])
  }

  private async setChagersToUnavailable(
    ids: Types.ObjectId[],
  ): Promise<void> {
    const queryUnavailableChargers = {
      _id: { $in: ids },
      plugs: {
        $not: {
          $elemMatch: { status: { $ne: PlugStatus.Unavailable } }
        }
      },
      operationalStatus: { $ne: ChargerOperationStatuses.Removed }
    }

    const updateUnavailableChargers = {
      status : ChargerStatus.Unavailable,
      subStatus : ChargerSubStatus.Unknown
    }

    await ChargersLibrary.updatePublicChargerWithOptions(queryUnavailableChargers,updateUnavailableChargers)
  }

  private async setChagersToAvailable(
    ids: Types.ObjectId[],
  ): Promise<void> {
    const queryAvailableChargers = {
      _id: { $in: ids },
      plugs: {
          $elemMatch: { status: { $ne: PlugStatus.Unavailable } }
      },
      operationalStatus: { $ne: ChargerOperationStatuses.Removed }
    }

    const updateAvailableChargers = {
      status : ChargerStatus.Available,
      subStatus : ChargerSubStatus.Available
    }

    await ChargersLibrary.updatePublicChargerWithOptions(queryAvailableChargers,updateAvailableChargers)
  }

  private buildEvseStatusUpdateOperations(
    evseStatusMap: Map<string, IEvseStatusMap>,
    evseStatusesRecords: IEvseStatusRecord[]
  ): {
    evseStatusBulkOperations: IPlugUpdateOperation[]
    notifyUsersAvailableCharger: Partial<INotifyUsersAvailableCharger>[]
  } {

    const evseStatusBulkOperations = [] as IPlugUpdateOperation[]
    const notifyUsersAvailableCharger = [] as Partial<INotifyUsersAvailableCharger>[]

    for (const record of evseStatusesRecords) {
      const { EvseID: evseId, EvseStatus: newStatus } = record;
      const { hwId, status: oldPlugStatus, plugId, _id } = evseStatusMap.get(evseId) || {};

      // Convert OICP status to EVIO status and substatus
      const newPlugStatus = this.oicpEvseStatusToPlugStatus(newStatus)
      const newSubStatus = this.oicpEvseStatusToPlugSubStatus(newStatus)

      // If there's no old plug status or if the new status is the same as the old one, skip the update
      if (!oldPlugStatus || oldPlugStatus === newPlugStatus) {
        continue;
      }
      
      // If the new plug status is 'Available', add to the notification array
      if (newPlugStatus === PlugStatus.Available) {
        notifyUsersAvailableCharger.push({ hwId, plugId });
      }
      
      // Build and add the update operation
      const operation = this.buildBulkEvseStatusUpdateOperation(
        evseId,
        newPlugStatus,
        newSubStatus,
        _id
      );
      evseStatusBulkOperations.push(operation);   
    }

    return {evseStatusBulkOperations, notifyUsersAvailableCharger }
  }

  private async updateEvsesAndChargerStatus(
    evseStatusMap: Map<string, IEvseStatusMap>,
    evseStatusesRecords: IEvseStatusRecord[],
  ): Promise<Partial<INotifyUsersAvailableCharger>[]> {

    // Build evse status update operations and the array to notify users of available chargers
    const {
      evseStatusBulkOperations, 
      notifyUsersAvailableCharger
    } = this.buildEvseStatusUpdateOperations(evseStatusMap, evseStatusesRecords)

    // Update evses and chargers
    await this.bulkUpdateEvseStatus(evseStatusBulkOperations)
    await this.updateChargersStatus(evseStatusBulkOperations)

    return notifyUsersAvailableCharger
  }

  private buildBulkEvseStatusUpdateOperation(
    evseId: string,
    newPlugStatus: string,
    newSubStatus: string,
    _id?: string
  ): IPlugUpdateOperation {
    return {
      updateOne: {
        filter: { 
          _id: new Types.ObjectId(_id)
        },
        update: { 
          $set: { 
            "plugs.$[plug].status": newPlugStatus,
            "plugs.$[plug].subStatus": newSubStatus,
            "plugs.$[plug].statusChangeDate": new Date(),
            "plugs.$[plug].updatedAt": new Date(),
          },
          $currentDate: { updatedAt: true },
        },
        arrayFilters: [{ "plug.evse_id": evseId }]
      }
    }
  }
  
  private async bulkUpdateEvseStatus(
    operations: IPlugUpdateOperation[],
    coordinatesActive: boolean = false
  ): Promise<void> {
    operations.length && (await ChargersLibrary.bulkWriteChargers(operations, coordinatesActive))
  }

  private prepareEvseStatusByIdInput(
    evseIds : string[],
  ): {
    url: string, 
    body: IEvseStatusByIdBody
  } {

    const url = this.configService.get<string>(
      'oicp.endpoints.evse.statusById',
    ) as string
    const providerId = this.configService.get<string>(
      'oicp.providerId',
    ) as string

    const body = {
      ProviderID: providerId,
      EvseID: evseIds
    }
    return { url, body }
  }  

  private async updateEvseAndNotifyUsers(
    evseId: string,
    status: string,
    subStatus: string
  ): Promise<void> {
    try {
      const chargerBeforeUpdate = await ChargersLibrary.updateEvseStatus(
        evseId, 
        status, 
        subStatus,
        ChargerNetworks.Hubject, 
        {
          _id: 1,
          hwId: 1,
          "plugs.evse_id": 1,
          "plugs.status": 1,
          "plugs.plugId": 1
        }
      )

      const { 
        status: oldPlugStatus, 
        plugId
      } = chargerBeforeUpdate?.plugs.find((plug) => plug.evse_id === evseId) || {}
      
      this.updateChargerOnEvseStatusUpdate(
        chargerBeforeUpdate,
        evseId,
        status,
        subStatus
      )

      if (
        !oldPlugStatus || 
        oldPlugStatus === status || 
        status !== PlugStatus.Available
      ) {
        return
      }
      
      NotificationsLibrary.notifyUsersAboutAvailableCharger(
        [
          { 
            hwId: chargerBeforeUpdate.hwId, 
            plugId
          }
        ]
      )
    } catch (error) {
      console.error("Error in updateEvseAndNotifyUsers", error)
    }

  }

  private updateChargerOnEvseStatusUpdate(
    chargerBeforeUpdate: ICharger,
    evseId: string,
    status: string,
    subStatus: string,
  ): void {
    const plugsAfterUpdate = chargerBeforeUpdate?.plugs.map((plug) => {
      if (plug.evse_id === evseId) {
        plug.status = status
        plug.subStatus = subStatus
      }
      return plug
    })

    if (!plugsAfterUpdate) return

    const chargerId = new Types.ObjectId(chargerBeforeUpdate._id)

    const isAvailableCharger = plugsAfterUpdate.some(
      (plug) => plug.status !== PlugStatus.Unavailable,
    )
    isAvailableCharger
      ? this.setChagersToAvailable([chargerId])
      : this.setChagersToUnavailable([chargerId])
  }

  private async getBulkTariffsToMap(
    evses: IPullEvseDataRecordType[],
  ): Promise<Map<string, ITariff[]>> {
    const operatorIds = [... new Set(evses.map(({OperatorID}) => OperatorID))]
    const countries = [... new Set(evses.map(({Address}) => alpha3CountryMapper[Address?.Country].countryCode))]
    return await TariffsService.mapOperatorAndDefaultTariffs(operatorIds, countries)
  }
}
