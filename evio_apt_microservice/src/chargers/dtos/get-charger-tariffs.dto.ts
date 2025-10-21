import { Expose, Type } from 'class-transformer'
import { OcpiTariffDimenstionType } from 'evio-library-commons'
import { IAddress } from 'evio-library-commons/src/interfaces/adrees.interface'

export class ChargerTariffRestriction {
  @Expose()
  day_of_week?: string[]

  @Expose()
  min_duration?: number

  @Expose()
  start_time?: string

  @Expose()
  end_time?: string

  @Expose()
  start_date?: string

  @Expose()
  end_date?: string

  @Expose()
  min_kwh?: number

  @Expose()
  max_kwh?: number

  @Expose()
  min_current?: number

  @Expose()
  max_current?: number

  @Expose()
  min_power?: number

  @Expose()
  max_power?: number

  @Expose()
  max_duration?: number

  @Expose()
  reservation?: 'RESERVATION' | 'RESERVATION_EXPIRES'
}

export class ChargerPriceComponents {
  _id?: string

  @Expose()
  type?: OcpiTariffDimenstionType

  @Expose()
  price?: number

  @Expose()
  vat?: number

  @Expose()
  step_size?: number

  @Expose()
  uom!: 'UN' | 'min' | 'kWh'

  @Expose()
  currency!: string
}

export class ChargerTariff {
  @Expose()
  @Type(() => ChargerPriceComponents)
  price_components?: ChargerPriceComponents[]

  @Expose()
  @Type(() => ChargerTariffRestriction)
  restrictions?: ChargerTariffRestriction
}

export class ChargerTariffsPlugDto {
  @Expose()
  @Type(() => ChargerTariff)
  activation_fee?: ChargerTariff[]

  @Expose()
  @Type(() => ChargerTariff)
  price_per_kwh?: ChargerTariff[]

  @Expose()
  @Type(() => ChargerTariff)
  price_per_time?: ChargerTariff[]
}

export class ChargerPlugsDto {
  @Expose()
  plugId!: string

  @Expose()
  plugNumber!: number

  @Expose()
  status!: string

  @Expose()
  connectorStatus!: string

  @Expose()
  connectorPowerType!: string

  @Expose()
  connectorType!: string

  @Expose()
  voltage!: number

  @Expose()
  amperage!: number

  @Expose()
  power!: number

  @Type(() => ChargerTariffsPlugDto)
  @Expose()
  tariffs?: ChargerTariffsPlugDto

  @Expose()
  tariffId?: string

  @Expose()
  preauthorisation!: number
}

export class ChargerItemDto {
  @Expose()
  _id!: string

  @Expose()
  chargerId!: string

  @Expose()
  chargerName!: string

  @Expose()
  state!: string

  @Expose()
  accessibility!: string

  @Expose()
  status!: string

  @Expose()
  chargerType!: string

  @Expose()
  voltageLevel!: string

  @Expose()
  operationalStatus!: string

  @Expose()
  address?: IAddress

  @Expose()
  geometry?: { type: string; coordinates: number[] }
}

export class ChargerItemPlugsDto {
  @Type(() => ChargerItemDto)
  @Expose()
  chargerItem!: ChargerItemDto

  @Type(() => ChargerPlugsDto)
  @Expose()
  plugs?: ChargerPlugsDto[]
}

export class GetChargerTariffsDto {
  @Expose()
  totalChargers!: number

  @Expose()
  @Type(() => ChargerItemPlugsDto)
  chargers!: ChargerItemPlugsDto[]
}
