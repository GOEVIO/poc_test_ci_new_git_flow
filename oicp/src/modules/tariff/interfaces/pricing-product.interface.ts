export interface IPricingProductData {
  OperatorID: string
  OperatorName: string
  ProviderID: string
  PricingDefaultPrice: number
  PricingDefaultPriceCurrency: string
  PricingDefaultReferenceUnit: string
  PricingProductDataRecords: Array<IPricingProductDataRecord>
}

interface IStatusCode {
  AdditionalInfo: string
  Code: string
  Description: string
}

export interface IPricingProductDataResponse {
  PricingProductData: IPricingProductData[]
  StatusCode: IStatusCode
}

export interface IAdditionalReference {
  AdditionalReferenceUnit: string
  PricePerAdditionalReferenceUnit: number
  AdditionalReference: string
}

interface IPeriod {
  begin: string
  end: string
}

export interface IAvailability {
  on: string
  Periods: IPeriod[]
}

export interface IPricingProductDataRecord {
  ProductID: string
  ReferenceUnit: string
  ProductPriceCurrency: string
  PricePerReferenceUnit: number
  MaximumProductChargingPower: number
  IsValid24hours: boolean
  ProductAvailabilityTimes: Array<IAvailability>
  AdditionalReferences: Array<IAdditionalReference>
}

interface ITariffTranslation {
  language: string
  text: string
}

export interface IPrice {
  excl_vat: number
  incl_vat: number
}

interface IPriceRound {
  round_granularity: string
  round_rule: string
}

interface IStepRound {
  round_granularity: string
  round_rule: string
}

export interface IPriceComponent {
  type: string
  price: number
  vat?: number
  step_size: number
  price_round?: IPriceRound
  step_round?: IStepRound
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
  country?: string
  currentType?: string
}

export interface ITariffElement {
  price_components: IPriceComponent[]
  restrictions: ITariffRestrictions
}

export interface ITariff {
  country_code: string
  party_id: string
  source: string
  id: string
  currency: string
  type: string
  tariff_alt_text?: ITariffTranslation[]
  min_price?: IPrice
  max_price?: IPrice
  elements: ITariffElement[]
  start_date_time?: string
  end_date_time?: string
  last_updated?: string
  userId?: string
  power?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface IUpdateOneOperation {
  updateOne: {
    filter: {
      id: string
    }
    update: {
      $set: ITariff
      $setOnInsert?: {
        createdAt: Date
      }
      $currentDate?: {
        updatedAt: boolean
      }
    }
    upsert?: boolean
  }
}
