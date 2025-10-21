import { Types } from "mongoose";
import {
  ITariff,
} from '@/modules/tariff/interfaces/pricing-product.interface'
export interface ICharger {
  _id?: string
  geometry: IGeometry
  maxServiceCost?: {
    currency: string
    costByTime: ICostByTime[]
    elements: IServiceElement[]
  }
  parkingType: string | undefined
  status: string
  subStatus: string
  chargingDistance?: string
  imageContent?: any[]
  rating?: number
  numberOfSessions?: number
  voltageLevel?: string
  wrongBehaviorStation?: boolean
  operationalStatus: string
  publish?: boolean
  directions?: any[]
  hwId: string
  chargerType: string
  source: string
  partyId: string
  countryCode: string
  cpoCountryCode?: string
  country: string
  name: string
  address: IAddress
  availability?: IAvailability
  plugs: IPlug[]
  network: string
  stationIdentifier?: string
  timeZone: string | null
  lastUpdated?: string
  operatorID?: string
  operator: string
  createdAt?: Date
  updatedAt?: Date
  originalCoordinates?: IGeometry
}

type GeometryType = 'Point'

export interface IGeometry {
  type: GeometryType
  coordinates: [number, number]
}

export interface IAddress {
  street: string
  zipCode: string
  city: string
  country?: string
  countryCode?: string
}

interface IAvailability {
  availabilityType: string
}

export interface IPlug {
  serviceCost: IServiceCost
  tariffId: string[]
  subStatus: string
  capabilities: string[]
  statusSchedule?: any[]
  directions?: any[]
  parkingRestrictions?: any[]
  images?: any[]
  hasRemoteCapabilities: boolean
  co2Emissions?: number | null
  plugId: string
  uid: string
  evse_id: string
  connectorFormat: string
  connectorPowerType: string
  connectorType: string
  voltage?: number
  amperage?: number
  status: string
  statusChangeDate: Date
  termsAndConditions?: string
  lastUpdated?: string
  power: number
  createdAt?: Date
  updatedAt: Date
}

export interface IServiceCost {
  costByPower?: {
    cost: number
    uom: string
  }
  currency?: string
  initialCost?: number
  elements?: IServiceElement[]
  tariffs?: ITariff[]
  costByTime?: ICostByTime[]
}

export interface IPrice {
  excl_vat: number
  incl_vat: number
}

interface IServiceElement {
  price_components: IPriceComponent[]
}

interface IPriceComponent {
  vat: number
  type: string
  price: number
  step_size: number
}

interface ICostByTime {
  minTime?: number
  cost: number
  step_size?: number
  uom: string
}

// Enums and Types
type DeltaType = 'update' | 'insert' | 'delete'
type AccessibilityType =
  | 'Free publicly accessible'
  | 'Restricted access'
  | 'Paying publicly accessible'
  | 'Test Station'
type AccessibilityLocationType =
  | 'OnStreet'
  | 'ParkingLot'
  | 'ParkingGarage'
  | 'UndergroundParkingGarage'
type CalibrationLawDataAvailabilityType = 'Local' | 'External' | 'Not Available'
type DynamicInfoAvailable = 'true' | 'false' | 'auto'
type PlugType = string
type AuthenticationModeType = string
type PaymentOptionType = string
type ValueAddedServiceType = string

export interface IChargingFacility {
  PowerType: string
  Voltage?: number
  Amperage?: number
  Power: number
  ChargingModes?: string[]
}
interface IEnergySource {
  Energy?: string
  Percentage?: number
}
interface IEnvironmentalImpact {
  CO2Emission?: number
  NuclearWaste?: number
}
interface IOpeningTimes {
  Period: {
    begin: string // Format: HH:MM
    end: string // Format: HH:MM
  }
  On: string // e.g., 'Everyday', 'Workdays', etc.
}
interface IInfoText {
  lang: string // ISO language code
  value: string
}
export interface IGeoCoordinatesType {
  Google: string
  DecimalDegree: {
    Latitude: string
    Longitude: string
  }
  DegreeMinuteSeconds: {
    Latitude: string
    Longitude: string
  }
}
export interface IAddressIso19773 {
  Country: string
  City: string
  Street: string
  PostalCode: string
  HouseNum: string
  Floor?: string
  Region?: string
  ParkingFacility?: boolean
  ParkingSpot?: string
  TimeZone?: string
}

export interface IPullEvseDataRecordType {
  deltaType?: DeltaType
  lastUpdate?: string
  EvseID: string
  ChargingPoolID?: string
  ChargingStationID?: string
  ChargingStationNames: IInfoText[]
  HardwareManufacturer?: string
  ChargingStationImage?: string
  SubOperatorName?: string
  Address: IAddressIso19773
  GeoCoordinates: IGeoCoordinatesType
  Plugs: PlugType[]
  DynamicPowerLevel?: boolean
  ChargingFacilities: IChargingFacility[]
  RenewableEnergy: boolean
  EnergySource?: IEnergySource[]
  EnvironmentalImpact?: IEnvironmentalImpact
  CalibrationLawDataAvailability: CalibrationLawDataAvailabilityType
  AuthenticationModes: AuthenticationModeType[]
  MaxCapacity?: number
  PaymentOptions: PaymentOptionType[]
  ValueAddedServices: ValueAddedServiceType[]
  Accessibility: AccessibilityType
  AccessibilityLocation?: AccessibilityLocationType
  HotlinePhoneNumber: string
  AdditionalInfo?: IInfoText[]
  ChargingStationLocationReference?: IInfoText[]
  GeoChargingPointEntrance?: IGeoCoordinatesType
  IsOpen24Hours: boolean
  OpeningTimes?: IOpeningTimes[]
  HubOperatorID?: string
  ClearinghouseID?: string
  IsHubjectCompatible: boolean
  DynamicInfoAvailable: DynamicInfoAvailable
  OperatorID: string
  OperatorName: string
}

export interface IUpdateOneOperation {
  updateOne: {
    filter: {
      hwId: string
      source: string
    }
    update: {
      $set: ICharger
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

export interface IEvseStatusJobInput {
  url: string
  body: IEvseStatusByOperatorBody,
  operatorIds: string[]
}

export interface IEvseStatusByOperatorBody {
  ProviderID : string
  OperatorID?: string[]
}

export interface IEvseStatusRecord {
  EvseID: string;
  EvseStatus: string;
}

interface IOperatorEvseStatus {
  EvseStatusRecord: IEvseStatusRecord[];
  OperatorID: string;
  OperatorName: string;
}

export interface IEvseStatuses {
  OperatorEvseStatus: IOperatorEvseStatus[];
}

interface IStatusCode {
  AdditionalInfo: string;
  Code: string;
  Description: string;
}

export interface IEvseStatusResponse {
  EvseStatuses: IEvseStatuses;
  StatusCode: IStatusCode;
}


export interface IEvseStatusMap {
  hwId: string;
  status: string;
  plugId: string;
  _id?: string;
}

export interface IPlugUpdateOperation {
  updateOne: {
    filter: {
      _id: Types.ObjectId;
    };
    update: {
      $set: {
        "plugs.$[plug].status": string;
        "plugs.$[plug].subStatus": string;
        "plugs.$[plug].statusChangeDate": Date;
        "plugs.$[plug].updatedAt": Date;
      };
      $currentDate: {
        updatedAt: true;
      };
    };
    arrayFilters: Array<{
      "plug.evse_id": string;
    }>;
  };
}

export interface INotifyUsersAvailableCharger {
  hwId: string;
  plugId: string;
}

export interface IEvseStatusByIdBody {
  ProviderID : string
  EvseID: string[]
}

interface IEVSEStatusByIdRecord {
  EvseID: string;
  EvseStatus: string;
}

export interface IEVSEStatusByIdRecords {
  EvseStatusRecord: IEVSEStatusByIdRecord[];
}

export interface IEVSEStatusByIdResponse {
  EVSEStatusRecords: IEVSEStatusByIdRecords;
  StatusCode: IStatusCode;
}
