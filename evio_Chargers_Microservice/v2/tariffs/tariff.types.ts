import { OcpiTariffType } from 'evio-library-commons'

export interface TariffAmount {
    uom: string;
    value: number;
}

export interface EvioCommission {
    minAmount: TariffAmount;
    transaction: TariffAmount;
}

export interface TariffDetails {
    activationFee?: number;
    bookingAmount?: TariffAmount;
    chargingAmount?: TariffAmount;
    parkingDuringChargingAmount?: TariffAmount;
    parkingAmount?: TariffAmount;
    evioCommission?: EvioCommission;
}

export interface PlugTariff {
    groupName: string;
    groupId: string;
    tariffId: string;
    fleetName?: string;
    fleetId?: string;
    tariff?: TariffDetails;
    tariffType?: string;
    name?: string;
    imageContent?: string;
    min_price?: IPrice 
    max_price?: IPrice
    type: OcpiTariffType
    currency: string
    elements: ITariffElement[]
}


interface IPrice {
  excl_vat: number
  incl_vat?: number
}

export interface ITariffElement {
  price_components: IPriceComponent[]
  restrictions: ITariffRestrictions
}

export interface IPriceComponent {
  type: string
  price: number
  vat?: number
  step_size: number
  price_round?: IPriceRound
  step_round?: IStepRound
}

interface IPriceRound {
  round_granularity: string
  round_rule: string
}

interface IStepRound {
  round_granularity: string
  round_rule: string
}

export interface ITariffRestrictions {
  _id?: string
  start_date?: string
  end_date?: string
  start_time?: string
  end_time?: string
  min_kwh?: number
  max_kwh?: number
  min_current?: number
  max_current?: number
  min_power?: number
  max_power?: number
  min_duration?: number
  max_duration?: number
  day_of_week?: string[]
  reservation?: string
}