import { OcpiTariffType, OcpiEnergySource, OcpiEnvironmentalImpact } from 'evio-library-commons'


interface ITariffAltText {
  language: string
  text: string
}

interface IPrice {
  excl_vat: number
  incl_vat?: number
}

export interface ITariffElement {
  price_components: IPriceComponent[]
  restrictions?: ITariffRestrictions
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

export interface IEnergyMix {
  is_green_energy: boolean;
  energy_sources?: IEnergySource[];
  environ_impact?: IEnvironmentalImpact[];
  supplier_name?: string;
  energy_product_name?: string;
}

export interface IEnergySource {
  source: OcpiEnergySource; 
  percentage: number;       
}

export interface IEnvironmentalImpact {
  category: OcpiEnvironmentalImpact; 
  amount: number;
}

export interface IAmountWithUom {
  uom: string;   
  value: number;
}

export interface IEvioCommission {
  minAmount?: IAmountWithUom;
  transaction?: IAmountWithUom;
}

export interface ITariffConfig {
  activationFee: number;
  bookingAmount: IAmountWithUom;
  chargingAmount: IAmountWithUom;
  parkingDuringChargingAmount: IAmountWithUom;
  parkingAmount: IAmountWithUom;
  evioCommission?: IEvioCommission;
}

export interface ISalesTariff {
  id: string;
  name: string;
  tariffType?: string; 
  tariff?: ITariffConfig;
  createUser: string;
  modifyUser?: string;
  billingType: string;
  clientName: string; 
  status: string;
  country_code?: string;
  party_id?: string;
  currency: string;
  type: OcpiTariffType;
  tariff_alt_text?: ITariffAltText[];
  tariff_alt_url?: string;
  min_price?: IPrice;
  max_price?: IPrice;
  elements: ITariffElement[];
  energy_mix?: IEnergyMix;
  start_date_time?: string;
  end_date_time?: string;
  _id: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

type IBaseMappedTariff = Pick<
  ISalesTariff,
  "_id" | "name" | "billingType" | "type" | "currency" | "elements"
>;

export interface ISalesTariffMapped extends IBaseMappedTariff {
  min_price?: number;
  max_price?: number;
}