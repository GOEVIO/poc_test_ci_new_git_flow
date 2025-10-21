interface IContractToken {
  tokenType: string
  status: string
  idTagDec: string
  idTagHex: string
  idTagHexInv: string
}

export interface IContractNetwork {
  name: string
  networkName: string
  network: string
  tokens: IContractToken[]
}

export interface IListDriver {
  _id: string
  userId: string
  name: string
  groupId: string
  period: {
    periodType: string
    period: {
      startDate: Date
      stopDate: Date
    }
  }
  paymenteBy: string
  billingBy: string
  mobile: string
  internationalPrefix: string
}

export interface IListOfGroupDrivers {
  _id: string
  clientName: string
  createUser: string
  imageContent: string
  listOfDrivers: IListDriver[]
  name: string
  paymenteBy: string
  billingBy: string
  groupId: string
}

interface IPlug {
  plugType: string
  plugPower: number
}

interface IPlugChargingList {
  plugType: string
  chargePhaseVolt: number
  chargePhaseAmp: number
  chargePhase: number
  chargePower: number
  chargeTime: number
}

interface IPlugFastChargingList {
  plugType: string
  fastChargePower: number
  fastChargeTime: number
  currentType: string
}

interface IEVInfo {
  databaseVehicleId: number
  yearFrom: string
  yearTo: string
  range: number
  useableBatteryCapacity: number
  maxBatteryCapacity: number
  eletricMotorPower: number
  internalChargerPower: number
  internalChargerChargeTime: number
  internalChargerChargeSpeed: number
  maxFastChargingPower: number
  avgFastChargingPower: number
  fastchargeChargeTime: number
  fastchargeChargeSpeed: number
  evType: string
  evEfficiency: number
  consumptionCity: number
  consumptionHighway: number
  plugsChargingTable: IPlugChargingList[]
  plugsFastChargingTable: IPlugFastChargingList[]
  plugs: IPlug[]
}

interface IListOfKms {
  kms: number
  sessionID: string
  chargingDate: Date
  chargerType: string
  kmsDate: Date
  updatedKmsDate: Date
}

export interface IEV {
  _id: string
  brand: string
  model: string
  version: string
  vehicleId: string
  evInfo: IEVInfo
  imageContent: string
  evType: string
  userId: string
  primaryEV: boolean
  status: string
  paymenteBy: string
  sessions: {
    userId: string
    numberOfSessions: number
  }[]
  chargerId: string
  batteryChargingSession: number
  consumptionChargingSession: number
  paymentChargingSession: number
  fleet: string
  hasFleet: boolean
  licensePlate: string
  country: string
  usageNumber: number
  listOfGroupDrivers: IListOfGroupDrivers[]
  listOfDrivers: IListDriver[]
  otherInfo: string
  plafondId: string
  plafond: number
  clientName: string
  invoiceType: string
  invoiceCommunication: string
  acceptKms: boolean
  updateKms: boolean
  listOfKms: IListOfKms[]
  kms: string
}


interface IFleetDetails {
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

export interface IEvInfo {
  evOwner: string;
  invoiceType: string;
  invoiceCommunication: string;
  evDetails: IEV | undefined;
  fleetDetails: IFleetDetails | undefined;
  userId: string;
}

export interface IFees {
  IEC: number
  IVA: number
  countryCode: string
}

export interface IFee {
    _id: string;
    countryCode: string;
    clientName: string;
    zone: string;
    fees: IFees;
}

export interface IUserInfo {
  _id: string;
  mobile: string;
  internationalPrefix: string;
  imageContent: string;
  name: string;
  language: string;
  country: string;
  clientType: string;
  clientName: string;
  operatorId: string;
  paymentPeriod: string;
}

export interface IAllUserInfo {
  userIdInfo: IUserInfo | undefined;
  userIdWillPayInfo: IUserInfo | undefined;
  userIdToBillingInfo: IUserInfo | undefined;
}