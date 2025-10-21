import { ICharger, IPrice  } from '@/modules/evse/evse.interface'
import { TokenTypes, EmspTariffTypes } from 'evio-library-commons'


interface IPaymentConditions {
  paymentType: string
  paymentMethod: string
  paymentMethodId: string
  walletAmount: number
  reservedAmount: number
  confirmationAmount: number
  userIdWillPay: string
  userIdToBilling: string
  adyenReference: string
  transactionId: string | null
  clientType: string
  clientName: string
}

export interface ICdrToken {
  uid: string
  type: string
  contract_id: string
}

export interface IAddress {
  city?: string
  street: string
  zipCode: string
  country?: string
  countryCode?: string
}

export interface IChargingSession extends IPaymentConditions {
  _id: string
  chargerType: string
  source: string
  location_id: string
  kwh: number
  auth_method: string
  token_uid: string
  token_type: TokenTypes
  status: string
  id: string
  commandResultStart: string
  last_updated: string
  command: string
  cdrId: string
  address: IAddress
  paymentStatus: string
  userId: string
  evOwner: string
  evId?: string
  total_cost: {
    excl_vat: number
    incl_vat: number
  }
  cdr_token: ICdrToken
  connector_id: string
  tariffCEME: IEmspTariff
  tariffOPC: ITariff
  country_code: string
  evse_uid: string
  party_id: string
  chargeOwnerId?: string
  roamingOperatorID?: string
  start_date_time: string
  operator?: string
  createdWay: string
  plugPower: number
  plugVoltage: number
  timeZone: string
  invoiceLines?: IInvoiceLine[],
  fees : IFees
  suspensionReason?: string | null
  minimumBillingConditions?: boolean
  finalPrices: IFinalPrices
  timeCharged: number
  totalPower : number
  CO2Saved: number
  end_date_time: string
  total_energy: number,
  charging_periods: IChargingPeriod[],
  local_start_date_time : string
  local_end_date_time: string
  updatedAt?: Date
  paymentId?: string | null
  paymentSubStatus?: string
  invoiceStatus?: boolean
  invoiceId?: string
  invoiceSubStatus?: string
  evDetails: IEvDetails
  fleetDetails: IFleetDetails
  userIdInfo: IUserInfo
  userIdWillPayInfo: IUserInfo
  userIdToBillingInfo: IUserInfo
  endOfEnergyDate: string
  billingPeriod: string
}

export interface IUserInfo {
  _id: string
  clientName: string
  clientType: string
  country: string
  imageContent: string
  internationalPrefix: string
  language: string
  mobile: string
  name: string
  operatorId: string
  paymentPeriod: string
}

export interface IEvDetails {
  primatyEV: boolean
  status: string
  hasFleet: boolean
  usageNumber: number
  clientName: string
  acceptKMs: boolean
  updateKMs: boolean
  _id: string
  brand: string
  model: string
  version: string
  evType: string
  vehicleId: string
  imageContent: string
  fleet: string
  licensePlate: string
  country: string
  otherInfo: string
  userId: string
  invoiceCommunication: string
  invoiceType: string
  listOfGroupDrivers: IListOfGroupDrivers[]
  listOfDrivers: IListOfDrivers[]
}

interface IListOfGroupDrivers {
  period: {
    periodType: string
  }
  groupId: string
  name: string
  paymenteBy: string
  billingBy: string
  listOfDrivers: IListOfDrivers[]
}

interface IListOfDrivers {
  _id: string
  period: {
    periodType: string
  }
  userId: string
  driverId: string
  name: string
  paymenteBy: string
  billingBy: string
  internationalPrefix: string
  mobile: string
}

export interface IFleetDetails {
  sharedWithOPC: boolean
  shareEVData: boolean
  clientName: string
  acceptKMs: boolean
  updateKMs: boolean
  _id: string
  createUserId: string
  imageContent: string
  name: string
}


export interface IFees {
  IEC: number
  IVA: number
  countryCode: string
}

export interface ICdr {
  country_code: string
  party_id: string
  credit?: boolean
  id: string
  start_date_time: string
  end_date_time: string
  source: string
  cdr_token: ICdrToken
  session_id: string
  auth_method: string
  cdr_location?: ICdrLocation
  currency: string
  tariffs: ITariff[]
  charging_periods?: IChargingPeriod[]
  total_cost?: ICost
  total_energy: number
  total_time: number
  total_parking_time: number
  last_updated: string
  createdAt: Date
  updatedAt: Date
}

export interface ICdrLocation {
  id: string
  name?: string
  address: string
  city: string
  postal_code: string
  country: string | undefined
  coordinates: ICoordinates
  evse_uid: string
  evse_id: string
  connector_id: string
  connector_standard: string
  connector_format: string
  connector_power_type: string
  connnector_power: number
  connector_voltage: number | undefined
  connector_amperage: number | undefined
}

interface ICoordinates {
  latitude: string
  longitude: string
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
  last_updated: string
  createdAt: Date
  updatedAt: Date
}

interface ITariffTranslation {
  language: string
  text: string
}

interface ITariffElement {
  price_components: IPriceComponent[]
  restrictions: ITariffRestrictions
}

interface ITariffRestrictions {
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

interface IPriceComponent {
  type: string
  price: number
  step_size: number
}
interface IChargingPeriod {
  start_date_time: string
  dimensions: IChargingDimension[]
}

interface IChargingDimension {
  volume: number
  type: string
}
interface ICost {
  excl_vat: number
}

export interface IExtractedEmspUnitPrices {
  flatUnitPrice: number;
  energyUnitPrice: number;
  timeUnitPrice: number;
  percentageUnitPrice: number;
}

export interface IExtractedEmspPrices {
  flat: number
  energy: number
  time: number
  emspPercentage: number
  percentageUnitPrice: number
}

interface IEmspTariffElement {
  type: EmspTariffTypes;
  uom: string;
  price: number;
}

interface ITariffHistory {
  startDate: string;
  stopDate: string;
  tariff: IEmspTariffElement[];
}

export interface IEmspTariff {
  country: string;
  CEME: string;
  planName: string;
  tariff: IEmspTariffElement[];
  tariffsHistory: ITariffHistory[];
  createdAt: Date;
  updatedAt: Date
  clientName: string;
}


export interface IInvoiceLine {
  code: string
  description: string
  unitPrice: number
  uom: string
  quantity: number
  vat: number
  discount: number
  total: number
  taxExemptionReasonCode?: string
}

export interface ICpoFinalPrices {
  opcPrice: IPrice
  opcPriceDetail: any
}

interface ICpoPriceDetail {
  flatPrice: IPrice
  timePrice: IPrice
  powerPrice: IPrice
  parkingTimePrice: IPrice
}

export interface IEmspFinalPrices {
  cemePrice: IPrice
  cemePriceDetail: any
}

interface IEmspPriceDetail {
  flatPrice: IPrice
  timePrice: IPrice
  powerPrice: IPrice
}

export interface IOtherPrice {
  description: string
  price: IPrice
}

export interface ITotalPriceDetail {
  vatPrice: IVat
  totalPrice: IPrice
}

interface IVat {
  vat: number
  value: number
}

export interface IFinalPrices {
  opcPrice: IPrice
  opcPriceDetail: ICpoPriceDetail
  cemePrice: IPrice
  cemePriceDetail: IEmspPriceDetail
  vatPrice: IVat
  othersPrice: IOtherPrice[]
  dimensionsPriceDetail: IDimensionsPriceDetail
  totalPrice: IPrice
}

export interface IDimensionsPriceDetail {
  flatPrice: IPrice
  timePrice: IPrice
  powerPrice: IPrice
  parkingTimePrice: IPrice
}

export interface IUpdateSessionValues {
  timeCharged: number
  totalPower: number
  kwh: number
  CO2Saved: number
  cdrId: string
  start_date_time: string
  end_date_time: string
  total_energy: number
  total_cost: IPrice
  finalPrices: IFinalPrices
  invoiceLines: IInvoiceLine[]
  charging_periods: IChargingPeriod[]
  paymentStatus?: string
  local_start_date_time: string
  local_end_date_time: string
  status?: string
  suspensionReason?: string | null
  minimumBillingConditions?: boolean
  updatedAt?: Date
  paymentId?: string | null
  transactionId?: string | null
  paymentSubStatus?: string
  invoiceStatus?: boolean
  invoiceId?: string
  invoiceSubStatus?: string
}

interface IPaymentAmount {
  currency: string
  value: number
}


export interface IPaymentData {
  amount: IPaymentAmount
  userId: string
  sessionId: string
  listOfSessions: string[]
  hwId: string
  chargerType: string
  paymentMethod: string
  paymentMethodId: string
  transactionId: string | null
  adyenReference: string
  reservedAmount: number
  clientName: string
}

export interface IPaymentsResponse {
  _id?: string 
  transactionId: string | null
  status: string | null
}

export interface IContextData {
  evseId: string
  cdr: ICdr
  session: IChargingSession
  charger: ICharger
  updatedSession: IUpdateSessionValues
  valid: boolean
  paid: boolean
  invoiced : boolean
}




export interface IInvoiceData {
  optionalCountryCodeToVAT: string;
  invoice: {
    paymentId: string;
    header: {
      userId: string;
    };
    lines: IInvoiceLine[];
  };
  attach: {
    overview: {
      footer: IVATSummary;
      lines: {
        evio_services: IVATSummary;
        evio_network: IVATSummary;
        mobie_network: IVATSummary;
        other_networks: IVATSummary;
        hyundai_network: IVATSummary;
        goCharge_network: IVATSummary;
        klc_network: IVATSummary;
        kinto_network: IVATSummary;
      };
    };
    chargingSessions: {
      header: IChargingSessionHeader;
      lines: IChargingSessionLine[];
      summaryAddress: ISummaryAddress[];
      summaryOperator: ISummaryOperator[];
      footer: IVATSummary;
    };
  };
}

interface IVATSummary {
  total_exc_vat: number;
  total_inc_vat?: number; 
  vat?: number;         
}

interface IChargingSessionHeader {
  sessions: number;
  totalTime: string;
  totalEnergy: string;
}

interface IChargingSessionLine {
  date: string;
  startTime: string;
  duration: string;
  network: string;
  country: string;
  hwId: string;
  partyId: string;
  totalPower: number;
  flatCost: number;
  energyCost: number;
  timeCost: number;
  unitPriceRoamingTime: number;
  unitPriceRoamingEnergy: number;
  total_exc_vat: number;
  vat: number;
  total_inc_vat: number;
  startDateTime: string;
  endDateTime: string;
  durationMin: number;
  realTimeCharging: number;
  averagePower: number;
  CO2emitted: number;
  fleetName: string;
  licensePlate: string;
  groupName: string;
  userIdName: string;
  userIdWillPayName: string;
}

interface ISummaryAddress {
  hwId: string;
  city: string;
  voltageLevel: string;
}

interface ISummaryOperator {
  partyId: string;
  operatorName: string;
}

export interface IFee {
    _id: string;
    countryCode: string;
    clientName: string;
    zone: string;
    fees: IFees;
}